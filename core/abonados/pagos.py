"""
Registro de pagos de abonados: transacciones y comprobantes en el nuevo esquema de BD.
"""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
import re

from django.db import transaction
from django.utils import timezone

from core.sunat.comprobantes import normalizar_tipo_comprobante, sistema_emitir_comprobante
from core.models.models_generados import Abonados, FacturacionPagos, ServiciosAbonados


def _decimal(value, default='0'):
    try:
        return Decimal(str(value or default))
    except (InvalidOperation, TypeError):
        return Decimal(default)


def _mapear_metodo_ui_a_db(metodo_ui):
    """Mapea el método de pago del UI al valor del ENUM de PostgreSQL (siempre minúsculas)."""
    m = (metodo_ui or 'efectivo').lower()
    if m in ('yape', 'transferencia', 'plin', 'tarjeta', 'deposito'):
        return m
    return 'efectivo'


def _resolve_cliente_id(cliente_id_val):
    if not cliente_id_val:
        return None
    from core.abonados.geoutils import parse_cliente_id
    try:
        parsed = parse_cliente_id(cliente_id_val)
        if str(parsed).isdigit():
            return int(parsed)
    except Exception:
        pass
    return None


def _es_cargo_plan_renovable(cargo):
    desc_lower = (cargo.descripcion or '').lower()
    if bool(getattr(cargo, 'cuota_mensual_indexada', False)):
        return True
    if 'mensualidad' in desc_lower:
        return True
    if 'plan' in desc_lower and 'financiamiento' not in desc_lower and 'deuda' not in desc_lower:
        return True
    return False


def _es_cargo_servicio_obligatorio(cargo=None, descripcion=None, tipo_documento=None):
    desc_lower = (descripcion or getattr(cargo, 'descripcion', '') or '').lower()
    desc_norm = ' '.join(desc_lower.split())
    tipo_doc = (tipo_documento or getattr(cargo, 'tipo_documento', '') or '').lower()
    if cargo is not None and bool(getattr(cargo, 'cuota_mensual_indexada', False)):
        return True
    if tipo_doc in ('boleta', 'factura'):
        return True
    if desc_norm == 'servicio' or desc_norm.startswith('pago de servicio'):
        return True
    patrones = ('mensualidad', 'cuota mensual', 'pago adelanto', 'adelanto', 'plan ')
    return any(p in desc_lower for p in patrones)


def _ids_cargos_pagados_por_abonos(servicio):
    abonos = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='abono',
    )
    montos_por_cargo = {}
    for abono in abonos:
        match = re.search(r'\[PAGO_CARGO_ID:\s*(\d+)\]', abono.descripcion or '')
        if not match:
            continue
        cargo_id = int(match.group(1))
        montos_por_cargo[cargo_id] = montos_por_cargo.get(cargo_id, Decimal('0')) + (abono.monto or Decimal('0'))
    return montos_por_cargo


def _descripcion_abono_cargo(deuda, extras=''):
    marker = f" [PAGO_CARGO_ID: {deuda.id}]"
    extras = extras or ''
    if len(marker) + len(extras) > 255:
        extras = extras[:255 - len(marker)]
    base = f"Pago de {deuda.descripcion or 'Cobro de servicio'}"
    max_base_len = 255 - len(marker) - len(extras)
    return f"{base[:max_base_len]}{marker}{extras}"


def sistema_actualizar_fecha_corte_por_pagos(servicio):
    """
    Extiende el corte solo por cargos de plan/mensualidad completamente pagados.
    Otras deudas pueden generar mora/corte, pero no renuevan el ciclo del plan.
    """
    if not servicio:
        return None

    montos_pagados = _ids_cargos_pagados_por_abonos(servicio)
    ultimo_vencimiento_plan_pagado = None

    cargos_plan = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='cargo',
    ).order_by('fecha_vencimiento', 'id')

    for cargo in cargos_plan:
        if not _es_cargo_plan_renovable(cargo) or not cargo.fecha_vencimiento:
            continue
        monto_cargo = cargo.monto or Decimal('0')
        monto_pagado = montos_pagados.get(cargo.id, Decimal('0'))
        if monto_cargo <= 0 or monto_pagado >= monto_cargo:
            ultimo_vencimiento_plan_pagado = cargo.fecha_vencimiento

    if not ultimo_vencimiento_plan_pagado:
        return None

    plan = getattr(servicio, 'plan', None)
    dias_gracia = getattr(plan, 'dias_gracia', None)
    if dias_gracia is None:
        dias_gracia = 5

    nueva_fecha_corte = ultimo_vencimiento_plan_pagado + timedelta(days=int(dias_gracia))
    servicio.fecha_limite_corte = nueva_fecha_corte.isoformat()
    servicio.save(update_fields=['control_operativo_json'])
    return nueva_fecha_corte


def sistema_agregar_beneficio(servicio_id, tipo_beneficio, descuento_porcentaje, nota, fecha_expiracion=None):
    """
    Agrega un beneficio al servicio con nota guardada.
    tipo_beneficio: 'instalacion_gratis', 'reconexion_gratis', 'descuento_especial', etc.
    """
    from core.models.models_generados import ServiciosAbonados
    
    try:
        servicio = ServiciosAbonados.objects.get(pk=servicio_id)
    except ServiciosAbonados.DoesNotExist:
        raise ValueError('Servicio no encontrado')
    
    if not isinstance(servicio.control_operativo_json, dict):
        servicio.control_operativo_json = {}
    
    if 'beneficios' not in servicio.control_operativo_json:
        servicio.control_operativo_json['beneficios'] = {}
    
    from datetime import datetime
    if fecha_expiracion:
        if isinstance(fecha_expiracion, str):
            fecha_exp = datetime.fromisoformat(fecha_expiracion).isoformat()
        else:
            fecha_exp = fecha_expiracion.isoformat()
    else:
        fecha_exp = None
    
    servicio.control_operativo_json['beneficios'][tipo_beneficio] = {
        'estado': 'activo',
        'descuento_porcentaje': float(descuento_porcentaje),
        'nota': nota,
        'fecha_creacion': datetime.now().isoformat(),
        'fecha_expiracion': fecha_exp,
        'creado_por': 'sistema'
    }
    
    servicio.save(update_fields=['control_operativo_json'])
    return {'status': 'success', 'beneficio': servicio.control_operativo_json['beneficios'][tipo_beneficio]}


def sistema_eliminar_beneficio(servicio_id, tipo_beneficio):
    """
    Elimina o desactiva un beneficio del servicio.
    """
    from core.models.models_generados import ServiciosAbonados
    
    try:
        servicio = ServiciosAbonados.objects.get(pk=servicio_id)
    except ServiciosAbonados.DoesNotExist:
        raise ValueError('Servicio no encontrado')
    
    if not isinstance(servicio.control_operativo_json, dict):
        servicio.control_operativo_json = {}
    
    if 'beneficios' in servicio.control_operativo_json and tipo_beneficio in servicio.control_operativo_json['beneficios']:
        servicio.control_operativo_json['beneficios'][tipo_beneficio]['estado'] = 'inactivo'
        servicio.save(update_fields=['control_operativo_json'])
        return {'status': 'success', 'message': f'Beneficio {tipo_beneficio} desactivado'}
    
    return {'status': 'error', 'message': 'Beneficio no encontrado'}


def sistema_obtener_beneficios_activos(servicio_id):
    """
    Retorna los beneficios activos de un servicio.
    """
    from core.models.models_generados import ServiciosAbonados
    
    try:
        servicio = ServiciosAbonados.objects.get(pk=servicio_id)
    except ServiciosAbonados.DoesNotExist:
        return []
    
    if not isinstance(servicio.control_operativo_json, dict):
        return []
    
    beneficios = servicio.control_operativo_json.get('beneficios', {})
    activos = []
    
    from datetime import datetime
    hoy = date.today()
    
    for key, beneficio in beneficios.items():
        if isinstance(beneficio, dict) and beneficio.get('estado') == 'activo':
            # Verificar expiración
            fecha_expiracion = beneficio.get('fecha_expiracion')
            if fecha_expiracion:
                try:
                    if isinstance(fecha_expiracion, str):
                        fecha_exp = datetime.fromisoformat(fecha_expiracion).date()
                    else:
                        fecha_exp = fecha_expiracion
                    if fecha_exp < hoy:
                        continue  # Expirado, no incluir
                except (ValueError, AttributeError):
                    pass
            
            activos.append({
                'tipo': key,
                'descuento_porcentaje': beneficio.get('descuento_porcentaje'),
                'nota': beneficio.get('nota'),
                'fecha_creacion': beneficio.get('fecha_creacion'),
                'fecha_expiracion': fecha_expiracion
            })
    
    return activos


def _aplicar_descuento_activo(servicio, monto_base, concepto):
    """
    Verifica y aplica descuentos activos del servicio.
    Retorna: (monto_con_descuento, descuento_aplicado, info_descuento)
    """
    if not servicio or not isinstance(servicio.control_operativo_json, dict):
        return monto_base, Decimal('0'), None
    
    concept_lower = (concepto or '').lower()
    if 'adelanto' in concept_lower or 'meses' in concept_lower or 'anexo' in concept_lower:
        return monto_base, Decimal('0'), None
    
    control = servicio.control_operativo_json
    oferta = control.get('oferta', {})
    beneficios = control.get('beneficios', {})
    
    descuento_total = Decimal('0')
    info_descuento = None
    
    # Verificar descuento de oferta aprobada — comparación por mes calendario
    if oferta and oferta.get('estado') == 'aprobada':
        descuento_pct = _decimal(oferta.get('descuento_plan') or 0)
        mes_inicio = oferta.get('mes_inicio', '')
        mes_fin = oferta.get('mes_fin', '')

        # Fallback: si no tiene mes_inicio/mes_fin, usar meses_descuento_usados (legado)
        if descuento_pct > 0 and mes_inicio and mes_fin:
            mes_actual = date.today().strftime('%Y-%m')
            if mes_inicio <= mes_actual <= mes_fin:
                descuento_monto = monto_base * (descuento_pct / Decimal('100'))
                descuento_total += descuento_monto
                meses_restantes = 0
                try:
                    yi, mi = int(mes_fin[:4]), int(mes_fin[5:7])
                    ya, ma = int(mes_actual[:4]), int(mes_actual[5:7])
                    meses_restantes = max(0, (yi * 12 + mi) - (ya * 12 + ma))
                except Exception:
                    pass
                info_descuento = {
                    'tipo': 'oferta',
                    'porcentaje': float(descuento_pct),
                    'monto': float(descuento_monto),
                    'mes_restante': meses_restantes,
                    'periodo': f"{mes_inicio} → {mes_fin}",
                }
        elif descuento_pct > 0:
            # Modo legado: contar meses usados
            meses_descuento = int(oferta.get('meses_descuento') or 0)
            meses_usados = int(oferta.get('meses_descuento_usados') or 0)
            if meses_descuento > 0 and meses_usados < meses_descuento:
                descuento_monto = monto_base * (descuento_pct / Decimal('100'))
                descuento_total += descuento_monto
                info_descuento = {
                    'tipo': 'oferta',
                    'porcentaje': float(descuento_pct),
                    'monto': float(descuento_monto),
                    'mes_restante': meses_descuento - meses_usados - 1,
                }
                oferta['meses_descuento_usados'] = meses_usados + 1
                servicio.control_operativo_json['oferta'] = oferta
                servicio.save(update_fields=['control_operativo_json'])
    
    # VerificarBenefits activos (instalación gratis, reconexión gratis)
    if beneficios:
        from datetime import datetime
        hoy = date.today()
        
        for key, beneficio in beneficios.items():
            if isinstance(beneficio, dict) and beneficio.get('estado') == 'activo':
                # Verificar si el beneficio no ha expirado
                fecha_expiracion = beneficio.get('fecha_expiracion')
                if fecha_expiracion:
                    try:
                        if isinstance(fecha_expiracion, str):
                            fecha_exp = datetime.fromisoformat(fecha_expiracion).date()
                        else:
                            fecha_exp = fecha_expiracion
                        if fecha_exp < hoy:
                            # Beneficio expirado, marcar como expirado
                            beneficio['estado'] = 'expirado'
                            servicio.control_operativo_json['beneficios'][key] = beneficio
                            servicio.save(update_fields=['control_operativo_json'])
                            continue
                    except (ValueError, AttributeError):
                        pass
                
                descuento_pct = _decimal(beneficio.get('descuento_porcentaje') or 0)
                if descuento_pct > 0:
                    descuento_monto = monto_base * (descuento_pct / Decimal('100'))
                    descuento_total += descuento_monto
                    
                    if not info_descuento:
                        info_descuento = {
                            'tipo': key,
                            'porcentaje': float(descuento_pct),
                            'monto': float(descuento_monto),
                            'nota': beneficio.get('nota', '')
                        }
                    else:
                        # Si hay múltiples descuentos, combinar
                        info_descuento['monto'] += float(descuento_monto)
                        info_descuento['tipo'] = f"múltiple ({info_descuento['tipo']}, {key})"
    
    monto_final = max(Decimal('0'), monto_base - descuento_total)
    return monto_final, descuento_total, info_descuento


@transaction.atomic
def _corregir_tipo_comprobante_por_servicio(tipo_comp, servicio, es_plan_pago):
    """
    Si es pago por servicio (plan/mensualidad), obliga a BOLETA o FACTURA según si tiene RUC.
    Los otros conceptos pueden quedar como nota_venta.
    """
    tipo = normalizar_tipo_comprobante(tipo_comp, default='NOTA_VENTA')
    if es_plan_pago:
        if tipo in ('BOLETA', 'FACTURA'):
            return tipo
        cliente = servicio.cliente
        tiene_ruc = cliente and cliente.ruc and len(str(cliente.ruc).strip()) == 11
        if tiene_ruc:
            return 'FACTURA'
        return 'BOLETA'
    return tipo


@transaction.atomic
def sistema_registrar_pago_cliente(datos):
    """
    datos: personal_id, sede_id, cliente_id, suministro_id, deuda_id (opcional),
           monto, metodo_pago, monto_efectivo, monto_digital, numero_operacion,
           ruc_emisor_id, tipo_comprobante, concepto, abrir_turno_si_falta, evidencia_url
    """
    personal_id = datos.get('personal_id')
    sede_id = datos.get('sede_id')
    if not personal_id or not sede_id:
        raise ValueError('personal_id y sede_id requeridos')

    monto_total = _decimal(datos.get('monto'))
    if monto_total <= 0:
        raise ValueError('Monto de pago inválido')

    cliente_id = _resolve_cliente_id(datos.get('cliente_id'))
    deuda_id = datos.get('deuda_id')
    suministro_id = datos.get('suministro_id')

    # 1. Fetch service (suscripcion)
    servicio = None
    es_plan_pago = False
    deuda = None
    concepto = None
    if deuda_id:
        try:
            deuda = FacturacionPagos.objects.get(pk=deuda_id)
            servicio = deuda.servicio
            es_plan_pago = _es_cargo_servicio_obligatorio(deuda)
        except FacturacionPagos.DoesNotExist:
            raise ValueError('Cargo de deuda no encontrado')
    else:
        # Find service by suministro_id and client_id
        if suministro_id:
            servicio = ServiciosAbonados.objects.filter(
                cliente_id=cliente_id,
                numero_suministro=suministro_id
            ).first()
        if not servicio and datos.get('suscripcion_id'):
            servicio = ServiciosAbonados.objects.filter(
                cliente_id=cliente_id,
                codigo=datos.get('suscripcion_id')
            ).first()
        if not servicio:
            servicio = ServiciosAbonados.objects.filter(
                cliente_id=cliente_id
            ).first()

        if not servicio:
            raise ValueError('No se encontró un servicio activo para este cliente')

        concepto = (datos.get('concepto') or 'Pago de servicio')[:255]
        es_plan_pago = _es_cargo_servicio_obligatorio(descripcion=concepto)

    tipo_comp = _corregir_tipo_comprobante_por_servicio(datos.get('tipo_comprobante'), servicio, es_plan_pago)

    # Aplicar descuento automático si corresponde
    monto_con_descuento = monto_total
    descuento_aplicado = Decimal('0')
    info_descuento = None
    
    if es_plan_pago and not deuda_id:
        monto_con_descuento, descuento_aplicado, info_descuento = _aplicar_descuento_activo(servicio, monto_total, concepto)
        if descuento_aplicado > 0:
            # Actualizar el monto a cobrar con el descuento aplicado
            monto_total = monto_con_descuento

    if deuda_id:
        if getattr(deuda, 'tipo_documento', '').lower() != tipo_comp.lower():
            deuda.tipo_documento = tipo_comp.lower()
            deuda.save(update_fields=['tipo_documento'])
    else:
        # Create the cargo first
        deuda = FacturacionPagos.objects.create(
            servicio=servicio,
            ruc_emisor_id=int(datos.get('ruc_emisor_id') or 1),
            tipo_documento=tipo_comp.lower(),
            tipo_transaccion='cargo',
            monto=monto_total,
            descripcion=concepto,
            vendedor_id=personal_id,
            fecha_transaccion=timezone.now(),
            fecha_vencimiento=date.today(),
            fecha_creacion=timezone.now(),
        )
        if servicio.deuda_acumulada is None:
            servicio.deuda_acumulada = Decimal('0')
        servicio.deuda_acumulada += monto_total
        servicio.save(update_fields=['deuda_acumulada'])

    # 2. Record the payment (abono)
    metodo_ui = _mapear_metodo_ui_a_db(datos.get('metodo_pago'))
    
    saldo_anterior = servicio.deuda_acumulada or Decimal('0')
    nuevo_saldo = max(Decimal('0'), saldo_anterior - monto_total)

    extras_pago = ''
    if datos.get('evidencia_url'):
        extras_pago += f" | Evidencia: {datos.get('evidencia_url')}"
    desc_pago = _descripcion_abono_cargo(deuda, extras_pago)

    pago_trans = FacturacionPagos.objects.create(
        servicio=servicio,
        ruc_emisor_id=int(datos.get('ruc_emisor_id') or 1),
        caja_id=datos.get('caja_id'),
        tipo_documento=tipo_comp.lower(),
        tipo_transaccion='abono',
        metodo_pago=metodo_ui.lower(),
        monto=monto_total,
        saldo_anterior=saldo_anterior,
        saldo_posterior=nuevo_saldo,
        descripcion=desc_pago,
        usuario_id=personal_id,
        vendedor_id=personal_id,
        fecha_transaccion=timezone.now(),
        fecha_creacion=timezone.now(),
    )

    # Update service debt
    servicio.deuda_acumulada = nuevo_saldo
    servicio.save(update_fields=['deuda_acumulada'])

    # 3. Emit Comprobante — no crítico
    comprobante = None
    if datos.get('emitir_comprobante', True) and datos.get('ruc_emisor_id'):
        try:
            comprobante = sistema_emitir_comprobante(
                cliente_id=cliente_id,
                ruc_emisor_id=int(datos['ruc_emisor_id']),
                sede_id=int(sede_id),
                tipo_comprobante=tipo_comp,
                monto_total=monto_total,
                items_descripcion=deuda.descripcion or 'Cobro de servicio',
            )
            if comprobante and comprobante.get('numero'):
                pago_trans.numero_documento = comprobante['numero']
                pago_trans.save(update_fields=['numero_documento'])
        except Exception as e:
            import logging
            logging.getLogger('core.pago_cliente').warning(f"Comprobante no emitido: {e}")
            comprobante = {'tipo': tipo_comp, 'numero': None, 'error': str(e)}

    sistema_actualizar_fecha_corte_por_pagos(servicio)

    return {
        'deuda_id': deuda.id,
        'transaccion_ids': [pago_trans.id],
        'monto_pagado': float(monto_total),
        'comprobante': comprobante,
        'turno_id': 1, # Return dummy shift ID
    }


@transaction.atomic
def sistema_registrar_multipago_cliente(datos):
    """
    datos: {
        'personal_id': int,
        'sede_id': int,
        'cliente_id': str/int,
        'suministro_id': str,
        'metodo_pago': str,
        'ruc_emisor_id': int,
        'suscripcion_id': int/str (opcional),
        'pagos': [
            {
                'deuda_id': int,
                'monto': float/str,
                'tipo_comprobante': str  # 'boleta', 'factura', 'nota_venta'
            },
            ...
        ]
    }
    """
    personal_id = datos.get('personal_id')
    sede_id = datos.get('sede_id')
    if not personal_id or not sede_id:
        raise ValueError('personal_id y sede_id requeridos')

    cliente_id = _resolve_cliente_id(datos.get('cliente_id'))
    suministro_id = datos.get('suministro_id')
    metodo_ui = _mapear_metodo_ui_a_db(datos.get('metodo_pago'))
    ruc_emisor_id = int(datos.get('ruc_emisor_id') or 1)

    # 1. Fetch service (suscripcion)
    servicio = None
    if suministro_id:
        servicio = ServiciosAbonados.objects.filter(
            cliente_id=cliente_id,
            numero_suministro=suministro_id
        ).first()
    if not servicio and datos.get('suscripcion_id'):
        try:
            sub_id = int(datos.get('suscripcion_id'))
            servicio = ServiciosAbonados.objects.filter(cliente_id=cliente_id, id=sub_id).first()
        except (ValueError, TypeError):
            pass
    if not servicio:
        servicio = ServiciosAbonados.objects.filter(cliente_id=cliente_id).first()

    if not servicio:
        raise ValueError('No se encontró un servicio activo para este cliente')

    pagos = datos.get('pagos', [])
    if not pagos:
        raise ValueError('No se enviaron pagos a registrar')

    transacciones_abonos_ids = []
    comprobantes_emitidos = []
    total_pagado = Decimal('0')

    for p in pagos:
        deuda_id = int(p.get('deuda_id') or 0)
        monto_pago = _decimal(p.get('monto'))
        tipo_comp_input = p.get('tipo_comprobante') or 'nota_venta'

        if monto_pago <= 0:
            continue

        # Find or create cargo
        es_plan_pago = False
        if deuda_id > 0:
            try:
                deuda = FacturacionPagos.objects.get(pk=deuda_id)
                es_plan_pago = _es_cargo_servicio_obligatorio(deuda)
            except FacturacionPagos.DoesNotExist:
                raise ValueError(f'Cargo de deuda ID {deuda_id} no encontrado')
        else:
            concepto_cargo = (p.get('concepto') or 'Pago de deuda general')[:255]
            es_plan_pago = _es_cargo_servicio_obligatorio(descripcion=concepto_cargo)

        tipo_comp = _corregir_tipo_comprobante_por_servicio(tipo_comp_input, servicio, es_plan_pago)

        # Aplicar descuento automático si corresponde
        monto_pago_con_descuento = monto_pago
        descuento_aplicado = Decimal('0')
        info_descuento = None
        
        if es_plan_pago and deuda_id == 0:
            monto_pago_con_descuento, descuento_aplicado, info_descuento = _aplicar_descuento_activo(servicio, monto_pago, concepto_cargo)
            if descuento_aplicado > 0:
                # Actualizar el monto a cobrar con el descuento aplicado
                monto_pago = monto_pago_con_descuento

        if deuda_id > 0:
            if getattr(deuda, 'tipo_documento', '').lower() != tipo_comp.lower():
                deuda.tipo_documento = tipo_comp.lower()
                deuda.save(update_fields=['tipo_documento'])
        else:
            # Create general debt cargo first
            deuda = FacturacionPagos.objects.create(
                servicio=servicio,
                ruc_emisor_id=ruc_emisor_id,
                tipo_documento=tipo_comp.lower(),
                tipo_transaccion='cargo',
                monto=monto_pago,
                descripcion=concepto_cargo,
                vendedor_id=personal_id,
                fecha_transaccion=timezone.now(),
                fecha_vencimiento=date.today(),
                fecha_creacion=timezone.now(),
            )
            if servicio.deuda_acumulada is None:
                servicio.deuda_acumulada = Decimal('0')
            servicio.deuda_acumulada += monto_pago
            servicio.save(update_fields=['deuda_acumulada'])

        # Now, register the abono (payment transaction)
        saldo_anterior = servicio.deuda_acumulada or Decimal('0')
        nuevo_saldo = max(Decimal('0'), saldo_anterior - monto_pago)

        extras_pago = ''
        if datos.get('numero_operacion'):
            extras_pago += f" | Op: {datos.get('numero_operacion')}"
        if datos.get('evidencia_url'):
            extras_pago += f" | Evidencia: {datos.get('evidencia_url')}"
        desc_pago = _descripcion_abono_cargo(deuda, extras_pago)

        pago_trans = FacturacionPagos.objects.create(
            servicio=servicio,
            ruc_emisor_id=ruc_emisor_id,
            caja_id=datos.get('caja_id'),
            tipo_documento=tipo_comp.lower(),
            tipo_transaccion='abono',
            metodo_pago=metodo_ui.lower(),
            monto=monto_pago,
            saldo_anterior=saldo_anterior,
            saldo_posterior=nuevo_saldo,
            descripcion=desc_pago,
            usuario_id=personal_id,
            vendedor_id=personal_id,
            fecha_transaccion=timezone.now(),
            fecha_creacion=timezone.now(),
        )

        transacciones_abonos_ids.append(pago_trans.id)
        total_pagado += monto_pago

        # Update service debt
        servicio.deuda_acumulada = nuevo_saldo
        servicio.save(update_fields=['deuda_acumulada'])

        # Emit Comprobante — no crítico: si falla, el pago ya quedó registrado
        comprobante = None
        try:
            comprobante = sistema_emitir_comprobante(
                cliente_id=cliente_id,
                ruc_emisor_id=ruc_emisor_id,
                sede_id=int(sede_id),
                tipo_comprobante=tipo_comp,
                monto_total=monto_pago,
                items_descripcion=deuda.descripcion or 'Cobro de servicio',
            )
            if comprobante and comprobante.get('numero'):
                pago_trans.numero_documento = comprobante['numero']
                pago_trans.save(update_fields=['numero_documento'])
        except Exception as e:
            # El pago ya fue persistido — el comprobante puede reintenarse luego
            import logging
            logging.getLogger('core.pago_cliente').warning(
                f"Comprobante no emitido para cargo {deuda.id} ({deuda.descripcion}): {e}"
            )
            comprobante = {'tipo': tipo_comp, 'numero': None, 'error': str(e)}
        comprobantes_emitidos.append(comprobante)

    sistema_actualizar_fecha_corte_por_pagos(servicio)

    return {
        'transaccion_ids': transacciones_abonos_ids,
        'monto_pagado': float(total_pagado),
        'comprobantes': comprobantes_emitidos,
        'turno_id': 1,
    }

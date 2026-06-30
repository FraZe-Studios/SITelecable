import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db import connection, transaction
from django.utils import timezone

# Importaciones alineadas estrictamente al contrato de persistencia unificada core
from core.models.models_generados import (
    Abonados, ServiciosAbonados, TicketsOrdenes, Planes, FacturacionPagos, CacheSuministro
)


def _decimal(value, default='0'):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        return Decimal(default)


def _parse_fecha(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def _normalize_estado_civil(value):
    if not value:
        return 'soltero'
    val = str(value).strip().lower()
    if val in ('soltero', 'soltera'):
        return 'soltero'
    elif val in ('casado', 'casada'):
        return 'casado'
    elif val in ('divorciado', 'divorciada'):
        return 'divorciado'
    elif val in ('viudo', 'viuda'):
        return 'viudo'
    elif val in ('conviviente',):
        return 'conviviente'
    return 'soltero'


def sistema_registro_cliente(datos):
    """
    Registra cliente + suscripción de servicio, o añade un nuevo servicio a un abonado existente.
    Garantiza la ciberseguridad transaccional y auditoría nativa del sistema.
    """
    def _clean_str(val):
        if not val:
            return None
        s = str(val).strip()
        if s in ('', '—', '-', 'None', 'null'):
            return None
        return s

    dni = _clean_str(datos.get('dni'))
    ruc = _clean_str(datos.get('ruc'))
    celular = _clean_str(datos.get('celular_1'))
    existing_client_id = datos.get('cliente_id')

    suministro_num = _clean_str(datos.get('suministro'))
    if not suministro_num:
        raise ValueError('Número de suministro requerido')

    plan_id = datos.get('plan_id')
    if not plan_id:
        raise ValueError('Plan requerido')

    vendedor_id = datos.get('vendedor_id')
    if not vendedor_id:
        raise ValueError('Vendedor requerido')

    plan = Planes.objects.select_related('sede').get(id=plan_id)
    lat = _decimal(datos.get('latitud', '-11.593160'))
    lng = _decimal(datos.get('longitud', '-75.896170'))
    direccion = (datos.get('direccion_servicio') or 'Sin dirección')[:255]
    
    # Blindaje de costos consultando la tabla de caché de suministros relacional (Regla 7)
    cache_entry = CacheSuministro.objects.filter(numero_suministro=suministro_num).first()
    if cache_entry:
        lat = cache_entry.latitud if cache_entry.latitud else lat
        lng = cache_entry.longitud if cache_entry.longitud else lng
        direccion = (cache_entry.direccion or direccion)[:255]

    nombre = _clean_str(datos.get('nombre_apellidos') or datos.get('razon_social'))
    if not nombre:
        nombre = f"Abonado DNI {dni}" if dni else "Nuevo Abonado"
    razon = _clean_str(datos.get('razon_social'))

    with transaction.atomic():
        # Invocación obligatoria del registro de responsabilidad transaccional en PostgreSQL (Regla 7)
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("SELECT set_auditoria_usuario(%s);", [int(vendedor_id)])
        except Exception:
            pass

        client_id = None
        if not existing_client_id:
            if not celular:
                raise ValueError('Celular principal requerido')
            
            if dni and Abonados.objects.filter(dni=dni).exists():
                raise ValueError('Ya existe un cliente registrado con este DNI')
            if ruc and Abonados.objects.filter(ruc=ruc).exists():
                raise ValueError('Ya existe un cliente registrado con este RUC')

            cliente = Abonados.objects.create(
                tipo_cliente='juridico' if ruc else 'natural',
                dni=dni,
                ruc=ruc,
                razon_social=razon,
                nombres_apellidos=nombre if not ruc else None,
                celular_1=celular,
                celular_2=_clean_str(datos.get('celular_2')),
                correo=_clean_str(datos.get('correo')) or '',
                direccion_fiscal=_clean_str(datos.get('direccion_fiscal') or direccion) or '',
                estado_civil=_normalize_estado_civil(datos.get('estado_civil')),
                fecha_nacimiento=_parse_fecha(datos.get('cumpleanos')),
                datos_adicionales_json={}
            )
            client_id = cliente.id
        else:
            from core.abonados.geoutils import parse_cliente_id
            parsed_id = parse_cliente_id(existing_client_id)
            
            try:
                cliente = Abonados.objects.get(pk=parsed_id)
                client_id = cliente.id
            except Abonados.DoesNotExist:
                raise ValueError(f'Cliente con código {existing_client_id} no existe')

        # Deducir procedencia de infraestructura por herencia lógica ascendente (Regla A4)
        from core.abonados.generador import obtener_codigo_servicio_actualizado
        from core.abonados.geoutils import buscar_sector_por_gps
        from core.models.infraestructura import CajasNap, Sectores, Sedes

        sector = buscar_sector_por_gps(lat, lng)
        nap = None
        if sector:
            nap = CajasNap.objects.filter(sector=sector, activo=True).first()
            if not nap:
                nap = CajasNap.objects.create(
                    sector=sector,
                    codigo=f"NAP-{sector.prefijo_comercial.upper()}-001",
                    activo=True,
                    capacidad_puertos="16",
                    estado_puertos={},
                    estado_precinto="activo"
                )
        
        if not nap and plan.sede:
            nap = CajasNap.objects.filter(sector__sede=plan.sede, activo=True).first()
            if not nap:
                sector_sede = Sectores.objects.filter(sede=plan.sede, activo=True).first()
                if sector_sede:
                    base_codigo = f"NAP-{sector_sede.prefijo_comercial.upper()}"
                    siguiente = CajasNap.objects.filter(codigo__startswith=base_codigo).count() + 1
                    nap = CajasNap.objects.create(
                        sector=sector_sede,
                        codigo=f"{base_codigo}-{siguiente:03d}",
                        activo=True,
                        capacidad_puertos="16",
                        estado_puertos={},
                        estado_precinto="activo"
                    )
        if not nap:
            sede = plan.sede or Sedes.objects.filter(activo=True).first()
            if not sede:
                sede = Sedes.objects.create(nombre="Sede Central", activo=True)
            sector_fallback = Sectores.objects.filter(sede=sede, activo=True).first()
            if not sector_fallback:
                sector_fallback = Sectores.objects.create(
                    sede=sede,
                    nombre="Sector Central",
                    prefijo_comercial="CEN",
                    activo=True
                )
            nap = CajasNap.objects.create(
                sector=sector_fallback,
                codigo="NAP-CEN-001",
                activo=True,
                capacidad_puertos="16",
                estado_puertos={},
                estado_precinto="activo"
            )

        # Generación incremental del código de servicio e identificador único
        sub_code = f"TMP-{uuid.uuid4().hex[:24]}"

        evaluacion = datos.get('evaluacion') or {}
        cuotas = int(datos.get('cuotas') or 1)
        pagar_deuda_cuotas = bool(datos.get('pagar_deuda_cuotas'))
        deuda_a_pagar = Decimal(str(evaluacion.get('deuda_a_pagar') or '0'))
        descuento_deuda = Decimal(str(datos.get('descuento_deuda') or '0'))
        
        # Apply debt discount if specified
        if descuento_deuda > 0 and deuda_a_pagar > 0:
            deuda_a_pagar = max(Decimal('0'), deuda_a_pagar - descuento_deuda)
        
        control_json = {}
        modo_pago_plan = (datos.get('modo_pago_plan') or 'FIN_MES').upper()
        control_json['modo_pago_plan'] = modo_pago_plan
        
        # Process facturacion structured object if provided
        facturacion = datos.get('facturacion', {})
        if facturacion:
            # Store base tariff info
            control_json['tarifa_base'] = facturacion.get('tarifa_base', {})
            
            # Store permanent discounts
            descuentos_perm = facturacion.get('descuentos_permanentes', {})
            descuento_plan = Decimal(str(descuentos_perm.get('porcentaje_plan') or 0))
            meses_gratis = int(descuentos_perm.get('meses_descuento') or descuentos_perm.get('meses_gratis') or 0)
            if descuento_plan > 0:
                control_json['descuento_permanente'] = float(descuento_plan)
            if meses_gratis > 0:
                control_json['meses_gratis'] = meses_gratis
                control_json['fecha_fin_gratis'] = (date.today() + timedelta(days=30*meses_gratis)).isoformat()
            
            # Store app discounts
            pct_descuento_apps = Decimal(str(datos.get('pct_descuento_apps') or 0))
            meses_descuento_apps = int(datos.get('meses_descuento_apps') or 0)
            if pct_descuento_apps > 0:
                control_json['descuento_apps'] = float(pct_descuento_apps)
            if meses_descuento_apps > 0:
                control_json['meses_descuento_apps'] = meses_descuento_apps
                control_json['fecha_fin_descuento_apps'] = (date.today() + timedelta(days=30*meses_descuento_apps)).isoformat()
            
            # Store debt proration info
            deuda_info = facturacion.get('deuda', {})
            cuotas_deuda = int(deuda_info.get('cuotas') or 1)
            if cuotas_deuda > 1:
                control_json['deuda_prorrateo'] = {
                    'total': deuda_info.get('total'),
                    'cuotas': cuotas_deuda,
                    'monto_cuota': deuda_info.get('monto_cuota')
                }
                # Override cuotas for debt payment
                cuotas = cuotas_deuda
            
            # Store additional services info
            control_json['servicios_adicionales'] = facturacion.get('servicios_adicionales', {})
        else:
            # Legacy support: process individual fields
            descuento_plan = Decimal(str(datos.get('descuento_plan') or '0'))
            meses_gratis = int(datos.get('meses_descuento') or datos.get('meses_gratis') or 0)
            if descuento_plan > 0:
                control_json['descuento_permanente'] = float(descuento_plan)
            if meses_gratis > 0:
                control_json['meses_gratis'] = meses_gratis
                control_json['fecha_fin_gratis'] = (date.today() + timedelta(days=30*meses_gratis)).isoformat()
            
            # Store app discounts in legacy support
            pct_descuento_apps = Decimal(str(datos.get('pct_descuento_apps') or 0))
            meses_descuento_apps = int(datos.get('meses_descuento_apps') or 0)
            if pct_descuento_apps > 0:
                control_json['descuento_apps'] = float(pct_descuento_apps)
            if meses_descuento_apps > 0:
                control_json['meses_descuento_apps'] = meses_descuento_apps
                control_json['fecha_fin_descuento_apps'] = (date.today() + timedelta(days=30*meses_descuento_apps)).isoformat()

            cuotas_deuda = int(datos.get('cuotas_deuda') or 1)
            if cuotas_deuda > 1:
                cuotas = cuotas_deuda

        # ────────────────────────────────────────────────────────────────
        # Persistir descuentos estructurados para el sistema de facturación
        # El campo 'descuentos' en control_operativo_json es la fuente de
        # verdad para cobros mensuales, reconexiones y cualquier evento de pago.
        # ────────────────────────────────────────────────────────────────
        _pct_plan_v   = float(datos.get('pct_descuento_plan') or datos.get('descuento_plan') or 0)
        _meses_plan_v = int(datos.get('meses_descuento') or 0)
        _pct_inst_v   = float(datos.get('pct_descuento_instalacion') or 0)
        _cuotas_inst  = int(datos.get('cuotas_instalacion') or 1)
        _pct_apps_v   = float(datos.get('pct_descuento_apps') or 0)
        _meses_apps_v = int(datos.get('meses_descuento_apps') or 0)
        _ev_data      = evaluacion  # ya definido en línea 198
        _costo_plan_b = float(_ev_data.get('costo_plan_mensual') or 0)
        _costo_plan_d = float(_ev_data.get('costo_plan_con_descuento') or _costo_plan_b)
        _costo_apps_b = float(_ev_data.get('costo_apps_mensual') or 0)
        _costo_apps_d = float(_ev_data.get('costo_apps_con_descuento') or _costo_apps_b)
        _costo_anx    = float(_ev_data.get('costo_anexos') or 0)
        _nota_v       = (datos.get('notas_beneficios') or '').strip()

        control_json['descuentos'] = {
            'plan': {
                'porcentaje':  _pct_plan_v,
                'meses':       _meses_plan_v,
                'fecha_inicio': date.today().isoformat(),
                'fecha_fin':   (date.today() + timedelta(days=30 * _meses_plan_v)).isoformat() if _meses_plan_v > 0 else None,
                'motivo':      _nota_v,
                'es_gratis':   _pct_plan_v >= 100,
            },
            'apps': {
                'porcentaje':  _pct_apps_v,
                'meses':       _meses_apps_v,
                'fecha_inicio': date.today().isoformat(),
                'fecha_fin':   (date.today() + timedelta(days=30 * _meses_apps_v)).isoformat() if _meses_apps_v > 0 else None,
                'es_gratis':   _pct_apps_v >= 100,
            },
            'instalacion': {
                'porcentaje':  _pct_inst_v,
                'cuotas':      _cuotas_inst,
                'es_gratis':   _pct_inst_v >= 100,
            },
        }
        control_json['costo_mensual_base']            = _costo_plan_b
        control_json['costo_mensual_con_descuento']   = _costo_plan_d
        control_json['costo_apps_mensual_base']       = _costo_apps_b
        control_json['costo_apps_mensual_con_descuento'] = _costo_apps_d
        control_json['costo_anexos_mensual']          = _costo_anx
        if _nota_v:
            control_json['notas_beneficios'] = _nota_v
        # ────────────────────────────────────────────────────────────────

        if pagar_deuda_cuotas and cuotas > 1 and deuda_a_pagar > 0:
            monto_cuota = (deuda_a_pagar / cuotas).quantize(Decimal('0.01'))
            total_cobrar = float(evaluacion.get('total_cobrar_ahora') or 0)
            cuotas_restantes = cuotas - 1 if (modo_pago_plan == 'CONTADO' and total_cobrar > 0) else cuotas
            control_json['plan_financiamiento'] = {
                'monto_total': float(deuda_a_pagar),
                'cuotas_totales': cuotas,
                'cuotas_restantes': cuotas_restantes,
                'monto_cuota': float(monto_cuota)
            }

        generar_orden = datos.get('generar_orden_instalacion', True)
        est_serv = 'pendiente_instalacion' if generar_orden else 'activo'
        f_instalacion = None if generar_orden else date.today()

        suscripcion = ServiciosAbonados(
            id=None,
            cliente_id=client_id,
            caja_nap=nap,
            plan_id=plan.id,
            codigo=sub_code,
            numero_suministro=suministro_num,
            direccion_servicio=direccion,
            distrito=datos.get('distrito', 'La Oroya') or 'La Oroya',
            provincia=datos.get('provincia', 'Yauli') or 'Yauli',
            departamento=datos.get('departamento', 'Junín') or 'Junín',
            latitud=lat,
            longitud=lng,
            estado_servicio=est_serv,
            fecha_instalacion=f_instalacion,
            control_operativo_json=control_json,
            deuda_acumulada=Decimal('0'),
            vendedora_id=vendedor_id
        )
        suscripcion.save()
        suscripcion.refresh_from_db()
        suscripcion.codigo = obtener_codigo_servicio_actualizado(suscripcion)
        suscripcion.save(update_fields=['codigo'])

        ticket_id = None
        app_tickets = []  # Store app installation tickets separately
        
        if datos.get('generar_orden_instalacion', True):
            p_instalacion = _decimal(
                datos.get('precio_instalacion') or 
                datos.get('precio_base') or 
                datos.get('costo_instalacion') or 
                evaluacion.get('costo_instalacion'), 
                '0.00'
            )
            
            # Orden de instalación configurada bajo tipos enumerados acotados (Filtro del MVP)
            ticket_campo = TicketsOrdenes.objects.create(
                servicio=suscripcion,
                categoria='instalacion',
                area='planta_externa',
                tecnologia='todos',
                modalidad='campo',
                nombre_ticket='Nueva instalación (Campo)',
                estado='pendiente',
                prioridad='media',
                precio_base=p_instalacion,
                empleado_atc_generador_id=vendedor_id
            )
            ticket_id = ticket_campo.id
            
            # Generate anexo installation tickets (Single ticket for all anexos as requested)
            num_anexos = int(datos.get('num_anexos') or 0)
            if num_anexos > 0:
                tipo_servicio = plan.tipo_servicio.lower() if plan.tipo_servicio else ''
                # Cost calculation: first is free, rest are charged monthly
                anexos_cobrar = max(0, num_anexos - 1)
                eval_payload = datos.get('evaluacion') or {}
                costo_anexo_unitario = Decimal(str(eval_payload.get('costo_anexo_base') or getattr(plan, 'costo_conexion_tv_adicional', 15.00) or 15.00))
                costo_anexo_mensual_total = anexos_cobrar * costo_anexo_unitario
                
                funciones_anexo = {
                    "instalacion_anexo": {
                        "activado": True,
                        "fecha_activacion": timezone.now().isoformat(),
                        "tipo_anexo": tipo_servicio.upper() or 'DUO',
                        "costo_mensual": float(costo_anexo_mensual_total),
                        "es_gratis_registro": True,
                        "estado": "pendiente",
                        "total_anexos": num_anexos
                    }
                }
                
                TicketsOrdenes.objects.create(
                    servicio=suscripcion,
                    categoria='instalacion',
                    area='planta_externa',
                    tecnologia='tv' if 'tv' in tipo_servicio else 'duo',
                    modalidad='campo',
                    nombre_ticket=f'Instalación de Anexos (Cantidad: {num_anexos})',
                    estado='pendiente',
                    prioridad='media',
                    precio_base=Decimal('0.00'),
                    empleado_atc_generador_id=vendedor_id,
                    funciones_especiales=funciones_anexo
                )

        # Registro de planes dinámicos adicionales opcionales (apps)
        app_ids = datos.get('app_ids', [])
        for app_id in app_ids:
            try:
                app_plan = Planes.objects.get(id=app_id, tipo_servicio='app')
                app_sub_code = f"TMP-{uuid.uuid4().hex[:24]}"
                
                # Generate unique supply number for app plan to avoid duplicate constraint
                app_suministro_num = f"{suministro_num}-APP{app_ids.index(app_id)+1}"
                
                app_sub = ServiciosAbonados.objects.create(
                    cliente_id=client_id,
                    caja_nap=nap,
                    plan_id=app_plan.id,
                    codigo=app_sub_code,
                    numero_suministro=app_suministro_num,
                    direccion_servicio=direccion,
                    distrito=suscripcion.distrito,
                    provincia=suscripcion.provincia,
                    departamento=suscripcion.departamento,
                    latitud=lat,
                    longitud=lng,
                    estado_servicio='activo',
                    fecha_instalacion=date.today(),
                    vendedora_id=vendedor_id
                )
                app_sub.codigo = obtener_codigo_servicio_actualizado(app_sub)
                app_sub.save(update_fields=['codigo'])
                
                # Create installation ticket for this app subscription (separate per service)
                app_ticket = TicketsOrdenes.objects.create(
                    servicio=app_sub,
                    categoria='instalacion',
                    area='planta_interna',
                    tecnologia='todos',
                    modalidad='remoto',
                    nombre_ticket=f'Orden de Instalación - {app_plan.nombre_plan} (Remoto)',
                    estado='pendiente',
                    prioridad='media',
                    precio_base=Decimal('0.00'),
                    empleado_atc_generador_id=vendedor_id
                )
                app_tickets.append(app_ticket.id)
            except Planes.DoesNotExist:
                continue

    evaluacion = datos.get('evaluacion') or {}
    return {
        'cliente_id': suscripcion.cliente_id,
        'suscripcion_id': suscripcion.codigo,
        'ticket_id': ticket_id,
        'app_ticket_ids': app_tickets,  # Return app installation ticket IDs separately
        'sede': plan.sede.nombre,
        'pago': {
            'modo_plan': datos.get('modo_pago_plan', 'FIN_MES'),
            'ruc_emisor_id': datos.get('ruc_emisor_id'),
            'tipo_comprobante': datos.get('tipo_comprobante'),
            'total_cobrar': evaluacion.get('total_cobrar_ahora'),
            'emitir_comprobante': bool(datos.get('emitir_comprobante', True)),
        },
    }

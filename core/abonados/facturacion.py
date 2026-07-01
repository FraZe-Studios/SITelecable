import calendar
from datetime import date, timedelta, datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from core.models.models_generados import ServiciosAbonados, FacturacionPagos, TareasLlamadas
from core.models.usuarios import Usuario


def _descuento_plan_para_mes(control, mes_str):
    """
    Devuelve el porcentaje de descuento (Decimal 0-100) que aplica al plan
    en el mes indicado (formato 'YYYY-MM').
    
    Prioridad:
    1. control['oferta'] con mes_inicio/mes_fin y estado 'aprobada'
    2. control['descuentos']['plan'] con fecha_inicio/fecha_fin (legacy)
    3. control['descuento_permanente'] (legacy sin fechas)
    Devuelve Decimal('0') si no hay descuento activo.
    """
    if not isinstance(control, dict):
        return Decimal('0')

    oferta = control.get('oferta', {})
    if isinstance(oferta, dict) and oferta.get('estado') == 'aprobada':
        mes_inicio = oferta.get('mes_inicio', '')
        mes_fin = oferta.get('mes_fin', '')
        pct = Decimal(str(oferta.get('descuento_plan') or 0))
        if pct > 0 and mes_inicio and mes_fin:
            if mes_inicio <= mes_str <= mes_fin:
                return pct
            return Decimal('0')

    descuentos = control.get('descuentos', {})
    if isinstance(descuentos, dict):
        plan_desc = descuentos.get('plan', {})
        if isinstance(plan_desc, dict):
            pct = Decimal(str(plan_desc.get('porcentaje') or 0))
            if pct > 0:
                fecha_fin = plan_desc.get('fecha_fin')
                if fecha_fin:
                    mes_fin_leg = fecha_fin[:7]  # 'YYYY-MM'
                    if mes_str <= mes_fin_leg:
                        return pct
                    return Decimal('0')
                return pct

    perm = Decimal(str(control.get('descuento_permanente') or 0))
    return perm

def obtener_ultimo_dia_mes(fecha):
    ultimo_dia = calendar.monthrange(fecha.year, fecha.month)[1]
    return date(fecha.year, fecha.month, ultimo_dia)


def sistema_costo_mensual_real(servicio, mes_str=None):
    """
    Calcula el costo mensual REAL del servicio considerando:
      - Precio base del plan
      - Anexos cobrables (numero_anexos - anexos_gratis del plan)
      - Descuento por período (oferta aprobada mes_inicio/mes_fin)

    Retorna dict con desglose completo.
    """
    if mes_str is None:
        mes_str = date.today().strftime('%Y-%m')

    plan = getattr(servicio, 'plan', None)
    costo_base = Decimal(str(plan.costo_mensual)) if plan else Decimal('0')

    # Anexos
    num_anexos = int(getattr(servicio, 'numero_anexos', None) or 0)
    anexos_gratis = int(getattr(plan, 'anexos_gratis', None) or 1) if plan else 1
    precio_por_anexo = Decimal(str(getattr(plan, 'precio_por_anexo', None) or 0)) if plan else Decimal('0')
    anexos_cobrables = max(0, num_anexos - anexos_gratis)
    costo_anexos = (Decimal(str(anexos_cobrables)) * precio_por_anexo).quantize(Decimal('0.01'))
    subtotal = (costo_base + costo_anexos).quantize(Decimal('0.01'))

    # Descuento por período
    control = servicio.control_operativo_json if isinstance(servicio.control_operativo_json, dict) else {}
    pct_descuento = _descuento_plan_para_mes(control, mes_str)
    descuento_monto = (subtotal * pct_descuento / Decimal('100')).quantize(Decimal('0.01')) if pct_descuento else Decimal('0')
    costo_final = max(Decimal('0'), subtotal - descuento_monto)

    # Descripción del período de oferta
    oferta = control.get('oferta', {})
    periodo_desc = oferta.get('periodo_descripcion', '') if isinstance(oferta, dict) else ''
    mes_inicio = oferta.get('mes_inicio', '') if isinstance(oferta, dict) else ''
    mes_fin = oferta.get('mes_fin', '') if isinstance(oferta, dict) else ''
    descuento_plan = oferta.get('descuento_plan', 0) if isinstance(oferta, dict) else 0
    estado_oferta = oferta.get('estado', '') if isinstance(oferta, dict) else ''

    return {
        'costo_base': costo_base,
        'num_anexos': num_anexos,
        'anexos_gratis': anexos_gratis,
        'anexos_cobrables': anexos_cobrables,
        'precio_por_anexo': precio_por_anexo,
        'costo_anexos': costo_anexos,
        'subtotal_sin_descuento': subtotal,
        'pct_descuento': pct_descuento,
        'descuento_monto': descuento_monto,
        'costo_final': costo_final,
        'periodo_descripcion': periodo_desc,
        'mes_inicio': mes_inicio,
        'mes_fin': mes_fin,
        'descuento_plan': descuento_plan,
        'estado_oferta': estado_oferta,
    }

@transaction.atomic
def sistema_procesar_facturacion_mensual(fecha_ref=None):
    """
    Procesa todas las suscripciones activas y genera cargos mensuales del plan y/o cuotas de deudas.
    Si se genera una mensualidad o cuota, se crea una tarea de cobranza (TareasLlamadas) 
    y se divide de forma equitativa (round-robin) entre los empleados ATC activos.
    """
    if fecha_ref is None:
        fecha_ref = date.today()
    elif isinstance(fecha_ref, str):
        fecha_ref = date.fromisoformat(fecha_ref[:10])

    # 1. Obtener empleados ATC activos
    empleados_atc = list(Usuario.objects.filter(rol='atc', activo=True).order_by('id'))
    if not empleados_atc:
        # Fallback to active users if no ATC exists to prevent crashing
        empleados_atc = list(Usuario.objects.filter(activo=True).order_by('id'))

    num_atc = len(empleados_atc)
    atc_index = 0

    # 2. Obtener suscripciones activas
    suscripciones = ServiciosAbonados.objects.filter(estado_servicio='activo', activo=True)

    cargos_generados = 0
    tareas_creadas = 0

    # Para evitar facturar múltiples veces en una misma ejecución, revisamos los candidatos a facturar
    # Hoy y los próximos 20 días para capturar el vencimiento dentro de los 15 días antes.
    # Dado que se ejecuta diariamente, usualmente revisaremos:
    # ¿El vencimiento del ciclo actual cae dentro de hoy y los próximos 15 días?
    # Revisamos dos meses posibles: el mes actual y el mes siguiente
    meses_candidatos = []
    # Mes actual
    meses_candidatos.append((fecha_ref.year, fecha_ref.month))
    # Mes siguiente
    siguiente_mes_dt = fecha_ref + timedelta(days=25)
    meses_candidatos.append((siguiente_mes_dt.year, siguiente_mes_dt.month))

    for sub in suscripciones:
        control = sub.control_operativo_json or {}
        if not isinstance(control, dict):
            control = {}

        modo_pago = (control.get('modo_pago_plan') or 'FIN_MES').upper()
        
        # Obtener el día de anclaje (fecha de instalación)
        anchor_day = 30 # Default if no installation date
        if sub.fecha_instalacion:
            anchor_day = sub.fecha_instalacion.day

        for year, month in meses_candidatos:
            mes_str = f"{year:04d}-{month:02d}"
            
            # Verificar si ya se facturó este mes
            ultimo_mes_facturado = control.get('ultimo_mes_facturado')
            if ultimo_mes_facturado == mes_str:
                continue

            # Calcular la fecha de vencimiento (due_date) para este mes/año
            if modo_pago == 'FIN_MES':
                due_date = obtener_ultimo_dia_mes(date(year, month, 1))
            else:
                # anchor_day
                ultimo_dia_del_mes = calendar.monthrange(year, month)[1]
                due_date = date(year, month, min(anchor_day, ultimo_dia_del_mes))

            # Verificar si faltan 15 días o menos para el vencimiento
            if due_date - timedelta(days=15) <= fecha_ref <= due_date:
                # Determinar ruc_emisor
                ruc_emisor_id = 1
                if sub.plan and sub.plan.sede:
                    from core.models.models_generados import RucSedes
                    rs = RucSedes.objects.filter(sede=sub.plan.sede, activo=True).first()
                    if rs:
                        ruc_emisor_id = rs.ruc_id

                # Producir cargo de mensualidad del plan usando el costo mensual REAL
                desglose = sistema_costo_mensual_real(sub, mes_str)
                costo_cargo = desglose['costo_final']
                pct_desc = desglose['pct_descuento']
                costo_base = desglose['costo_base']
                anexos_cobrables = desglose['anexos_cobrables']

                if costo_cargo > 0:
                    cliente = sub.cliente
                    tipo_doc = 'boleta'
                    if cliente and cliente.ruc and len(str(cliente.ruc).strip()) == 11:
                        tipo_doc = 'factura'

                    # Armar descripción detallada
                    desc_parts = [f"Mensualidad de Plan {sub.plan.nombre_plan} - Periodo {mes_str}"]
                    if anexos_cobrables > 0:
                        desc_parts.append(f"+{anexos_cobrables} anexo(s) adicional(es)")
                    if pct_desc > 0:
                        desc_parts.append(f"Descuento {pct_desc}%")
                    descripcion_cargo = ' | '.join(desc_parts)

                    cargo_plan = FacturacionPagos.objects.create(
                        servicio=sub,
                        ruc_emisor_id=ruc_emisor_id,
                        tipo_documento=tipo_doc,
                        tipo_transaccion='cargo',
                        monto=costo_cargo,
                        descripcion=descripcion_cargo,
                        fecha_transaccion=timezone.now(),
                        fecha_vencimiento=due_date,
                        fecha_creacion=timezone.now(),
                        cuota_mensual_indexada=True
                    )
                    cargos_generados += 1

                    if sub.deuda_acumulada is None:
                        sub.deuda_acumulada = Decimal('0')
                    sub.deuda_acumulada += costo_cargo

                # Verificar si tiene deuda financiada (cuotas pendientes)
                financiamiento = control.get('plan_financiamiento')
                if financiamiento and isinstance(financiamiento, dict):
                    cuotas_restantes = int(financiamiento.get('cuotas_restantes') or 0)
                    if cuotas_restantes > 0:
                        monto_cuota = Decimal(str(financiamiento.get('monto_cuota') or '0'))
                        cuotas_totales = int(financiamiento.get('cuotas_totales') or 1)
                        cuota_num = cuotas_totales - cuotas_restantes + 1
                        
                        cargo_cuota = FacturacionPagos.objects.create(
                            servicio=sub,
                            ruc_emisor_id=ruc_emisor_id,
                            tipo_documento='nota_venta',
                            tipo_transaccion='cargo',
                            monto=monto_cuota,
                            descripcion=f"Cuota de financiamiento de deuda ({cuota_num}/{cuotas_totales}) - Periodo {mes_str}",
                            fecha_transaccion=timezone.now(),
                            fecha_vencimiento=due_date,
                            fecha_creacion=timezone.now(),
                            numero_cuota=cuota_num
                        )
                        cargos_generados += 1
                        
                        if sub.deuda_acumulada is None:
                            sub.deuda_acumulada = Decimal('0')
                        sub.deuda_acumulada += monto_cuota
                        
                        # Actualizar cuotas restantes
                        financiamiento['cuotas_restantes'] = cuotas_restantes - 1
                        control['plan_financiamiento'] = financiamiento

                # Guardar el último mes facturado y actualizar la suscripción
                control['ultimo_mes_facturado'] = mes_str
                sub.control_operativo_json = control
                sub.save(update_fields=['control_operativo_json', 'deuda_acumulada'])

                # Generar Tarea de Cobranza (Llamada) y asignarla round-robin
                if num_atc > 0:
                    empleado_asig = empleados_atc[atc_index % num_atc]
                    atc_index += 1

                    venc_dt = datetime.combine(due_date, datetime.min.time())
                    try:
                        fecha_venc = timezone.make_aware(venc_dt)
                    except ValueError:
                        fecha_venc = venc_dt

                    TareasLlamadas.objects.create(
                        servicio=sub,
                        empleado=empleado_asig,
                        estado_contacto='pendiente',
                        observaciones=f"Cobranza para el periodo {mes_str}. Vence el {due_date.strftime('%d/%m/%Y')}.",
                        fecha_vencimiento_tarea=fecha_venc
                    )
                    tareas_creadas += 1
                    
                break

    return {
        'cargos_generados': cargos_generados,
        'tareas_creadas': tareas_creadas
    }

import calendar
from datetime import date, timedelta, datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from core.models.models_generados import ServiciosAbonados, FacturacionPagos, TareasLlamadas
from core.models.usuarios import Usuario

def obtener_ultimo_dia_mes(fecha):
    ultimo_dia = calendar.monthrange(fecha.year, fecha.month)[1]
    return date(fecha.year, fecha.month, ultimo_dia)

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

                # Producir cargo de mensualidad del plan
                costo_plan = Decimal(str(sub.plan.costo_plan)) if sub.plan_id else Decimal('0.00')
                if costo_plan > 0:
                    cliente = sub.cliente
                    tipo_doc = 'boleta'
                    if cliente and cliente.ruc and len(str(cliente.ruc).strip()) == 11:
                        tipo_doc = 'factura'

                    cargo_plan = FacturacionPagos.objects.create(
                        servicio=sub,
                        ruc_emisor_id=ruc_emisor_id,
                        tipo_documento=tipo_doc,
                        tipo_transaccion='cargo',
                        monto=costo_plan,
                        descripcion=f"Mensualidad de Plan {sub.plan.nombre_plan} - Periodo {mes_str}",
                        fecha_transaccion=timezone.now(),
                        fecha_vencimiento=due_date,
                        fecha_creacion=timezone.now(),
                        cuota_mensual_indexada=True
                    )
                    cargos_generados += 1
                    
                    if sub.deuda_acumulada is None:
                        sub.deuda_acumulada = Decimal('0')
                    sub.deuda_acumulada += costo_plan

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

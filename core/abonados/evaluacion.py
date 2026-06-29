"""
Evaluación económica del registro de abonado según deudas y habilidades del vendedor.
"""
from decimal import Decimal, InvalidOperation

from core.models.models_generados import Planes, SedeRuc

COSTO_INSTALACION_DEFAULT = Decimal('80.00')


def _decimal(value, default='0'):
    try:
        return Decimal(str(value or default))
    except (InvalidOperation, TypeError):
        return Decimal(default)


def sistema_rucs_emision_sede(sede_id):
    if not sede_id:
        return []
    qs = SedeRuc.objects.filter(sede_id=sede_id).select_related('ruc')
    return [
        {
            'id': sr.ruc_id,
            'numero_ruc': sr.ruc.ruc_numero,
            'razon_social': sr.ruc.razon_social,
            'permite_boleta': sr.permite_boleta,
            'permite_factura': sr.permite_factura,
            'permite_nota_venta': sr.permite_nota_venta,
        }
        for sr in qs if sr.activo
    ]


def _sumar_deudas(items):
    total = Decimal('0')
    for d in items or []:
        total += _decimal(d.get('monto_actual'))
    return total


def sistema_evaluar_registro(datos, ctx_vendedor):
    """
    Calcula montos a cobrar: deuda (con descuento), adelanto plan, instalación.
    """
    hab = (ctx_vendedor or {}).get('habilidades') or {}
    hg = hab.get('habilidades_globales', {})
    tickets_cobro = hg.get('tickets_cobro', {})
    deudas_antiguas = hg.get('deudas_antiguas', {})
    planes_mensuales = hg.get('planes_mensuales', {})
    sede_id = datos.get('sede_id') or ctx_vendedor.get('sede_id')

    deuda_cliente = _sumar_deudas(datos.get('deudas_cliente'))
    deuda_sistema = _sumar_deudas(datos.get('deudas_sistema'))
    if deuda_sistema == 0:
        deuda_sistema = _sumar_deudas(datos.get('deudas_suministro'))
    deuda_externa = _decimal(datos.get('monto_deuda_externa'))
    if deuda_externa == 0:
        deuda_externa = _sumar_deudas(datos.get('deudas_externas'))

    deuda_bruta = deuda_cliente + deuda_sistema + deuda_externa

    pct = _decimal(datos.get('pct_descuento') or 0)
    pct_max = _decimal(deudas_antiguas.get('descuento_maximo_porcentaje') or 0)
    if pct_max == 0:
        pct = Decimal('0')
    elif pct > pct_max:
        pct = pct_max

    descuento = (deuda_bruta * pct / Decimal('100')).quantize(Decimal('0.01'))
    deuda_a_pagar = max(deuda_bruta - descuento, Decimal('0'))

    cuotas = int(datos.get('cuotas') or 1)
    limite_cuotas = int(deudas_antiguas.get('cuotas_maximas') or 6)
    if limite_cuotas == 0:
        cuotas = 1
    elif cuotas > limite_cuotas:
        cuotas = limite_cuotas
    cuotas = max(cuotas, 1)

    if datos.get('pagar_deuda_cuotas') and cuotas > 1:
        deuda_cuota_mensual = (deuda_a_pagar / cuotas).quantize(Decimal('0.01'))
        deuda_cobrar_ahora = deuda_cuota_mensual
    else:
        deuda_cuota_mensual = deuda_a_pagar
        deuda_cobrar_ahora = deuda_a_pagar

    plan = None
    costo_plan = Decimal('0')
    costo_apps = Decimal('0')
    selected_apps = []
    if datos.get('plan_id'):
        try:
            plan = Planes.objects.get(id=datos['plan_id'])
            costo_plan = _decimal(plan.costo_plan)
        except Planes.DoesNotExist:
            pass
    if datos.get('app_ids'):
        is_servicio = plan and plan.tipo_servicio.lower() == 'servicio'
        for idx, app_id in enumerate(datos['app_ids']):
            try:
                app = Planes.objects.get(id=app_id, tipo_servicio='app')
                if is_servicio and idx == 0:
                    costo_apps += Decimal('0')
                else:
                    costo_apps += _decimal(app.costo_plan)
                selected_apps.append(app)
            except Planes.DoesNotExist:
                pass

    # Tickets de cobro (instalación, traslados, equipos)
    pct_instalacion = _decimal(datos.get('pct_descuento_instalacion') or 0)
    pct_max_instalacion = _decimal(tickets_cobro.get('descuento_maximo_porcentaje') or 0)
    if pct_max_instalacion == 0:
        pct_instalacion = Decimal('0')
    elif pct_instalacion > pct_max_instalacion:
        pct_instalacion = pct_max_instalacion
    
    cuotas_instalacion = int(datos.get('cuotas_instalacion') or 1)
    limite_cuotas_instalacion = int(tickets_cobro.get('cuotas_maximas') or 0)
    if limite_cuotas_instalacion == 0:
        cuotas_instalacion = 1
    elif cuotas_instalacion > limite_cuotas_instalacion:
        cuotas_instalacion = limite_cuotas_instalacion
    cuotas_instalacion = max(cuotas_instalacion, 1)
    
    costo_instalacion_base = COSTO_INSTALACION_DEFAULT
    try:
        from core.models.compat import CatalogoTickets
        inst_ticket = CatalogoTickets.objects.filter(es_instalacion=True, activo=True).first()
        if not inst_ticket:
            inst_ticket = CatalogoTickets.objects.filter(nombre_ticket__icontains='instalacion', activo=True).first()
        if inst_ticket:
            costo_instalacion_base = inst_ticket.precio_base
    except Exception:
        pass
    
    descuento_instalacion = (costo_instalacion_base * pct_instalacion / Decimal('100')).quantize(Decimal('0.01'))
    costo_instalacion = max(costo_instalacion_base - descuento_instalacion, Decimal('0'))
    
    if cuotas_instalacion > 1:
        instalacion_cuota_mensual = (costo_instalacion / cuotas_instalacion).quantize(Decimal('0.01'))
        instalacion_cobrar_ahora = instalacion_cuota_mensual
    else:
        instalacion_cuota_mensual = costo_instalacion
        instalacion_cobrar_ahora = costo_instalacion

    # Planes mensuales
    pct_plan = _decimal(datos.get('pct_descuento_plan') or 0)
    pct_max_plan = _decimal(planes_mensuales.get('descuento_maximo_porcentaje') or 100)
    meses_descuento = int(datos.get('meses_descuento_plan') or 0)
    meses_max = int(planes_mensuales.get('meses_maximos') or 0)
    
    if meses_max == 0:
        pct_plan = Decimal('0')
    elif pct_plan > pct_max_plan:
        pct_plan = pct_max_plan
    
    if meses_descuento > meses_max:
        meses_descuento = meses_max
    
    descuento_plan = (costo_plan * pct_plan / Decimal('100')).quantize(Decimal('0.01'))
    costo_plan_con_descuento = max(costo_plan - descuento_plan, Decimal('0'))
    
    omitir_adelanto = bool(datos.get('omitir_adelanto_plan'))
    omitir_pago_apps = bool(datos.get('omitir_pago_apps'))
    modo_plan = (datos.get('modo_pago_plan') or 'FIN_MES').upper()
    adelanto_plan = Decimal('0')
    if modo_plan == 'CONTADO' and not omitir_adelanto:
        adelanto_plan = costo_plan_con_descuento + (Decimal('0') if omitir_pago_apps else costo_apps)

    total_cobrar = deuda_cobrar_ahora + adelanto_plan + instalacion_cobrar_ahora

    tiene_ruc = bool((datos.get('ruc') or '').strip())
    tipo_sugerido = 'FACTURA' if tiene_ruc else 'BOLETA'

    return {
        'deuda_bruta': float(deuda_bruta),
        'pct_descuento_aplicado': float(pct),
        'descuento_monto': float(descuento),
        'deuda_a_pagar': float(deuda_a_pagar),
        'deuda_cobrar_ahora': float(deuda_cobrar_ahora),
        'deuda_cuota_mensual': float(deuda_cuota_mensual),
        'cuotas_liberacion': cuotas,
        'costo_instalacion': float(costo_instalacion),
        'instalacion_cobrar_ahora': float(instalacion_cobrar_ahora),
        'instalacion_cuota_mensual': float(instalacion_cuota_mensual),
        'cuotas_instalacion': cuotas_instalacion,
        'adelanto_plan': float(adelanto_plan),
        'costo_plan_mensual': float(costo_plan),
        'costo_plan_con_descuento': float(costo_plan_con_descuento),
        'pct_descuento_plan_aplicado': float(pct_plan),
        'meses_descuento_plan': meses_descuento,
        'costo_apps_mensual': float(costo_apps),
        'total_cobrar_ahora': float(total_cobrar),
        'tipo_comprobante_sugerido': tipo_sugerido,
        'modo_pago_plan': modo_plan,
        'rucs_emision': sistema_rucs_emision_sede(sede_id),
        'deuda_luz_referencial': float(_decimal(datos.get('deuda_luz'))),
        'plan_nombre': plan.nombre_plan if plan else None,
        'apps_nombres': [a.nombre_plan for a in selected_apps],
        'vendedor_nombre': ctx_vendedor.get('personal_nombre'),
        'vendedor_id': ctx_vendedor.get('personal_id'),
    }

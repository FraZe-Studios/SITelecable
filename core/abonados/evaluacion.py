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
    hg = hab.get('habilidades_globales') or hab
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

    # App discount calculations
    pct_apps = Decimal('0')
    meses_descuento_apps = 0
    fecha_fin_descuento_apps = None
    costo_apps_con_descuento = costo_apps

    if costo_apps > 0:
        pct_apps = _decimal(datos.get('pct_descuento_apps') or 0)
        pct_max_plan = _decimal(planes_mensuales.get('descuento_maximo_porcentaje') or 100)
        if pct_max_plan == 0:
            pct_apps = Decimal('0')
        elif pct_apps > pct_max_plan:
            pct_apps = pct_max_plan

        meses_descuento_apps = int(datos.get('meses_descuento_apps') or 0)
        meses_max = int(planes_mensuales.get('meses_maximos') or 0)
        if meses_max == 0:
            pct_apps = Decimal('0')
            meses_descuento_apps = 0
        elif meses_descuento_apps > meses_max:
            meses_descuento_apps = meses_max

        descuento_apps = (costo_apps * pct_apps / Decimal('100')).quantize(Decimal('0.01'))
        costo_apps_con_descuento = max(costo_apps - descuento_apps, Decimal('0'))

        if meses_descuento_apps > 0:
            from datetime import date, timedelta
            fecha_fin_descuento_apps = date.today() + timedelta(days=meses_descuento_apps * 30)

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
    costo_anexo_base = Decimal('15.00')
    try:
        from core.models.compat import CatalogoTickets
        t_templates = CatalogoTickets.objects.filter(activo=True)
        import logging
        logging.info(f"Total tickets activos: {t_templates.count()}")

        # Buscar ticket de instalación por función especial (NO por categoría para evitar confusión con anexos)
        inst_ticket = None
        for t in t_templates:
            # Check both the property and the raw JSON for compatibility
            es_inst_prop = t.es_instalacion
            es_inst_json = t.funciones_especiales and t.funciones_especiales.get('instalacion', {}).get('activado')
            logging.info(f"Revisando ticket: {t.nombre_ticket} ({t.categoria}), es_instalacion(prop): {es_inst_prop}, es_instalacion(json): {es_inst_json}, precio: {t.precio_base}")
            if es_inst_prop or es_inst_json:
                # Verificar que NO sea un ticket de anexo y sea de la categoría 'instalacion' (para evitar confusión con traslados)
                es_anexo = t.instalacion_anexo or (t.funciones_especiales and t.funciones_especiales.get('instalacion_anexo', {}).get('activado'))
                if not es_anexo and t.categoria == 'instalacion':
                    inst_ticket = t
                    logging.info(f"Ticket de instalación encontrado (NO anexo): {t.nombre_ticket}, precio: {t.precio_base}")
                    break
                else:
                    logging.info(f"Omitiendo ticket {t.nombre_ticket} porque es de anexo")
        if not inst_ticket:
            logging.warning("No se encontró ticket de instalación por función especial, usando valor por defecto")
        if inst_ticket:
            costo_instalacion_base = inst_ticket.precio_base
            logging.info(f"FINAL - Ticket de instalación: {inst_ticket.nombre_ticket}, precio base: {costo_instalacion_base}")

        # Buscar ticket de anexos por función especial o nombre
        anexo_ticket = None
        for t in t_templates:
            # Check both the property and the raw JSON for compatibility
            es_anexo = t.instalacion_anexo or (t.funciones_especiales and t.funciones_especiales.get('instalacion_anexo', {}).get('activado'))
            if es_anexo:
                anexo_ticket = t
                logging.info(f"Ticket con instalacion_anexo encontrado: {t.nombre_ticket}, precio: {t.precio_base}")
                break
        if not anexo_ticket:
            anexo_ticket = CatalogoTickets.objects.filter(nombre_ticket__icontains='anexo', activo=True).first()
            if anexo_ticket:
                logging.info(f"Ticket por nombre anexo: {anexo_ticket.nombre_ticket}, precio: {anexo_ticket.precio_base}")
        if anexo_ticket:
            costo_anexo_base = anexo_ticket.precio_base
            logging.info(f"FINAL - Ticket de anexo: {anexo_ticket.nombre_ticket}, precio base: {costo_anexo_base}")
        else:
            logging.warning("No se encontró ningún ticket de anexo, usando valor por defecto")
    except Exception as e:
        import logging
        logging.error(f"Error buscando tickets de instalación/anexo: {e}")
        pass
    
    descuento_instalacion = (costo_instalacion_base * pct_instalacion / Decimal('100')).quantize(Decimal('0.01'))
    costo_instalacion = max(costo_instalacion_base - descuento_instalacion, Decimal('0'))
    
    if cuotas_instalacion > 1:
        instalacion_cuota_mensual = (costo_instalacion / cuotas_instalacion).quantize(Decimal('0.01'))
        instalacion_cobrar_ahora = instalacion_cuota_mensual
    else:
        instalacion_cuota_mensual = costo_instalacion
        instalacion_cobrar_ahora = costo_instalacion

    # Planes mensuales — leer tanto 'pct_descuento_plan' como alias 'descuento_plan' del frontend
    pct_plan = _decimal(datos.get('pct_descuento_plan') or datos.get('descuento_plan') or 0)
    pct_max_plan = _decimal(planes_mensuales.get('descuento_maximo_porcentaje') or 100)
    meses_descuento = int(datos.get('meses_descuento') or 0)
    meses_max = int(planes_mensuales.get('meses_maximos') or 0)
    
    if meses_max == 0:
        pct_plan = Decimal('0')
        meses_descuento = 0
    elif pct_plan > pct_max_plan:
        pct_plan = pct_max_plan
    
    if meses_descuento > meses_max:
        meses_descuento = meses_max
    
    descuento_plan = (costo_plan * pct_plan / Decimal('100')).quantize(Decimal('0.01'))
    costo_plan_con_descuento = max(costo_plan - descuento_plan, Decimal('0'))
    
    # Calculate discount end date
    fecha_fin_descuento = None
    if meses_descuento > 0:
        from datetime import date, timedelta
        fecha_fin_descuento = date.today() + timedelta(days=meses_descuento * 30)
    
    # Calculate anexos cost (first anexo is free, additional ones are charged)
    costo_anexos_base = Decimal('0')
    num_anexos = int(datos.get('num_anexos') or 0)
    if plan and num_anexos > 0:
        # First anexo is free, additional ones are charged
        anexos_cobrables = max(0, num_anexos - 1)
        # Cost per additional anexo from active catalog template if present, else fallback to plan additional TV cost
        costo_por_anexo = costo_anexo_base
        if not anexo_ticket and hasattr(plan, 'costo_conexion_tv_adicional') and plan.costo_conexion_tv_adicional:
            costo_por_anexo = Decimal(str(plan.costo_conexion_tv_adicional))
        costo_anexos_base = anexos_cobrables * costo_por_anexo

    # Aplicar descuento a anexos (usando el mismo porcentaje que instalación)
    pct_anexos = pct_instalacion  # Usar el mismo descuento que tickets de cobro
    descuento_anexos = (costo_anexos_base * pct_anexos / Decimal('100')).quantize(Decimal('0.01'))
    costo_anexos = max(costo_anexos_base - descuento_anexos, Decimal('0'))

    # Modo de pago del plan: CONTADO (adelantado) o FIN_MES
    omitir_adelanto = bool(datos.get('omitir_adelanto_plan'))
    modo_plan = (datos.get('modo_pago_plan') or 'FIN_MES').upper()
    adelanto_plan = Decimal('0')
    if modo_plan == 'CONTADO' and not omitir_adelanto:
        # Pago adelantado: cobrar plan + apps ahora
        adelanto_plan = costo_plan_con_descuento + costo_apps_con_descuento

    # Total a cobrar ahora (como compra):
    # - Deuda (con descuento)
    # - + Plan (si pago adelantado)
    # - + Apps (si pago adelantado)
    # - + Instalación (con descuento)
    # - + Anexos (con descuento)
    total_cobrar = deuda_cobrar_ahora + adelanto_plan + instalacion_cobrar_ahora + costo_anexos

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
        'costo_instalacion_base': float(costo_instalacion_base),
        'costo_instalacion': float(costo_instalacion),
        'instalacion_cobrar_ahora': float(instalacion_cobrar_ahora),
        'instalacion_cuota_mensual': float(instalacion_cuota_mensual),
        'cuotas_instalacion': cuotas_instalacion,
        'adelanto_plan': float(adelanto_plan),
        'costo_plan_mensual': float(costo_plan),
        'costo_plan_con_descuento': float(costo_plan_con_descuento),
        'pct_descuento_plan_aplicado': float(pct_plan),
        'meses_descuento_plan': meses_descuento,
        'fecha_fin_descuento': fecha_fin_descuento.isoformat() if fecha_fin_descuento else None,
        'costo_apps_mensual': float(costo_apps),
        'costo_apps_con_descuento': float(costo_apps_con_descuento),
        'pct_descuento_apps_aplicado': float(pct_apps),
        'meses_descuento_apps': meses_descuento_apps,
        'fecha_fin_descuento_apps': fecha_fin_descuento_apps.isoformat() if fecha_fin_descuento_apps else None,
        'costo_anexos': float(costo_anexos),
        'costo_anexo_base': float(costo_anexo_base),
        'descuento_anexos': float(descuento_anexos),
        'pct_descuento_anexos_aplicado': float(pct_anexos),
        'num_anexos': num_anexos,
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

"""
Datos enriquecidos para la ficha del abonado (por suscripción / servicio).
"""
from datetime import timedelta

from django.db.models import Q

from core.abonados.lista import sistema_deudas_cliente
from core.abonados.evaluacion import sistema_rucs_emision_sede
from core.tickets.liquidacion import sistema_leer_liquidacion
from core.abonados.permisos import contexto_permisos_ficha
from core.models.models_generados import (
    CatalogoTickets, ComprobantesSunat, Deudas, SedeRuc, Tickets,
)
from core.abonados.generador import (
    obtener_codigo_cliente_actualizado,
    obtener_codigo_servicio_actualizado,
    obtener_codigo_ticket_actualizado,
    resolver_sector_servicio,
)


def _tickets_suscripcion(suscripcion_id):
    qs = Tickets.objects.filter(servicio_id=suscripcion_id).order_by('-fecha_creacion')[:50]
    items = []
    for t in qs:
        # Fetching assignee name (single technician from tecnico_asignado_id)
        tecnicos = []
        if t.tecnico_asignado_id:
            from core.models.usuarios import Usuario
            try:
                tecnico = Usuario.objects.get(pk=t.tecnico_asignado_id)
                tecnicos = [tecnico.nombre_completo]
            except Usuario.DoesNotExist:
                pass
        
        liq = sistema_leer_liquidacion(t.id)
        if liq:
            if t.fecha_liquidacion:
                liq['fecha_liquidacion'] = t.fecha_liquidacion
            personal_id = liq.get('personal_id')
            if personal_id:
                from core.models.usuarios import Usuario
                try:
                    user = Usuario.objects.get(pk=personal_id)
                    liq['usuario_liquidacion'] = {
                        'nombre_apellidos': user.nombre_apellidos
                    }
                except Usuario.DoesNotExist:
                    liq['usuario_liquidacion'] = {
                        'nombre_apellidos': f"Usuario #{personal_id}"
                    }
        items.append({
            'id': t.id,
            'codigo_ticket': obtener_codigo_ticket_actualizado(t),
            'tipo_ticket': t.tipo_ticket,
            'estado_ticket': t.estado_ticket,
            'fecha_creacion': t.fecha_creacion,
            'fecha_liquidacion': t.fecha_liquidacion,
            'catalogo_nombre': t.nombre_ticket,
            'area': t.area,
            'modalidad': t.modalidad,
            'cobra_materiales': False,
            'liquidacion': liq,
            'tecnicos': tecnicos,
            'motivo': t.nombre_ticket or '',
            'detalle': t.notas or '',
            'observacion': t.notas or '',
            'notas': t.notas or '',
        })
    return items


def _get_comprobante_url(abono_obj, cliente_id):
    if not abono_obj:
        return None
        
    ruc_id = abono_obj.ruc_emisor_id or 1
    num_doc = abono_obj.numero_documento
    
    # 1. Try matching using numero_documento if populated
    if num_doc:
        if num_doc.startswith('NV-'):
            try:
                nv_id = int(num_doc.replace('NV-', ''))
                return f"/api/sede/rucs/{ruc_id}/comprobante/{nv_id}/vista-previa/?tipo=NOTA_VENTA"
            except ValueError:
                pass
        else:
            parts = num_doc.split('-')
            if len(parts) == 2:
                serie, correlativo_str = parts[0], parts[1]
                try:
                    correlativo = int(correlativo_str)
                    from core.models.models_generados import ComprobantesSunat
                    comp = ComprobantesSunat.objects.filter(
                        ruc_emisor_id=ruc_id,
                        serie=serie,
                        correlativo=correlativo
                    ).first()
                    if comp:
                        return f"/api/sede/rucs/{ruc_id}/comprobante/{comp.id}/vista-previa/"
                except ValueError:
                    pass

    # 2. Fallback to match by type and amount for legacy records
    tipo_doc = abono_obj.tipo_documento or ''
    if tipo_doc.lower() in ('boleta', 'factura'):
        from core.models.models_generados import ComprobantesSunat
        comp = ComprobantesSunat.objects.filter(
            cliente_id=str(cliente_id),
            tipo_comprobante=tipo_doc.upper(),
            monto_total=abono_obj.monto
        ).order_by('-fecha_emision').first()
        if comp:
            return f"/api/sede/rucs/{ruc_id}/comprobante/{comp.id}/vista-previa/"
    elif tipo_doc.lower() == 'nota_venta':
        from core.models.models_generados import NotasVentaInternas
        nv = NotasVentaInternas.objects.filter(
            cliente_id=str(cliente_id),
            monto_total=abono_obj.monto
        ).order_by('-fecha_registro').first()
        if nv:
            return f"/api/sede/rucs/{ruc_id}/comprobante/{nv.id}/vista-previa/?tipo=NOTA_VENTA"
            
    return f"/api/sede/rucs/{ruc_id}/comprobante/vista-previa/?abono_id={abono_obj.id}"


def _periodo_pagado_servicio(servicio):
    """
    Calcula el rango de fechas pagadas del servicio.
    Retorna dict con: pagado_desde, pagado_hasta, meses_pagados, tiene_deuda_pendiente.
    """
    from core.models.facturacion import FacturacionPagos
    import re

    def es_cargo_plan(cargo):
        desc_lower = (cargo.descripcion or '').lower()
        return (
            bool(getattr(cargo, 'cuota_mensual_indexada', False))
            or 'mensualidad' in desc_lower
            or 'plan' in desc_lower
        )

    def inicio_periodo(cargo, cargo_anterior):
        if cargo_anterior and cargo_anterior.fecha_vencimiento:
            return cargo_anterior.fecha_vencimiento + timedelta(days=1)
        if servicio.fecha_instalacion:
            return servicio.fecha_instalacion
        if cargo.fecha_vencimiento:
            return cargo.fecha_vencimiento.replace(day=1)
        return None

    cargos = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='cargo'
    ).order_by('fecha_vencimiento')

    abonos = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='abono'
    )

    montos_pagados_por_cargo = {}
    for ab in abonos:
        match = re.search(r'\[PAGO_CARGO_ID:\s*(\d+)\]', ab.descripcion or '')
        if match:
            cargo_id = int(match.group(1))
            montos_pagados_por_cargo[cargo_id] = montos_pagados_por_cargo.get(cargo_id, 0) + (ab.monto or 0)

    fechas_pagadas = []
    inicios_pagados = []
    tiene_pendiente = False
    cargo_plan_anterior = None
    for c in cargos:
        if not es_cargo_plan(c):
            continue
        monto_pagado = montos_pagados_por_cargo.get(c.id, 0)
        if c.monto <= 0 or monto_pagado >= c.monto:
            if c.fecha_vencimiento:
                inicio = inicio_periodo(c, cargo_plan_anterior)
                if inicio:
                    inicios_pagados.append(inicio)
                fechas_pagadas.append(c.fecha_vencimiento)
        else:
            tiene_pendiente = True
        cargo_plan_anterior = c

    if not fechas_pagadas:
        return {
            'pagado_desde': None,
            'pagado_hasta': None,
            'meses_pagados': 0,
            'tiene_deuda_pendiente': tiene_pendiente,
        }

    return {
        'pagado_desde': min(inicios_pagados) if inicios_pagados else min(fechas_pagadas),
        'pagado_hasta': max(fechas_pagadas),
        'meses_pagados': len(fechas_pagadas),
        'tiene_deuda_pendiente': tiene_pendiente,
    }


def _deudas_suscripcion(servicio):
    from core.models.facturacion import FacturacionPagos
    import re

    cargos = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='cargo'
    ).order_by('-fecha_transaccion')[:15]
    
    abonos = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='abono'
    )
    
    pagados_ids = set()
    abonos_map = {}
    for ab in abonos:
        match = re.search(r'\[PAGO_CARGO_ID:\s*(\d+)\]', ab.descripcion or '')
        if match:
            cargo_id = int(match.group(1))
            pagados_ids.add(cargo_id)
            abonos_map[cargo_id] = ab
            
    compromisos = {}
    if isinstance(servicio.control_operativo_json, dict) and 'compromisos_pago' in servicio.control_operativo_json:
        compromisos = servicio.control_operativo_json['compromisos_pago']

    deudas_list = []
    for d in cargos:
        is_paid = d.id in pagados_ids
        if d.tipo_transaccion == 'exoneracion':
            estado_txt = 'BENEFICIO' if d.monto and d.monto > 0 else 'GRATIS'
        elif d.monto <= 0:
            estado_txt = 'GRATIS'
        else:
            estado_txt = 'PAGADO' if is_paid else ('COMPROMISO' if (str(d.id) in compromisos or d.id in compromisos) else 'PENDIENTE')
            
        desc_lower = (d.descripcion or '').lower()
        es_plan = (
            bool(getattr(d, 'cuota_mensual_indexada', False))
            or getattr(d, 'tipo_documento', '').lower() in ('boleta', 'factura')
            or 'mensualidad' in desc_lower
            or 'cuota mensual' in desc_lower
            or 'pago adelanto' in desc_lower
            or 'adelanto' in desc_lower
            or 'plan ' in desc_lower
        )

        abono_obj = abonos_map.get(d.id)
        evidencia_url = None
        comprobante_url = None
        usuario_registro = d.vendedor
        numero_documento = d.numero_documento or ''
        tipo_documento = (d.tipo_documento or 'nota_venta').upper()
        if abono_obj:
            usuario_registro = abono_obj.vendedor or d.vendedor
            numero_documento = abono_obj.numero_documento or numero_documento
            tipo_documento = (abono_obj.tipo_documento or d.tipo_documento or 'nota_venta').upper()
            if abono_obj.descripcion:
                match_ev = re.search(r'Evidencia:\s*([^\s\|]+)', abono_obj.descripcion)
                if match_ev:
                    evidencia_url = match_ev.group(1)
            comprobante_url = _get_comprobante_url(abono_obj, servicio.cliente_id)

        deudas_list.append({
            'id': d.id,
            'concepto': d.descripcion or 'Cargo por servicio',
            'monto_actual': float(d.monto),
            'fecha_vencimiento': d.fecha_vencimiento,
            'fecha_compromiso_pago': compromisos.get(str(d.id)) or compromisos.get(d.id),
            'estado': estado_txt,
            'created_at': d.fecha_creacion,
            'usuario_registro': usuario_registro,
            'es_plan': es_plan,
            'tipo_documento': tipo_documento.replace('_', ' '),
            'numero_documento': numero_documento,
            'evidencia_url': evidencia_url,
            'comprobante_url': comprobante_url,
        })
        
    if not deudas_list and servicio.deuda_acumulada and servicio.deuda_acumulada > 0:
        deudas_list.append({
            'id': 0,
            'concepto': 'Deuda acumulada de servicio',
            'monto_actual': float(servicio.deuda_acumulada),
            'fecha_vencimiento': None,
            'fecha_compromiso_pago': None,
            'estado': 'PENDIENTE',
            'created_at': servicio.fecha_creacion,
            'usuario_registro': None,
            'es_plan': False,
            'evidencia_url': None,
            'comprobante_url': None,
        })
    return deudas_list


def _comprobantes_cliente(cliente_id, limite=20):
    from core.models.models_generados import Abonados, ComprobantesSunat, NotasVentaInternas
    from django.utils import timezone
    
    # Resolve client integer PK from code string or use it directly
    c_id = None
    try:
        if isinstance(cliente_id, str) and not cliente_id.isdigit():
            from core.abonados.geoutils import parse_cliente_id
            parsed = parse_cliente_id(cliente_id)
            c_id = str(parsed) if parsed else None
        else:
            c_id = str(cliente_id)
    except Exception:
        return []
        
    if not c_id:
        return []
        
    res = []
    
    # Query ComprobantesSunat
    comp_qs = ComprobantesSunat.objects.filter(cliente_id=c_id).order_by('-fecha_emision')[:limite]
    for comp in comp_qs:
        ruc_emisor = comp.ruc_emisor
        ruc_num = ruc_emisor.ruc_numero if ruc_emisor else ''
        res.append({
            'tipo': comp.tipo_comprobante,
            'serie': comp.serie,
            'correlativo': str(comp.correlativo).zfill(7),
            'monto_total': float(comp.monto_total),
            'ruc_emisor': ruc_num,
            'fecha_emision': comp.fecha_emision,
            'preview_url': f"/api/sede/rucs/{comp.ruc_emisor_id or 1}/comprobante/{comp.id}/vista-previa/",
        })
        
    # Query NotasVentaInternas
    nv_qs = NotasVentaInternas.objects.filter(cliente_id=c_id).order_by('-fecha_registro')[:limite]
    for nv in nv_qs:
        res.append({
            'tipo': 'NOTA DE VENTA',
            'serie': 'NV01',
            'correlativo': str(nv.id).zfill(7),
            'monto_total': float(nv.monto_total),
            'ruc_emisor': '—',
            'fecha_emision': nv.fecha_registro,
            'preview_url': f"/api/sede/rucs/1/comprobante/{nv.id}/vista-previa/?tipo=NOTA_VENTA",
        })
        
    # Sort all by date descending (handling None/null dates gracefully)
    res.sort(key=lambda x: x['fecha_emision'] or timezone.now(), reverse=True)
    return res[:limite]


def _contrato_plantilla_sede(sede_id, ruc_id=None):
    qs = SedeRuc.objects.filter(sede_id=sede_id).select_related('ruc')
    if ruc_id:
        qs = qs.filter(ruc_id=ruc_id)
    sr = next((x for x in qs if x.activo), None)
    if not sr:
        return None
    return {
        'ruc_id': sr.ruc_id,
        'numero_ruc': sr.ruc.ruc_numero,
        'razon_social': sr.ruc.razon_social,
        'contrato_pdf_path': sr.contrato_pdf_path,
        'contrato_url': f'/media/{sr.contrato_pdf_path}' if sr.contrato_pdf_path else None,
    }


def _serialize_tickets(tickets_list):
    import json
    from django.utils import timezone
    serializable = []
    for t in tickets_list:
        item = t.copy()
        fc = t.get('fecha_creacion')
        if fc and hasattr(fc, 'strftime'):
            item['fecha_creacion'] = timezone.localtime(fc).strftime('%d/%m/%Y %H:%M')
        else:
            item['fecha_creacion'] = str(fc or '')
        
        fl = t.get('fecha_liquidacion')
        if fl and hasattr(fl, 'strftime'):
            item['fecha_liquidacion'] = timezone.localtime(fl).strftime('%d/%m/%Y %H:%M')
        else:
            item['fecha_liquidacion'] = str(fl or '')
        
        # If there's a liquidación dictionary, also format any datetime objects inside it
        if item.get('liquidacion') and isinstance(item['liquidacion'], dict):
            liq = item['liquidacion'].copy()
            fl_liq = liq.get('fecha_liquidacion')
            if fl_liq:
                if hasattr(fl_liq, 'strftime'):
                    liq['fecha_liquidacion'] = timezone.localtime(fl_liq).strftime('%d/%m/%Y %H:%M')
                else:
                    liq['fecha_liquidacion'] = str(fl_liq)
            item['liquidacion'] = liq
            
        serializable.append(item)
    return json.dumps(serializable)


def sistema_detalle_ficha_cliente(cliente, suscripciones, cargo_usuario=''):
    """
    Construye suscripciones_detalles para la plantilla ficha.html.
    """
    import json
    from django.db.models import Q
    deudas_globales = sistema_deudas_cliente(cliente.id_cliente_codigo)
    comprobantes = _comprobantes_cliente(cliente.id_cliente_codigo)
    tiene_servicio_activo = any(
        sub.plan_id and sub.plan.tipo_servicio.lower() == 'servicio' and sub.estado_servicio.lower() == 'activo'
        for sub in suscripciones
    )
    app_bonificada_encontrada = False
    detalles = []

    for sub in suscripciones:
        sede_id = sub.plan.sede.id if sub.plan and sub.plan.sede else None
        catalogo = []
        if sede_id:
            catalogo = list(
                CatalogoTickets.objects.filter(activo=True)
                .values(
                    'id', 'nombre_ticket', 'area', 'categoria', 'tecnologia', 'modalidad', 
                    'precio_base', 'configuracion_reglas', 'funciones_especiales'
                )[:100]
            )
            # Convert Decimal fields to float for JSON serialization
            for ticket in catalogo:
                if ticket['precio_base'] is not None:
                    ticket['precio_base'] = float(ticket['precio_base'])

        tickets = _tickets_suscripcion(sub.id_suscripcion)
        
        # Obtener materiales consumidos/liquidados de los tickets de la suscripcion
        materiales_list = []
        for ticket in tickets:
            if ticket.get('liquidacion') and isinstance(ticket['liquidacion'], dict):
                materiales = ticket['liquidacion'].get('materiales', [])
                for mat in materiales:
                    tipo_accion = "Retiro" if "[RETIRO]" in mat.get('descripcion', '').upper() else "Instalado/Usado"
                    nombre_limpio = mat.get('descripcion', '').replace("[RETIRO]", "").replace("[retiro]", "").strip()
                    materiales_list.append({
                        'id': mat.get('id'),
                        'nombre_material': nombre_limpio,
                        'cantidad': float(mat.get('cantidad', 0)),
                        'fecha_asignacion': ticket.get('fecha_creacion'),
                        'estado': 'LIQUIDADO',
                        'tipo_accion': tipo_accion,
                        'se_cobra': "SÍ" if mat.get('precio_unitario', 0) > 0 else "NO",
                        'precio_total': float(mat.get('cantidad', 0) * mat.get('precio_unitario', 0)),
                        'ticket_id': ticket.get('id'),
                    })

        # Calculate net materials the client currently has installed
        net_materiales = {}
        for m in materiales_list:
            nombre = m['nombre_material']
            cant = m['cantidad']
            if m['tipo_accion'] == 'Instalado/Usado':
                net_materiales[nombre] = net_materiales.get(nombre, 0.0) + cant
            else: # Retiro
                net_materiales[nombre] = net_materiales.get(nombre, 0.0) - cant
        
        # Filter to only keep materials with a net quantity > 0
        materiales_cliente = [
            {'nombre': k, 'cantidad_disponible': float(v)}
            for k, v in net_materiales.items() if v > 0
        ]
        # Fetch cache_api_suministro data
        cache_suministro = None
        cache_suministro_dict = None
        try:
            from core.models.models_generados import CacheSuministro
            cache_suministro = CacheSuministro.objects.filter(
                numero_suministro=sub.numero_suministro
            ).first()
            if cache_suministro:
                cache_suministro_dict = {
                    'numero_suministro': cache_suministro.numero_suministro,
                    'empresa_electrica': getattr(cache_suministro, 'empresa_electrica', 'Distriluz') or 'Distriluz',
                    'direccion_registrada': cache_suministro.direccion,
                    'distrito': cache_suministro.distrito,
                    'provincia': cache_suministro.provincia,
                    'departamento': cache_suministro.departamento,
                    'titular_nombre': cache_suministro.datos_json.get('nombre') if cache_suministro.datos_json else 'Titular',
                    'titular_documento': cache_suministro.datos_json.get('documento') if cache_suministro.datos_json else '',
                    'gps_latitud': float(cache_suministro.gps_latitud) if cache_suministro.gps_latitud else None,
                    'gps_longitud': float(cache_suministro.gps_longitud) if cache_suministro.gps_longitud else None,
                    'raw_response_json': cache_suministro.raw_response_json,
                    'detalles': getattr(cache_suministro, 'detalles', None),
                    'ultima_actualizacion': cache_suministro.ultima_actualizacion,
                    'tiene_deuda_pendiente': cache_suministro.datos_json.get('tiene_deuda_pendiente') if cache_suministro.datos_json else False,
                    'monto_deuda_pendiente': cache_suministro.datos_json.get('monto_deuda_pendiente') if cache_suministro.datos_json else 0.0,
                    'cliente_deudor_id': cache_suministro.datos_json.get('cliente_deudor_id') if cache_suministro.datos_json else None,
                    'fecha_ultima_revision_deuda': getattr(cache_suministro, 'fecha_ultima_revision_deuda', None),
                }
        except Exception:
            pass
        # Logo: buscar primer sede_ruc con logo configurado
        logo_url = ''
        if sede_id:
            try:
                from core.models.models_generados import SedeRuc
                srs = SedeRuc.objects.filter(sede_id=sede_id)
                sr = next((x for x in srs if x.logo_url), None)
                if sr and sr.logo_url:
                    logo_url = sr.logo_url
                else:
                    sr_ruc = next((x for x in srs), None)
                    if sr_ruc and sr_ruc.ruc.logo_url:
                        logo_url = sr_ruc.ruc.logo_url
            except Exception:
                pass

        # Convert YYYY-MM-DD to DD/MM/YYYY for display if it exists
        from datetime import datetime, date
        fecha_limite_corte_display = '—'
        flc = sub.fecha_limite_corte
        if flc:
            if isinstance(flc, str) and len(flc) >= 10:
                try:
                    fecha_limite_corte_display = datetime.strptime(flc[:10], '%Y-%m-%d').strftime('%d/%m/%Y')
                except ValueError:
                    fecha_limite_corte_display = flc
            elif hasattr(flc, 'strftime'):
                fecha_limite_corte_display = flc.strftime('%d/%m/%Y')

        sector_resuelto = resolver_sector_servicio(sub)

        service_data = {
            "codigo_servicio": obtener_codigo_servicio_actualizado(sub),
            "id_suscripcion": sub.id,
            "plan_nombre": sub.plan.nombre_plan if sub.plan_id else '—',
            "plan": sub.plan.nombre_plan if sub.plan_id else '—',
            "sede_nombre": sub.plan.sede.nombre if sub.plan_id and sub.plan.sede else '—',
            "sede_telefono": sub.plan.sede.telefono if sub.plan_id and sub.plan.sede and sub.plan.sede.telefono else '064466080',
            "suministro": sub.numero_suministro or '—',
            "suministro_direccion": cache_suministro_dict.get('direccion_registrada') if cache_suministro_dict and cache_suministro_dict.get('direccion_registrada') else sub.direccion_servicio,
            "referencia_domicilio": sub.referencia_domicilio or '—',
            "observaciones": sub.observaciones or '—',
            "sector_nombre": sector_resuelto.nombre if sector_resuelto else '—',
            "sector": sector_resuelto.nombre if sector_resuelto else '—',
            "presinto_numero": sub.presinto_numero or '—',
            "nap_id": sub.caja_nap_id if getattr(sub, 'caja_nap_id', None) else '—',
            "puerto_nap": sub.puerto_nap or '—',
            "borne": sub.hub_borne_referencia or '—',
            "numero_anexos": sub.numero_anexos or 0,
            "velocidad": f"{sub.plan.velocidad_mbps} Mbps" if (sub.plan_id and sub.plan.velocidad_mbps) else '—',
            "estado": sub.estado_servicio.upper() if sub.estado_servicio else '—',
            "modelo_equipo": sub._get_dato_tecnico('router_modelo', '—'),
            "serie_equipo": sub.router_serie or '—',
            "mac_equipo": sub.router_mac or '—',
            "fecha_instalacion": sub.fecha_instalacion.strftime('%Y-%m-%d') if sub.fecha_instalacion else '',
            "fecha_limite_corte": sub.fecha_limite_corte or '',
            "logo_url": logo_url,
            "sede_logo": logo_url,
        }

        # Check if the service was created within the last 48 hours and is not yet active (or if state is pending/not active)
        from django.utils import timezone
        from datetime import timedelta
        permite_cambio_plan = False
        if sub.fecha_creacion:
            within_48_hours = (timezone.now() - sub.fecha_creacion) <= timedelta(hours=48)
            permite_cambio_plan = within_48_hours and (sub.estado_servicio.lower() != 'activo')
        
        # Check if there's a pending offer approval
        oferta_pendiente = False
        if isinstance(sub.control_operativo_json, dict):
            oferta = sub.control_operativo_json.get('oferta', {})
            if oferta.get('estado') == 'pendiente_aprobacion':
                oferta_pendiente = True

        from core.abonados.contextovendedor import sistema_planes_por_sede
        planes_sede = sistema_planes_por_sede(sede_id) if sede_id else []
        planes_sede_json = json.dumps(planes_sede)

        # Obtener beneficios activos del servicio
        from core.abonados.pagos import sistema_obtener_beneficios_activos
        beneficios_activos = sistema_obtener_beneficios_activos(sub.id)

        detalles.append({
            'obj': sub,
            'codigo_servicio': sub.id_suscripcion,
            'codigo_servicio_display': obtener_codigo_servicio_actualizado(sub),
            'fecha_limite_corte_display': fecha_limite_corte_display,
            'plan_tipo_servicio': sub.plan.tipo_servicio.upper() if sub.plan_id and sub.plan.tipo_servicio else '',
            'deudas': _deudas_suscripcion(sub),
            'periodo_pagado': _periodo_pagado_servicio(sub),
            'materiales': materiales_list,
            'modelo_equipo': sub._get_dato_tecnico('router_modelo', '—'),
            'serie_equipo': sub.router_serie or '—',
            'mac_equipo': sub.router_mac or '—',
            'tickets': tickets,
            'tickets_tac': [
                t for t in tickets
                if 'externa' not in (t.get('area') or '').lower() and (t.get('modalidad') or '').lower() not in ('campo', 'presencial')
            ],
            'tickets_campo': [
                t for t in tickets
                if 'externa' in (t.get('area') or '').lower() or (t.get('modalidad') or '').lower() in ('campo', 'presencial')
            ],
            'total_mensual': 0.0 if (tiene_servicio_activo and sub.plan_id and sub.plan.tipo_servicio.lower() == 'app' and sub.estado_servicio.lower() == 'activo' and not app_bonificada_encontrada) else (float(sub.plan.costo_plan) if sub.plan_id else 0),
            'admite_compromiso': bool(getattr(sub.plan, 'admite_compromiso_pago', True)) if sub.plan_id else False,
            'oferta_pendiente': oferta_pendiente,
            'beneficios_activos': beneficios_activos,
            'rucs_emision': sistema_rucs_emision_sede(sede_id),
            'contrato_plantilla': _contrato_plantilla_sede(sede_id),
            'catalogo_tickets': catalogo,
            'catalogo_tickets_json': json.dumps(catalogo),
            'planes_sede_json': planes_sede_json,
            'permite_cambio_plan': permite_cambio_plan,
            'tickets_json': _serialize_tickets(tickets),
            'service_data_json': json.dumps(service_data),
            'materiales_cliente_json': json.dumps(materiales_cliente),
            'hub_borne_referencia': getattr(sub, 'hub_borne_referencia', '') or '',
            'numero_anexos': getattr(sub, 'numero_anexos', 0) or 0,
            'cache_suministro': cache_suministro_dict,
            'logo_url': logo_url,
            'velocidad': f"{sub.plan.velocidad_mbps} Mbps" if (sub.plan_id and sub.plan.velocidad_mbps) else '—',
        })

    # Transformar tipo_cliente para mostrar residencial/corporativo
    tipo_cliente_display = '—'
    if cliente.tipo_cliente == 'natural':
        tipo_cliente_display = 'residencial'
    elif cliente.tipo_cliente == 'juridico':
        tipo_cliente_display = 'corporativo'

    client_data = {
        "id": cliente.id_cliente_codigo,
        "id_cliente_codigo": cliente.id_cliente_codigo,
        "tipo_cliente": tipo_cliente_display,
        "dni": cliente.dni or '',
        "ruc": cliente.ruc or '',
        "nombres_apellidos": cliente.nombre_apellidos or '',
        "razon_social": cliente.razon_social or '',
        "fecha_nacimiento": cliente.fecha_nacimiento.strftime('%Y-%m-%d') if cliente.fecha_nacimiento else '',
        "estado_civil": cliente.estado_civil or '',
        "celular_1": cliente.celular_1 or '',
        "celular_2": cliente.celular_2 or '',
        "correo": cliente.correo or '',
        "direccion_fiscal": cliente.direccion_fiscal or '',
    }

    return {
        'suscripciones_detalles': detalles,
        'deudas_globales': deudas_globales,
        'comprobantes': comprobantes,
        'documento_facturacion': cliente.ruc or cliente.dni,
        'tipo_documento': 'RUC' if cliente.ruc else 'DNI',
        'permisos': contexto_permisos_ficha(cargo_usuario),
        'client_data_json': json.dumps(client_data),
    }

from datetime import datetime
from django.http import JsonResponse
from core.models.models_generados import RucsGlobales, ComprobantesSunat
from core.auth.comun import checksession, senderror

def listar(request):
    """
    API asíncrona para listar comprobantes de SUNAT y calcular KPIs con filtros.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    ruc_emisor_id = request.GET.get('ruc_emisor_id')
    tipo_comprobante = request.GET.get('tipo_comprobante')
    estado_sunat = request.GET.get('estado_sunat')
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    search = request.GET.get('search', '').strip().lower()

    qs = ComprobantesSunat.objects.all()

    if ruc_emisor_id:
        qs = qs.filter(ruc_emisor_id=int(ruc_emisor_id))
    if tipo_comprobante:
        qs = qs.filter(tipo_comprobante=tipo_comprobante)
    if estado_sunat:
        qs = qs.filter(estado_sunat=estado_sunat)

    if fecha_inicio:
        try:
            f_ini = datetime.strptime(fecha_inicio, '%Y-%m-%d').date()
            qs = [c for c in qs if c.fecha_emision and c.fecha_emision.date() >= f_ini]
        except ValueError:
            pass

    if fecha_fin:
        try:
            f_fin = datetime.strptime(fecha_fin, '%Y-%m-%d').date()
            qs = [c for c in qs if c.fecha_emision and c.fecha_emision.date() <= f_fin]
        except ValueError:
            pass

    if search:
        filtered_qs = []
        for c in qs:
            match = False
            num_comp = f"{c.serie}-{c.correlativo:08d}".lower()
            if search in num_comp or search in c.serie.lower() or search in str(c.correlativo):
                match = True
            
            cliente = c.cliente
            if cliente:
                nom = (cliente.razon_social or cliente.nombre_apellidos or '').lower()
                doc = (cliente.ruc or cliente.dni or '').lower()
                if search in nom or search in doc:
                    match = True
            
            if match:
                filtered_qs.append(c)
        qs = filtered_qs

    total_emitidos = 0
    total_pendientes = 0
    total_rechazados = 0
    monto_total_declarado = 0.0

    listado_serializado = []
    for c in qs:
        est = getattr(c, 'estado_sunat', 'pendiente')
        monto = float(c.monto_total or 0.0)

        if est == 'emitido':
            total_emitidos += 1
            monto_total_declarado += monto
        elif est == 'pendiente':
            total_pendientes += 1
        elif est == 'rechazado':
            total_rechazados += 1

        cliente = c.cliente
        ruc_emisor = c.ruc_emisor
        
        listado_serializado.append({
            'id': c.id,
            'ruc_emisor_num': ruc_emisor.ruc_numero if ruc_emisor else '—',
            'ruc_emisor_nombre': ruc_emisor.razon_social if ruc_emisor else '—',
            'cliente_nombre': (cliente.razon_social or cliente.nombre_apellidos) if cliente else 'Cliente Desconocido',
            'cliente_documento': (cliente.ruc or cliente.dni) if cliente else '—',
            'tipo_comprobante': c.tipo_comprobante,
            'numero': f"{c.serie}-{c.correlativo:08d}",
            'fecha_emision': c.fecha_emision.strftime('%Y-%m-%d %H:%M:%S') if c.fecha_emision else '—',
            'monto_total': monto,
            'estado_sunat': est,
            'codigo_hash': getattr(c, 'codigo_hash', '—'),
            'xml_url': c.xml_url or '',
            'pdf_url': c.pdf_url or '',
            'mensaje_error': getattr(c, 'mensaje_error_sunat', '')
        })

    rucs_list = []
    for r in RucsGlobales.objects.all():
        rucs_list.append({
            'id': r.id,
            'ruc_numero': r.ruc_numero,
            'razon_social': r.razon_social
        })

    listado_serializado.sort(key=lambda x: x['id'], reverse=True)

    return JsonResponse({
        'status': 'success',
        'comprobantes': listado_serializado,
        'kpis': {
            'total_emitidos': total_emitidos,
            'total_pendientes': total_pendientes,
            'total_rechazados': total_rechazados,
            'monto_total_declarado': round(monto_total_declarado, 2)
        },
        'rucs': rucs_list
    })

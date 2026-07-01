from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from core.models.models_generados import ServiciosAbonados, FacturacionPagos
from core.auth.comun import senderror


@csrf_exempt
@require_GET
def materialesdisponibles(request):
    """
    GET /api/abonados/materiales-disponibles/?cliente_id=...&suministro_id=...
    Lista los materiales de tickets liquidados del servicio que aún no han sido cobrados.
    Excluye materiales ya registrados en FacturacionPagos.metadata_transaccion_json['materiales_cobrados'].
    """
    cliente_id = request.GET.get('cliente_id')
    suministro_id = request.GET.get('suministro_id')

    if not all([cliente_id, suministro_id]):
        return senderror('cliente_id y suministro_id son requeridos', status=400)

    from core.abonados.geoutils import parse_cliente_id
    parsed_id = parse_cliente_id(cliente_id)

    servicio = ServiciosAbonados.objects.filter(
        cliente_id=parsed_id,
        numero_suministro=suministro_id
    ).first()

    if not servicio:
        return senderror(f'No se encontró suscripción para el suministro {suministro_id}', status=400)

    # Obtener set de materiales ya cobrados para este servicio
    cobrados_set = set()
    pagos_con_materiales = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='cargo',
    ).exclude(metadata_transaccion_json={}).exclude(metadata_transaccion_json__isnull=True)

    for pago in pagos_con_materiales:
        meta = pago.metadata_transaccion_json
        if isinstance(meta, dict):
            for mc in meta.get('materiales_cobrados', []):
                if mc.get('ticket_id') and mc.get('descripcion'):
                    cobrados_set.add((int(mc['ticket_id']), str(mc['descripcion']).strip()))

    # Obtener tickets liquidados del servicio
    from core.models.models_generados import Tickets
    tickets_liq = Tickets.objects.filter(
        servicio=servicio,
        estado_ticket='LIQUIDADO',
    ).order_by('-fecha_liquidacion')

    materiales_disponibles = []
    for ticket in tickets_liq:
        materiales_json = getattr(ticket, 'materiales_consumidos_json', None) or []
        if not isinstance(materiales_json, list):
            continue

        for mat in materiales_json:
            if not isinstance(mat, dict):
                continue
            descripcion = str(mat.get('descripcion') or mat.get('nombre') or '').strip()
            if not descripcion:
                continue

            clave = (ticket.id, descripcion)
            if clave in cobrados_set:
                continue  # Ya fue cobrado

            materiales_disponibles.append({
                'ticket_id': ticket.id,
                'ticket_codigo': f"T{ticket.id}",
                'ticket_fecha': ticket.fecha_liquidacion.strftime('%d/%m/%Y') if ticket.fecha_liquidacion else '—',
                'descripcion': descripcion,
                'cantidad': float(mat.get('cantidad') or 1),
                'precio_unitario': float(mat.get('precio_unitario') or mat.get('precio') or 0),
                'precio_total': float(mat.get('precio_total') or (float(mat.get('precio_unitario') or 0) * float(mat.get('cantidad') or 1))),
                'tipo_accion': mat.get('tipo_accion') or 'usado',
            })

    return JsonResponse({
        'status': 'success',
        'data': {
            'materiales': materiales_disponibles,
            'total': len(materiales_disponibles),
        }
    })

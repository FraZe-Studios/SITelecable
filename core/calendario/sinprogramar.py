from django.http import JsonResponse
from core.models.models_generados import TicketsOrdenes
from core.auth.comun import checksession, senderror

def sinprogramar(request):
    """
    API asíncrona para listar tickets que aún no han sido programados.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    tickets = TicketsOrdenes.objects.filter(
        estado__in=['pendiente', 'asignado']
    ).select_related('servicio', 'servicio__cliente')

    sin_programar_list = []
    for t in tickets:
        if not t.fecha_programada:
            sin_programar_list.append({
                'id': t.id,
                'nombre': t.nombre_ticket,
                'categoria': t.categoria,
                'prioridad': t.prioridad,
                'cliente': t.servicio.cliente.razon_social or t.servicio.cliente.nombre_apellidos,
                'codigo_cliente': t.servicio.codigo,
                'direccion': t.servicio.direccion_servicio,
                'estado': t.estado
            })

    return JsonResponse({'status': 'success', 'tickets': sin_programar_list})

import json
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import TicketsOrdenes
from core.auth.comun import checksession, senderror

@csrf_exempt
def reprogramar(request):
    """
    API asíncrona para reprogramar un ticket (llamada por Drag and Drop).
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        data = json.loads(request.body)
        ticket_id = data.get('ticket_id')
        nueva_fecha = data.get('fecha_programada')
    except Exception:
        return senderror('JSON inválido', status=400)

    if not ticket_id or not nueva_fecha:
        return senderror('ticket_id y fecha_programada requeridos', status=400)

    try:
        t = TicketsOrdenes.objects.get(pk=int(ticket_id))
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)

    try:
        if nueva_fecha.endswith('Z'):
            nueva_fecha = nueva_fecha.replace('Z', '+00:00')
        dt = datetime.fromisoformat(nueva_fecha)
        t.fecha_programada = dt
        
        if t.configuracion_reglas is None:
            t.configuracion_reglas = {}
        cnt = t.configuracion_reglas.get('reprogramado_count', 0)
        t.configuracion_reglas['reprogramado_count'] = cnt + 1
        
        t.save()
    except Exception as e:
        return senderror(f'Error al parsear fecha: {str(e)}', status=400)

    return JsonResponse({
        'status': 'success',
        'message': f'Ticket "{t.nombre_ticket}" reprogramado correctamente para el {dt.strftime("%d/%m/%Y %H:%M")}'
    })

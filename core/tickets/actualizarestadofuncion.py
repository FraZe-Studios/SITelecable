import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def actualizarestadofuncion(request, ticket_id):
    """Actualiza el estado de una función especial"""
    try:
        data = json.loads(request.body)
        funcion_key = data.get('funcion_key')
        estado = data.get('estado')
        kwargs = data.get('datos', {})
        
        if not funcion_key or not estado:
            return senderror('funcion_key y estado son requeridos', status=400)
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.actualizar_estado_funcion(funcion_key, estado, **kwargs)
        
        return JsonResponse({
            'success': True,
            'mensaje': f'Estado de función {funcion_key} actualizado a {estado}',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

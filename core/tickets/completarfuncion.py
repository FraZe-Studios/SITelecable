import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def completarfuncion(request, ticket_id):
    """Marca una función especial como completada"""
    try:
        data = json.loads(request.body)
        funcion_key = data.get('funcion_key')
        kwargs = data.get('datos', {})
        
        if not funcion_key:
            return senderror('funcion_key es requerido', status=400)
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.completar_funcion(funcion_key, **kwargs)
        
        return JsonResponse({
            'success': True,
            'mensaje': f'Función {funcion_key} completada correctamente',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

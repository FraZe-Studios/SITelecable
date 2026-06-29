import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def cambioequipo(request, ticket_id):
    """Activa flujo de reemplazo de dispositivo"""
    try:
        data = json.loads(request.body)
        equipo_anterior = data.get('equipo_anterior')
        equipo_nuevo = data.get('equipo_nuevo')
        motivo = data.get('motivo', '')
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.activar_funcion('cambio_equipo', 
                             equipo_anterior=equipo_anterior,
                             equipo_nuevo=equipo_nuevo,
                             motivo=motivo)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Flujo de cambio de equipo activado',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

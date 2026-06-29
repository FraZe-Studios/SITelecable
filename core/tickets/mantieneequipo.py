import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def mantieneequipo(request, ticket_id):
    """El equipo anterior se mantiene"""
    try:
        data = json.loads(request.body)
        equipo_mantenido = data.get('equipo_mantenido')
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.activar_funcion('mantiene_equipo',
                             equipo_mantenido=equipo_mantenido)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Mantenimiento de equipo activado',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

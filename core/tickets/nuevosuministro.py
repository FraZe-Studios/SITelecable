import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def nuevosuministro(request, ticket_id):
    """Requiere N° suministro nuevo"""
    try:
        data = json.loads(request.body)
        suministro_nuevo = data.get('suministro_nuevo')
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        servicio = ticket.servicio
        suministro_anterior = servicio.numero_suministro
        
        ticket.activar_funcion('nuevo_suministro',
                             suministro_anterior=suministro_anterior,
                             suministro_nuevo=suministro_nuevo)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Nuevo suministro activado',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

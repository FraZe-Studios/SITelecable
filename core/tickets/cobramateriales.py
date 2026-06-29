import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def cobramateriales(request, ticket_id):
    """Genera cargo por materiales"""
    try:
        data = json.loads(request.body)
        materiales = data.get('materiales', [])
        monto_total = data.get('monto_total', 0.00)
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.activar_funcion('cobra_materiales',
                             materiales=materiales,
                             monto_total=monto_total)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Cargo por materiales generado',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

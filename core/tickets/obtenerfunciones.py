from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["GET"])
def obtenerfunciones(request, ticket_id):
    """Obtiene todas las funciones especiales de un ticket"""
    try:
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        return JsonResponse({
            'success': True,
            'funciones_especiales': ticket.funciones_especiales or ticket._get_default_funciones_especiales()
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

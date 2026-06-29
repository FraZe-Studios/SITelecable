import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def generamerma(request, ticket_id):
    """Registra baja de materiales"""
    try:
        data = json.loads(request.body)
        materiales_merma = data.get('materiales_merma', [])
        motivo = data.get('motivo', '')
        autorizado_por = data.get('autorizado_por')
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.activar_funcion('genera_merma',
                             materiales_merma=materiales_merma,
                             motivo=motivo,
                             autorizado_por=autorizado_por)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Merma registrada correctamente',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

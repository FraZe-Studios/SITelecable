import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def editarmapa(request, ticket_id):
    """Permite editar posición NAP"""
    try:
        data = json.loads(request.body)
        nap_id = data.get('nap_id')
        coordenadas_anteriores = data.get('coordenadas_anteriores')
        coordenadas_nuevas = data.get('coordenadas_nuevas')
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.activar_funcion('editar_mapa',
                             nap_id=nap_id,
                             coordenadas_anteriores=coordenadas_anteriores,
                             coordenadas_nuevas=coordenadas_nuevas)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Edición de mapa activada',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

import json
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def instalacion(request, ticket_id):
    """Activa flujo de instalación"""
    try:
        data = json.loads(request.body)
        tecnico_id = data.get('tecnico_id')
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        ticket.activar_funcion('instalacion',
                             tecnico_id=tecnico_id,
                             fecha_inicio=datetime.now().isoformat())
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Flujo de instalación activado',
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

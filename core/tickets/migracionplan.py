import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def migracionplan(request, ticket_id):
    """Al liquidar: corta el plan actual y activa el nuevo plan seleccionado"""
    try:
        data = json.loads(request.body)
        plan_nuevo_id = data.get('plan_nuevo_id')
        
        if not plan_nuevo_id:
            return senderror('plan_nuevo_id es requerido', status=400)
        
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        servicio = ticket.servicio
        plan_anterior_id = servicio.plan_id
        
        ticket.activar_funcion('migracion_plan',
                             plan_anterior_id=plan_anterior_id,
                             plan_nuevo_id=plan_nuevo_id)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Flujo de migración de plan activado',
            'plan_anterior_id': plan_anterior_id,
            'plan_nuevo_id': plan_nuevo_id,
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

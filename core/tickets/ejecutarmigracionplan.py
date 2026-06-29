from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.models.planes import Planes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def ejecutarmigracionplan(request, ticket_id):
    """Ejecuta la migración de plan: corta el actual y activa el nuevo"""
    try:
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        servicio = ticket.servicio
        
        funcion_migracion = ticket._get_funcion_especial('migracion_plan')
        plan_nuevo_id = funcion_migracion.get('plan_nuevo_id')
        
        if not plan_nuevo_id:
            return senderror('No hay plan nuevo configurado para migración', status=400)
        
        servicio.estado_servicio = 'cortado'
        servicio.save(update_fields=['estado_servicio'])
        
        ticket.actualizar_estado_funcion('migracion_plan', 'en_proceso',
                                        fecha_corte=datetime.now().isoformat())
        
        nuevo_plan = Planes.objects.get(id=plan_nuevo_id)
        servicio.plan_id = plan_nuevo_id
        servicio.estado_servicio = 'activo'
        servicio.save(update_fields=['plan_id', 'estado_servicio'])
        
        ticket.completar_funcion('migracion_plan',
                               fecha_activacion_nuevo=datetime.now().isoformat())
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Migración de plan ejecutada correctamente',
            'plan_anterior_id': funcion_migracion.get('plan_anterior_id'),
            'plan_nuevo_id': plan_nuevo_id,
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Planes.DoesNotExist:
        return senderror('Plan nuevo no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

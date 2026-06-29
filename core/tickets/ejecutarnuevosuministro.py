from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.tickets import TicketsOrdenes
from core.auth.comun import senderror

@csrf_exempt
@require_http_methods(["POST"])
def ejecutarnuevosuministro(request, ticket_id):
    """Ejecuta el cambio de suministro"""
    try:
        ticket = TicketsOrdenes.objects.get(id=ticket_id)
        servicio = ticket.servicio
        
        funcion_suministro = ticket._get_funcion_especial('nuevo_suministro')
        suministro_nuevo = funcion_suministro.get('suministro_nuevo')
        
        if not suministro_nuevo:
            return senderror('No hay suministro nuevo configurado', status=400)
        
        servicio.numero_suministro = suministro_nuevo
        servicio.save(update_fields=['numero_suministro'])
        
        ticket.completar_funcion('nuevo_suministro')
        
        return JsonResponse({
            'success': True,
            'mensaje': 'Suministro actualizado correctamente',
            'suministro_anterior': funcion_suministro.get('suministro_anterior'),
            'suministro_nuevo': suministro_nuevo,
            'funciones_especiales': ticket.funciones_especiales
        })
    except TicketsOrdenes.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

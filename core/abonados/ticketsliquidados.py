from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.models.models_generados import TicketsOrdenes
from core.tickets.liquidacion import sistema_leer_liquidacion
from core.auth.comun import senderror


@csrf_exempt
@require_http_methods(["GET"])
def tickets_liquidados(request, servicio_id):
    """
    Obtiene los tickets liquidados de un servicio con sus materiales.
    GET /api/abonados/servicio/{servicio_id}/tickets-liquidados/
    """
    try:
        tickets = TicketsOrdenes.objects.filter(
            servicio_id=servicio_id,
            estado='completado'
        ).order_by('-fecha_completado')
        
        data = []
        for ticket in tickets:
            ticket_data = {
                'id': ticket.id,
                'nombre_ticket': ticket.nombre_ticket,
                'fecha_liquidacion': ticket.fecha_liquidacion.isoformat() if ticket.fecha_liquidacion else None,
                'materiales': []
            }
            
            # Obtener materiales de la liquidación con manejo de errores
            try:
                liquidacion = sistema_leer_liquidacion(ticket.id)
                if liquidacion and liquidacion.get('materiales'):
                    ticket_data['materiales'] = liquidacion['materiales']
            except Exception as e:
                # Si hay error al leer la liquidación, continuamos con materiales vacíos
                print(f"Error al leer liquidación del ticket {ticket.id}: {e}")
            
            data.append(ticket_data)
        
        return JsonResponse({
            'status': 'success',
            'data': data
        })
    except Exception as e:
        print(f"Error en tickets_liquidados: {e}")
        return senderror(str(e), status=500)

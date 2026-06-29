import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import CatalogoTickets
from core.auth.comun import checksession, senderror

def _require_sede_id(body):
    sede_id = body.get('sede_id')
    if sede_id is None or sede_id == '':
        raise ValueError('sede_id requerido')
    return int(sede_id)

@csrf_exempt
def eliminarcatalogoticket(request):
    """POST /api/sede/config/catalogo-ticket/eliminar/ — Elimina plantilla de ticket."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        _require_sede_id(body)
        t = CatalogoTickets.objects.get(pk=int(body['ticket_id']))
        t.delete()
        return JsonResponse({'status': 'success'})
    except CatalogoTickets.DoesNotExist:
        return senderror('Ticket no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

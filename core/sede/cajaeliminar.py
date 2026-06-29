import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Cajas
from core.auth.comun import checksession, senderror

@csrf_exempt
def cajaeliminar(request):
    """POST /api/sede/config/caja/eliminar/ — Desactiva lógicamente una caja de la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        caja_id = body.get('caja_id')
        if not caja_id:
            return senderror('caja_id requerido', status=400)
            
        caja = Cajas.objects.get(pk=int(caja_id))
        caja.activo = False
        caja.save()
        
        return JsonResponse({'status': 'success'})
        
    except Cajas.DoesNotExist:
        return senderror('Caja no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

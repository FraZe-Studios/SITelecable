import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Planes
from core.auth.comun import checksession, senderror

@csrf_exempt
def eliminarplan(request):
    """POST /api/sede/config/plan/eliminar/ — Elimina un plan."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        Planes.objects.filter(pk=int(body['plan_id']), sede_id=int(body['sede_id'])).delete()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return senderror(str(e), status=500)

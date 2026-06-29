import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import SedeRuc
from core.auth.comun import checksession, senderror

@csrf_exempt
def desvincularruc(request):
    """POST /api/sede/config/ruc/desvincular/ — Quita un RUC de la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        SedeRuc.objects.filter(sede_id=int(body['sede_id']), ruc_id=int(body['ruc_id'])).delete()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return senderror(str(e), status=500)

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sedes, Personal
from core.auth.comun import checksession, senderror

@csrf_exempt
def vincularpersonal(request):
    """POST /api/sede/config/personal/vincular/ — Vincula un empleado existente a la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        sede_id = int(body['sede_id'])
        personal_id = int(body['personal_id'])
        
        sede = Sedes.objects.get(pk=sede_id)
        empleado = Personal.objects.get(pk=personal_id)
        
        empleado.sede_id = sede_id
        empleado.save()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return senderror(str(e), status=500)

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Personal
from core.auth.comun import checksession, senderror

@csrf_exempt
def eliminarpersonal(request):
    """POST /api/sede/config/personal/eliminar/ — Desvincula un empleado de la sede (elimina la relación)."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        pid = int(body['personal_id'])
        empleado = Personal.objects.get(pk=pid)
        if empleado.username == 'admin' or pid == 1:
            return senderror('No se puede desvincular al administrador principal del sistema.', status=400)
            
        empleado.sede_id = None
        empleado.save()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return senderror(str(e), status=500)

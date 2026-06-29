import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import MaterialesConfiguracion
from core.auth.comun import checksession, senderror

def _require_sede_id(body):
    sede_id = body.get('sede_id')
    if sede_id is None or sede_id == '':
        raise ValueError('sede_id requerido')
    return int(sede_id)

@csrf_exempt
def eliminarmaterial(request):
    """POST /api/sede/config/material/eliminar/ — Elimina precios de materiales."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        _require_sede_id(body)
        MaterialesConfiguracion.objects.filter(pk=int(body['material_id'])).delete()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return senderror(str(e), status=500)

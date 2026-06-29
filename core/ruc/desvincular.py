import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import SedeRuc
from core.auth.comun import checksession, senderror

@csrf_exempt
def desvincular(request, ruc_id):
    """POST/DELETE /api/sede/rucs/<id>/desvincular/ — Desvincula RUC de la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    try:
        sede_id = request.GET.get('sede_id') or request.POST.get('sede_id')
        if not sede_id and request.body:
            try:
                body = json.loads(request.body or '{}')
                sede_id = body.get('sede_id')
            except Exception:
                pass
                
        if not sede_id:
            return senderror('sede_id requerido', status=400)
            
        SedeRuc.objects.filter(sede_id=sede_id, ruc_id=ruc_id).delete()
        return JsonResponse({'status': 'success', 'message': 'RUC desvinculado. Revincule para emitir comprobantes.'})
    except Exception as e:
        return senderror(str(e), status=500)

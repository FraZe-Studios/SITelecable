import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import RucsGlobales, SedeRuc
from core.auth.comun import checksession, senderror

@csrf_exempt
def vincular(request, ruc_id):
    """POST /api/sede/rucs/<id>/vincular/ — Revincula un RUC desvinculado o nuevo a la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        sede_id = request.POST.get('sede_id') or json.loads(request.body or '{}').get('sede_id')
        # Try to get from session if not in request
        if not sede_id:
            sede_id = request.session.get('current_sede_id')
        if not sede_id:
            return senderror('sede_id requerido', status=400)
            
        ruc = RucsGlobales.objects.get(pk=ruc_id)
        sr, created = SedeRuc.objects.get_or_create(sede_id=sede_id, ruc=ruc)
        if hasattr(sr, 'activo'):
            sr.activo = True
        sr.save()
        
        return JsonResponse({'status': 'success', 'created': created})
    except RucsGlobales.DoesNotExist:
        return senderror('RUC no existe', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

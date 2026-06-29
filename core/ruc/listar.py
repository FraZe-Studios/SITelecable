from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import SedeRuc
from core.auth.comun import checksession, senderror
from core.ruc.utils import ruc_to_dict
from core.ruc.create import create

@csrf_exempt
def listar(request):
    """GET /api/sede/rucs/?sede_id= or POST /api/sede/rucs/"""
    if request.method == 'POST':
        return create(request)

    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    sede_id = request.GET.get('sede_id')
    if not sede_id:
        return senderror('sede_id requerido', status=400)
        
    try:
        srs = SedeRuc.objects.filter(sede_id=sede_id).select_related('ruc').order_by('-fecha_vinculacion', 'ruc__razon_social')
        rucs = [ruc_to_dict(sr, sede_id) for sr in srs]
        return JsonResponse({'status': 'success', 'rucs': rucs})
    except Exception as e:
        return senderror(str(e), status=500)

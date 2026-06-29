from django.http import JsonResponse
from core.models.models_generados import RucsGlobales, SedeRuc
from core.auth.comun import checksession, senderror

def disponibles(request):
    """GET /api/sede/rucs/disponibles/?sede_id= — RUCs globales no vinculados activamente."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    sede_id = request.GET.get('sede_id')
    if not sede_id:
        return senderror('sede_id requerido', status=400)
        
    vinculados_ids = SedeRuc.objects.filter(
        sede_id=sede_id
    ).values_list('ruc_id', flat=True)
    
    disponibles_qs = RucsGlobales.objects.exclude(id__in=vinculados_ids).values(
        'id', 'ruc_numero', 'razon_social'
    )
    return JsonResponse({'status': 'success', 'rucs': list(disponibles_qs)})

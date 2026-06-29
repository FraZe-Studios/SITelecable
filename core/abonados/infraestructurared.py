from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from django.db.models import Q
from core.models.infraestructura import CajasNap, Mufas
from core.models.models_generados import CatalogoTickets

@csrf_exempt
@require_GET
def infraestructurared(request):
    """GET /api/abonados/infraestructura-red/"""
    sede_id = request.GET.get('sede_id')
    
    naps_qs = CajasNap.objects.filter(activo=True)
    if sede_id:
        naps_qs = naps_qs.filter(sector__sede_id=int(sede_id))
    
    naps = list(naps_qs.values('id', 'codigo'))
    mufas = list(Mufas.objects.filter(activo=True).values('id', 'nombre'))
    
    catalog_qs = CatalogoTickets.objects.filter(activo=True).filter(
        Q(area__icontains='externa') | Q(area__icontains='planta_externa') | Q(area__icontains='planta externa')
    )
    if sede_id:
        catalog_qs = catalog_qs.filter(
            Q(es_universal=True) | Q(sede_id=int(sede_id))
        )
    
    catalog = []
    for ct in catalog_qs:
        catalog.append({
            'id': ct.id,
            'nombre': ct.nombre,
            'categoria': ct.categoria,
            'area': ct.area,
            'modalidad': ct.modalidad,
            'precio_base': float(ct.precio_base or 0)
        })
        
    return JsonResponse({
        'status': 'success',
        'data': {
            'naps': naps,
            'mufas': mufas,
            'catalog': catalog
        }
    })

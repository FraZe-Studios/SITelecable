from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import CatalogoTickets

@csrf_exempt
def opcionescatalogo(request):
    """
    Obtener opciones de filtros para el catálogo de tickets.
    GET /api/net/catalogo-tickets-opciones/
    """
    categorias = CatalogoTickets.objects.filter(activo=True).values_list('categoria', flat=True).distinct()
    areas = CatalogoTickets.objects.filter(activo=True).values_list('area', flat=True).distinct()
    tecnologias = CatalogoTickets.objects.filter(activo=True).values_list('tecnologia', flat=True).distinct()
    modalidades = CatalogoTickets.objects.filter(activo=True).values_list('modalidad', flat=True).distinct()
    
    return JsonResponse({
        'status': 'success',
        'data': {
            'categorias': sorted(list(set(categorias))),
            'areas': sorted(list(set(areas))),
            'tecnologias': sorted(list(set(tecnologias))),
            'modalidades': sorted(list(set(modalidades))),
        }
    })

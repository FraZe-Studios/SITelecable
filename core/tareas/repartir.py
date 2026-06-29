from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

@csrf_exempt
@require_POST
def repartir(request):
    """Deprecated: El sistema ahora genera tareas automáticamente."""
    return JsonResponse({
        'status': 'info',
        'message': 'El sistema ahora genera tareas de notificación automáticamente. Use la vista /tareas/ para ver las tareas del ciclo.'
    })

from django.http import JsonResponse
from django.views.decorators.http import require_GET
from core.models.materiales import Materiales
from core.auth.comun import senderror

@require_GET
def detalle(request):
    """
    Obtener detalle de un material específico.
    GET /api/materiales/detalle/?id=X
    """
    material_id = request.GET.get('id', '')
    if not material_id:
        return senderror('ID de material requerido', status=400)
    
    try:
        material = Materiales.objects.get(id=material_id, activo=True)

        return JsonResponse({
            'status': 'success',
            'data': {
                'id': material.id,
                'nombre': material.nombre,
                'tipo_material': material.tipo_material,
                'requiere_mac': material.requiere_mac,
                'requiere_serie': material.requiere_serie,
                'descripcion': material.descripcion or '',
                'activo': material.activo
            }
        })
    except Materiales.DoesNotExist:
        return senderror('Material no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

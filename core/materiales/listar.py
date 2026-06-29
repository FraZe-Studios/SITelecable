from django.http import JsonResponse
from django.views.decorators.http import require_GET
from core.models.materiales import Materiales
from core.auth.comun import senderror

@require_GET
def listar(request):
    """
    Listar todos los materiales activos.
    GET /api/materiales/listar/
    """
    try:
        raw_materiales = Materiales.objects.filter(activo=True).values(
            'id', 'nombre', 'tipo_material', 'requiere_mac', 'requiere_serie', 'descripcion'
        )
        materiales_list = []
        for m in raw_materiales:
            item = {
                'id': m['id'],
                'nombre': m['nombre'],
                'tipo_material': m['tipo_material'],
                'requiere_mac': m['requiere_mac'],
                'requiere_serie': m['requiere_serie'],
                'descripcion': m.get('descripcion') or ''
            }
            materiales_list.append(item)
            
        return JsonResponse({
            'status': 'success',
            'data': materiales_list
        })
    except Exception as e:
        return senderror(str(e), status=500)

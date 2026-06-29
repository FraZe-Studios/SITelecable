from django.http import JsonResponse
from django.views.decorators.http import require_GET
from core.models.materiales import Materiales
from core.auth.comun import senderror

@require_GET
def portipo(request):
    """
    Listar materiales por tipo.
    GET /api/materiales/por-tipo/?tipo=equipo
    """
    tipo = request.GET.get('tipo', '')
    if not tipo:
        return senderror('Tipo de material requerido', status=400)
    
    try:
        raw_materiales = Materiales.objects.filter(
            tipo_material=tipo,
            activo=True
        ).values(
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

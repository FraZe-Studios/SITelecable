import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.exceptions import ValidationError
from core.models.materiales import Materiales
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def actualizar(request):
    """
    Actualizar un material existente.
    POST /api/materiales/actualizar/
    """
    try:
        data = json.loads(request.body)
        material_id = data.get('id', '')
        
        if not material_id:
            return senderror('ID de material requerido', status=400)
        
        material = Materiales.objects.get(id=material_id)
        
        if 'nombre' in data:
            material.nombre = data['nombre']
        if 'tipo_material' in data:
            material.tipo_material = data['tipo_material']
        if 'requiere_mac' in data:
            material.requiere_mac = data['requiere_mac']
        if 'requiere_serie' in data:
            material.requiere_serie = data['requiere_serie']
        if 'descripcion' in data:
            material.descripcion = data['descripcion']
        if 'activo' in data:
            material.activo = data['activo']
        
        material.full_clean()
        material.save()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Material actualizado exitosamente',
            'data': {
                'id': material.id,
                'nombre': material.nombre
            }
        })
    except Materiales.DoesNotExist:
        return senderror('Material no encontrado', status=404)
    except ValidationError as e:
        return JsonResponse({
            'status': 'error',
            'message': 'Error de validación',
            'errors': e.message_dict
        }, status=400)
    except Exception as e:
        return senderror(str(e), status=500)

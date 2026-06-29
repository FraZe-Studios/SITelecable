import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from core.models.materiales import Materiales
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def crear(request):
    """
    Crear un nuevo material.
    POST /api/materiales/crear/
    """
    try:
        data = json.loads(request.body)
        
        material = Materiales(
            nombre=data.get('nombre', ''),
            tipo_material=data.get('tipo_material', ''),
            requiere_mac=data.get('requiere_mac', False),
            requiere_serie=data.get('requiere_serie', False),
            descripcion=data.get('descripcion', ''),
            activo=data.get('activo', True)
        )
        
        material.full_clean()
        material.save()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Material creado exitosamente',
            'data': {
                'id': material.id,
                'nombre': material.nombre
            }
        })
    except ValidationError as e:
        return JsonResponse({
            'status': 'error',
            'message': 'Error de validación',
            'errors': e.message_dict
        }, status=400)
    except IntegrityError:
        return senderror('Error de integridad en base de datos', status=400)
    except Exception as e:
        return senderror(str(e), status=500)

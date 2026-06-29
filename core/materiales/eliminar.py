import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models.materiales import Materiales
from core.auth.comun import senderror, sendsuccess

@csrf_exempt
@require_POST
def eliminar(request):
    """
    Eliminar (soft delete) un material.
    POST /api/materiales/eliminar/
    """
    try:
        data = json.loads(request.body)
        material_id = data.get('id', '')
        
        if not material_id:
            return senderror('ID de material requerido', status=400)
        
        material = Materiales.objects.get(id=material_id)
        material.activo = False
        material.save()
        
        return sendsuccess('Material eliminado exitosamente')
    except Materiales.DoesNotExist:
        return senderror('Material no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

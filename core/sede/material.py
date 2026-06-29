import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import MaterialesConfiguracion
from core.auth.comun import checksession, senderror

def _require_sede_id(body):
    sede_id = body.get('sede_id')
    if sede_id is None or sede_id == '':
        raise ValueError('sede_id requerido')
    return int(sede_id)

@csrf_exempt
def material(request):
    """POST /api/sede/config/material/ — Guarda/actualiza precios de materiales."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        _require_sede_id(body)
        mat_id = body.get('material_id')
        
        if mat_id:
            m = MaterialesConfiguracion.objects.get(pk=int(mat_id))
        else:
            m = MaterialesConfiguracion()
            
        m.nombre_material = body['nombre_material'].strip()
        m.metraje_limite_gratis = int(body.get('metraje_limite_gratis') or 0)
        m.precio_exceso_metro = float(body.get('precio_exceso_metro') or 0)
        m.precio_venta_equipo = float(body.get('precio_venta_equipo') or 0)
        m.save()
        
        return JsonResponse({'status': 'success', 'material_id': m.id})
    except Exception as e:
        return senderror(str(e), status=500)

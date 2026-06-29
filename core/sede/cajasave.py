import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sedes, Cajas
from core.auth.comun import checksession, senderror

@csrf_exempt
def cajasave(request):
    """POST /api/sede/config/caja/ — Crea o edita una caja en la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        sede_id = body.get('sede_id')
        if not sede_id:
            return senderror('sede_id requerido', status=400)
            
        sede = Sedes.objects.get(pk=int(sede_id))
        caja_id = body.get('caja_id')
        nombre = body.get('nombre', '').strip()
        tipo_ubicacion = body.get('tipo_ubicacion', 'oficina').lower()
        recaudo = body.get('recaudo', {"efectivo": True, "transferencia": True})
        
        if not nombre:
            return senderror('El nombre de la caja es requerido', status=400)
            
        if tipo_ubicacion not in ['oficina', 'campo']:
            return senderror('Tipo de ubicación inválido', status=400)
            
        if caja_id:
            caja = Cajas.objects.get(pk=int(caja_id))
            if Cajas.objects.filter(nombre__iexact=nombre).exclude(pk=caja.pk).exists():
                return senderror(f"Ya existe una caja con el nombre '{nombre}'", status=400)
        else:
            if Cajas.objects.filter(nombre__iexact=nombre).exists():
                return senderror(f"Ya existe una caja con el nombre '{nombre}'", status=400)
            caja = Cajas()
            
        caja.nombre = nombre
        caja.sede = sede
        caja.tipo_ubicacion = tipo_ubicacion
        caja.activo = True
        caja.save()
        
        # Guardar configuración de recaudación
        caja.configuracion_recaudo = recaudo
        
        return JsonResponse({
            'status': 'success',
            'caja_id': caja.id,
            'nombre': caja.nombre,
            'tipo_ubicacion': caja.tipo_ubicacion,
            'recaudo': caja.configuracion_recaudo
        })
        
    except (Sedes.DoesNotExist, Cajas.DoesNotExist):
        return senderror('Sede o Caja no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

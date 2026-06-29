import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Cajas, Personal, Sedes
from core.auth.comun import checksession, senderror

@csrf_exempt
def cajavincular(request):
    """
    POST /api/sede/config/caja/personal/
    Vincula o desvincula personal con una caja específica.
    Recibe: caja_id, personal_ids (lista de enteros con IDs de usuarios autorizados)
    """
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        caja_id = body.get('caja_id')
        personal_ids = body.get('personal_ids', []) # lista de IDs de usuarios autorizados
        
        if not caja_id:
            return senderror('caja_id requerido', status=400)
            
        caja = Cajas.objects.get(pk=int(caja_id))
        sede_id = caja.sede_id
        
        # Obtener todo el personal de la sede
        personal_sede = Personal.objects.filter(sede_id=sede_id, activo=True)
        
        # Asegurar que personal_ids sea una lista de enteros
        auth_ids = [int(x) for x in personal_ids]
        
        for u in personal_sede:
            cajas_auth = list(u.cajas_permitidas)
            if u.id in auth_ids:
                if caja.id not in cajas_auth:
                    cajas_auth.append(caja.id)
            else:
                if caja.id in cajas_auth:
                    cajas_auth.remove(caja.id)
            
            u.cajas_permitidas = cajas_auth
            u.save()
            
        return JsonResponse({'status': 'success'})
        
    except Cajas.DoesNotExist:
        return senderror('Caja no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

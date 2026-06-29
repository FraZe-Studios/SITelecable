import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import FibrasOpticas
from core.auth.comun import checksession, senderror

@csrf_exempt
def fibravertices(request):
    """
    API para guardar la ruta georreferenciada de una fibra óptica.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        body = json.loads(request.body)
        fibra_id = body.get('id')
        coordenadas_ruta = body.get('coordenadas_ruta')  # list of [lat, lng]
        distancia_m = body.get('distancia_m')
        hub_id = body.get('hub_id')  # optional
    except Exception:
        return senderror('JSON inválido', status=400)

    if not fibra_id or not coordenadas_ruta:
        return senderror('ID y coordenadas son requeridos', status=400)

    if len(coordenadas_ruta) < 2:
        return senderror('La fibra debe tener al menos 2 puntos', status=400)

    try:
        fibra = FibrasOpticas.objects.get(pk=fibra_id)
        
        # Primer punto -> inicio
        fibra.latitud_inicio = float(coordenadas_ruta[0][0])
        fibra.longitud_inicio = float(coordenadas_ruta[0][1])
        # Último punto -> fin
        fibra.latitud_fin = float(coordenadas_ruta[-1][0])
        fibra.longitud_fin = float(coordenadas_ruta[-1][1])
        
        fibra.coordenadas_ruta = json.dumps(coordenadas_ruta)
        
        if hub_id is not None:
            fibra.hub_id = int(hub_id) if hub_id else None

        fibra.save()

        from datetime import datetime
        return JsonResponse({
            'status': 'success',
            'distancia_m': distancia_m,
            'timestamp': datetime.now().isoformat()
        })

    except FibrasOpticas.DoesNotExist:
        return senderror('Fibra no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

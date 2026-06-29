import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sectores, CajasNap
from core.auth.comun import checksession, senderror

@csrf_exempt
def sectorvertices(request):
    """
    API para guardar los vértices de un sector y reasignar las Cajas NAP.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        body = json.loads(request.body)
        sector_id = body.get('id')
        coordenadas = body.get('coordenadas')  # list of [lat, lng]
    except Exception:
        return senderror('JSON inválido', status=400)

    if not sector_id or not coordenadas:
        return senderror('ID y coordenadas son requeridos', status=400)

    if len(coordenadas) < 3:
        return senderror('El polígono debe tener al menos 3 vértices', status=400)

    try:
        sector = Sectores.objects.get(pk=sector_id)
        
        # Recalcular latitud_centro y longitud_centro como centroide
        lats = [float(p[0]) for p in coordenadas]
        lngs = [float(p[1]) for p in coordenadas]
        sector.latitud_centro = sum(lats) / len(coordenadas)
        sector.longitud_centro = sum(lngs) / len(coordenadas)
        sector.coordenadas = json.dumps(coordenadas)
        sector.save()

        # Asignación espacial a NAPs
        def is_point_in_polygon(lat, lng, polygon):
            inside = False
            n = len(polygon)
            j = n - 1
            for i in range(n):
                xi, yi = float(polygon[i][0]), float(polygon[i][1])
                xj, yj = float(polygon[j][0]), float(polygon[j][1])
                if ((yi > lng) != (yj > lng)) and (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi):
                    inside = not inside
                j = i
            return inside

        naps_actualizadas = 0
        for nap in CajasNap.objects.all():
            if is_point_in_polygon(float(nap.latitud), float(nap.longitud), coordenadas):
                if nap.sector_id != sector.id:
                    nap.sector_id = sector.id
                    nap.save()
                    naps_actualizadas += 1

        return JsonResponse({
            'status': 'success',
            'naps_actualizadas': naps_actualizadas,
            'latitud_centro': float(sector.latitud_centro),
            'longitud_centro': float(sector.longitud_centro)
        })

    except Sectores.DoesNotExist:
        return senderror('Sector no encontrado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

import json
import math
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import (
    Sedes, Hubs, CajasNap, Mufas, Sectores, FibrasOpticas
)
from core.auth.comun import checksession, senderror, sendsuccess
from core.sede.sedeutils import strip_sede_prefijo

@csrf_exempt
def guardar(request):
    """
    API para guardar un nuevo elemento de red desde el mapa interactivo.
    Soporta tipos: SEDE, HUB, NAP, MUFA, SECTOR, FIBRA.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        body  = json.loads(request.body)
        tipo  = body.get('tipo', '').upper()
        datos = body.get('datos', {})
    except Exception:
        return senderror('JSON inválido', status=400)

    try:
        if tipo == 'SEDE':
            Sedes.objects.create(
                nombre      = strip_sede_prefijo(datos['sede_nombre']),
                descripcion = datos.get('sede_descripcion', ''),
                latitud     = float(datos['sede_lat']),
                longitud    = float(datos['sede_lng']),
            )
        elif tipo == 'HUB':
            Hubs.objects.create(
                nombre   = datos['hub_codigo'],
                latitud  = float(datos['hub_lat']),
                longitud = float(datos['hub_lng']),
            )
        elif tipo == 'NAP':
            CajasNap.objects.create(
                codigo_identificador = datos['nap_codigo'],
                latitud              = float(datos['nap_lat']),
                longitud             = float(datos['nap_lng']),
                cantidad_puertos     = datos['nap_puertos'],
                sector               = Sectores.objects.first(),
            )
        elif tipo == 'MUFA':
            Mufas.objects.create(
                codigo_identificador = datos['mufa_codigo'],
                registro_coordenadas_json = {'latitud': float(datos['mufa_lat']), 'longitud': float(datos['mufa_lng'])},
                capacidad_hilos      = int(datos['mufa_capacidad']),
            )
        elif tipo == 'SECTOR':
            lat_val = datos.get('sector_lat')
            lng_val = datos.get('sector_lng')
            Sectores.objects.create(
                nombre          = datos['sector_codigo'],
                prefijo_comercial = datos['sector_prefijo'],
                latitud_centro  = float(lat_val) if lat_val else 0.0,
                longitud_centro = float(lng_val) if lng_val else 0.0,
                coordenadas     = datos.get('sector_coordenadas', ''),
            )
        elif tipo == 'FIBRA':
            hub_id_val = datos.get('fibra_hub_id')
            hub_id = int(hub_id_val) if hub_id_val else None
            cap_total = int(datos.get('fibra_capacidad') or
                           (int(datos.get('fibra_buffers', 1)) * int(datos.get('fibra_hilos', 12))))
            if cap_total <= 12:
                n_buffers = 1
                n_hilos   = cap_total
            else:
                n_buffers = math.ceil(cap_total / 12)
                n_hilos   = 12
            lat_i = datos.get('fibra_lat_i')
            lng_i = datos.get('fibra_lng_i')
            lat_f = datos.get('fibra_lat_f') or lat_i
            lng_f = datos.get('fibra_lng_f') or lng_i
            FibrasOpticas.objects.create(
                codigo_identificador = datos['fibra_codigo'],
                latitud_inicio       = float(lat_i) if lat_i else 0.0,
                longitud_inicio      = float(lng_i) if lng_i else 0.0,
                latitud_fin          = float(lat_f) if lat_f else 0.0,
                longitud_fin         = float(lng_f) if lng_f else 0.0,
                cantidad_buffers     = n_buffers,
                hilos_por_buffer     = n_hilos,
                capacidad_total      = cap_total,
                coordenadas_ruta     = datos.get('fibra_coordenadas_ruta', ''),
                hub_id               = hub_id,
            )
        else:
            return senderror(f'Tipo desconocido: {tipo}', status=400)

        return sendsuccess(f'{tipo} guardado correctamente')

    except Exception as e:
        return senderror(str(e), status=500)

import json
import math
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import (
    Sedes, Hubs, CajasNap, Mufas, Sectores, FibrasOpticas
)
from core.auth.comun import checksession, senderror, sendsuccess
from core.sede.sedeutils import strip_sede_prefijo

@csrf_exempt
def actualizar(request):
    """
    API para actualizar un elemento de red existente.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        body  = json.loads(request.body)
        tipo  = body.get('tipo', '').upper()
        datos = body.get('datos', {})
        item_id = body.get('id')
    except Exception:
        return senderror('JSON inválido', status=400)

    if not item_id:
        return senderror('ID del elemento requerido', status=400)

    try:
        if tipo == 'SEDE':
            obj = Sedes.objects.get(pk=item_id)
            obj.nombre = strip_sede_prefijo(datos['sede_nombre'])
            obj.descripcion = datos.get('sede_descripcion', '')
            obj.latitud = float(datos['sede_lat'])
            obj.longitud = float(datos['sede_lng'])
            obj.save()
        elif tipo == 'HUB':
            obj = Hubs.objects.get(pk=item_id)
            obj.nombre = datos['hub_codigo']
            obj.latitud = float(datos['hub_lat'])
            obj.longitud = float(datos['hub_lng'])
            obj.save()
        elif tipo == 'NAP':
            obj = CajasNap.objects.get(pk=item_id)
            obj.codigo_identificador = datos['nap_codigo']
            obj.latitud = float(datos['nap_lat'])
            obj.longitud = float(datos['nap_lng'])
            obj.cantidad_puertos = datos['nap_puertos']
            obj.save()
        elif tipo == 'MUFA':
            obj = Mufas.objects.get(pk=item_id)
            obj.codigo_identificador = datos['mufa_codigo']
            obj.latitud = float(datos['mufa_lat'])
            obj.longitud = float(datos['mufa_lng'])
            obj.capacidad_hilos = int(datos['mufa_capacidad'])
            obj.save()
        elif tipo == 'SECTOR':
            obj = Sectores.objects.get(pk=item_id)
            obj.nombre = datos['sector_codigo']
            obj.prefijo_comercial = datos['sector_prefijo']
            lat_val = datos.get('sector_lat')
            lng_val = datos.get('sector_lng')
            obj.latitud_centro = float(lat_val) if lat_val else 0.0
            obj.longitud_centro = float(lng_val) if lng_val else 0.0
            obj.coordenadas = datos.get('sector_coordenadas', '')
            obj.save()
        elif tipo == 'FIBRA':
            obj = FibrasOpticas.objects.get(pk=item_id)
            obj.codigo_identificador = datos['fibra_codigo']
            lat_i = datos.get('fibra_lat_i')
            lng_i = datos.get('fibra_lng_i')
            lat_f = datos.get('fibra_lat_f') or lat_i
            lng_f = datos.get('fibra_lng_f') or lng_i
            obj.latitud_inicio = float(lat_i) if lat_i else 0.0
            obj.longitud_inicio = float(lng_i) if lng_i else 0.0
            obj.latitud_fin = float(lat_f) if lat_f else 0.0
            obj.longitud_fin = float(lng_f) if lng_f else 0.0
            cap_total = int(datos.get('fibra_capacidad') or
                           (int(datos.get('fibra_buffers', obj.cantidad_buffers)) *
                            int(datos.get('fibra_hilos', obj.hilos_por_buffer))))
            if cap_total <= 12:
                obj.cantidad_buffers = 1
                obj.hilos_por_buffer = cap_total
            else:
                obj.cantidad_buffers = math.ceil(cap_total / 12)
                obj.hilos_por_buffer = 12
            obj.capacidad_total = cap_total
            if 'fibra_coordenadas_ruta' in datos:
                obj.coordenadas_ruta = datos['fibra_coordenadas_ruta']
            if 'fibra_hub_id' in datos:
                hub_id_val = datos['fibra_hub_id']
                obj.hub_id = int(hub_id_val) if hub_id_val else None
            obj.save()
        else:
            return senderror(f'Tipo desconocido: {tipo}', status=400)

        return sendsuccess(f'{tipo} actualizado correctamente')

    except Sedes.DoesNotExist:
        return senderror('Sede no encontrada', status=404)
    except Hubs.DoesNotExist:
        return senderror('Hub no encontrado', status=404)
    except CajasNap.DoesNotExist:
        return senderror('NAP no encontrado', status=404)
    except Mufas.DoesNotExist:
        return senderror('Mufa no encontrada', status=404)
    except Sectores.DoesNotExist:
        return senderror('Sector no encontrado', status=404)
    except FibrasOpticas.DoesNotExist:
        return senderror('Fibra no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

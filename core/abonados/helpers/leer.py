from django.utils import timezone
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from core.models.cache import CacheDni, CacheRuc, CacheSuministro
from core.models.abonados import Abonados
from core.abonados.services.consumo_api import DecolectaAPIClient, DistriluzAPIClient

def _to_decimal(value, default='0'):
    try:
        return Decimal(str(value or default))
    except (InvalidOperation, TypeError):
        return Decimal(default)

def leer_registro(model, **kwargs):
    """
    Generic record read using filter with **kwargs.
    Returns the first matching record or None.
    """
    return model.objects.filter(**kwargs).first()

def leer_registros(model, **kwargs):
    """
    Generic queryset read using filter with **kwargs.
    """
    return model.objects.filter(**kwargs)

def leer_dni_con_cache(dni):
    """
    Reads DNI using CacheDni before executing external API consumption.
    """
    if not dni or len(dni) != 8 or not dni.isdigit():
        return None

    cache_entry = CacheDni.objects.filter(dni_numero=dni).first()
    if cache_entry and cache_entry.fecha_expiracion > timezone.now():
        data = dict(cache_entry.datos_json or {})
        # Ensure en_sistema is updated dynamically
        data['en_sistema'] = Abonados.objects.filter(dni=dni).exists()
        return {'status': 'success', 'data': data}

    client = DecolectaAPIClient()
    result = client.consultar_dni(dni)
    if not result:
        # Fallback to expired cache if available to prevent complete failure
        if cache_entry:
            data = dict(cache_entry.datos_json or {})
            data['en_sistema'] = Abonados.objects.filter(dni=dni).exists()
            return {'status': 'success', 'data': data}
        return None

    nombres = result.get('nombres', '')
    apellidos = f"{result.get('apellido_paterno', '')} {result.get('apellido_materno', '')}".strip()
    expiracion = timezone.now() + timedelta(days=30)

    CacheDni.objects.update_or_create(
        dni_numero=dni,
        defaults={
            'nombres': nombres,
            'apellidos': apellidos,
            'fecha_consulta': timezone.now(),
            'fecha_expiracion': expiracion,
            'datos_json': result,
        }
    )

    result['en_sistema'] = Abonados.objects.filter(dni=dni).exists()
    return {'status': 'success', 'data': result}

def leer_ruc_con_cache(ruc):
    """
    Reads RUC using CacheRuc before executing external API consumption.
    """
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return None

    cache_entry = CacheRuc.objects.filter(ruc_numero=ruc).first()
    if cache_entry and cache_entry.fecha_expiracion > timezone.now():
        data = dict(cache_entry.datos_json or {})
        data['en_sistema'] = Abonados.objects.filter(ruc=ruc).exists()
        return {'status': 'success', 'data': data}

    client = DecolectaAPIClient()
    result = client.consultar_ruc(ruc)
    if not result:
        # Fallback to expired cache if available
        if cache_entry:
            data = dict(cache_entry.datos_json or {})
            data['en_sistema'] = Abonados.objects.filter(ruc=ruc).exists()
            return {'status': 'success', 'data': data}
        return None

    razon_social = result.get('razon_social', '')
    expiracion = timezone.now() + timedelta(days=30)

    CacheRuc.objects.update_or_create(
        ruc_numero=ruc,
        defaults={
            'razon_social': razon_social,
            'fecha_consulta': timezone.now(),
            'fecha_expiracion': expiracion,
            'datos_json': result,
        }
    )

    result['en_sistema'] = Abonados.objects.filter(ruc=ruc).exists()
    return {'status': 'success', 'data': result}

def leer_suministro_con_cache(suministro):
    """
    Reads electricity supply details using CacheSuministro before calling external API.
    """
    if not suministro:
        return None

    cache_entry = CacheSuministro.objects.filter(numero_suministro=suministro).first()
    if cache_entry and cache_entry.fecha_expiracion > timezone.now():
        data = dict(cache_entry.datos_json or {})
        return {'status': 'success', 'data': data}

    client = DistriluzAPIClient()
    result = client.consultar_suministro(suministro)
    if not result:
        # Fallback to expired cache if available
        if cache_entry:
            data = dict(cache_entry.datos_json or {})
            return {'status': 'success', 'data': data}
        return None

    lat = _to_decimal(result.get('latitud'), '-11.593000')
    lng = _to_decimal(result.get('longitud'), '-75.896000')
    expiracion = timezone.now() + timedelta(days=30)

    CacheSuministro.objects.update_or_create(
        numero_suministro=suministro,
        defaults={
            'tipo_suministro': result.get('tipo_via', ''),
            'estado_suministro': 'ACTIVO',
            'direccion': result.get('direccion', ''),
            'departamento': result.get('departamento', ''),
            'provincia': result.get('provincia', ''),
            'distrito': result.get('distrito', ''),
            'latitud': lat,
            'longitud': lng,
            'fecha_consulta': timezone.now(),
            'fecha_expiracion': expiracion,
            'datos_json': result,
        }
    )
    return {'status': 'success', 'data': result}

"""
Consulta de documento para registro de abonado.
Orden: BD local → API Telecable → API Net (Decolecta DNI/RUC).
"""
from datetime import date, datetime
from decimal import Decimal

from core.abonados.lista import sistema_buscar_cliente_local, sistema_deudas_cliente
from core.abonados.dni import consultar_dni_con_cache
from core.abonados.ruc import consultar_ruc_con_cache
from core.abonados.services.consumo_api import TelecableAPIClient


def es_mayor_de_edad(fecha_nacimiento):
    """Retorna True/False si es mayor de edad, o None si la fecha no es válida."""
    if not fecha_nacimiento:
        return None
    if isinstance(fecha_nacimiento, date):
        nac = fecha_nacimiento
    else:
        try:
            nac = datetime.strptime(str(fecha_nacimiento)[:10], '%Y-%m-%d').date()
        except ValueError:
            return None
    hoy = date.today()
    edad = hoy.year - nac.year - ((hoy.month, hoy.day) < (nac.month, nac.day))
    return edad >= 18


def _cliente_local_a_dict(cliente):
    from core.models.models_generados import ServiciosAbonados
    deudas = sistema_deudas_cliente(cliente.id_cliente_codigo)
    
    # Get existing services (suscripciones)
    suscripciones = ServiciosAbonados.objects.filter(cliente_id=cliente.id).select_related('plan')
    servicios = []
    for sub in suscripciones:
        servicio = {
            'id_suscripcion': sub.id_suscripcion,
            'plan_nombre': sub.plan.nombre_plan if sub.plan else None,
            'plan_costo': float(sub.plan.costo_plan) if sub.plan and sub.plan.costo_plan else None,
            'estado_suscripcion': sub.estado_suscripcion,
            'fecha_contrato': str(sub.fecha_contrato) if sub.fecha_contrato else None,
        }
        servicios.append(servicio)
    
    return {
        'cliente_id': cliente.id_cliente_codigo,
        'dni': cliente.dni,
        'ruc': cliente.ruc,
        'razon_social': cliente.razon_social,
        'nombre_apellidos': cliente.nombre_apellidos,
        'nombre_completo': cliente.nombre_apellidos or cliente.razon_social,
        'celular_1': cliente.celular_1,
        'celular_2': cliente.celular_2,
        'operador': cliente.operador,
        'estado_civil': cliente.estado_civil,
        'cumpleanos': str(cliente.cumpleanos) if cliente.cumpleanos else None,
        'fecha_nacimiento': str(cliente.cumpleanos) if cliente.cumpleanos else None,
        'correo': cliente.correo,
        'direccion_fiscal': cliente.direccion_fiscal,
        'tiene_deuda_activa': bool(cliente.tiene_deuda_activa),
        'deudas': deudas,
        'servicios_existentes': servicios,
        'en_sistema': True,
    }


def _mapear_telecable(item):
    if not item or not isinstance(item, dict):
        return None
    doc = (
        item.get('numero_documento')
        or item.get('numero_identificacion')
        or item.get('dni')
        or item.get('ruc')
        or ''
    )
    doc = str(doc).strip()
    nombre = (
        item.get('nombre_completo')
        or item.get('nombres_apellidos')
        or item.get('razon_social')
        or ''
    )
    codigo = item.get('codigo') or item.get('codigo_cliente') or item.get('codigo_abonado')
    return {
        'cliente_id': codigo,
        'dni': doc if len(doc) == 8 else item.get('dni'),
        'ruc': doc if len(doc) == 11 else item.get('ruc'),
        'razon_social': item.get('razon_social') or (nombre if len(doc) == 11 else None),
        'nombre_apellidos': nombre,
        'nombre_completo': nombre,
        'celular_1': item.get('telefono') or item.get('celular') or item.get('telefono_principal'),
        'celular_2': item.get('telefono_secundario') or item.get('celular_2'),
        'correo': item.get('email') or item.get('correo'),
        'direccion_fiscal': item.get('direccion') or item.get('direccion_fiscal'),
        'estado_civil': item.get('estado_civil'),
        'cumpleanos': item.get('fecha_nacimiento') or item.get('cumpleanos'),
        'fecha_nacimiento': item.get('fecha_nacimiento') or item.get('cumpleanos'),
        'operador': item.get('operador'),
        'codigo_externo': codigo,
        'en_sistema': False,
        'source': 'TELECABLE',
    }


def _deudas_telecable(codigo):
    if not codigo:
        return [], 0
    client = TelecableAPIClient()
    raw = client.get_deudas(codigo)
    deudas = []
    monto = Decimal('0')
    items = raw if isinstance(raw, list) else (raw.get('deudas') or raw.get('data') or []) if isinstance(raw, dict) else []
    for item in items:
        if not isinstance(item, dict):
            continue
        m = Decimal(str(item.get('monto') or item.get('monto_actual') or item.get('saldo') or 0))
        monto += m
        deudas.append({
            'concepto': item.get('concepto') or item.get('descripcion') or 'Deuda Telecable',
            'monto_actual': float(m),
            'origen': 'TELECABLE',
            'suministro_id': item.get('suministro'),
        })
    return deudas, float(monto)


def _consultar_telecable(numero):
    client = TelecableAPIClient()
    resultados = client.buscar_abonado(numero)
    if not resultados:
        return None
    item = resultados[0] if isinstance(resultados, list) else resultados
    data = _mapear_telecable(item)
    if not data:
        return None
    codigo = data.get('codigo_externo') or data.get('cliente_id')
    deudas_ext, monto = _deudas_telecable(codigo)
    data['deudas_externas'] = deudas_ext
    data['monto_deuda_externa'] = monto
    data['tiene_deuda_externa'] = bool(deudas_ext) or monto > 0
    return data


def _consultar_net_decolecta(numero):
    if len(numero) == 8:
        res = consultar_dni_con_cache(numero)
        if not res:
            return None
        data = dict(res['data'])
        data['dni'] = numero
        data['nombre_apellidos'] = data.get('nombre_completo') or data.get('nombres_apellidos')
        data['source'] = data.get('source', 'NET')
        return data
    if len(numero) == 11:
        res = consultar_ruc_con_cache(numero)
        if not res:
            return None
        data = dict(res['data'])
        data['ruc'] = numero
        data['source'] = data.get('source', 'NET')
        return data
    return None


def _similitud_direccion(dir_a, dir_b):
    if not dir_a or not dir_b:
        return 0.0
    import re
    def _tokens(texto):
        limpio = re.sub(r'[^a-z0-9\s]', ' ', str(texto).lower())
        return {t for t in limpio.split() if len(t) > 2}
    ta, tb = _tokens(dir_a), _tokens(dir_b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _mejor_coincidencia_telecable(resultados, direccion_ref):
    if not resultados:
        return None
    if not direccion_ref or len(resultados) == 1:
        item = resultados[0] if isinstance(resultados, list) else resultados
        return _mapear_telecable(item)
    mejor, score = None, -1.0
    items = resultados if isinstance(resultados, list) else [resultados]
    for item in items:
        data = _mapear_telecable(item)
        if not data:
            continue
        dir_tel = data.get('direccion_fiscal') or ''
        s = _similitud_direccion(direccion_ref, dir_tel)
        if s > score:
            score, mejor = s, data
            mejor['similitud_direccion'] = round(s, 2)
    return mejor if score >= 0.25 else _mapear_telecable(items[0])


def consultar_telecable_por_referencia(suministro=None, direccion=None, documento=None):
    """
    Busca abonado en Telecable por suministro, documento o similitud de dirección.
    Retorna datos mapeados con deudas externas cobrables.
    """
    client = TelecableAPIClient()
    coincidencia_por = None
    data = None

    if suministro:
        resultados = client.buscar_abonado(str(suministro).strip())
        data = _mejor_coincidencia_telecable(resultados, direccion)
        if data:
            coincidencia_por = 'suministro' if len(resultados or []) <= 1 else 'suministro_direccion'

    if not data and documento:
        doc = str(documento).strip()
        if doc.isdigit() and len(doc) >= 8:
            resultados = client.buscar_abonado(doc)
            data = _mejor_coincidencia_telecable(resultados, direccion)
            if data:
                coincidencia_por = 'documento' if not direccion else 'documento_direccion'

    if not data and direccion:
        return None

    if not data:
        return None

    codigo = data.get('codigo_externo') or data.get('cliente_id')
    deudas_ext, monto = _deudas_telecable(codigo)
    data['deudas_externas'] = deudas_ext
    data['monto_deuda_externa'] = monto
    data['tiene_deuda_externa'] = bool(deudas_ext) or monto > 0
    data['coincidencia_por'] = coincidencia_por
    data['en_sistema'] = False
    data['source'] = 'TELECABLE'
    return data


def consultar_documento_registro(numero):
    """
    Orquesta la consulta de DNI/RUC para el wizard de registro.
    """
    numero = (numero or '').strip()
    if not numero.isdigit():
        return {'status': 'error', 'message': 'Documento inválido (solo dígitos)'}
    if len(numero) not in (8, 11):
        return {'status': 'error', 'message': 'Ingrese DNI (8 dígitos) o RUC (11 dígitos)'}

    origen = 'LOCAL'
    cliente_existente = False
    data = None

    local = sistema_buscar_cliente_local(numero)
    if local:
        cliente_existente = True
        data = _cliente_local_a_dict(local)
        origen = 'LOCAL'
    else:
        data = _consultar_telecable(numero)
        if data:
            origen = 'TELECABLE'
        else:
            data = _consultar_net_decolecta(numero)
            if data:
                origen = data.get('source', 'NET')
            else:
                return {
                    'status': 'success',
                    'origen': 'MANUAL',
                    'cliente_existente': False,
                    'cliente_nuevo': True,
                    'tiene_deuda': False,
                    'tiene_deuda_sistema': False,
                    'tiene_deuda_telecable': False,
                    'es_mayor_edad': None,
                    'message': 'No se encontró en sistema ni APIs. Complete los datos manualmente.',
                    'data': {
                        'dni': numero if len(numero) == 8 else None,
                        'ruc': numero if len(numero) == 11 else None,
                        'deudas': [],
                        'deudas_externas': [],
                    },
                }

    cumple = data.get('cumpleanos') or data.get('fecha_nacimiento')
    es_mayor = es_mayor_de_edad(cumple) if cumple else None
    deudas = data.get('deudas') or []
    deudas_ext = data.get('deudas_externas') or []
    tiene_deuda_sistema = bool(data.get('tiene_deuda_activa')) or len(deudas) > 0
    tiene_deuda_telecable = (
        len(deudas_ext) > 0
        or float(data.get('monto_deuda_externa') or 0) > 0
        or bool(data.get('tiene_deuda_externa'))
    )
    tiene_deuda_cobrar = tiene_deuda_sistema or tiene_deuda_telecable

    return {
        'status': 'success',
        'origen': origen,
        'cliente_existente': cliente_existente,
        'cliente_nuevo': not cliente_existente,
        'tiene_deuda': tiene_deuda_cobrar,
        'tiene_deuda_sistema': tiene_deuda_sistema,
        'tiene_deuda_telecable': tiene_deuda_telecable,
        'es_mayor_edad': es_mayor,
        'data': data,
    }

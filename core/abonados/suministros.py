from decimal import Decimal, InvalidOperation

from core.abonados.helpers.leer import leer_suministro_con_cache

from core.abonados.documentos import consultar_telecable_por_referencia



def _to_decimal(value, default='0'):

    try:

        return Decimal(str(value or default))

    except (InvalidOperation, TypeError):

        return Decimal(default)



def consultar_suministro_con_cache(suministro, documento=None):

    if not suministro:

        return None



    res = leer_suministro_con_cache(suministro)

    if not res:

        return None



    data = dict(res['data'])

    local = _enriquecer_suministro_local(suministro)



    deuda_luz = _to_decimal(data.get('deuda') or data.get('importetotal') or 0)

    data['deuda_luz'] = float(deuda_luz)

    data['deuda_luz_referencial'] = deuda_luz > 0

    data['deudas_sistema'] = local.get('deudas') or []

    data['tiene_deuda_sistema'] = local.get('tiene_deuda_pendiente') or False

    data['deuda_bloqueante'] = local.get('deuda_bloqueante') or False

    data['registrado_en_sistema'] = local.get('registrado_en_sistema') or False

    data['monto_deuda_sistema'] = local.get('monto_deuda_pendiente') or 0.0



    direccion_luz = data.get('direccion') or ''

    doc_titular = documento or data.get('documento_titular') or data.get('documento') or ''

    telecable = consultar_telecable_por_referencia(

        suministro=suministro,

        direccion=direccion_luz,

        documento=doc_titular,

    )

    if telecable:

        data['telecable'] = telecable

        data['deudas_externas'] = telecable.get('deudas_externas') or []

        data['monto_deuda_externa'] = telecable.get('monto_deuda_externa') or 0

        data['tiene_deuda_externa'] = telecable.get('tiene_deuda_externa') or False

        data['coincidencia_telecable_por'] = telecable.get('coincidencia_por')

        data['similitud_direccion'] = telecable.get('similitud_direccion')

    else:

        data['telecable'] = None

        data['deudas_externas'] = []

        data['monto_deuda_externa'] = 0

        data['tiene_deuda_externa'] = False



    return {'status': 'success', 'data': data}



def _enriquecer_suministro_local(suministro, cache_entry=None):

    from core.models.suscripciones import ServiciosAbonados

    from core.models.facturacion import FacturacionPagos



    servicio = ServiciosAbonados.objects.filter(numero_suministro=suministro).first()

    if not servicio:

        return {

            'registrado_en_sistema': False,

            'deuda_bloqueante': False,

            'tiene_deuda_pendiente': False,

            'monto_deuda_pendiente': 0.0,

            'deudas': [],

        }



    deuda_monto = servicio.deuda_acumulada or Decimal('0')

    tiene_deuda = deuda_monto > 0



    cargo_transactions = FacturacionPagos.objects.filter(

        servicio=servicio,

        tipo_transaccion='cargo'

    ).order_by('-fecha_transaccion')[:10]



    deudas_list = []

    for cargo in cargo_transactions:

        deudas_list.append({

            'id': cargo.id,

            'concepto': cargo.descripcion or 'Cargo por servicio',

            'monto_actual': float(cargo.monto),

            'cliente_id': servicio.abonado.id if servicio.abonado else None,

            'origen': 'SISTEMA',

        })



    if tiene_deuda and not deudas_list:

        deudas_list.append({

            'id': 0,

            'concepto': 'Deuda acumulada de servicio',

            'monto_actual': float(deuda_monto),

            'cliente_id': servicio.abonado.id if servicio.abonado else None,

            'origen': 'SISTEMA',

        })



    return {

        'registrado_en_sistema': True,

        'deuda_bloqueante': tiene_deuda and servicio.estado_servicio in ('suspendido', 'cortado'),

        'tiene_deuda_pendiente': tiene_deuda,

        'monto_deuda_pendiente': float(deuda_monto),

        'deudas': deudas_list,

    }


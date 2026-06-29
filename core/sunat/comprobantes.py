"""
Emisión de comprobantes SUNAT y notas de venta internas.
"""
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from core.models.models_generados import ComprobantesSunat, NotasVentaInternas, Ruc, RucSedes

SERIES = {
    'BOLETA': 'B001',
    'FACTURA': 'F001',
    'NOTA_CREDITO': 'FC01',
}


def normalizar_tipo_comprobante(tipo_comprobante, default='BOLETA'):
    tipo = (tipo_comprobante or default or 'BOLETA').strip().upper().replace('-', '_').replace(' ', '_')
    aliases = {
        'NOTA': 'NOTA_VENTA',
        'NOTA_DE_VENTA': 'NOTA_VENTA',
        'NOTA_VENTA_INTERNA': 'NOTA_VENTA',
        'NV': 'NOTA_VENTA',
    }
    return aliases.get(tipo, tipo)


def _calc_recaudado(ruc_id):
    now = timezone.now()
    qs = ComprobantesSunat.objects.filter(ruc_emisor_id=ruc_id)
    validos = [
        c for c in qs
        if getattr(c, 'estado_sunat', 'pendiente') in ('emitido', 'pendiente')
        and getattr(c, 'tipo_comprobante', '').upper() in ('BOLETA', 'FACTURA')
        and c.fecha_emision
        and c.fecha_emision.year == now.year
        and c.fecha_emision.month == now.month
    ]
    mes = sum(float(c.monto_total or 0.0) for c in validos)
    boletas_mes = sum(float(c.monto_total or 0.0) for c in validos if getattr(c, 'tipo_comprobante', '').upper() == 'BOLETA')
    facturas_mes = sum(float(c.monto_total or 0.0) for c in validos if getattr(c, 'tipo_comprobante', '').upper() == 'FACTURA')
    return {'mes': mes, 'boletas_mes': boletas_mes, 'facturas_mes': facturas_mes}


def validar_emision_comprobante(ruc_id, sede_id, tipo_comprobante, monto):
    try:
        sr = RucSedes.objects.select_related('ruc').get(sede_id=sede_id, ruc_id=ruc_id)
    except RucSedes.DoesNotExist:
        return False, 'RUC no autorizado para esta sede'
    # Record existence indicates linkage
    if hasattr(sr, 'activo') and not sr.activo:
        return False, 'RUC inactivo para la sede'
    tipo = normalizar_tipo_comprobante(tipo_comprobante)
    permisos = {
        'BOLETA': sr.permite_boleta,
        'FACTURA': sr.permite_factura,
        'NOTA_VENTA': sr.permite_nota_venta,
    }
    if tipo in permisos and not permisos[tipo]:
        return False, f'No está permitido emitir {tipo} con este RUC'
    if tipo == 'NOTA_VENTA':
        return True, 'OK'
    rec = _calc_recaudado(ruc_id)
    limite = float(getattr(sr, 'limite_recaudacion_mensual', None) or 600000)
    if rec['mes'] + float(monto) > limite:
        return False, f'Límite mensual de recaudación alcanzado (S/ {limite:,.2f})'
    if tipo == 'BOLETA':
        lim_b = float(getattr(sr.ruc, 'limite_mensual_boletas', None) or 600000)
        if rec['boletas_mes'] + float(monto) > lim_b:
            return False, 'Límite mensual de boletas alcanzado'
    if tipo == 'FACTURA':
        lim_f = float(getattr(sr.ruc, 'limite_mensual_facturas', None) or 1200000)
        if rec['facturas_mes'] + float(monto) > lim_f:
            return False, 'Límite mensual de facturas alcanzado'
    return True, 'OK'


def _calc_igv_desde_total(total):
    total = Decimal(str(total))
    subtotal = (total / Decimal('1.18')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    igv = (total - subtotal).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return subtotal, igv, total


def _siguiente_correlativo(ruc_emisor_id, tipo, serie):
    ultimo = (
        ComprobantesSunat.objects.filter(
            ruc_emisor_id=ruc_emisor_id,
            tipo_comprobante=tipo,
            serie=serie,
        )
        .order_by('-correlativo')
        .values_list('correlativo', flat=True)
        .first()
    )
    return (ultimo or 0) + 1


@transaction.atomic
def sistema_emitir_comprobante(cliente_id, ruc_emisor_id, sede_id, tipo_comprobante, monto_total, items_descripcion=None):
    """
    Crea registro en comprobantes_sunat o notas_venta_internas.
    Retorna dict con comprobante_id, tipo, serie, correlativo, pdf_url.
    """
    tipo = normalizar_tipo_comprobante(tipo_comprobante)
    monto = Decimal(str(monto_total))
    if monto <= 0:
        raise ValueError('El monto del comprobante debe ser mayor a cero')

    ok, msg = validar_emision_comprobante(ruc_emisor_id, sede_id, tipo, float(monto))
    if not ok:
        raise ValueError(msg)

    if tipo == 'NOTA_VENTA':
        nv = NotasVentaInternas.objects.create(
            cliente_id=cliente_id,
            monto_total=monto,
            fecha_registro=timezone.now(),
            state='PENDIENTE_CONVERSION',
        )
        return {
            'tipo': 'NOTA_VENTA',
            'nota_venta_id': nv.id,
            'monto_total': float(monto),
            'numero': f'NV-{nv.id}',
        }

    serie = SERIES.get(tipo, 'B001')
    correlativo = _siguiente_correlativo(ruc_emisor_id, tipo, serie)
    subtotal, igv, total = _calc_igv_desde_total(monto)

    comp = ComprobantesSunat.objects.create(
        ruc_emisor_id=ruc_emisor_id,
        cliente_id=cliente_id,
        tipo_comprobante=tipo,
        serie=serie,
        correlativo=correlativo,
        monto_subtotal=subtotal,
        monto_igv=igv,
        monto_total=total,
        fecha_emision=timezone.now(),
        pdf_url=f'/api/sede/rucs/{ruc_emisor_id}/comprobante/vista-previa/?tipo={tipo}&sede_id={sede_id}',
    )

    ruc = Ruc.objects.get(pk=ruc_emisor_id)
    return {
        'tipo': tipo,
        'comprobante_id': comp.id,
        'serie': serie,
        'correlativo': correlativo,
        'numero': f'{serie}-{correlativo:08d}',
        'monto_total': float(total),
        'ruc_emisor': ruc.ruc_numero,
        'pdf_url': comp.pdf_url,
        'descripcion': items_descripcion or 'Servicios de telecomunicaciones',
    }


@transaction.atomic
def sistema_convertir_nota_venta(nota_venta_id, ruc_emisor_id, sede_id, tipo_comprobante):
    tipo = normalizar_tipo_comprobante(tipo_comprobante)
    if tipo not in ('BOLETA', 'FACTURA'):
        raise ValueError('La nota de venta solo se puede convertir en BOLETA o FACTURA')

    nv = NotasVentaInternas.objects.get(pk=nota_venta_id)
    estado_actual = (getattr(nv, 'state', '') or '').upper()
    if estado_actual.startswith('CONVERTIDA'):
        raise ValueError('La nota de venta ya fue convertida')

    monto = Decimal(str(nv.monto_total))
    ok, msg = validar_emision_comprobante(ruc_emisor_id, sede_id, tipo, float(monto))
    if not ok:
        raise ValueError(msg)

    serie = SERIES.get(tipo, 'B001')
    correlativo = _siguiente_correlativo(ruc_emisor_id, tipo, serie)
    subtotal, igv, total = _calc_igv_desde_total(monto)

    comp = ComprobantesSunat.objects.create(
        ruc_emisor_id=ruc_emisor_id,
        cliente_id=nv.cliente_id,
        tipo_comprobante=tipo,
        serie=serie,
        correlativo=correlativo,
        monto_subtotal=subtotal,
        monto_igv=igv,
        monto_total=total,
        fecha_emision=timezone.now(),
        pdf_url=f'/api/sede/rucs/{ruc_emisor_id}/comprobante/vista-previa/?tipo={tipo}&sede_id={sede_id}',
    )

    nv.state = f'CONVERTIDA_{tipo}'
    nv.save()

    numero_anterior = f'NV-{nv.id}'
    numero_nuevo = f'{serie}-{correlativo:08d}'
    try:
        from core.models.models_generados import FacturacionPagos
        FacturacionPagos.objects.filter(
            numero_documento=numero_anterior,
            tipo_transaccion='abono',
        ).update(
            numero_documento=numero_nuevo,
            tipo_documento=tipo.lower(),
        )
    except Exception:
        pass

    ruc = Ruc.objects.get(pk=ruc_emisor_id)
    return {
        'tipo': tipo,
        'comprobante_id': comp.id,
        'nota_venta_id': nv.id,
        'serie': serie,
        'correlativo': correlativo,
        'numero': numero_nuevo,
        'monto_total': float(total),
        'ruc_emisor': ruc.ruc_numero,
        'estado_nota_venta': nv.state,
        'pdf_url': f'/api/sede/rucs/{ruc_emisor_id}/comprobante/{comp.id}/vista-previa/',
    }

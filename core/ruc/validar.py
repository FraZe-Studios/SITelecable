from decimal import Decimal
from core.models.models_generados import SedeRuc
from core.sunat.comprobantes import normalizar_tipo_comprobante
from core.ruc.utils import calc_recaudado

def validar(ruc_id, sede_id, tipo_comprobante, monto) -> tuple[bool, str]:
    """
    Valida si se puede emitir un comprobante según permisos y límites SUNAT de la sede.
    Retorna (ok: bool, mensaje: str).
    """
    try:
        sr = SedeRuc.objects.select_related('ruc').get(sede_id=sede_id, ruc_id=ruc_id)
    except SedeRuc.DoesNotExist:
        return False, 'RUC no autorizado para esta sede'

    if hasattr(sr, 'activo') and not sr.activo:
        return False, 'Este RUC está inactivo para la sede'

    tipo = normalizar_tipo_comprobante(tipo_comprobante)
    permisos = {
        'BOLETA': sr.permite_boleta,
        'FACTURA': sr.permite_factura,
        'NOTA_VENTA': sr.permite_nota_venta,
        'NOTA_DEUDA': getattr(sr, 'permite_nota_deuda', True),
    }
    if tipo in permisos and not permisos[tipo]:
        return False, f'No está permitido emitir {tipo} con este RUC en esta sede'

    if tipo == 'NOTA_VENTA':
        return True, 'OK'

    rec = calc_recaudado(ruc_id)
    limite = float(getattr(sr, 'limite_recaudacion_mensual', None) or 600000)
    if rec['mes'] + float(monto) > limite:
        return False, f'Límite mensual de recaudación alcanzado (S/ {limite:,.2f}). Use otro RUC.'

    if tipo == 'BOLETA':
        lim_b = float(getattr(sr.ruc, 'limite_mensual_boletas', None) or 600000)
        if rec['boletas_mes'] + float(monto) > lim_b:
            return False, f'Límite mensual de boletas alcanzado (S/ {lim_b:,.2f})'
    if tipo == 'FACTURA':
        lim_f = float(getattr(sr.ruc, 'limite_mensual_facturas', None) or 1200000)
        if rec['facturas_mes'] + float(monto) > lim_f:
            return False, f'Límite mensual de facturas alcanzado (S/ {lim_f:,.2f})'

    return True, 'OK'

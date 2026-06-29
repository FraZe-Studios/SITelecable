from django.conf import settings
from django.utils import timezone
from core.models.models_generados import ComprobantesSunat, SedeRuc

def calc_recaudado(ruc_id):
    """Calcula el monto recaudado por un RUC en el mes y año actuales."""
    now = timezone.now()
    qs = ComprobantesSunat.objects.filter(ruc_emisor_id=ruc_id)
    emitidos = [
        c for c in qs 
        if getattr(c, 'estado_sunat', 'pendiente') in ('emitido', 'pendiente') 
        and getattr(c, 'tipo_comprobante', '').upper() != 'BAJA'
        and c.fecha_emision
    ]
    
    mes = 0.0
    anio = 0.0
    boletas_mes = 0.0
    facturas_mes = 0.0
    
    for c in emitidos:
        monto = float(c.monto_total or 0.0)
        if c.fecha_emision.year == now.year:
            anio += monto
            if c.fecha_emision.month == now.month:
                mes += monto
                if c.tipo_comprobante == 'BOLETA':
                    boletas_mes += monto
                elif c.tipo_comprobante == 'FACTURA':
                    facturas_mes += monto
                    
    return {
        'mes': mes,
        'anio': anio,
        'boletas_mes': boletas_mes,
        'facturas_mes': facturas_mes,
    }

def ruc_to_dict(sr: SedeRuc, sede_id):
    """Convierte un objeto SedeRuc/Ruc a diccionario para JSON."""
    ruc = sr.ruc
    vinculado = True
    rec = calc_recaudado(ruc.id)
    limite = float(getattr(sr, 'limite_recaudacion_mensual', None) or 600000)
    lim_boletas = float(getattr(ruc, 'limite_mensual_boletas', None) or 600000)
    lim_facturas = float(getattr(ruc, 'limite_mensual_facturas', None) or 1200000)
    puede_emitir = getattr(sr, 'activo', True)
    return {
        'id': ruc.id,
        'vinculado': vinculado,
        'sede_ruc_activo': getattr(sr, 'activo', True),
        'numero': ruc.ruc_numero,
        'numero_ruc': ruc.ruc_numero,
        'razon_social': ruc.razon_social,
        'direccion_fiscal': ruc.direccion_fiscal or '',
        'telefono_celular': ruc.telefono_celular or '',
        'usuario_sol': ruc.usuario_sol,
        'logo_url': ruc.logo_url or sr.logo_url or '',
        'certificado_p12': bool(ruc.certificado_p12),
        'monto_recaudado_mes': rec['mes'],
        'monto_recaudado_anio': rec['anio'],
        'monto_boletas_mes': rec['boletas_mes'],
        'monto_facturas_mes': rec['facturas_mes'],
        'limite_recaudacion_mensual': limite,
        'limite_mensual_boletas': lim_boletas,
        'limite_mensual_facturas': lim_facturas,
        'permite_boleta': sr.permite_boleta,
        'permite_factura': sr.permite_factura,
        'permite_nota_venta': sr.permite_nota_venta,
        'permite_nota_deuda': getattr(sr, 'permite_nota_deuda', True),
        'formato_impresion': sr.formato_impresion,
        'prefijo_boleta': getattr(sr, 'prefijo_boleta', 'B001'),
        'prefijo_factura': getattr(sr, 'prefijo_factura', 'F001'),
        'numero_actual_boleta': getattr(sr, 'numero_actual_boleta', 1),
        'numero_actual_factura': getattr(sr, 'numero_actual_factura', 1),
        'contrato': bool(getattr(sr, 'contrato_pdf_path', None)),
        'contrato_pdf_path': getattr(sr, 'contrato_pdf_path', None) or '',
        'puede_emitir_boleta': puede_emitir and sr.permite_boleta and rec['boletas_mes'] < lim_boletas,
        'puede_emitir_factura': puede_emitir and sr.permite_factura and rec['facturas_mes'] < lim_facturas,
        'limite_alcanzado': rec['mes'] >= limite,
        'puede_emitir': puede_emitir,
    }

def build_comprobante_context(ruc, tipo='BOLETA', comprobante=None, cliente=None, formato='A4', sr=None):
    """Arma el contexto para la plantilla de vista previa del comprobante."""
    if comprobante and cliente:
        subtotal = float(comprobante.monto_subtotal)
        total_igv = float(comprobante.monto_igv)
        total = float(comprobante.monto_total)
        doc = cliente.ruc or cliente.dni or '—'
        nombre = cliente.razon_social or cliente.nombre_apellidos or '—'
        direccion = cliente.direccion_fiscal or '—'
        codigo = getattr(cliente, 'id_cliente_codigo', '—')
        serie = comprobante.serie
        correlativo = comprobante.correlativo
        fecha = comprobante.fecha_emision.strftime('%d/%m/%Y') if comprobante.fecha_emision else timezone.now().strftime('%d/%m/%Y')
        tipo_label = comprobante.tipo_comprobante
    else:
        subtotal = 72.03
        total_igv = 12.97
        total = 85.00
        doc = '21245677'
        nombre = 'BARRETO MARCELO, LUIS RAUL'
        direccion = 'DRP - HUAMPANI DPTO S1 JUNÍN-YAULI-LA OROYA'
        codigo = 'OR01-A0012703'
        
        # Obtener prefijos y correlativos del SedeRuc o usar valores por defecto
        if sr:
            if tipo == 'FACTURA':
                serie = getattr(sr, 'prefijo_factura', 'F001') or 'F001'
                correlativo = getattr(sr, 'numero_actual_factura', 1) or 1
            elif tipo == 'BOLETA':
                serie = getattr(sr, 'prefijo_boleta', 'B001') or 'B001'
                correlativo = getattr(sr, 'numero_actual_boleta', 1) or 1
            else:
                serie = 'NV01'
                correlativo = 1
        else:
            if tipo == 'FACTURA':
                serie = 'F001'
                correlativo = 1
            elif tipo == 'BOLETA':
                serie = 'B001'
                correlativo = 1
            else:
                serie = 'NV01'
                correlativo = 1
                
        fecha = timezone.now().strftime('%d/%m/%Y %H:%M:%S')
        tipo_label = tipo

    items = [{
        'cantidad': '1.00000',
        'descripcion': f'COD {codigo} DUO RESIDENCIAL 300MG MARZO 2026' if not comprobante else 'Servicio de Internet / Cable',
        'precio_unitario': f'{subtotal:.6f}',
        'igv': f'{total_igv:.2f}',
        'subtotal': f'{subtotal:.2f}',
    }]
    tipo_display = {
        'BOLETA': 'BOLETA ELECTRÓNICA',
        'FACTURA': 'FACTURA ELECTRÓNICA',
        'NOTA_CREDITO': 'NOTA DE CRÉDITO',
        'NOTA_VENTA': 'NOTA DE VENTA',
    }.get(tipo_label, tipo_label)

    return {
        'razon_social': ruc.razon_social,
        'ruc_emisor': ruc.ruc_numero,
        'direccion_fiscal': ruc.direccion_fiscal or '',
        'telefono': ruc.telefono_celular or '',
        'logo_url': ruc.logo_url or '',
        'tipo_comprobante': tipo_display,
        'serie': serie,
        'correlativo': str(correlativo).zfill(7),
        'fecha_emision': fecha,
        'cliente_documento': doc,
        'cliente_nombre': nombre,
        'cliente_direccion': direccion,
        'cliente_codigo': codigo,
        'items': items,
        'subtotal': f'{subtotal:.2f}',
        'total_igv': f'{total_igv:.2f}',
        'total': f'{total:.2f}',
        'qr_url': 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=VISTA-PREVIA',
        'resolucion_intendencia': '034-005-0001234',
        'codigo_hash': 'X+XIV7e7iP8ZgBLkl6nDxZkLxl=',
        'formato': formato,
        'es_vista_previa': comprobante is None,
    }

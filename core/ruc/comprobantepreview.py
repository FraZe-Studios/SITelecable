from django.shortcuts import render
from django.http import JsonResponse
from django.utils import timezone
from core.models.models_generados import RucsGlobales, ComprobantesSunat
from core.auth.comun import checksession, senderror
from core.sunat.comprobantes import normalizar_tipo_comprobante
from core.ruc.utils import build_comprobante_context

def comprobantepreview(request, ruc_id, comprobante_id=None):
    """GET vista previa HTML del comprobante (emitido o muestra)."""
    if not checksession(request):
        return JsonResponse({'status': 'error', 'message': 'Sin sesión'}, status=401)
        
    formato = request.GET.get('formato', 'A4')
    try:
        ruc = RucsGlobales.objects.get(pk=ruc_id)
        if comprobante_id:
            fuerza_nota_venta = normalizar_tipo_comprobante(request.GET.get('tipo', ''), default='') == 'NOTA_VENTA'
            try:
                if fuerza_nota_venta:
                    raise ComprobantesSunat.DoesNotExist
                comprobante = ComprobantesSunat.objects.get(pk=comprobante_id)
                cliente = comprobante.cliente
                ctx = build_comprobante_context(ruc, comprobante.tipo_comprobante, comprobante, cliente, formato)
                
                if getattr(comprobante, 'codigo_qr', None):
                    import urllib.parse
                    encoded_qr = urllib.parse.quote(comprobante.codigo_qr)
                    ctx['qr_url'] = f'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data={encoded_qr}'
                if getattr(comprobante, 'codigo_hash', None):
                    ctx['codigo_hash'] = comprobante.codigo_hash
                
                # Fetch registered user from FacturacionPagos
                doc_num = f"{comprobante.serie}-{comprobante.correlativo:08d}"
                from core.models.models_generados import FacturacionPagos
                abono = FacturacionPagos.objects.filter(numero_documento=doc_num, tipo_transaccion='abono').first()
                if abono:
                    if abono.vendedor:
                        ctx['registrado_por'] = abono.vendedor.nombre_completo
                    if abono.fecha_transaccion:
                        ctx['registrado_fecha'] = abono.fecha_transaccion.strftime('%d/%m/%Y')
                        ctx['registrado_hora'] = abono.fecha_transaccion.strftime('%H:%M:%S')
            except ComprobantesSunat.DoesNotExist:
                # Intenta buscar en NotasVentaInternas
                from core.models.models_generados import NotasVentaInternas, Abonados
                try:
                    nv = NotasVentaInternas.objects.get(pk=comprobante_id)
                    cliente = Abonados.objects.get(pk=int(nv.cliente_id)) if nv.cliente_id else None
                    subtotal = float(nv.monto_total)
                    total_igv = 0.0
                    total = float(nv.monto_total)
                    doc = (cliente.ruc or cliente.dni or '—') if cliente else '—'
                    nombre = (cliente.razon_social or cliente.nombre_apellidos or '—') if cliente else '—'
                    direccion = (cliente.direccion_fiscal or '—') if cliente else '—'
                    codigo = getattr(cliente, 'id_cliente_codigo', '—') if cliente else '—'
                    serie = 'NV01'
                    correlativo = nv.id
                    fecha = nv.fecha_registro.strftime('%d/%m/%Y %H:%M:%S') if nv.fecha_registro else timezone.now().strftime('%d/%m/%Y %H:%M:%S')
                    
                    items = [{
                        'cantidad': '1.00000',
                        'descripcion': 'Servicios de telecomunicaciones / Nota de venta',
                        'precio_unitario': f'{subtotal:.6f}',
                        'igv': '0.00',
                        'subtotal': f'{subtotal:.2f}',
                    }]
                    
                    ctx = {
                        'razon_social': ruc.razon_social,
                        'ruc_emisor': ruc.ruc_numero,
                        'direccion_fiscal': ruc.direccion_fiscal or '',
                        'telefono': ruc.telefono_celular or '',
                        'logo_url': ruc.logo_url or '',
                        'tipo_comprobante': 'NOTA DE VENTA',
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
                        'qr_url': 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=NOTA-VENTA',
                        'resolucion_intendencia': '—',
                        'codigo_hash': '—',
                        'formato': formato,
                        'es_vista_previa': False,
                    }
                    from core.models.models_generados import FacturacionPagos
                    abono = FacturacionPagos.objects.filter(descripcion__contains=f"PAGO_CARGO_ID: {nv.id}", tipo_transaccion='abono').first()
                    if abono:
                        if abono.vendedor:
                            ctx['registrado_por'] = abono.vendedor.nombre_completo
                        if abono.fecha_transaccion:
                            ctx['registrado_fecha'] = abono.fecha_transaccion.strftime('%d/%m/%Y')
                            ctx['registrado_hora'] = abono.fecha_transaccion.strftime('%H:%M:%S')
                except (NotasVentaInternas.DoesNotExist, Abonados.DoesNotExist, ValueError):
                    return senderror('Comprobante no encontrado', status=404)
        else:
            abono_id = request.GET.get('abono_id')
            if abono_id:
                from core.models.models_generados import FacturacionPagos, Abonados
                try:
                    abono = FacturacionPagos.objects.select_related('servicio', 'servicio__cliente').get(pk=int(abono_id))
                    cliente = abono.servicio.cliente
                    
                    tipo_comp = (abono.tipo_documento or 'BOLETA').upper()
                    total = float(abono.monto)
                    if tipo_comp in ('BOLETA', 'FACTURA'):
                        subtotal = round(total / 1.18, 2)
                        total_igv = round(total - subtotal, 2)
                    else:
                        subtotal = total
                        total_igv = 0.0
                        
                    doc = cliente.ruc or cliente.dni or '—'
                    nombre = cliente.razon_social or cliente.nombre_apellidos or '—'
                    direccion = cliente.direccion_fiscal or '—'
                    codigo = getattr(cliente, 'id_cliente_codigo', '—')
                    
                    num_doc = abono.numero_documento
                    if num_doc and '-' in num_doc:
                        parts = num_doc.split('-')
                        serie = parts[0]
                        correlativo = parts[1]
                    else:
                        serie = 'NV01' if tipo_comp == 'NOTA_VENTA' else ('B001' if tipo_comp == 'BOLETA' else 'F001')
                        correlativo = str(abono.id).zfill(7)
                        
                    fecha = abono.fecha_transaccion.strftime('%d/%m/%Y %H:%M:%S') if abono.fecha_transaccion else timezone.now().strftime('%d/%m/%Y %H:%M:%S')
                    
                    items = [{
                        'cantidad': '1.00000',
                        'descripcion': abono.descripcion or 'Servicio de Internet / Cable',
                        'precio_unitario': f'{subtotal:.6f}',
                        'igv': f'{total_igv:.2f}',
                        'subtotal': f'{subtotal:.2f}',
                    }]
                    
                    tipo_display = {
                        'BOLETA': 'BOLETA ELECTRÓNICA',
                        'FACTURA': 'FACTURA ELECTRÓNICA',
                        'NOTA_VENTA': 'NOTA DE VENTA',
                        'NOTA_CREDITO': 'NOTA DE CRÉDITO',
                    }.get(tipo_comp, tipo_comp)
                    
                    ctx = {
                        'razon_social': ruc.razon_social,
                        'ruc_emisor': ruc.ruc_numero,
                        'direccion_fiscal': ruc.direccion_fiscal or '',
                        'telefono': ruc.telefono_celular or '',
                        'logo_url': ruc.logo_url or '',
                        'tipo_comprobante': tipo_display,
                        'serie': serie,
                        'correlativo': correlativo,
                        'fecha_emision': fecha,
                        'cliente_documento': doc,
                        'cliente_nombre': nombre,
                        'cliente_direccion': direccion,
                        'cliente_codigo': codigo,
                        'items': items,
                        'subtotal': f'{subtotal:.2f}',
                        'total_igv': f'{total_igv:.2f}',
                        'total': f'{total:.2f}',
                        'qr_url': f'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data={serie}-{correlativo}',
                        'resolucion_intendencia': '—',
                        'codigo_hash': '—',
                        'formato': formato,
                        'es_vista_previa': False,
                    }
                    if abono.vendedor:
                        ctx['registrado_por'] = abono.vendedor.nombre_completo
                    if abono.fecha_transaccion:
                        ctx['registrado_fecha'] = abono.fecha_transaccion.strftime('%d/%m/%Y')
                        ctx['registrado_hora'] = abono.fecha_transaccion.strftime('%H:%M:%S')
                except (FacturacionPagos.DoesNotExist, ValueError):
                    return senderror('Abono no encontrado', status=404)
            else:
                tipo = request.GET.get('tipo', 'BOLETA').upper()
                sede_id_raw = request.GET.get('sede_id') or request.session.get('current_sede_id')
                sr = None
                if ruc and sede_id_raw:
                    try:
                        from core.models.models_generados import SedeRuc
                        sr = SedeRuc.objects.filter(sede_id=int(sede_id_raw), ruc_id=ruc.id).first()
                    except (ValueError, TypeError):
                        pass
                ctx = build_comprobante_context(ruc, tipo, None, None, formato, sr=sr)
        
        if 'registrado_por' not in ctx or not ctx['registrado_por']:
            ctx['registrado_por'] = request.session.get('nombre') or 'ADMINISTRADOR DEL SISTEMA'
        if 'registrado_fecha' not in ctx or not ctx['registrado_fecha']:
            ctx['registrado_fecha'] = timezone.now().strftime('%d/%m/%Y')
        if 'registrado_hora' not in ctx or not ctx['registrado_hora']:
            ctx['registrado_hora'] = timezone.now().strftime('%H:%M:%S')
            
        return render(request, 'organizacion/components/comprobantes/factura_template.html', ctx)
    except RucsGlobales.DoesNotExist:
        return senderror('RUC no encontrado', status=404)

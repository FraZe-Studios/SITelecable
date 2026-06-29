import json
import os
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from core.models.models_generados import SedeRuc, ComprobantesSunat
from core.auth.comun import checksession, senderror
from core.ruc.utils import ruc_to_dict

def _media_ruc_dir(ruc_id, *parts):
    path = settings.MEDIA_ROOT / 'rucs' / str(ruc_id)
    for p in parts:
        path = path / p
    path.mkdir(parents=True, exist_ok=True)
    return path

def _save_upload(upload, dest_path):
    with open(dest_path, 'wb') as f:
        for chunk in upload.chunks():
            f.write(chunk)
    return str(dest_path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')

@csrf_exempt
def detalle(request, ruc_id):
    """GET/PUT/DELETE /api/sede/rucs/<id>/"""
    if not checksession(request):
        return senderror('Sin sesión', status=401)

    sede_id = request.GET.get('sede_id') or request.POST.get('sede_id')
    
    if request.method == 'GET':
        try:
            sr = SedeRuc.objects.select_related('ruc').get(sede_id=sede_id, ruc_id=ruc_id)
            data = ruc_to_dict(sr, sede_id)
            
            # Incorporar campos SUNAT en los datos retornados
            data['prefijo_boleta'] = sr.prefijo_boleta
            data['prefijo_factura'] = sr.prefijo_factura
            data['numero_actual_boleta'] = sr.numero_actual_boleta
            data['numero_actual_factura'] = sr.numero_actual_factura
            
            comprobantes_qs = ComprobantesSunat.objects.filter(ruc_emisor_id=ruc_id)
            data['comprobantes'] = [
                {
                    'id': c.id,
                    'tipo_comprobante': c.tipo_comprobante,
                    'serie': c.serie,
                    'correlativo': c.correlativo,
                    'monto_total': float(c.monto_total),
                    'fecha_emision': c.fecha_emision.strftime('%Y-%m-%d %H:%M:%S') if c.fecha_emision else '—',
                    'estado_sunat': getattr(c, 'estado_sunat', 'pendiente'),
                }
                for c in comprobantes_qs
            ]
            return JsonResponse({'status': 'success', 'ruc': data})
        except SedeRuc.DoesNotExist:
            return senderror('RUC no vinculado a esta sede', status=404)

    if request.method == 'DELETE':
        from core.ruc.desvincular import desvincular
        return desvincular(request, ruc_id)

    if request.method in ('POST', 'PUT', 'PATCH'):
        try:
            if not sede_id:
                if request.body:
                    try:
                        body_data = json.loads(request.body)
                        sede_id = body_data.get('sede_id')
                    except Exception:
                        pass
                if not sede_id:
                    sede_id = request.POST.get('sede_id')
                    
            sr = SedeRuc.objects.select_related('ruc').get(sede_id=sede_id, ruc_id=ruc_id)
            ruc = sr.ruc
            ruc.razon_social = request.POST.get('razon_social', ruc.razon_social)
            ruc.direccion_fiscal = request.POST.get('direccion_fiscal', ruc.direccion_fiscal or '')
            ruc.telefono_celular = request.POST.get('telefono_celular', ruc.telefono_celular or '')
            ruc.usuario_sol = request.POST.get('usuario_sol', ruc.usuario_sol)
            if request.POST.get('clave_sol'):
                ruc.password_sol = request.POST['clave_sol']
            if request.POST.get('clave_certificado'):
                ruc.clave_certificado = request.POST['clave_certificado']
                
            media_dir = _media_ruc_dir(ruc.id)
            if 'logo' in request.FILES:
                logo = request.FILES['logo']
                ext = os.path.splitext(logo.name)[1].lower() or '.png'
                rel = _save_upload(logo, media_dir / f'logo{ext}')
                ruc.logo_url = f'/media/{rel}'
            if 'certificado_p12' in request.FILES:
                rel = _save_upload(request.FILES['certificado_p12'], media_dir / 'certificado.p12')
                ruc.certificado_p12 = rel
            ruc.save()
            
            sr.permite_boleta = request.POST.get('permite_boleta') in ('true', 'on', '1', True)
            sr.permite_factura = request.POST.get('permite_factura') in ('true', 'on', '1', True)
            sr.permite_nota_venta = request.POST.get('permite_nota_venta') in ('true', 'on', '1', True)
            
            if hasattr(sr, 'permite_nota_deuda'):
                sr.permite_nota_deuda = request.POST.get('permite_nota_deuda') in ('true', 'on', '1', True)
            sr.formato_impresion = request.POST.get('formato_impresion', sr.formato_impresion)
            if hasattr(sr, 'activo'):
                sr.activo = request.POST.get('activo', 'true') in ('true', 'on', '1', True)
                
            # Actualizar series SUNAT si vienen en POST
            if request.POST.get('prefijo_boleta'):
                sr.prefijo_boleta = str(request.POST['prefijo_boleta']).strip().upper()
            if request.POST.get('prefijo_factura'):
                sr.prefijo_factura = str(request.POST['prefijo_factura']).strip().upper()
            if request.POST.get('numero_actual_boleta'):
                sr.numero_actual_boleta = int(request.POST['numero_actual_boleta'])
            if request.POST.get('numero_actual_factura'):
                sr.numero_actual_factura = int(request.POST['numero_actual_factura'])

            if hasattr(sr, 'limite_recaudacion_mensual'):
                lim = request.POST.get('limite_recaudacion_mensual')
                if lim:
                    sr.limite_recaudacion_mensual = Decimal(lim)
            sr.save()
            return JsonResponse({'status': 'success'})
        except SedeRuc.DoesNotExist:
            return senderror('RUC no encontrado', status=404)
        except Exception as e:
            return senderror(str(e), status=500)

    return senderror('Método no permitido', status=405)

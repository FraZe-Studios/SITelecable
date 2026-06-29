import os
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from core.models.models_generados import Sedes, RucsGlobales, SedeRuc
from core.auth.comun import checksession, senderror

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
def create(request):
    """POST /api/sede/rucs/ — Crear RUC global y vincular a sede (multipart)."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        print(f"DEBUG: request.POST keys: {list(request.POST.keys())}")
        print(f"DEBUG: request.POST data: {dict(request.POST)}")
        print(f"DEBUG: request.FILES keys: {list(request.FILES.keys())}")
        sede_id_val = request.POST.get('sede_id') or request.POST.get('current_sede_id') or request.GET.get('sede_id') or request.session.get('current_sede_id')
        print(f"DEBUG: sede_id raw values - POST.sede_id: {request.POST.get('sede_id')}, POST.current_sede_id: {request.POST.get('current_sede_id')}, GET.sede_id: {request.GET.get('sede_id')}, session.current_sede_id: {request.session.get('current_sede_id')}")
        sede_id = int(sede_id_val or 0)
        print(f"DEBUG: sede_id final: {sede_id}")
        if not sede_id:
            return senderror(f'sede_id requerido (recibido: {sede_id_val})', status=400)
            
        Sedes.objects.get(pk=sede_id)

        numero_ruc = (request.POST.get('numero_ruc') or '').strip()
        if len(numero_ruc) != 11 or not numero_ruc.isdigit():
            return senderror('RUC debe tener 11 dígitos', status=400)

        ruc, _ = RucsGlobales.objects.get_or_create(
            ruc_numero=numero_ruc,
            defaults={
                'razon_social': request.POST.get('razon_social', ''),
                'direccion_fiscal': request.POST.get('direccion_fiscal', ''),
                'telefono_celular': request.POST.get('telefono_celular', ''),
                'usuario_sol': request.POST.get('usuario_sol', '') or 'MODDATOS',
                'password_sol': request.POST.get('clave_sol', '') or 'MODDATOS',
            },
        )
        ruc.razon_social = request.POST.get('razon_social', ruc.razon_social)
        ruc.direccion_fiscal = request.POST.get('direccion_fiscal', ruc.direccion_fiscal or '')
        ruc.telefono_celular = request.POST.get('telefono_celular', ruc.telefono_celular or '')
        ruc.usuario_sol = request.POST.get('usuario_sol', ruc.usuario_sol) or 'MODDATOS'
        if request.POST.get('clave_sol'):
            ruc.password_sol = request.POST['clave_sol']
        if request.POST.get('clave_certificado'):
            ruc.clave_certificado = request.POST['clave_certificado']

        media_dir = _media_ruc_dir(ruc.id)
        if 'logo' in request.FILES:
            logo = request.FILES['logo']
            ext = os.path.splitext(logo.name)[1].lower() or '.png'
            logo_path = media_dir / f'logo{ext}'
            rel = _save_upload(logo, logo_path)
            ruc.logo_url = f'/media/{rel}'
        if 'certificado_p12' in request.FILES:
            cert = request.FILES['certificado_p12']
            cert_path = media_dir / 'certificado.p12'
            rel = _save_upload(cert, cert_path)
            ruc.certificado_p12 = rel

        ruc.save()
        ruc.refresh_from_db()

        sr, _ = SedeRuc.objects.get_or_create(sede_id=sede_id, ruc=ruc)
        sr.permite_boleta = request.POST.get('permite_boleta') in ('true', 'on', '1', True)
        sr.permite_factura = request.POST.get('permite_factura') in ('true', 'on', '1', True)
        sr.permite_nota_venta = request.POST.get('permite_nota_venta') in ('true', 'on', '1', True)
        if hasattr(sr, 'permite_nota_deuda'):
            sr.permite_nota_deuda = request.POST.get('permite_nota_deuda', 'on') in ('true', 'on', '1', True)
        sr.formato_impresion = request.POST.get('formato_impresion', 'A4')
        if hasattr(sr, 'activo'):
            sr.activo = True
            
        # Almacenar series SUNAT si se especifican
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
        sr.refresh_from_db()

        return JsonResponse({'status': 'success', 'ruc_id': ruc.id})
    except Sedes.DoesNotExist:
        return senderror('Sede no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

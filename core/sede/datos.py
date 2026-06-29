import json
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sedes, SedeRuc, RucsGlobales
from core.auth.comun import checksession, senderror
from core.sede.sedeutils import strip_sede_prefijo

@csrf_exempt
def datos(request):
    """POST /api/sede/config/datos/ — Actualiza datos base de la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        if request.content_type and 'multipart/form-data' in request.content_type:
            body = request.POST
            is_json = False
        else:
            body = json.loads(request.body)
            is_json = True

        sede_id = body.get('sede_id')
        sede = Sedes.objects.get(pk=int(sede_id))
        nombre_base = strip_sede_prefijo(body.get('nombre', sede.nombre))
        if not nombre_base:
            return senderror('El nombre de la sede es obligatorio', status=400)
            
        sede.nombre = nombre_base
        sede.descripcion = body.get('descripcion', sede.descripcion)
        sector_id = body.get('sector_id')
        
        if sector_id:
            sede.sector_id = int(sector_id)
        elif sector_id == '' or sector_id is None:
            return senderror('Debe asignar un sector geográfico', status=400)
            
        if body.get('latitud'):
            sede.latitud = float(body['latitud'])
        if body.get('longitud'):
            sede.longitud = float(body['longitud'])
            
        if 'activa' in body and hasattr(sede, 'activa'):
            if is_json:
                sede.activa = bool(body['activa'])
            else:
                sede.activa = body.get('activa') in ('true', 'on', '1', True)
        sede.save()

        # Guardar logo si se subió uno
        if 'logo' in request.FILES:
            logo = request.FILES['logo']
            sr = SedeRuc.objects.filter(sede=sede).first()
            if not sr:
                ruc = RucsGlobales.objects.first()
                if ruc:
                    sr = SedeRuc.objects.create(sede=sede, ruc=ruc)
            if sr:
                from django.conf import settings
                media_dir = settings.MEDIA_ROOT / 'rucs' / str(sr.ruc.id)
                media_dir.mkdir(parents=True, exist_ok=True)
                ext = os.path.splitext(logo.name)[1].lower() or '.png'
                logo_path = media_dir / f'logo_sede_{sede.id}{ext}'
                with open(logo_path, 'wb') as f:
                    for chunk in logo.chunks():
                        f.write(chunk)
                rel = str(logo_path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')
                sr.logo_url = f'/media/{rel}'
                sr.save()

        return JsonResponse({'status': 'success', 'nombre_actualizado': sede.nombre})
        
    except Sedes.DoesNotExist:
        return senderror('Sede no encontrada', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

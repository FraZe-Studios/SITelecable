import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from core.models.models_generados import SedeRuc
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
def contrato(request, ruc_id):
    """POST /api/sede/rucs/<id>/contrato/ — Subir contrato PDF para sede+RUC."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        sede_id = request.POST.get('sede_id')
        sr = SedeRuc.objects.get(sede_id=sede_id, ruc_id=ruc_id)
        upload = request.FILES.get('contrato')
        if not upload:
            return senderror('Archivo contrato requerido', status=400)
            
        if not upload.name.lower().endswith('.pdf'):
            return senderror('Solo se permiten archivos PDF', status=400)
            
        dest = _media_ruc_dir(ruc_id, 'contratos') / f'sede_{sede_id}_contrato.pdf'
        rel = _save_upload(upload, dest)
        if hasattr(sr, 'contrato_pdf_path'):
            sr.contrato_pdf_path = rel
            sr.save()
            sr.refresh_from_db()
        return JsonResponse({'status': 'success', 'path': rel, 'sede_id': sede_id})
    except SedeRuc.DoesNotExist:
        return senderror('RUC no vinculado', status=404)
    except Exception as e:
        return senderror(str(e), status=500)

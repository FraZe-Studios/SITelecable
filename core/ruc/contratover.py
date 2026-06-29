from django.http import FileResponse
from django.conf import settings
from core.models.models_generados import SedeRuc
from core.auth.comun import checksession, senderror

def contratover(request, ruc_id):
    """GET /api/sede/rucs/<id>/contrato/ver/?sede_id= — Ver contrato PDF."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    sede_id = request.GET.get('sede_id')
    try:
        sr = SedeRuc.objects.get(sede_id=sede_id, ruc_id=ruc_id)
        path = getattr(sr, 'contrato_pdf_path', None)
        if not path:
            return senderror('Sin contrato', status=404)
            
        file_path = settings.MEDIA_ROOT / path
        if not file_path.exists():
            return senderror('Archivo no encontrado', status=404)
            
        return FileResponse(open(file_path, 'rb'), content_type='application/pdf')
    except SedeRuc.DoesNotExist:
        return senderror('RUC no vinculado', status=404)

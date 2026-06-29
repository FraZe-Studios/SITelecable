from django.http import FileResponse
from django.conf import settings
from core.models.models_generados import ComprobantesSunat
from core.auth.comun import checksession, senderror

def comprobante(request, ruc_id, comprobante_id):
    """GET /api/sede/rucs/<ruc_id>/comprobante/<id>/ver/ — Ver PDF/XML del comprobante."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
    
    fmt = request.GET.get('format', 'xml').lower()  # xml, zip, cdr
    try:
        comp = ComprobantesSunat.objects.get(pk=comprobante_id)
    except ComprobantesSunat.DoesNotExist:
        return senderror('Comprobante no encontrado', status=404)
        
    ruc_emisor = comp.ruc_emisor
    if not ruc_emisor:
        return senderror('Emisor no encontrado', status=404)
        
    tipo_comp_code = '01' if comp.tipo_comprobante == 'FACTURA' else '03' if comp.tipo_comprobante == 'BOLETA' else '07'
    from core.sunat import xml as sunat_logic
    filename = sunat_logic.sistema_generacion_nombre_archivo(
        ruc_emisor.ruc_numero, tipo_comp_code, comp.serie, comp.correlativo
    )
    
    if fmt == 'xml':
        file_path = settings.MEDIA_ROOT / 'sunat' / 'xml' / f"{filename}.xml"
        content_type = 'application/xml'
    elif fmt == 'zip':
        file_path = settings.MEDIA_ROOT / 'sunat' / 'zip' / f"{filename}.zip"
        content_type = 'application/zip'
    elif fmt == 'cdr':
        file_path = settings.MEDIA_ROOT / 'sunat' / 'cdr' / f"R-{filename}.zip"
        content_type = 'application/zip'
    else:
        return senderror('Formato no soportado', status=400)
        
    if not file_path.exists():
        return senderror(f'El archivo {fmt.upper()} no existe. Transmita el comprobante primero.', status=404)
        
    response = FileResponse(open(file_path, 'rb'), content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{file_path.name}"'
    return response

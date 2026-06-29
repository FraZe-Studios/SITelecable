import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sedes, RucsGlobales, SedeRuc
from core.auth.comun import checksession, senderror

@csrf_exempt
def ruc(request):
    """POST /api/sede/config/ruc/ — Vincula RUC a Sede y configura facturación/series SUNAT."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        sede_id = int(body['sede_id'])
        ruc_id = int(body['ruc_id'])
        
        sede = Sedes.objects.get(pk=sede_id)
        ruc_obj = RucsGlobales.objects.get(pk=ruc_id)
        
        sede_ruc, created = SedeRuc.objects.get_or_create(sede=sede, ruc=ruc_obj)
        sede_ruc.permite_boleta = bool(body.get('permite_boleta', True))
        sede_ruc.permite_factura = bool(body.get('permite_factura', True))
        sede_ruc.permite_nota_venta = bool(body.get('permite_nota_venta', True))
        sede_ruc.formato_impresion = body.get('formato_impresion', 'A4')
        sede_ruc.logo_url = body.get('logo_url', '') or None
        
        # Mapear e internalizar campos SUNAT de la tabla intermedia
        if 'prefijo_boleta' in body:
            sede_ruc.prefijo_boleta = str(body['prefijo_boleta']).strip().upper()
        if 'prefijo_factura' in body:
            sede_ruc.prefijo_factura = str(body['prefijo_factura']).strip().upper()
        if 'numero_actual_boleta' in body:
            sede_ruc.numero_actual_boleta = int(body['numero_actual_boleta'])
        if 'numero_actual_factura' in body:
            sede_ruc.numero_actual_factura = int(body['numero_actual_factura'])
            
        sede_ruc.save()
        return JsonResponse({'status': 'success', 'created': created})
        
    except Exception as e:
        return senderror(str(e), status=500)

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Sedes, Contratos
from core.auth.comun import checksession, senderror

@csrf_exempt
def contrato(request):
    """POST /api/sede/config/contrato/ — Crea o actualiza el contrato de adhesión de la sede."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)
        
    try:
        body = json.loads(request.body)
        sede = Sedes.objects.get(pk=int(body['sede_id']))
        contrato_obj, _ = Contratos.objects.get_or_create(sede=sede, defaults={'titulo': 'Contrato de Adhesión'})
        
        contrato_obj.titulo = body.get('titulo', contrato_obj.titulo)
        contrato_obj.introduccion = body.get('introduccion', contrato_obj.introduccion)
        contrato_obj.clausulas = body.get('clausulas', contrato_obj.clausulas)
        contrato_obj.pdf_template_path = body.get('pdf_template_path', contrato_obj.pdf_template_path)
        
        if body.get('velocidad_garantizada') is not None:
            contrato_obj.velocidad_garantizada = float(body['velocidad_garantizada'])
        if body.get('plazo_atencion_horas') is not None:
            contrato_obj.plazo_atencion_horas = int(body['plazo_atencion_horas'])
        if body.get('costo_reconexion') is not None:
            contrato_obj.costo_reconexion = float(body['costo_reconexion'])
        if body.get('ruc_facturacion_id'):
            contrato_obj.ruc_facturacion_id = int(body['ruc_facturacion_id'])
            
        contrato_obj.save()
        return JsonResponse({'status': 'success', 'contrato_id': contrato_obj.id})
        
    except Exception as e:
        return senderror(str(e), status=500)

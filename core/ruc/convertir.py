import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.sunat.comprobantes import sistema_convertir_nota_venta
from core.auth.comun import checksession, senderror

@csrf_exempt
def convertir(request, ruc_id, nota_venta_id):
    """POST /api/sede/rucs/<ruc_id>/nota-venta/<nvid>/convertir/ — Convierte nota de venta a comprobante electrónico."""
    if not checksession(request):
        return senderror('Sin sesión', status=401)
        
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        body = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    sede_id = body.get('sede_id') or request.GET.get('sede_id')
    tipo = body.get('tipo_comprobante') or body.get('tipo') or request.GET.get('tipo')
    if not sede_id:
        return senderror('sede_id requerido', status=400)

    try:
        data = sistema_convertir_nota_venta(
            nota_venta_id=nota_venta_id,
            ruc_emisor_id=int(ruc_id),
            sede_id=int(sede_id),
            tipo_comprobante=tipo,
        )
        return JsonResponse({'status': 'success', 'data': data})
    except ValueError as exc:
        return senderror(str(exc), status=400)
    except Exception as exc:
        return senderror(f'Error al convertir nota de venta: {exc}', status=500)

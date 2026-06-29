import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.abonados.facturacion import sistema_procesar_facturacion_mensual
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def procesarfacturacion(request):
    """POST /api/abonados/sistema-procesar-facturacion-mensual/"""
    fecha_ref = None
    if request.body:
        try:
            body = json.loads(request.body)
            fecha_ref = body.get('fecha')
        except json.JSONDecodeError:
            pass

    try:
        result = sistema_procesar_facturacion_mensual(fecha_ref=fecha_ref)
        return JsonResponse({
            'status': 'success',
            'data': result
        })
    except Exception as e:
        return senderror(str(e), status=500)

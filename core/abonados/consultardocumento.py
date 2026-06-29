from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from core.abonados.documentos import consultar_documento_registro

@csrf_exempt
@require_GET
def consultardocumento(request):
    """GET /api/abonados/consultar-documento/?numero=XXXXXXXX"""
    numero = (request.GET.get('numero') or '').strip()
    resultado = consultar_documento_registro(numero)
    if resultado.get('status') == 'error':
        return JsonResponse(resultado, status=400)
    return JsonResponse(resultado)

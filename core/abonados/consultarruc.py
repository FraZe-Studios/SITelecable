from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.abonados.ruc import consultar_ruc_con_cache
from core.auth.comun import senderror

@csrf_exempt
def consultarruc(request):
    """GET /api/empresa/consultar-ruc/?numero=XXXXXXXXXXX"""
    numero = request.GET.get('numero', '')
    if not numero or len(numero) != 11:
        return senderror('RUC inválido', status=400)
    
    resultado = consultar_ruc_con_cache(numero)
    if resultado:
        return JsonResponse({'status': 'success', 'data': resultado['data']})
    return senderror('Error al consultar RUC', status=500)

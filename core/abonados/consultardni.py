from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.abonados.dni import consultar_dni_con_cache
from core.auth.comun import senderror

@csrf_exempt
def consultardni(request):
    """GET /api/empresa/consultar-dni/?numero=XXXXXXXX"""
    numero = request.GET.get('numero', '')
    if not numero or len(numero) != 8:
        return senderror('DNI inválido', status=400)
    
    resultado = consultar_dni_con_cache(numero)
    if resultado:
        return JsonResponse({'status': 'success', 'data': resultado['data']})
    return senderror('Error al consultar DNI', status=500)

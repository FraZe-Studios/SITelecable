from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.abonados.dni import consultar_dni_con_cache
from core.abonados.ruc import consultar_ruc_con_cache
from core.auth.comun import senderror

@csrf_exempt
def buscardocumento(request):
    """GET /api/empresa/buscar-documento/?numero=XXXXXXX"""
    numero = request.GET.get('numero', '')
    if not numero:
        return senderror('Número de documento requerido', status=400)
    
    if len(numero) == 8:
        resultado = consultar_dni_con_cache(numero)
    elif len(numero) == 11:
        resultado = consultar_ruc_con_cache(numero)
    else:
        return senderror('Documento inválido', status=400)
        
    if resultado:
        return JsonResponse({'status': 'success', 'data': resultado['data']})
    return senderror('Error al buscar documento', status=500)

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.abonados.suministros import consultar_suministro_con_cache
from core.auth.comun import senderror

@csrf_exempt
def consultarsuministro(request):
    """
    Consultar suministro eléctrico con caché mediante delegación a la capa logic.
    GET /api/suministro/consultar-externo/?suministro=XXXXXXXX
    """
    suministro = request.GET.get('suministro', '')
    if not suministro:
        return senderror('Número de suministro requerido', status=400)
    
    resultado = consultar_suministro_con_cache(suministro)
    if resultado:
        return JsonResponse({
            'status': 'success',
            'data': resultado['data']
        })
    return senderror('No se pudo consultar el suministro', status=500)

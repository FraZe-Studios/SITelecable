from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.abonados.services.consumo_api import TelecableAPIClient
from core.auth.comun import senderror

@csrf_exempt
def buscartelecable(request):
    """
    Buscar abonado en API externa de Telecable.
    GET /api/net/buscar-abonado/?query=XXXX
    """
    query = request.GET.get('query', '')
    if not query:
        return senderror('Query requerido (código o número de documento)', status=400)
    
    client = TelecableAPIClient()
    data = client.buscar_abonado(query)
    
    return JsonResponse({
        'status': 'success',
        'data': data
    })

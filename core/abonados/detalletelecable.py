from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.abonados.services.consumo_api import TelecableAPIClient
from core.auth.comun import senderror

@csrf_exempt
def detalletelecable(request):
    """
    Obtener detalle de abonado en API externa de Telecable.
    GET /api/net/detalle-abonado/?codigo=XXXX
    """
    codigo = request.GET.get('codigo', '')
    if not codigo:
        return senderror('Código de abonado requerido', status=400)
    
    client = TelecableAPIClient()
    data = client.get_detalle(codigo)
    
    if data:
        return JsonResponse({
            'status': 'success',
            'data': data
        })
    return senderror('No se encontró el abonado', status=404)

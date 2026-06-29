import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.tickets.generacion import sistema_generar_ticket_manual
from core.auth.comun import senderror

@csrf_exempt
def generarmanual(request):
    """
    Generar un ticket manual solicitado por el cliente.
    POST /api/net/generar-ticket/
    """
    if request.method != 'POST':
        return senderror('Método no permitido. Use POST.', status=405)
    
    try:
        datos = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return senderror('JSON inválido en el cuerpo de la solicitud', status=400)
    
    try:
        resultado = sistema_generar_ticket_manual(datos)
        return JsonResponse({
            'status': 'success',
            'data': resultado
        })
    except ValueError as e:
        return senderror(str(e), status=400)
    except Exception as e:
        return senderror(f'Error al generar ticket: {str(e)}', status=500)

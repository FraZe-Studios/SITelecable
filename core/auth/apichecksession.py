from django.http import JsonResponse
from core.auth.sesion import sistema_verificar_sesion

def apichecksession(request):
    """
    Endpoint API de sondeo que permite a la interfaz verificar si la sesión del usuario
    sigue siendo la sesión activa (no ha sido anulada por otro inicio de sesión).
    """
    username = request.session.get('username')
    session_token = request.session.get('session_token')

    if not username or not session_token:
        username = request.GET.get('username')
        session_token = request.GET.get('token')

    is_valid = False
    if username and session_token:
        is_valid = sistema_verificar_sesion(username, session_token)

    return JsonResponse({'valid': is_valid})

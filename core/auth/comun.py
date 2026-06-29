import json
from django.http import JsonResponse
from core.auth.sesion import sistema_verificar_sesion
from core.models.usuarios import Usuario

def checksession(request) -> bool:
    """Verifica si la sesión actual del usuario es válida."""
    username = request.session.get('username')
    session_token = request.session.get('session_token')
    if username and session_token:
        return sistema_verificar_sesion(username, session_token)
    return False

def getloggeduser(request) -> Usuario:
    """Obtiene el objeto Usuario logueado en la sesión actual."""
    username = request.session.get('username')
    if username:
        try:
            return Usuario.objects.get(username=username)
        except Usuario.DoesNotExist:
            return None
    return None

def requireparams(body, keys) -> tuple[bool, str]:
    """
    Valida la existencia de una lista de llaves obligatorias en el diccionario body.
    Retorna (True, None) si es válido, o (False, mensaje_error) si falta alguna llave.
    """
    if not isinstance(body, dict):
        return False, "Payload JSON inválido"
    missing = [k for k in keys if k not in body]
    if missing:
        return False, f"Los siguientes campos son requeridos: {', '.join(missing)}"
    return True, None

def senderror(message: str, status: int = 400) -> JsonResponse:
    """Retorna una JsonResponse de error estandarizada."""
    return JsonResponse({'status': 'error', 'message': message, 'error': message}, status=status)

def sendsuccess(message: str, data: dict = None) -> JsonResponse:
    """Retorna una JsonResponse de éxito estandarizada."""
    response = {'status': 'success', 'message': message}
    if data is not None:
        response.update(data)
    return JsonResponse(response)

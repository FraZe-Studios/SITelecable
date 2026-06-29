import json
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import Usuario
from core.auth.comun import checksession, getloggeduser, senderror, sendsuccess

@csrf_exempt
def permiso(request):
    """
    API asíncrona para que un administrador edite los permisos de caja de un cajero.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    user = getloggeduser(request)
    if not user or user.rol != 'tac':
        return senderror('No tiene permisos de administrador', status=403)

    try:
        data = json.loads(request.body)
        target_user_id = data.get('usuario_id')
        permiso_tipo = data.get('permiso_tipo')  # efectivo o transferencia
        valor = data.get('valor')  # boolean
    except Exception:
        return senderror('JSON inválido', status=400)

    if target_user_id is None or not permiso_tipo or valor is None:
        return senderror('Todos los campos requeridos', status=400)

    try:
        target_user = Usuario.objects.get(pk=int(target_user_id))
    except (Usuario.DoesNotExist, ValueError):
        return senderror('Cajero no encontrado', status=404)

    if permiso_tipo == 'efectivo':
        target_user.permiso_efectivo = bool(valor)
    elif permiso_tipo == 'transferencia':
        target_user.permiso_transferencia = bool(valor)
    else:
        return senderror('Tipo de permiso inválido', status=400)

    target_user.save()

    estado_txt = "habilitado" if valor else "deshabilitado"
    return sendsuccess(f'Permiso de {permiso_tipo} {estado_txt} para el usuario "{target_user.username}"')

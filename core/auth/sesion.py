import uuid
import bcrypt as _bcrypt
from django.core.cache import cache
from core.models.models_generados import Usuario


def _verificar_password(user, password):
    """
    Verifica la contraseña del usuario.

    Soporta:
    - Hashes bcrypt nativos ($2a$, $2b$, $2y$) generados externamente o por SQL.
    - Hashes Django PBKDF2/argon2 (para usuarios creados/migrados desde Django).

    pgcrypto's crypt() NO puede verificar hashes bcrypt externos; se usa Python
    bcrypt directamente.
    """
    db_hash = user.password  # mapeado a password_hash en la DB
    if not db_hash:
        return False

    # Hashes bcrypt externos ($2a$, $2b$, $2y$)
    if db_hash.startswith(('$2a$', '$2b$', '$2y$')):
        try:
            return _bcrypt.checkpw(password.encode('utf-8'), db_hash.encode('utf-8'))
        except Exception:
            return False

    # Hashes Django (PBKDF2, argon2, etc.) — fallback para cuentas migradas
    return user.check_password(password)


def sistema_autenticar_usuario(username, password):
    """
    Valida las credenciales de un usuario y genera un nuevo token de sesión único,
    invalidando cualquier sesión abierta previa para ese usuario.
    """
    try:
        user = Usuario.objects.get(username=username)
    except Usuario.DoesNotExist:
        return False, "Usuario o contraseña incorrectos", None

    if not user.activo:
        return False, "El usuario está desactivado", None

    try:
        if not _verificar_password(user, password):
            return False, "Usuario o contraseña incorrectos", None
    except Exception:
        return False, "Error de verificación de contraseña", None

    # Generar nuevo token de sesión único y almacenarlo en cache
    session_token = uuid.uuid4().hex
    cache.set(f'active_session_{username}', session_token, timeout=3600)

    return True, session_token, user


def sistema_verificar_sesion(username, token):
    """
    Verifica si el token proporcionado coincide con el token activo en cache,
    garantizando que solo exista una sesión abierta a la vez en la SPA.
    """
    if not username or not token:
        return False

    active_token = cache.get(f'active_session_{username}')
    return active_token == token
import json
from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.models.usuarios import Usuario
from core.auth.comun import senderror, sendsuccess

@csrf_exempt
def verificar(request):
    """
    POST /api/movil/verificar-codigo/
    Protegido con la sesión del celular. Recibe: { username, codigo_ingresado, pc_a_eliminar }.
    Valida el código en el JSONB de PostgreSQL y realiza una actualización atómica.
    """
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    current_username = request.session.get('username')
    if not current_username:
        return senderror('Sesión no iniciada o no autorizada', status=401)

    try:
        data = json.loads(request.body)
    except Exception:
        return senderror('JSON inválido', status=400)

    username = data.get('username')
    codigo_ingresado = data.get('codigo_ingresado')
    pc_a_eliminar = data.get('pc_a_eliminar')

    if not username or not codigo_ingresado:
        return senderror('username y codigo_ingresado son requeridos', status=400)

    if username != current_username:
        return senderror('No autorizado para verificar esta cuenta', status=403)

    try:
        user = Usuario.objects.get(username=username)
    except Usuario.DoesNotExist:
        return senderror('Usuario no encontrado', status=404)

    data_seg = user.dispositivos_y_seguridad
    if not data_seg or not isinstance(data_seg, dict) or 'codigo_verificacion' not in data_seg:
        return senderror('No hay un proceso de verificación activo', status=400)

    codigo_info = data_seg.get('codigo_verificacion', {})
    codigo_guardado = codigo_info.get('codigo')

    if not codigo_guardado or str(codigo_guardado) != str(codigo_ingresado):
        return senderror('Código de verificación incorrecto', status=400)

    expira_str = codigo_info.get('expira_en')
    if expira_str:
        from datetime import datetime
        from django.utils import timezone
        try:
            exp_dt = datetime.fromisoformat(expira_str)
            if timezone.now() > exp_dt:
                return senderror('El código ha expirado', status=400)
        except Exception:
            pass

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE usuarios
                    SET dispositivos_y_seguridad = jsonb_build_object(
                        'pcs_confianza', COALESCE(
                            (
                                SELECT jsonb_agg(val)
                                FROM (
                                    SELECT DISTINCT val
                                    FROM (
                                        SELECT jsonb_array_elements_text(COALESCE(dispositivos_y_seguridad->'pcs_confianza', '[]'::jsonb)) AS val
                                        UNION ALL
                                        SELECT COALESCE(dispositivos_y_seguridad->'codigo_verificacion'->>'pc_pendiente_hash', '') AS val
                                    ) sub
                                    WHERE val IS NOT NULL AND val != %s AND val != ''
                                ) sub2
                            ),
                            '[]'::jsonb
                        ),
                        'codigo_verificacion', '{"codigo": null, "expira_en": null, "pc_pendiente_hash": null}'::jsonb
                    )
                    WHERE username = %s;
                """, [pc_a_eliminar, username])
    except Exception as e:
        return senderror(f'Fallo al actualizar el dispositivo atómicamente: {str(e)}', status=500)

    return sendsuccess('Dispositivo autorizado con éxito')

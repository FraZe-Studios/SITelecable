import json
import hashlib
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core.auth.sesion import sistema_autenticar_usuario
from core.auth.comun import senderror, sendsuccess

@csrf_exempt
def apilogin(request):
    """
    Endpoint API asíncrono para autenticación de usuario.
    Retorna JSON con el estado de la operación y el token de sesión asignado.
    Integra mecanismo adaptativo de Hardware Fingerprinting (WebGL) de máximo 2 PCs de confianza.
    """
    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
    except Exception:
        return senderror('JSON inválido', status=400)

    if not username or not password:
        return senderror('Usuario y contraseña son requeridos', status=400)

    fingerprint = (
        data.get('deviceFingerprint')
        or request.headers.get('Device-Fingerprint')
        or request.META.get('HTTP_DEVICE_FINGERPRINT')
    )
    if not fingerprint:
        user_agent = request.META.get('HTTP_USER_AGENT', 'unknown_agent')
        ip = request.META.get('REMOTE_ADDR', 'unknown_ip')
        fingerprint = hashlib.sha256(f"fallback_{ip}_{user_agent}".encode('utf-8')).hexdigest()

    success, session_token, user = sistema_autenticar_usuario(username, password)
    if success:
        data_seg = user.dispositivos_y_seguridad
        if not data_seg or not isinstance(data_seg, dict) or 'pcs_confianza' not in data_seg:
            data_seg = {
                "pcs_confianza": [],
                "codigo_verificacion": {
                    "codigo": None,
                    "expira_en": None,
                    "pc_pendiente_hash": None
                }
            }

        pcs_confianza = data_seg.setdefault('pcs_confianza', [])
        codigo_verificacion = data_seg.setdefault('codigo_verificacion', {
            "codigo": None,
            "expira_en": None,
            "pc_pendiente_hash": None
        })

        if fingerprint in pcs_confianza:
            pass
        elif len(pcs_confianza) < 2:
            pcs_confianza.append(fingerprint)
            data_seg['pcs_confianza'] = pcs_confianza
            user.dispositivos_y_seguridad = data_seg
            user.save(update_fields=['dispositivos_y_seguridad'])
        else:
            import random
            from django.utils import timezone
            from datetime import timedelta

            otp = f"{random.randint(1000, 9999)}"
            expira = (timezone.now() + timedelta(minutes=3)).isoformat()

            codigo_verificacion["codigo"] = otp
            codigo_verificacion["expira_en"] = expira
            codigo_verificacion["pc_pendiente_hash"] = fingerprint

            data_seg["codigo_verificacion"] = codigo_verificacion
            user.dispositivos_y_seguridad = data_seg
            user.save(update_fields=['dispositivos_y_seguridad'])

            return JsonResponse({
                "status": "REQUERID_VERIFICACION_MOVIL",
                "mensaje": f"Límite de equipos alcanzado. Confirme el acceso ingresando el código {otp} en su aplicativo móvil.",
                "message": f"Límite de equipos alcanzado. Confirme el acceso ingresando el código {otp} en su aplicativo móvil.",
                "codigo": otp
            }, status=200)

        request.session['username'] = username
        request.session['session_token'] = session_token
        request.session['device_fingerprint'] = fingerprint
        request.session['nombre_completo'] = user.nombre_completo or "Usuario"
        request.session['rol'] = user.rol or "Personal"
        
        # Obtener nombre de la sede (cuenta)
        nombre_cuenta = "SIT Telecable"
        if user.sede_id:
            from core.models.infraestructura import Sedes
            try:
                sede = Sedes.objects.get(id=user.sede_id)
                nombre_cuenta = sede.nombre
            except Sedes.DoesNotExist:
                pass
        request.session['nombre_cuenta'] = nombre_cuenta

        nombre = user.nombre_completo or "Usuario"
        cargo = user.rol or "Personal"

        return sendsuccess('Autenticación exitosa', {
            'token': session_token,
            'username': username,
            'nombre': nombre,
            'cargo': cargo
        })
    else:
        return senderror(session_token, status=401)

from django.shortcuts import redirect
from django.urls import reverse, NoReverseMatch
from core.auth.sesion import sistema_verificar_sesion

class SingleSessionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Define paths that don't require session check
        exempt_paths = []
        try:
            exempt_paths.append(reverse('login'))
        except NoReverseMatch:
            exempt_paths.append('/login/')
            
        try:
            exempt_paths.append(reverse('api_login'))
        except NoReverseMatch:
            exempt_paths.append('/api/login/')

        try:
            exempt_paths.append(reverse('api_check_session'))
        except NoReverseMatch:
            exempt_paths.append('/api/check-session/')

        exempt_prefixes = [
            '/static/',
            '/admin/',
        ]

        path = request.path
        if path in exempt_paths or any(path.startswith(prefix) for prefix in exempt_prefixes):
            return self.get_response(request)

        username = request.session.get('username')
        session_token = request.session.get('session_token')

        if username and session_token:
            if not sistema_verificar_sesion(username, session_token):
                # Token doesn't match active token in DB - invalidate session
                request.session.flush()
                return redirect('/login/?reason=duplicate')
        else:
            # User not logged in, redirect to login
            return redirect('/login/')

        return self.get_response(request)


class PostgreSQLAuditoriaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        username = request.session.get('username')
        if username:
            user_id = request.session.get('user_id')
            if not user_id:
                from core.models import Usuario
                try:
                    user = Usuario.objects.get(username=username)
                    user_id = user.id
                    request.session['user_id'] = user_id
                except Exception:
                    pass

            if user_id:
                from django.db import connection
                with connection.cursor() as cur:
                    try:
                        cur.execute("SELECT set_auditoria_usuario(%s);", [user_id])
                    except Exception:
                        pass

        return self.get_response(request)


from django.http import JsonResponse
from core.models.usuarios import Usuario

class WebGLSessionFingerprintMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        exempt_paths = [
            '/login/', 
            '/api/login/', 
            '/api/check-session/', 
            '/logout/', 
            '/api/movil/verificar-codigo/'
        ]
        exempt_prefixes = ['/static/', '/admin/']

        path = request.path
        if path in exempt_paths or any(path.startswith(prefix) for prefix in exempt_prefixes):
            return self.get_response(request)

        username = request.session.get('username')
        if username:
            # Retrieve the fingerprint from headers or metadata
            fingerprint = request.headers.get('Device-Fingerprint') or request.META.get('HTTP_DEVICE_FINGERPRINT') or request.META.get('Device-Fingerprint')
            
            # Fallback to session stored fingerprint if not in headers (e.g. for standard page GETs)
            if not fingerprint:
                fingerprint = request.session.get('device_fingerprint')

            if not fingerprint:
                import hashlib
                user_agent = request.META.get('HTTP_USER_AGENT', 'unknown_agent')
                ip = request.META.get('REMOTE_ADDR', 'unknown_ip')
                fingerprint = hashlib.sha256(f"fallback_{ip}_{user_agent}".encode('utf-8')).hexdigest()

            try:
                user = Usuario.objects.get(username=username)
            except Usuario.DoesNotExist:
                return self.get_response(request)

            data_seg = user.dispositivos_y_seguridad
            if not data_seg or not isinstance(data_seg, dict):
                return JsonResponse({'status': 'error', 'message': 'Falta configuración de seguridad de dispositivos'}, status=403)

            pcs_confianza = data_seg.get('pcs_confianza', [])
            if fingerprint not in pcs_confianza:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Dispositivo no autorizado. Secuestro de sesión prevenido.'
                }, status=403)

        return self.get_response(request)


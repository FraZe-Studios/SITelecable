import bcrypt
import secrets
from django.core.cache import cache
from core.models.usuarios import Usuario

class CustomAuthBackend:
    """
    Custom authentication backend that works directly with the Usuario model.
    Supports raw bcrypt hashes (which typically start with $2a$, $2b$, $2y$).
    Manages user sessions with tokens for single-session-per-user enforcement.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            return None
            
        try:
            user = Usuario.objects.get(username=username, activo=True)
        except Usuario.DoesNotExist:
            return None

        # Try raw bcrypt verification if the password in DB starts with $2
        db_password = user.password  # Mapped to 'password_hash' column
        if db_password and (db_password.startswith('$2b$') or db_password.startswith('$2a$') or db_password.startswith('$2y$')):
            try:
                # bcrypt.checkpw expects bytes for both arguments
                if bcrypt.checkpw(password.encode('utf-8'), db_password.encode('utf-8')):
                    return self._create_user_session(user, request)
            except Exception:
                pass

        return None

    def get_user(self, user_id):
        try:
            return Usuario.objects.get(pk=user_id, activo=True)
        except Usuario.DoesNotExist:
            return None

    def _create_user_session(self, user, request):
        """Create a user session and store active session token in cache"""
        try:
            # Generate a secure random token
            token = secrets.token_urlsafe(32)
            
            # Store in Django's cache for single-session enforcement
            cache.set(f'active_session_{user.username}', token, timeout=3600)
            
            # Store token in session for later validation
            if request:
                if not hasattr(request, 'session'):
                    # Create simple dict-based session if Django session middleware is not available
                    request.session = {}
                request.session['auth_token'] = token
                request.session['user_id'] = user.id
                request.session['username'] = user.username
                request.session['session_token'] = token
            
            return user
        except Exception as e:
            # If session creation fails, still return user (fallback)
            print(f'[CustomAuthBackend] Error creating user session: {e}')
            return user

    def _get_client_ip(self, request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

from django.shortcuts import redirect

def logout(request):
    """Cierra la sesión actual y borra todos los datos del cliente."""
    request.session.flush()
    return redirect('/login/')

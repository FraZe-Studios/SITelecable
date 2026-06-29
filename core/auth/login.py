from django.shortcuts import render, redirect
from core.auth.comun import checksession

def login(request):
    """
    Renderiza la interfaz premium de inicio de sesión.
    Si ya hay una sesión activa válida, redirecciona al dashboard.
    """
    if checksession(request):
        return redirect('/dashboard/')

    reason = request.GET.get('reason')
    context = {'reason': reason}
    return render(request, 'auth/login.html', context)

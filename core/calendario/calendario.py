from django.shortcuts import render, redirect
from core.auth.comun import checksession

def calendario(request):
    """
    Renderiza el Dashboard Premium de Calendario.
    """
    if not checksession(request):
        return redirect('/login/')
    return render(request, 'calendario/calendario.html')

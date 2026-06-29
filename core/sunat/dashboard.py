from django.shortcuts import render, redirect
from core.auth.comun import checksession

def dashboard(request):
    """
    Renderiza el Dashboard Premium de SUNAT.
    """
    if not checksession(request):
        return redirect('/login/')
    return render(request, 'sunat/sunat.html')

from django.shortcuts import render, redirect
from core.auth.comun import checksession

def caja(request):
    """
    Renderiza el Dashboard Premium de Caja Diaria.
    """
    if not checksession(request):
        return redirect('/login/')
    return render(request, 'caja/caja.html')

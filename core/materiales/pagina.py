from django.shortcuts import render
from django.contrib.auth.decorators import login_required

@login_required
def pagina(request):
    """
    Página de gestión de materiales y equipos
    GET /materiales/
    """
    return render(request, 'materiales/materiales.html')

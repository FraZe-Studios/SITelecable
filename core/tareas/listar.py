import json
from django.shortcuts import render, redirect
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.auth.comun import checksession

def listar(request):
    """Renderiza la vista principal del módulo de Tareas ATC."""
    username = request.session.get('username')
    if not username:
        return redirect('/login/')

    ctx_vendedor = sistema_obtener_contexto_vendedor(username)
    es_admin = ctx_vendedor.get('es_admin', False)
    es_atc = ctx_vendedor.get('rol') == 'atc'

    context = {
        'username': username,
        'nombre_usuario': request.session.get('nombre', 'Usuario'),
        'ctx_vendedor_json': json.dumps(ctx_vendedor),
        'es_admin': es_admin,
        'es_atc': es_atc,
    }
    return render(request, 'tareas/tareas.html', context)

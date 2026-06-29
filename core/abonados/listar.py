import json
from django.shortcuts import render, redirect
from core.models.models_generados import Sedes
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.lista import sistema_listar_abonados, sistema_buscar_cliente_local
from core.abonados.dni import consultar_dni_con_cache
from core.abonados.ruc import consultar_ruc_con_cache
from core.auth.comun import checksession

def listar(request):
    """Renderiza la vista principal del módulo de Abonados."""
    username = request.session.get('username')
    if not username:
        return redirect('/login/')

    ctx_vendedor = sistema_obtener_contexto_vendedor(username)
    sedes_list = Sedes.objects.filter(activo=True).order_by('nombre')

    try:
        from core.tickets.automation import verificar_plazos_cortes_temporales
        verificar_plazos_cortes_temporales()
    except Exception:
        pass

    resultado = sistema_listar_abonados({
        'q': request.GET.get('q', ''),
        'estado': request.GET.get('estado', ''),
        'sede': request.GET.get('sede', ''),
        'paginate_by': request.GET.get('paginate_by', '50'),
        'page': request.GET.get('page', '1'),
    })

    api_result = None
    q = (request.GET.get('q') or '').strip()
    if q and q.isdigit() and len(q) in (8, 11) and not sistema_buscar_cliente_local(q):
        if len(q) == 8:
            ext = consultar_dni_con_cache(q)
            if ext:
                data = ext['data']
                api_result = {
                    'documento': q,
                    'nombre': data.get('nombre_completo', ''),
                    'direccion': '',
                    'source': data.get('source', 'API'),
                }
        else:
            ext = consultar_ruc_con_cache(q)
            if ext:
                data = ext['data']
                api_result = {
                    'documento': q,
                    'nombre': data.get('razon_social', ''),
                    'direccion': data.get('direccion_fiscal', ''),
                    'source': data.get('source', 'API'),
                }

    context = {
        'username': username,
        'nombre_usuario': request.session.get('nombre', 'Usuario'),
        'sedes_list': sedes_list,
        'clientes': resultado['clientes'],
        'page_obj': resultado['page_obj'],
        'paginator': resultado['paginator'],
        'api_result': api_result,
        'ctx_vendedor_json': json.dumps(ctx_vendedor),
    }
    return render(request, 'cliente/abonados.html', context)

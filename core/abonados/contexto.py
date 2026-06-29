from django.http import JsonResponse
from django.views.decorators.http import require_GET
from core.abonados.contextovendedor import (
    sistema_obtener_contexto_vendedor,
    sistema_planes_por_sede,
    sistema_sedes_disponibles,
    sistema_vendedores_por_sede,
)
from core.abonados.evaluacion import sistema_rucs_emision_sede
from core.auth.comun import checksession, senderror

@require_GET
def contexto(request):
    """GET /api/abonados/contexto/"""
    username = request.session.get('username')
    if not username:
        return senderror('Sin sesión', status=401)

    ctx = sistema_obtener_contexto_vendedor(username)
    sede_id = request.GET.get('sede_id') or ctx.get('sede_id')
    data = {
        'vendedor': ctx,
        'sedes': sistema_sedes_disponibles(ctx['es_admin'], ctx.get('sede_id')),
        'planes': sistema_planes_por_sede(sede_id) if sede_id else [],
        'vendedores': sistema_vendedores_por_sede(sede_id) if sede_id else [],
        'rucs_emision': sistema_rucs_emision_sede(sede_id) if sede_id else [],
        'estados_civiles': [
            {'value': 'SOLTERO', 'label': 'Soltero/a'},
            {'value': 'CASADO', 'label': 'Casado/a'},
            {'value': 'VIUDO', 'label': 'Viudo/a'},
            {'value': 'DIVORCIADO', 'label': 'Divorciado/a'},
        ],
        'operadores': ['MOVISTAR', 'CLARO', 'ENTEL', 'BITEL', 'OTRO'],
    }
    return JsonResponse({'status': 'success', 'data': data})

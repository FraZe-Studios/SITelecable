from django.http import JsonResponse
from django.views.decorators.http import require_GET
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.caja.turnos import sistema_estado_turno_vendedor
from core.abonados.permisos import puede_registrar_pago
from core.auth.comun import senderror

@require_GET
def turnocaja(request):
    """GET /api/abonados/turno-caja/ — Consulta el estado del turno de caja del cajero logueado."""
    username = request.session.get('username')
    if not username:
        return senderror('Sin sesión activa', status=401)
        
    ctx = sistema_obtener_contexto_vendedor(username)
    if not ctx.get('personal_id'):
        return senderror('Sin sesión de personal', status=401)
        
    estado = sistema_estado_turno_vendedor(ctx['personal_id'], ctx.get('sede_id'))
    estado['puede_cobrar'] = puede_registrar_pago(ctx.get('cargo'))
    
    return JsonResponse({'status': 'success', 'data': estado})

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.caja.turnos import sistema_abrir_turno
from core.abonados.permisos import puede_registrar_pago
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def abrirturnocaja(request):
    """POST /api/abonados/turno-caja/abrir/ — Abre el turno de caja para el cajero."""
    username = request.session.get('username')
    if not username:
        return senderror('Sin sesión activa', status=401)
        
    ctx = sistema_obtener_contexto_vendedor(username)
    if not ctx.get('personal_id') or not ctx.get('sede_id'):
        return senderror('Vendedor sin sede asignada', status=400)
        
    if not puede_registrar_pago(ctx.get('cargo')):
        return senderror('Sin permiso para abrir caja', status=403)
        
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        body = {}
        
    turno = sistema_abrir_turno(
        ctx['personal_id'],
        ctx['sede_id'],
        body.get('monto_apertura', 0),
    )
    return JsonResponse({
        'status': 'success',
        'data': {'turno_id': turno.id, 'mensaje': 'Turno de caja abierto'},
    })

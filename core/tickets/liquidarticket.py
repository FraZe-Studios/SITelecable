import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.permisos import puede_liquidar_ticket
from core.tickets.liquidacion import sistema_liquidar_ticket
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def liquidarticket(request):
    """POST /api/abonados/liquidar-ticket/"""
    username = request.session.get('username', '')
    ctx = sistema_obtener_contexto_vendedor(username)
    if not puede_liquidar_ticket(ctx.get('cargo')):
        return senderror('Sin permiso para liquidar tickets (solo TAC/NOC/ADMIN)', status=403)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    body['personal_id'] = ctx.get('personal_id')
    try:
        resultado = sistema_liquidar_ticket(body)
    except ValueError as exc:
        return senderror(str(exc), status=400)
    except Exception as exc:
        import traceback
        return JsonResponse({
            'status': 'error',
            'message': str(exc),
            'traceback': traceback.format_exc()
        }, status=500)

    return JsonResponse({'status': 'success', 'data': resultado})

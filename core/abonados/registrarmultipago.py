import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.caja.turnos import sistema_abrir_turno, sistema_estado_turno_vendedor
from core.abonados.pagos import sistema_registrar_multipago_cliente
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def registrarmultipago(request):
    """POST /api/abonados/registrar-multipago/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    username = request.session.get('username', '')
    ctx_vendedor = sistema_obtener_contexto_vendedor(username)
    personal_id = ctx_vendedor.get('personal_id')
    sede_id = ctx_vendedor.get('sede_id')

    if not personal_id or not sede_id:
        return senderror('No se pudo obtener el contexto del personal o sede', status=403)

    turno_estado = sistema_estado_turno_vendedor(personal_id, sede_id)
    if not turno_estado or not turno_estado.get('abierto'):
        try:
            sistema_abrir_turno(personal_id, sede_id, 0.0)
        except Exception as e:
            return senderror(f'Caja cerrada. Intento de auto-apertura falló: {str(e)}', status=400)

    body['personal_id'] = personal_id
    body['sede_id'] = sede_id

    try:
        result = sistema_registrar_multipago_cliente(body)
        return JsonResponse({
            'status': 'success',
            'data': result
        })
    except ValueError as e:
        return senderror(str(e), status=400)
    except Exception as e:
        return senderror(f'Error interno: {str(e)}', status=500)

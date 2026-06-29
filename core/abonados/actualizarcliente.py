import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models.models_generados import Abonados
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.permisos import puede_editar_cliente
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def actualizarcliente(request):
    """POST /api/abonados/actualizar-cliente/"""
    username = request.session.get('username', '')
    ctx = sistema_obtener_contexto_vendedor(username)
    if not puede_editar_cliente(ctx.get('cargo')):
        return senderror('Sin permiso para editar cliente', status=403)
        
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    cliente_id = body.get('cliente_id')
    if not cliente_id:
        return senderror('cliente_id requerido', status=400)

    campos_permitidos = {
        'celular_1', 'celular_2', 'correo', 'operador', 'estado_civil',
        'direccion_fiscal', 'nombre_apellidos', 'razon_social',
    }
    update = {k: body[k] for k in campos_permitidos if k in body}
    if not update:
        return senderror('Sin campos para actualizar', status=400)

    from core.abonados.geoutils import parse_cliente_id
    parsed_id = parse_cliente_id(cliente_id)

    if 'nombre_apellidos' in update:
        val = update.pop('nombre_apellidos')
        parts = val.strip().split(' ', 1)
        if len(parts) == 2:
            update['nombres'] = parts[0]
            update['apellido_paterno'] = parts[1]
        else:
            update['nombres'] = val

    Abonados.objects.filter(pk=parsed_id).update(**update)
    return JsonResponse({'status': 'success', 'data': {'cliente_id': cliente_id}})

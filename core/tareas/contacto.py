import json
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from core.models.models_generados import TareasLlamadas
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.auth.comun import checksession, senderror, sendsuccess

@csrf_exempt
@require_POST
def contacto(request):
    """Registra el resultado de la llamada por el operador ATC."""
    username = request.session.get('username')
    if not username:
        return senderror('No autorizado', status=401)

    ctx_vendedor = sistema_obtener_contexto_vendedor(username)
    personal_id = ctx_vendedor.get('personal_id')
    es_admin = ctx_vendedor.get('es_admin', False)
    rol = ctx_vendedor.get('rol', '')

    if not es_admin and rol != 'atc':
        return senderror('Solo los operadores ATC pueden registrar contactos.', status=403)

    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    tarea_id = body.get('tarea_id')
    nuevo_estado = body.get('estado_contacto')
    observaciones = body.get('observaciones', '').strip()

    if not tarea_id or not nuevo_estado:
        return senderror('tarea_id y estado_contacto son requeridos', status=400)

    try:
        tarea = TareasLlamadas.objects.get(pk=int(tarea_id))
    except (TareasLlamadas.DoesNotExist, ValueError):
        return senderror('Tarea no encontrada', status=404)

    if not es_admin and tarea.empleado_id != personal_id:
        return senderror('No tiene permisos para modificar esta tarea.', status=403)

    tarea.estado_contacto = nuevo_estado.lower().strip()
    tarea.observaciones = observaciones
    tarea.fecha_ejecucion = timezone.now()
    tarea.save(update_fields=['estado_contacto', 'observaciones', 'fecha_ejecucion'])

    return sendsuccess('Registro guardado correctamente.', {
        'data': {
            'tarea_id': tarea.id,
            'estado_contacto': tarea.estado_contacto.upper()
        }
    })

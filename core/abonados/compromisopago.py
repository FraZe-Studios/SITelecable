import json
from datetime import date
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models.models_generados import FacturacionPagos, ServiciosAbonados
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def compromisopago(request):
    """POST /api/abonados/compromiso-pago/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    deuda_id = body.get('deuda_id')
    fecha = body.get('fecha_compromiso')
    suscripcion_id = body.get('suscripcion_id')

    if deuda_id is None or not fecha:
        return senderror('deuda_id y fecha_compromiso requeridos', status=400)

    try:
        fecha_comp = date.fromisoformat(str(fecha)[:10])
    except ValueError:
        return senderror('Fecha inválida', status=400)

    servicio = None
    try:
        deuda_id_int = int(deuda_id)
        if deuda_id_int > 0:
            deuda = FacturacionPagos.objects.get(id=deuda_id_int)
            servicio = deuda.servicio
        elif suscripcion_id:
            servicio = ServiciosAbonados.objects.get(id=int(suscripcion_id))
    except (FacturacionPagos.DoesNotExist, ServiciosAbonados.DoesNotExist, ValueError, TypeError):
        return senderror('No se pudo determinar el servicio o deuda', status=404)

    if not servicio:
        return senderror('suscripcion_id es requerido para deuda general (ID 0)', status=400)

    if not isinstance(servicio.control_operativo_json, dict):
        servicio.control_operativo_json = {}
    if 'compromisos_pago' not in servicio.control_operativo_json:
        servicio.control_operativo_json['compromisos_pago'] = {}

    servicio.control_operativo_json['compromisos_pago'][str(deuda_id)] = str(fecha_comp)
    servicio.save(update_fields=['control_operativo_json'])

    return JsonResponse({'status': 'success', 'data': {'deuda_id': deuda_id, 'fecha_compromiso': str(fecha_comp)}})

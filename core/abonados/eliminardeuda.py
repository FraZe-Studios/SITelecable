import json
import re
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models.models_generados import FacturacionPagos
from core.auth.comun import senderror, sendsuccess

@csrf_exempt
@require_POST
def eliminardeuda(request):
    """POST /api/abonados/eliminar-deuda/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    deuda_id = body.get('deuda_id')
    if not deuda_id:
        return senderror('deuda_id requerido', status=400)

    try:
        deuda = FacturacionPagos.objects.get(id=int(deuda_id))
    except (FacturacionPagos.DoesNotExist, ValueError):
        return senderror('Deuda no encontrada', status=404)

    abonos = FacturacionPagos.objects.filter(
        servicio=deuda.servicio,
        tipo_transaccion='abono'
    )
    is_paid = False
    for ab in abonos:
        match = re.search(r'\[PAGO_CARGO_ID:\s*(\d+)\]', ab.descripcion or '')
        if match and int(match.group(1)) == deuda.id:
            is_paid = True
            break

    if is_paid:
        return senderror('No se puede eliminar una deuda que ya ha sido pagada', status=400)

    servicio = deuda.servicio
    monto_dec = deuda.monto

    if servicio.deuda_acumulada is None:
        servicio.deuda_acumulada = Decimal('0')
    servicio.deuda_acumulada = max(Decimal('0'), servicio.deuda_acumulada - monto_dec)
    
    deuda.delete()
    servicio.save(update_fields=['deuda_acumulada'])

    return sendsuccess('Deuda eliminada')

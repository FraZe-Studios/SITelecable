import json
import re
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models.models_generados import FacturacionPagos
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def editardeuda(request):
    """POST /api/abonados/editar-deuda/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    deuda_id = body.get('deuda_id')
    monto = body.get('monto')
    concepto = (body.get('concepto') or '').strip()

    if not all([deuda_id, monto, concepto]):
        return senderror('deuda_id, monto y concepto requeridos', status=400)

    try:
        monto_dec = Decimal(str(monto))
        if monto_dec <= 0:
            raise InvalidOperation
    except (InvalidOperation, TypeError):
        return senderror('Monto inválido', status=400)

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
        return senderror('No se puede editar una deuda que ya ha sido pagada', status=400)

    servicio = deuda.servicio
    old_monto = deuda.monto
    deuda.monto = monto_dec
    deuda.descripcion = concepto[:255]
    deuda.save(update_fields=['monto', 'descripcion'])

    if servicio.deuda_acumulada is None:
        servicio.deuda_acumulada = Decimal('0')
    servicio.deuda_acumulada = (servicio.deuda_acumulada - old_monto) + monto_dec
    servicio.save(update_fields=['deuda_acumulada'])

    return JsonResponse({
        'status': 'success',
        'data': {'deuda_id': deuda.id, 'monto': float(monto_dec), 'concepto': concepto}
    })

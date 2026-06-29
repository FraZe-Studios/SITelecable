import json
from decimal import Decimal, InvalidOperation
from datetime import date, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from core.models.models_generados import FacturacionPagos, ServiciosAbonados
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def generardeuda(request):
    """POST /api/abonados/generar-deuda/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    cliente_id = body.get('cliente_id')
    suministro_id = body.get('suministro_id')
    monto = body.get('monto')
    concepto = (body.get('concepto') or 'Cargo generado desde ficha').strip()

    if not all([cliente_id, suministro_id, monto]):
        return senderror('cliente_id, suministro_id y monto requeridos', status=400)

    try:
        monto_dec = Decimal(str(monto))
        if monto_dec <= 0:
            raise InvalidOperation
    except (InvalidOperation, TypeError):
        return senderror('Monto inválido', status=400)

    from core.abonados.geoutils import parse_cliente_id
    parsed_id = parse_cliente_id(cliente_id)

    servicio = ServiciosAbonados.objects.filter(
        cliente_id=parsed_id,
        numero_suministro=suministro_id
    ).first()

    if not servicio:
        return senderror(f'No se encontró suscripción para el suministro {suministro_id}', status=400)

    deuda = FacturacionPagos.objects.create(
        servicio=servicio,
        ruc_emisor_id=1,
        tipo_documento='nota_venta',
        tipo_transaccion='cargo',
        monto=monto_dec,
        descripcion=concepto[:255],
        fecha_transaccion=timezone.now(),
        fecha_vencimiento=date.today() + timedelta(days=30),
        fecha_creacion=timezone.now(),
    )
    if servicio.deuda_acumulada is None:
        servicio.deuda_acumulada = Decimal('0')
    servicio.deuda_acumulada += monto_dec
    servicio.estado_servicio = 'cortado'
    servicio.save(update_fields=['deuda_acumulada', 'estado_servicio'])

    return JsonResponse({
        'status': 'success',
        'data': {'deuda_id': deuda.id, 'monto': float(monto_dec)},
    })

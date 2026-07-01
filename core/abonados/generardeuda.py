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
    materiales = body.get('materiales')  # Lista opcional de materiales a cobrar

    if not all([cliente_id, suministro_id]):
        return senderror('cliente_id y suministro_id requeridos', status=400)

    # Si se envían materiales, calcular el monto desde ellos
    materiales_cobrados = []
    if materiales and isinstance(materiales, list):
        total_materiales = Decimal('0')
        for mat in materiales:
            if not isinstance(mat, dict):
                continue
            precio_u = Decimal(str(mat.get('precio_unitario') or 0))
            cantidad = Decimal(str(mat.get('cantidad') or 1))
            subtotal = precio_u * cantidad
            total_materiales += subtotal
            materiales_cobrados.append({
                'ticket_id': mat.get('ticket_id'),
                'descripcion': str(mat.get('descripcion') or '').strip(),
                'cantidad': float(cantidad),
                'precio_unitario': float(precio_u),
                'precio_total': float(subtotal),
            })
        if total_materiales > 0:
            monto = float(total_materiales)
            if not concepto or concepto == 'Cargo generado desde ficha':
                concepto = f'Cobro de materiales — {len(materiales_cobrados)} ítem(s)'

    if not monto:
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

    # Si se cobran materiales, verificar que no estén ya cobrados
    if materiales_cobrados:
        pagos_prev = FacturacionPagos.objects.filter(
            servicio=servicio,
            tipo_transaccion='cargo',
        ).exclude(metadata_transaccion_json={}).exclude(metadata_transaccion_json__isnull=True)

        cobrados_set = set()
        for pago in pagos_prev:
            meta = pago.metadata_transaccion_json
            if isinstance(meta, dict):
                for mc in meta.get('materiales_cobrados', []):
                    if mc.get('ticket_id') and mc.get('descripcion'):
                        cobrados_set.add((int(mc['ticket_id']), str(mc['descripcion']).strip()))

        for mc in materiales_cobrados:
            clave = (int(mc['ticket_id']), mc['descripcion'])
            if clave in cobrados_set:
                return senderror(
                    f"El material '{mc['descripcion']}' del ticket T{mc['ticket_id']} ya fue cobrado anteriormente",
                    status=400
                )

    # Construir metadata del cargo
    metadata = {}
    if materiales_cobrados:
        metadata['materiales_cobrados'] = materiales_cobrados

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
        metadata_transaccion_json=metadata if metadata else {},
    )
    if servicio.deuda_acumulada is None:
        servicio.deuda_acumulada = Decimal('0')
    servicio.deuda_acumulada += monto_dec
    servicio.estado_servicio = 'cortado'
    servicio.save(update_fields=['deuda_acumulada', 'estado_servicio'])

    return JsonResponse({
        'status': 'success',
        'data': {
            'deuda_id': deuda.id,
            'monto': float(monto_dec),
            'materiales_cobrados': len(materiales_cobrados),
        },
    })

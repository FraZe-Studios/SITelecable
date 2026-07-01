import json
import re
from decimal import Decimal, InvalidOperation
from datetime import date
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction
from django.utils import timezone
from core.models.models_generados import FacturacionPagos, ServiciosAbonados
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.auth.comun import senderror


def _decimal(value, default='0'):
    try:
        return Decimal(str(value or default))
    except (InvalidOperation, TypeError):
        return Decimal(default)


@csrf_exempt
@require_POST
def financiardeuda(request):
    """
    POST /api/abonados/financiar-deuda/
    Fracciona las deudas pendientes de un servicio en cuotas mensuales.
    Reinicia el estado del servicio a 'activo' y guarda el plan en
    control_operativo_json['plan_financiamiento'].

    Payload: { cliente_id, suministro_id, num_cuotas }
    """
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    username = request.session.get('username', '')
    ctx = sistema_obtener_contexto_vendedor(username)

    cliente_id = body.get('cliente_id')
    suministro_id = body.get('suministro_id')
    num_cuotas = int(body.get('num_cuotas') or 1)

    if not all([cliente_id, suministro_id]):
        return senderror('cliente_id y suministro_id son requeridos', status=400)

    if num_cuotas < 1:
        return senderror('El número de cuotas debe ser al menos 1', status=400)

    # Verificar habilidades del vendedor
    hab = ctx.get('habilidades') or {}
    hg = hab.get('habilidades_globales') or hab
    planes_mensuales = hg.get('planes_mensuales', {})
    cuotas_maximas = int(planes_mensuales.get('cuotas_maximas') or 0)

    if num_cuotas > 1 and cuotas_maximas == 0:
        return senderror('Sin habilidad para financiar deudas en cuotas', status=403)
    if num_cuotas > cuotas_maximas and not ctx.get('es_admin'):
        return senderror(
            f'El número de cuotas excede el máximo permitido ({cuotas_maximas})',
            status=403
        )

    from core.abonados.geoutils import parse_cliente_id
    parsed_id = parse_cliente_id(cliente_id)

    servicio = ServiciosAbonados.objects.filter(
        cliente_id=parsed_id,
        numero_suministro=suministro_id
    ).select_related('plan').first()

    if not servicio:
        return senderror(f'No se encontró suscripción para el suministro {suministro_id}', status=400)

    # Obtener todos los cargos pendientes
    cargos_pendientes = FacturacionPagos.objects.filter(
        servicio=servicio,
        tipo_transaccion='cargo',
    )

    # Filtrar solo los realmente no pagados (sin abono que los cubra)
    abonos_por_cargo = {}
    abonos = FacturacionPagos.objects.filter(servicio=servicio, tipo_transaccion='abono')
    for abono in abonos:
        m = re.search(r'\[PAGO_CARGO_ID:\s*(\d+)\]', abono.descripcion or '')
        if m:
            cid = int(m.group(1))
            abonos_por_cargo[cid] = abonos_por_cargo.get(cid, Decimal('0')) + (abono.monto or Decimal('0'))

    cargos_a_liquidar = [
        c for c in cargos_pendientes
        if (c.monto or Decimal('0')) > abonos_por_cargo.get(c.id, Decimal('0'))
    ]

    if not cargos_a_liquidar:
        return senderror('No hay deudas pendientes para financiar', status=400)

    deuda_total = sum(
        (c.monto or Decimal('0')) - abonos_por_cargo.get(c.id, Decimal('0'))
        for c in cargos_a_liquidar
    )

    if deuda_total <= 0:
        return senderror('El total de deuda pendiente es cero', status=400)

    monto_cuota = (deuda_total / Decimal(str(num_cuotas))).quantize(Decimal('0.01'))

    with transaction.atomic():
        # Marcar todos los cargos pendientes como cubiertos con abonos
        for cargo in cargos_a_liquidar:
            ya_pagado = abonos_por_cargo.get(cargo.id, Decimal('0'))
            pendiente = (cargo.monto or Decimal('0')) - ya_pagado
            if pendiente > 0:
                FacturacionPagos.objects.create(
                    servicio=servicio,
                    ruc_emisor_id=cargo.ruc_emisor_id or 1,
                    tipo_documento='nota_venta',
                    tipo_transaccion='abono',
                    monto=pendiente,
                    descripcion=f"Financiamiento de deuda D{cargo.id} — {num_cuotas} cuotas [PAGO_CARGO_ID: {cargo.id}]",
                    fecha_transaccion=timezone.now(),
                    fecha_creacion=timezone.now(),
                )

        # Guardar plan de financiamiento y reiniciar servicio
        if not isinstance(servicio.control_operativo_json, dict):
            servicio.control_operativo_json = {}

        servicio.control_operativo_json['plan_financiamiento'] = {
            'monto_total': float(deuda_total),
            'cuotas_totales': num_cuotas,
            'cuotas_restantes': num_cuotas,
            'monto_cuota': float(monto_cuota),
            'fecha_inicio': date.today().isoformat(),
            'registrado_por': ctx.get('personal_id'),
        }

        servicio.estado_servicio = 'activo'
        servicio.deuda_acumulada = Decimal('0')
        servicio.save(update_fields=['control_operativo_json', 'estado_servicio', 'deuda_acumulada'])

    return JsonResponse({
        'status': 'success',
        'data': {
            'num_cuotas': num_cuotas,
            'monto_total': float(deuda_total),
            'monto_cuota': float(monto_cuota),
            'cargos_liquidados': len(cargos_a_liquidar),
            'mensaje': f'Deuda de S/ {deuda_total:.2f} financiada en {num_cuotas} cuota(s) de S/ {monto_cuota:.2f}',
        }
    })

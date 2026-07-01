import json
from datetime import date
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction
from django.utils import timezone
from core.models.models_generados import ServiciosAbonados, FacturacionPagos
from core.auth.comun import senderror


@csrf_exempt
@require_POST
def gestionaranexo(request):
    """
    POST /api/abonados/gestionar-anexo/
    Agrega o quita un anexo al servicio del cliente.

    Reglas:
    - El primer anexo (o los N configurados en plan.anexos_gratis) es gratis.
    - A partir del siguiente, cada anexo suma precio_por_anexo al costo mensual.
    - Agregar/quitar solo actualiza numero_anexos en control_operativo_json
      y registra el historial. El costo nuevo se refleja en el próximo ciclo
      de facturación mensual (sistema_costo_mensual_real).
    - Si el cambio genera una diferencia de precio respecto al mes en curso,
      se puede crear un cargo de ajuste (opcional, controlado por `cargo_inmediato`).

    Payload:
    {
      "cliente_id": "...",
      "suministro_id": "...",
      "accion": "agregar" | "quitar",
      "motivo": "texto libre",
      "cargo_inmediato": false  (opcional, default false)
    }
    """
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    cliente_id = body.get('cliente_id')
    suministro_id = body.get('suministro_id')
    accion = (body.get('accion') or '').strip().lower()
    motivo = (body.get('motivo') or '').strip()
    cargo_inmediato = bool(body.get('cargo_inmediato', False))

    if not all([cliente_id, suministro_id, accion]):
        return senderror('cliente_id, suministro_id y accion son requeridos', status=400)

    if accion not in ('agregar', 'quitar'):
        return senderror("accion debe ser 'agregar' o 'quitar'", status=400)

    from core.abonados.geoutils import parse_cliente_id
    parsed_id = parse_cliente_id(cliente_id)

    servicio = ServiciosAbonados.objects.filter(
        cliente_id=parsed_id,
        numero_suministro=suministro_id,
    ).select_related('plan').first()

    if not servicio:
        return senderror(f'No se encontró suscripción para el suministro {suministro_id}', status=400)

    plan = getattr(servicio, 'plan', None)
    precio_por_anexo = Decimal(str(getattr(plan, 'precio_por_anexo', None) or 0)) if plan else Decimal('0')
    anexos_gratis = int(getattr(plan, 'anexos_gratis', None) or 1) if plan else 1

    if not isinstance(servicio.control_operativo_json, dict):
        servicio.control_operativo_json = {}

    num_actual = int(servicio.numero_anexos or 0)

    if accion == 'agregar':
        num_nuevo = num_actual + 1
    else:
        if num_actual <= 0:
            return senderror('El servicio no tiene anexos para quitar', status=400)
        num_nuevo = num_actual - 1

    # Calcular diferencia de costo cobrable
    cobrables_antes = max(0, num_actual - anexos_gratis)
    cobrables_despues = max(0, num_nuevo - anexos_gratis)
    diferencia_precio = (Decimal(str(cobrables_despues)) - Decimal(str(cobrables_antes))) * precio_por_anexo

    with transaction.atomic():
        # Actualizar numero_anexos en datos_tecnicos
        servicio.numero_anexos = num_nuevo

        # Registrar historial en control_operativo_json
        if 'historial_anexos' not in servicio.control_operativo_json:
            servicio.control_operativo_json['historial_anexos'] = []

        servicio.control_operativo_json['historial_anexos'].append({
            'fecha': date.today().isoformat(),
            'accion': accion,
            'numero_anterior': num_actual,
            'numero_nuevo': num_nuevo,
            'diferencia_precio': float(diferencia_precio),
            'motivo': motivo or f'{accion.capitalize()} de anexo',
        })

        # Cargo inmediato si se solicita y hay diferencia positiva
        cargo_creado = None
        if cargo_inmediato and diferencia_precio > 0:
            from datetime import timedelta
            cargo_creado = FacturacionPagos.objects.create(
                servicio=servicio,
                ruc_emisor_id=1,
                tipo_documento='nota_venta',
                tipo_transaccion='cargo',
                monto=diferencia_precio,
                descripcion=f'Ajuste por {accion} de anexo — {num_nuevo} anexo(s) en total',
                fecha_transaccion=timezone.now(),
                fecha_vencimiento=date.today() + timedelta(days=30),
                fecha_creacion=timezone.now(),
            )
            if servicio.deuda_acumulada is None:
                servicio.deuda_acumulada = Decimal('0')
            servicio.deuda_acumulada += diferencia_precio
            servicio.save(update_fields=['control_operativo_json', 'deuda_acumulada'])
        else:
            servicio.save(update_fields=['control_operativo_json'])

    # Retornar el desglose actualizado
    from core.abonados.facturacion import sistema_costo_mensual_real
    desglose = sistema_costo_mensual_real(servicio)

    return JsonResponse({
        'status': 'success',
        'data': {
            'accion': accion,
            'numero_anexos_anterior': num_actual,
            'numero_anexos_nuevo': num_nuevo,
            'diferencia_precio': float(diferencia_precio),
            'cargo_inmediato_creado': cargo_creado is not None,
            'costo_mensual_real': {
                'costo_base': float(desglose['costo_base']),
                'costo_anexos': float(desglose['costo_anexos']),
                'anexos_cobrables': desglose['anexos_cobrables'],
                'precio_por_anexo': float(desglose['precio_por_anexo']),
                'subtotal': float(desglose['subtotal_sin_descuento']),
                'pct_descuento': float(desglose['pct_descuento']),
                'descuento_monto': float(desglose['descuento_monto']),
                'costo_final': float(desglose['costo_final']),
                'periodo_descripcion': desglose['periodo_descripcion'],
            },
        }
    })

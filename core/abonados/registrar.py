import json
from decimal import Decimal
from datetime import date, timedelta
from calendar import monthrange
from core.abonados.evaluacion import _decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from core.models.models_generados import FacturacionPagos, ServiciosAbonados
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.documentos import es_mayor_de_edad
from core.abonados.evaluacion import sistema_evaluar_registro
from core.abonados.registro import sistema_registro_cliente
from core.abonados.pagos import sistema_registrar_pago_cliente
from core.auth.comun import senderror

_MESES_ES = [
    '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]


def _calcular_mes_fin(mes_inicio_date, meses_descuento):
    """Retorna la fecha del último día del mes de fin del período."""
    anio = mes_inicio_date.year
    mes = mes_inicio_date.month + meses_descuento - 1
    anio += (mes - 1) // 12
    mes = (mes - 1) % 12 + 1
    return f"{anio:04d}-{mes:02d}"


def _descripcion_periodo(mes_inicio_str, mes_fin_str):
    """Ej: '2026-07' → '2026-12' → 'Desde julio hasta diciembre 2026'."""
    try:
        yi, mi = int(mes_inicio_str[:4]), int(mes_inicio_str[5:7])
        yf, mf = int(mes_fin_str[:4]), int(mes_fin_str[5:7])
        inicio_txt = _MESES_ES[mi]
        fin_txt = f"{_MESES_ES[mf]} {yf}"
        return f"Desde {inicio_txt} hasta {fin_txt}"
    except Exception:
        return f"{mes_inicio_str} → {mes_fin_str}"

@csrf_exempt
@require_POST
def registrar(request):
    """POST /api/abonados/registrar/"""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return senderror('JSON inválido', status=400)

    username = request.session.get('username', '')
    ctx = sistema_obtener_contexto_vendedor(username)
    if not body.get('vendedor_id'):
        body['vendedor_id'] = ctx.get('personal_id')
    if not body.get('vendedor_id'):
        return senderror('Vendedor no identificado', status=400)

    if not ctx.get('es_admin') and ctx.get('sede_id'):
        sede_plan = body.get('sede_id') or ctx['sede_id']
        if str(sede_plan) != str(ctx['sede_id']):
            return senderror('No puede registrar en otra sede', status=403)

    hab = ctx.get('habilidades') or {}
    hg = hab.get('habilidades_globales') or hab
    tickets_cobro = hg.get('tickets_cobro', {})
    deudas_antiguas = hg.get('deudas_antiguas', {})
    planes_mensuales = hg.get('planes_mensuales', {})
    
    # Validar tickets de cobro (instalación)
    pct_instalacion = _decimal(body.get('pct_descuento_instalacion') or 0)
    pct_max_instalacion = _decimal(tickets_cobro.get('descuento_maximo_porcentaje') or 0)
    if pct_instalacion > 0 and pct_max_instalacion == 0:
        return senderror('Sin habilidad para aplicar descuento en instalación', status=403)
    if pct_instalacion > pct_max_instalacion:
        return senderror(f'Descuento excede máximo permitido ({pct_max_instalacion}%)', status=403)
    
    cuotas_instalacion = int(body.get('cuotas_instalacion') or 1)
    limite_cuotas_instalacion = int(tickets_cobro.get('cuotas_maximas') or 0)
    if cuotas_instalacion > 1 and limite_cuotas_instalacion == 0:
        return senderror('Sin habilidad para fraccionar instalación en cuotas', status=403)
    if cuotas_instalacion > limite_cuotas_instalacion:
        return senderror(f'Cuotas exceden máximo permitido ({limite_cuotas_instalacion})', status=403)
    
    # Validar deudas antiguas
    pct_deuda = _decimal(body.get('pct_descuento') or 0)
    pct_max_deuda = _decimal(deudas_antiguas.get('descuento_maximo_porcentaje') or 0)
    if pct_deuda > 0 and pct_max_deuda == 0:
        return senderror('Sin habilidad para aplicar descuento en deudas antiguas', status=403)
    if pct_deuda > pct_max_deuda:
        return senderror(f'Descuento excede máximo permitido ({pct_max_deuda}%)', status=403)
    
    cuotas_deuda = int(body.get('cuotas') or 1)
    limite_cuotas_deuda = int(deudas_antiguas.get('cuotas_maximas') or 0)
    if cuotas_deuda > 1 and limite_cuotas_deuda == 0:
        return senderror('Sin habilidad para fraccionar deudas en cuotas', status=403)
    if cuotas_deuda > limite_cuotas_deuda:
        return senderror(f'Cuotas exceden máximo permitido ({limite_cuotas_deuda})', status=403)
    
    # Validar descuento de deuda exacto
    descuento_deuda = _decimal(body.get('descuento_deuda') or 0)
    if descuento_deuda > 0:
        evaluacion_temp = sistema_evaluar_registro(body, ctx)
        deuda_total = _decimal(evaluacion_temp.get('deuda_a_pagar') or 0)
        if descuento_deuda > deuda_total:
            return senderror(f'Descuento de deuda excede monto total ({deuda_total})', status=400)
    
    # Validar descuento de plan mensual
    descuento_plan = _decimal(body.get('descuento_plan') or 0)
    pct_max_plan = _decimal(planes_mensuales.get('descuento_maximo_porcentaje') or 0)
    if descuento_plan > 0 and pct_max_plan == 0:
        return senderror('Sin habilidad para aplicar descuento en planes mensuales', status=403)
    if descuento_plan > pct_max_plan:
        return senderror(f'Descuento de plan excede máximo permitido ({pct_max_plan}%)', status=403)
    
    # Validar descuento de aplicativo mensual (mismas reglas que el plan)
    descuento_apps = _decimal(body.get('pct_descuento_apps') or 0)
    if descuento_apps > 0 and pct_max_plan == 0:
        return senderror('Sin habilidad para aplicar descuento en aplicativos', status=403)
    if descuento_apps > pct_max_plan:
        return senderror(f'Descuento de aplicativo excede máximo permitido ({pct_max_plan}%)', status=403)
    
    # Validar meses de descuento
    meses_descuento = int(body.get('meses_descuento') or 0)
    max_meses = int(planes_mensuales.get('meses_maximos') or 0)
    if meses_descuento > 0 and max_meses == 0:
        return senderror('Sin habilidad para otorgar meses de descuento', status=403)
    if meses_descuento > max_meses:
        return senderror(f'Meses de descuento exceden máximo permitido ({max_meses})', status=403)
    
    # Validar meses de descuento de aplicativos
    meses_descuento_apps = int(body.get('meses_descuento_apps') or 0)
    if meses_descuento_apps > 0 and max_meses == 0:
        return senderror('Sin habilidad para otorgar meses de descuento en aplicativos', status=403)
    if meses_descuento_apps > max_meses:
        return senderror(f'Meses de descuento de aplicativos exceden máximo permitido ({max_meses})', status=403)
    
    # Validar autorización de supervisor para descuentos altos
    requiere_autorizacion = planes_mensuales.get('requiere_autorizacion_supervisor', False)
    descuento_plan = _decimal(body.get('descuento_plan') or 0)
    if requiere_autorizacion and descuento_plan > 50:
        codigo_autorizacion = body.get('autorizacion_supervisor', '').strip()
        if not codigo_autorizacion:
            return senderror('Descuento superior al 50% requiere autorización de supervisor', status=403)
        # Aquí se podría validar el código contra una lista de códigos válidos
        # Por ahora, solo verificamos que no esté vacío
    
    # Validar cuotas de deuda
    cuotas_deuda = int(body.get('cuotas_deuda') or 1)
    if cuotas_deuda not in [1, 3, 6, 12]:
        return senderror('Las cuotas de deuda deben ser 1, 3, 6 o 12', status=400)

    cumpleanos = body.get('cumpleanos')
    if cumpleanos:
        mayor = es_mayor_de_edad(cumpleanos)
        if mayor is False:
            return senderror('El cliente debe ser mayor de edad para registrarse', status=400)

    if not body.get('ruc_emisor_id'):
        from core.models.models_generados import SedeRuc
        sede_id = body.get('sede_id') or ctx.get('sede_id')
        if sede_id:
            srs = SedeRuc.objects.filter(sede_id=sede_id)
            first_ruc_sede = next((sr for sr in srs if sr.activo), None)
            if not first_ruc_sede:
                first_ruc_sede = srs.first()
            if first_ruc_sede:
                body['ruc_emisor_id'] = first_ruc_sede.ruc_id

    evaluacion = body.get('evaluacion') or sistema_evaluar_registro(body, ctx)

    try:
        body['evaluacion'] = evaluacion
        resultado = sistema_registro_cliente(body)
        
        # Guardar oferta pendiente de aprobación en control_operativo_json
        if resultado.get('suscripcion_id'):
            from core.models.models_generados import ServiciosAbonados
            servicio = ServiciosAbonados.objects.get(codigo=resultado['suscripcion_id'])
            
            if not isinstance(servicio.control_operativo_json, dict):
                servicio.control_operativo_json = {}
            
            # Calcular período del descuento por meses calendario
            hoy = date.today()
            mes_inicio_str = hoy.strftime('%Y-%m')
            meses_desc = int(body.get('meses_descuento') or 0)
            mes_fin_str = _calcular_mes_fin(hoy, meses_desc) if meses_desc > 0 else mes_inicio_str
            
            # Guardar detalles de la oferta para aprobación
            servicio.control_operativo_json['oferta'] = {
                    'estado': 'pendiente_aprobacion',
                    'plan_id': body.get('plan_id'),
                    'plan_nombre': body.get('plan_nombre'),
                    'descuento_plan': float(body.get('descuento_plan') or body.get('pct_descuento_plan') or 0),
                    'meses_descuento': meses_desc,
                    'mes_inicio': mes_inicio_str,
                    'mes_fin': mes_fin_str,
                    'periodo_descripcion': _descripcion_periodo(mes_inicio_str, mes_fin_str) if meses_desc > 0 else '',
                    'descuento_apps': float(body.get('pct_descuento_apps') or 0),
                    'meses_descuento_apps': int(body.get('meses_descuento_apps') or 0),
                    'monto_instalacion': float(body.get('monto_instalacion') or 0),
                    'descuento_instalacion': float(body.get('pct_descuento_instalacion') or 0),
                    'cuotas_instalacion': int(body.get('cuotas_instalacion') or 1),
                    'notas_beneficios': (body.get('notas_beneficios') or '').strip(),
                    'vendedor_id': ctx.get('personal_id'),
                    'fecha_registro': timezone.now().isoformat()
                }
            servicio.save(update_fields=['control_operativo_json'])
            
    except ValueError as exc:
        return senderror(str(exc), status=400)
    except Exception as exc:
        return senderror(f'Error al registrar: {exc}', status=500)

    modo_pago_plan = body.get('modo_pago_plan', 'FIN_MES').upper()
    total_cobrar = float(evaluacion.get('total_cobrar_ahora') or 0)
    
    if modo_pago_plan == 'FIN_MES' and total_cobrar > 0 and body.get('ruc_emisor_id'):
        try:
            hoy = date.today()
            fin_de_mes = (hoy.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            servicio = ServiciosAbonados.objects.get(codigo=resultado['suscripcion_id'])
            
            deuda = FacturacionPagos.objects.create(
                servicio=servicio,
                ruc_emisor_id=int(body['ruc_emisor_id']),
                tipo_documento=(body.get('tipo_comprobante') or 'nota_venta').lower(),
                tipo_transaccion='cargo',
                monto=Decimal(str(total_cobrar)),
                descripcion=f'Cobro fin de mes - Registro nuevo abonado (Plan + Instalación)',
                fecha_vencimiento=fin_de_mes,
                fecha_transaccion=timezone.now(),
                fecha_creacion=timezone.now(),
            )
            
            servicio.deuda_acumulada = (servicio.deuda_acumulada or Decimal('0')) + Decimal(str(total_cobrar))
            servicio.save(update_fields=['deuda_acumulada'])
            
            from core.sunat.comprobantes import sistema_emitir_comprobante
            
            # Build detailed description for invoice
            items_descripcion_parts = ['Registro nuevo abonado']
            if evaluacion.get('plan_nombre'):
                items_descripcion_parts.append(f"Plan: {evaluacion['plan_nombre']}")
            if evaluacion.get('costo_apps_mensual', 0) > 0:
                items_descripcion_parts.append(f"Aplicaciones: {', '.join(evaluacion.get('apps_nombres', []))}")
            if evaluacion.get('costo_anexos', 0) > 0:
                items_descripcion_parts.append(f"Anexos adicionales: {evaluacion.get('num_anexos', 0)}")
            if evaluacion.get('costo_instalacion', 0) > 0:
                items_descripcion_parts.append("Instalación")
            
            items_descripcion = ' - '.join(items_descripcion_parts)
            
            comprobante = sistema_emitir_comprobante(
                cliente_id=resultado['cliente_id'],
                ruc_emisor_id=int(body['ruc_emisor_id']),
                sede_id=int(body.get('sede_id') or ctx.get('sede_id')),
                tipo_comprobante=body.get('tipo_comprobante') or evaluacion.get('tipo_comprobante_sugerido'),
                monto_total=total_cobrar,
                items_descripcion=items_descripcion,
            )
            
            resultado['deuda_generada'] = {
                'deuda_id': deuda.id,
                'monto': total_cobrar,
                'fecha_vencimiento': str(fin_de_mes),
            }
            resultado['comprobante_generado'] = comprobante
            resultado['pago_diferido'] = True
        except Exception as exc:
            resultado['pago_pendiente'] = True
            resultado['pago_error'] = str(exc)
            
    elif total_cobrar > 0 and body.get('ruc_emisor_id'):
        try:
            pago = sistema_registrar_pago_cliente({
                'personal_id': ctx.get('personal_id'),
                'sede_id': body.get('sede_id') or ctx.get('sede_id'),
                'cliente_id': resultado['cliente_id'],
                'suministro_id': body.get('suministro'),
                'monto': total_cobrar,
                'metodo_pago': body.get('metodo_pago', 'EFECTIVO'),
                'monto_efectivo': body.get('monto_efectivo'),
                'monto_digital': body.get('monto_digital'),
                'numero_operacion': body.get('numero_operacion'),
                'ruc_emisor_id': body.get('ruc_emisor_id'),
                'tipo_comprobante': body.get('tipo_comprobante') or evaluacion.get('tipo_comprobante_sugerido'),
                'concepto': 'Registro nuevo abonado',
                'abrir_turno_si_falta': True,
                'emitir_comprobante': body.get('emitir_comprobante', True),
            })
            resultado['pago_ejecutado'] = pago
        except Exception as exc:
            resultado['pago_pendiente'] = True
            resultado['pago_error'] = str(exc)

    return JsonResponse({'status': 'success', 'data': resultado})

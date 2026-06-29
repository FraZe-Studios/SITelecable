import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.abonados.permisos import puede_registrar_pago
from core.abonados.archivos import sistema_guardado_archivo_cliente
from core.abonados.pagos import sistema_registrar_pago_cliente
from core.auth.comun import senderror

@csrf_exempt
@require_POST
def registrarpago(request):
    """POST /api/abonados/registrar-pago/"""
    username = request.session.get('username', '')
    ctx = sistema_obtener_contexto_vendedor(username)
    if not puede_registrar_pago(ctx.get('cargo')):
        return senderror('Sin permiso para registrar pagos', status=403)

    content_type = request.content_type or ''
    if 'multipart/form-data' in content_type:
        datos = {
            'personal_id': ctx.get('personal_id'),
            'sede_id': ctx.get('sede_id'),
            'cliente_id': request.POST.get('cliente_id'),
            'suscripcion_id': request.POST.get('suscripcion_id'),
            'suministro_id': request.POST.get('suministro_id'),
            'deuda_id': request.POST.get('deuda_id') or None,
            'monto': request.POST.get('monto'),
            'metodo_pago': request.POST.get('metodo_pago'),
            'monto_efectivo': request.POST.get('monto_efectivo'),
            'monto_digital': request.POST.get('monto_digital'),
            'numero_operacion': request.POST.get('numero_operacion'),
            'ruc_emisor_id': request.POST.get('ruc_emisor_id'),
            'tipo_comprobante': request.POST.get('tipo_comprobante'),
            'concepto': request.POST.get('concepto'),
            'emitir_comprobante': request.POST.get('emitir_comprobante', 'true') != 'false',
        }
        evidencia = request.FILES.get('evidencia')
        if evidencia:
            try:
                guardado = sistema_guardado_archivo_cliente(
                    evidencia, datos['cliente_id'], 'pagos'
                )
                datos['evidencia_url'] = guardado['url']
            except ValueError as exc:
                return senderror(str(exc), status=400)
    else:
        try:
            datos = json.loads(request.body)
        except json.JSONDecodeError:
            return senderror('JSON inválido', status=400)
        datos['personal_id'] = ctx.get('personal_id')
        datos['sede_id'] = ctx.get('sede_id')

    if not datos.get('ruc_emisor_id'):
        from core.models.models_generados import SedeRuc
        sede_id = datos.get('sede_id') or ctx.get('sede_id')
        if sede_id:
            srs = SedeRuc.objects.filter(sede_id=sede_id)
            first_ruc_sede = next((sr for sr in srs if sr.activo), None)
            if not first_ruc_sede:
                first_ruc_sede = srs.first()
            if first_ruc_sede:
                datos['ruc_emisor_id'] = first_ruc_sede.ruc_id

    # Asociar la caja activa de la sesión al pago
    datos['caja_id'] = request.session.get('active_caja_id')

    try:
        resultado = sistema_registrar_pago_cliente(datos)
    except ValueError as exc:
        return senderror(str(exc), status=400)
    except Exception as exc:
        return senderror(f'Error al registrar pago: {exc}', status=500)

    return JsonResponse({'status': 'success', 'data': resultado})

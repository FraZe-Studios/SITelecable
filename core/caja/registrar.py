import json
from decimal import Decimal
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from core.models.models_generados import CajaMovimientos, Cajas
from core.auth.comun import checksession, getloggeduser, senderror, sendsuccess

@csrf_exempt
def registrar(request):
    """
    API asíncrona para registrar un movimiento manual de caja (ingreso o egreso).
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    if request.method != 'POST':
        return senderror('Método no permitido', status=405)

    user = getloggeduser(request)
    if not user:
        return senderror('Usuario no encontrado', status=404)

    sede = user.sede
    if not sede:
        return senderror('No puede registrar movimientos si no pertenece a una sede.', status=400)

    # Validar que exista una caja activa en sesión
    active_caja_id = request.session.get('active_caja_id')
    if not active_caja_id:
        return senderror('Debe seleccionar una caja activa para operar.', status=400)

    try:
        caja = Cajas.objects.get(pk=int(active_caja_id), activo=True)
    except (Cajas.DoesNotExist, ValueError):
        return senderror('La caja seleccionada no es válida o está inactiva.', status=400)

    try:
        data = json.loads(request.body)
        tipo_movimiento = data.get('tipo_movimiento')  # entrada_pago, salida_gasto
        metodo_pago = data.get('metodo_pago')  # efectivo, transferencia, otros
        monto_str = data.get('monto')
        descripcion = data.get('descripcion', '')
    except Exception:
        return senderror('JSON inválido', status=400)

    if not tipo_movimiento or not metodo_pago or not monto_str:
        return senderror('Todos los campos requeridos', status=400)

    if tipo_movimiento not in ['entrada_pago', 'salida_gasto']:
        return senderror('Tipo de movimiento inválido', status=400)

    if metodo_pago not in ['efectivo', 'transferencia', 'otros']:
        return senderror('Método de pago inválido', status=400)

    try:
        monto = Decimal(str(monto_str))
        if monto <= 0:
            raise ValueError()
    except Exception:
        return senderror('El monto debe ser un número positivo', status=400)

    # Validar permisos del cajero (efectivo/transferencia)
    if metodo_pago == 'efectivo' and not user.permiso_efectivo:
        return senderror('No tiene autorización para registrar cobros/gastos en Efectivo.', status=403)

    if metodo_pago in ['transferencia', 'otros'] and not user.permiso_transferencia:
        return senderror('No tiene autorización para registrar cobros/gastos bancarios/virtuales.', status=403)

    # Validar si el medio de recaudo está permitido por la caja
    recaudo = caja.configuracion_recaudo
    if metodo_pago == 'efectivo' and not recaudo.get('efectivo', True):
        return senderror('El método de pago Efectivo no está permitido en esta caja.', status=400)

    if metodo_pago in ['transferencia', 'otros'] and not recaudo.get('transferencia', True):
        return senderror('Los cobros o egresos bancarios/virtuales no están permitidos en esta caja.', status=400)

    # Crear movimiento manual con el prefijo [CAJA_ID: <id>] en la descripción
    CajaMovimientos.objects.create(
        sede=sede,
        usuario=user,
        tipo_movimiento=tipo_movimiento,
        metodo_pago=metodo_pago,
        monto=monto,
        descripcion=f"[CAJA_ID: {caja.id}] {descripcion}",
        fecha_movimiento=timezone.now(),
        fecha_creacion=timezone.now()
    )

    tipo_txt = "ingreso" if tipo_movimiento == "entrada_pago" else "gasto/salida"
    return sendsuccess(f'Se registró correctamente el {tipo_txt} por un monto de S/ {monto:.2f} en la caja "{caja.nombre}".')

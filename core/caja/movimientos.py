from datetime import datetime, time
from django.http import JsonResponse
from django.utils import timezone
from core.models.models_generados import CajaMovimientos, FacturacionPagos
from core.auth.comun import checksession, getloggeduser, senderror

def movimientos(request):
    """
    API asíncrona para listar movimientos de caja (manuales de CajaMovimientos + reales de FacturacionPagos).
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    user = getloggeduser(request)
    if not user:
        return senderror('Usuario no encontrado', status=404)

    is_admin = (user.rol == 'tac')
    fecha_str = request.GET.get('fecha')
    
    if fecha_str:
        try:
            query_date = datetime.strptime(fecha_str, '%Y-%m-%d').date()
        except ValueError:
            query_date = timezone.localdate()
    else:
        query_date = timezone.localdate()

    start_dt = timezone.make_aware(datetime.combine(query_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(query_date, time.max))

    # Resolver caja_id
    active_caja_id = request.session.get('active_caja_id')
    if not is_admin:
        caja_id = active_caja_id
    else:
        caja_id_param = request.GET.get('caja_id')
        if caja_id_param and caja_id_param != 'all' and caja_id_param != '':
            try:
                caja_id = int(caja_id_param)
            except ValueError:
                caja_id = None
        else:
            caja_id = None

    selected_sede_id = request.GET.get('sede_id')
    if is_admin and selected_sede_id:
        try:
            from core.models.models_generados import Sedes
            sede = Sedes.objects.get(pk=int(selected_sede_id))
        except (Sedes.DoesNotExist, ValueError):
            sede = user.sede
    else:
        sede = user.sede

    # Query 1: CajaMovimientos (movimientos manuales)
    man_qs = CajaMovimientos.objects.filter(
        fecha_movimiento__range=(start_dt, end_dt)
    ).select_related('usuario', 'sede').order_by('-fecha_movimiento')
    
    if sede:
        man_qs = man_qs.filter(sede=sede)
    if caja_id:
        man_qs = man_qs.filter(descripcion__startswith=f"[CAJA_ID: {caja_id}]")

    # Query 2: FacturacionPagos (pagos de clientes)
    pagos_qs = FacturacionPagos.objects.filter(
        tipo_transaccion='abono',
        fecha_transaccion__range=(start_dt, end_dt)
    ).select_related('usuario', 'servicio__cliente', 'servicio__plan__sede').order_by('-fecha_transaccion')
    
    if sede:
        pagos_qs = pagos_qs.filter(servicio__plan__sede=sede)
    if caja_id:
        pagos_qs = pagos_qs.filter(caja_id=caja_id)

    # Combinar y serializar
    combined_list = []
    
    # Serializar manuales
    prefix_str = f"[CAJA_ID: {caja_id}]" if caja_id else ""
    for m in man_qs:
        clean_desc = m.descripcion or ''
        if clean_desc.startswith('[CAJA_ID:'):
            # Limpiar el prefijo para la interfaz
            idx = clean_desc.find(']')
            if idx != -1:
                clean_desc = clean_desc[idx+1:].strip()
                
        combined_list.append({
            'id': f"manual_{m.id}",
            'sede': m.sede.nombre if m.sede else 'Sin Sede',
            'usuario': m.usuario.nombre_completo or m.usuario.username,
            'usuario_id': m.usuario_id,
            'tipo_movimiento': m.tipo_movimiento,
            'metodo_pago': m.metodo_pago,
            'monto': float(m.monto),
            'descripcion': clean_desc,
            'fecha': m.fecha_movimiento.strftime('%Y-%m-%d %H:%M:%S')
        })

    # Serializar abonos de clientes
    for p in pagos_qs:
        metodo = p.metodo_pago or 'efectivo'
        # Si no es efectivo, clasificar como 'transferencia' para alinearse con los KPIs del frontend
        if metodo != 'efectivo':
            metodo = 'transferencia'
            
        combined_list.append({
            'id': f"pago_{p.id}",
            'sede': p.servicio.plan.sede.nombre if p.servicio and p.servicio.plan and p.servicio.plan.sede else 'Sin Sede',
            'usuario': p.usuario.nombre_completo or p.usuario.username if p.usuario else 'Sistema',
            'usuario_id': p.usuario_id,
            'tipo_movimiento': 'entrada_pago',
            'metodo_pago': metodo,
            'monto': float(p.monto),
            'descripcion': p.descripcion or f"Pago de servicio — Cliente: {p.servicio.cliente.nombres_apellidos if p.servicio and p.servicio.cliente else 'Abonado'}",
            'fecha': p.fecha_transaccion.strftime('%Y-%m-%d %H:%M:%S')
        })

    # Ordenar por fecha decreciente
    combined_list.sort(key=lambda x: x['fecha'], reverse=True)

    if is_admin:
        return JsonResponse({'status': 'success', 'is_admin': True, 'movimientos': combined_list})
    else:
        # Para Cajeros convencionales, separar personales y totales de su sede/caja
        personales = [m for m in combined_list if m['usuario_id'] == user.id]
        return JsonResponse({
            'status': 'success',
            'is_admin': False,
            'personales': personales,
            'totales': combined_list
        })

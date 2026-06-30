from datetime import datetime, time
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Sum

from core.models.models_generados import Sedes, Usuario, CajaMovimientos, FacturacionPagos, Cajas
from core.auth.comun import checksession, getloggeduser, senderror

def resumen(request):
    """
    API asíncrona para obtener el resumen consolidado de caja diaria y personal.
    Soporta multicañas y control de recaudación por caja.
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

    selected_sede_id = request.GET.get('sede_id')
    if is_admin and selected_sede_id:
        try:
            sede = Sedes.objects.get(pk=int(selected_sede_id))
        except (Sedes.DoesNotExist, ValueError):
            sede = user.sede
    else:
        sede = user.sede

    if not sede and not is_admin:
        return JsonResponse({
            'status': 'error',
            'code': 'no_sede_assigned',
            'message': 'El usuario no tiene una sede asignada. Contacte al administrador.',
            'is_admin': is_admin,
            'sede': None,
            'sede_totales': {
                'efectivo': 0,
                'transferencia': 0,
                'otros': 0,
                'ingresos': 0,
                'egresos': 0,
                'neto': 0
            },
            'personal_totales': {
                'efectivo': 0,
                'transferencia': 0,
                'otros': 0,
                'ingresos': 0,
                'egresos': 0,
                'neto': 0
            },
            'sedes': [],
            'cajeros': [],
            'cajas_sede': [],
            'cajas_autorizadas': []
        }, status=200)

    # Permitir activar una caja en la sesión
    set_caja = request.GET.get('set_active_caja_id')
    if set_caja:
        try:
            # Validar que pertenezca a las autorizadas si no es admin
            cid = int(set_caja)
            if is_admin or cid in user.cajas_permitidas:
                request.session['active_caja_id'] = cid
        except Exception:
            pass

    active_caja_id = request.session.get('active_caja_id')
    cajas_autorizadas = []
    
    # Resolver cajas autorizadas del cajero
    auth_caja_ids = user.cajas_permitidas or []
    for cid in auth_caja_ids:
        try:
            c = Cajas.objects.get(pk=cid, activo=True)
            cajas_autorizadas.append({
                'id': c.id,
                'nombre': c.nombre,
                'recaudo': c.configuracion_recaudo
            })
        except Exception:
            pass

    if not is_admin:
        # Si es cajero, forzar a su caja activa. Si no tiene activa, auto-activar la única
        if not active_caja_id:
            if len(cajas_autorizadas) == 1:
                active_caja_id = cajas_autorizadas[0]['id']
                request.session['active_caja_id'] = active_caja_id
            elif len(cajas_autorizadas) > 1:
                # Debe elegir
                return JsonResponse({
                    'status': 'error',
                    'code': 'no_active_caja',
                    'message': 'Debe seleccionar una caja para operar.',
                    'cajas_autorizadas': cajas_autorizadas
                })
            else:
                return senderror('No tiene cajas autorizadas asignadas.', status=403)
        caja_id = active_caja_id
    else:
        # Si es admin, puede venir caja_id por filtro
        caja_id_param = request.GET.get('caja_id')
        if caja_id_param and caja_id_param != 'all':
            try:
                caja_id = int(caja_id_param)
            except ValueError:
                caja_id = None
        else:
            caja_id = None

    start_dt = timezone.make_aware(datetime.combine(query_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(query_date, time.max))

    # 1. Filtros de movimientos manuales (CajaMovimientos)
    sede_movs = CajaMovimientos.objects.none()
    if sede:
        sede_movs = CajaMovimientos.objects.filter(sede=sede, fecha_movimiento__range=(start_dt, end_dt))
        if caja_id:
            sede_movs = sede_movs.filter(descripcion__startswith=f"[CAJA_ID: {caja_id}]")

    # 2. Filtros de abonos reales de clientes (FacturacionPagos)
    pagos_qs = FacturacionPagos.objects.filter(
        tipo_transaccion='abono',
        fecha_transaccion__range=(start_dt, end_dt)
    )
    if sede:
        pagos_qs = pagos_qs.filter(servicio__plan__sede=sede)
    if caja_id:
        pagos_qs = pagos_qs.filter(caja_id=caja_id)

    # Totales Sede Consolidados
    man_efectivo_ent = float(sede_movs.filter(tipo_movimiento='entrada_pago', metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)
    man_efectivo_sal = float(sede_movs.filter(tipo_movimiento='salida_gasto', metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)
    man_transferencia_ent = float(sede_movs.filter(tipo_movimiento='entrada_pago', metodo_pago='transferencia').aggregate(s=Sum('monto'))['s'] or 0.0)
    man_transferencia_sal = float(sede_movs.filter(tipo_movimiento='salida_gasto', metodo_pago='transferencia').aggregate(s=Sum('monto'))['s'] or 0.0)
    man_otros_ent = float(sede_movs.filter(tipo_movimiento='entrada_pago', metodo_pago='otros').aggregate(s=Sum('monto'))['s'] or 0.0)
    man_otros_sal = float(sede_movs.filter(tipo_movimiento='salida_gasto', metodo_pago='otros').aggregate(s=Sum('monto'))['s'] or 0.0)

    client_efectivo_ent = float(pagos_qs.filter(metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)
    client_transferencia_ent = float(pagos_qs.exclude(metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)

    total_efectivo_ent = man_efectivo_ent + client_efectivo_ent
    total_efectivo_sal = man_efectivo_sal
    total_transferencia_ent = man_transferencia_ent + client_transferencia_ent
    total_transferencia_sal = man_transferencia_sal
    total_otros_ent = man_otros_ent
    total_otros_sal = man_otros_sal

    total_sede_ingresos = total_efectivo_ent + total_transferencia_ent + total_otros_ent
    total_sede_egresos = total_efectivo_sal + total_transferencia_sal + total_otros_sal
    total_sede_neto = total_sede_ingresos - total_sede_egresos

    # Totales Personales del Cajero
    personal_movs = CajaMovimientos.objects.filter(usuario=user, fecha_movimiento__range=(start_dt, end_dt))
    if sede:
        personal_movs = personal_movs.filter(sede=sede)
    if caja_id:
        personal_movs = personal_movs.filter(descripcion__startswith=f"[CAJA_ID: {caja_id}]")

    p_man_efectivo_ent = float(personal_movs.filter(tipo_movimiento='entrada_pago', metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)
    p_man_efectivo_sal = float(personal_movs.filter(tipo_movimiento='salida_gasto', metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)
    p_man_transferencia_ent = float(personal_movs.filter(tipo_movimiento='entrada_pago', metodo_pago='transferencia').aggregate(s=Sum('monto'))['s'] or 0.0)
    p_man_transferencia_sal = float(personal_movs.filter(tipo_movimiento='salida_gasto', metodo_pago='transferencia').aggregate(s=Sum('monto'))['s'] or 0.0)
    p_man_otros_ent = float(personal_movs.filter(tipo_movimiento='entrada_pago', metodo_pago='otros').aggregate(s=Sum('monto'))['s'] or 0.0)
    p_man_otros_sal = float(personal_movs.filter(tipo_movimiento='salida_gasto', metodo_pago='otros').aggregate(s=Sum('monto'))['s'] or 0.0)

    pers_pagos_qs = pagos_qs.filter(usuario=user)
    p_client_efectivo_ent = float(pers_pagos_qs.filter(metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)
    p_client_transferencia_ent = float(pers_pagos_qs.exclude(metodo_pago='efectivo').aggregate(s=Sum('monto'))['s'] or 0.0)

    pers_efectivo_ent = p_man_efectivo_ent + p_client_efectivo_ent
    pers_efectivo_sal = p_man_efectivo_sal
    pers_transferencia_ent = p_man_transferencia_ent + p_client_transferencia_ent
    pers_transferencia_sal = p_man_transferencia_sal
    pers_otros_ent = p_man_otros_ent
    pers_otros_sal = p_man_otros_sal

    total_personal_ingresos = pers_efectivo_ent + pers_transferencia_ent + pers_otros_ent
    total_personal_egresos = pers_efectivo_sal + pers_transferencia_sal + pers_otros_sal
    total_personal_neto = total_personal_ingresos - total_personal_egresos

    listado_sedes = []
    listado_cajeros = []
    cajas_sede = []
    
    if is_admin:
        for s in Sedes.objects.all():
            listado_sedes.append({'id': s.id, 'nombre': s.nombre})
        
        for u in Usuario.objects.filter(activo=True):
            listado_cajeros.append({
                'id': u.id,
                'username': u.username,
                'nombre_completo': u.nombre_completo,
                'rol': u.rol,
                'permiso_efectivo': u.permiso_efectivo,
                'permiso_transferencia': u.permiso_transferencia
            })
            
        if sede:
            for c in Cajas.objects.filter(sede=sede, activo=True).order_by('nombre'):
                cajas_sede.append({
                    'id': c.id,
                    'nombre': c.nombre,
                    'recaudo': c.configuracion_recaudo
                })

    active_caja_obj = None
    if active_caja_id:
        try:
            ac_box = Cajas.objects.get(pk=active_caja_id)
            active_caja_obj = {
                'id': ac_box.id,
                'nombre': ac_box.nombre,
                'recaudo': ac_box.configuracion_recaudo
            }
        except Exception:
            pass

    return JsonResponse({
        'status': 'success',
        'is_admin': is_admin,
        'fecha': query_date.strftime('%Y-%m-%d'),
        'sede': {'id': sede.id, 'nombre': sede.nombre} if sede else None,
        'active_caja': active_caja_obj,
        'permisos': {
            'efectivo': user.permiso_efectivo,
            'transferencia': user.permiso_transferencia
        },
        'sede_totales': {
            'efectivo': round(total_efectivo_ent - total_efectivo_sal, 2),
            'transferencia': round(total_transferencia_ent - total_transferencia_sal, 2),
            'otros': round(total_otros_ent - total_otros_sal, 2),
            'ingresos': round(total_sede_ingresos, 2),
            'egresos': round(total_sede_egresos, 2),
            'neto': round(total_sede_neto, 2)
        },
        'personal_totales': {
            'efectivo': round(pers_efectivo_ent - pers_efectivo_sal, 2),
            'transferencia': round(pers_transferencia_ent - pers_transferencia_sal, 2),
            'otros': round(pers_otros_ent - pers_otros_sal, 2),
            'ingresos': round(total_personal_ingresos, 2),
            'egresos': round(total_personal_egresos, 2),
            'neto': round(total_personal_neto, 2)
        },
        'sedes': listado_sedes,
        'cajeros': listado_cajeros,
        'cajas_sede': cajas_sede,
        'cajas_autorizadas': cajas_autorizadas
    })

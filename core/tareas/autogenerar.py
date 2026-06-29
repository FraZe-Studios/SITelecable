import random
from datetime import datetime, date, timedelta
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from core.models.models_generados import TareasLlamadas, Usuario, ServiciosAbonados
from core.abonados.contextovendedor import sistema_obtener_contexto_vendedor
from core.auth.comun import checksession, senderror
from core.tareas.utils import calcularfechavencimiento, urgencianivel

@require_GET
def autogenerar(request):
    """
    Genera automáticamente las tareas del ciclo de cobro para el día de hoy.
    Solo asigna a operadores con rol 'atc'. Nunca duplica tareas existentes del ciclo.
    """
    username = request.session.get('username')
    if not username:
        return senderror('No autorizado', status=401)

    ctx_vendedor = sistema_obtener_contexto_vendedor(username)
    es_admin = ctx_vendedor.get('es_admin', False)
    personal_id = ctx_vendedor.get('personal_id')
    rol = ctx_vendedor.get('rol', '')

    if not es_admin and rol != 'atc':
        return senderror('Acceso solo para operadores ATC.', status=403)

    hoy = date.today()
    ahora = timezone.now()

    empleados_atc = list(
        Usuario.objects.filter(rol='atc', activo=True).order_by('id')
    )

    if not empleados_atc:
        return senderror('No hay operadores ATC activos para recibir tareas.', status=400)

    servicios_activos = ServiciosAbonados.objects.filter(
        activo=True,
        estado_servicio__in=['activo', 'suspendido']
    ).select_related('plan', 'cliente')

    servicios_elegibles = []
    for serv in servicios_activos:
        resultado = calcularfechavencimiento(serv, hoy)
        if resultado is None:
            continue
        fecha_limite, dias_restantes, tipo_ciclo = resultado

        if dias_restantes > 15:
            continue
        if dias_restantes < -3:
            continue

        servicios_elegibles.append((serv, fecha_limite, dias_restantes, tipo_ciclo))

    inicio_ciclo = ahora - timedelta(days=20)
    servicios_con_tarea = set(
        TareasLlamadas.objects.filter(
            fecha_asignacion__gte=inicio_ciclo,
            estado_contacto__in=['pendiente', 'no_contesto', 'notificado', 'sms', 'whatsapp', 'contactado']
        ).values_list('servicio_id', flat=True)
    )

    servicios_nuevos = [
        (serv, fl, dr, tc)
        for serv, fl, dr, tc in servicios_elegibles
        if serv.id not in servicios_con_tarea
    ]

    num_atc = len(empleados_atc)
    tareas_creadas = 0

    if servicios_nuevos:
        random.shuffle(servicios_nuevos)
        for idx, (serv, fecha_limite, dias_restantes, tipo_ciclo) in enumerate(servicios_nuevos):
            empleado = empleados_atc[idx % num_atc]
            obs = f"[{tipo_ciclo.upper()}] Notificar vencimiento el {fecha_limite.strftime('%d/%m/%Y')} — {dias_restantes} días restantes."
            TareasLlamadas.objects.create(
                servicio=serv,
                empleado=empleado,
                estado_contacto='pendiente',
                observaciones=obs,
                fecha_asignacion=ahora,
                fecha_vencimiento_tarea=timezone.make_aware(
                    datetime.combine(fecha_limite - timedelta(days=1), datetime.max.time())
                )
            )
            tareas_creadas += 1

    qs_ciclo = TareasLlamadas.objects.filter(
        fecha_asignacion__gte=inicio_ciclo
    ).select_related('servicio__cliente', 'servicio__plan', 'empleado')

    if not es_admin:
        qs_ciclo = qs_ciclo.filter(empleado_id=personal_id)

    filtro = request.GET.get('filtro', 'TODOS')
    operador_id = request.GET.get('operador_id')
    if es_admin and operador_id:
        try:
            qs_ciclo = qs_ciclo.filter(empleado_id=int(operador_id))
        except ValueError:
            pass

    qs_ciclo = qs_ciclo.order_by('fecha_vencimiento_tarea', 'id')

    tareas_list = []
    for t in qs_ciclo:
        serv = t.servicio
        cliente = serv.cliente if serv else None

        resultado = calcularfechavencimiento(serv, hoy) if serv else None
        dias_rest = resultado[1] if resultado else 999
        tipo_ciclo_t = resultado[2] if resultado else '—'
        urgencia = urgencianivel(dias_rest)

        if filtro == 'URGENTES' and urgencia not in ('CRITICO', 'URGENTE', 'VENCIDA'):
            continue
        if filtro == 'PENDIENTE' and t.estado_contacto != 'pendiente':
            continue
        if filtro == 'NOTIFICADO' and t.estado_contacto == 'pendiente':
            continue

        es_contactado = t.estado_contacto not in ('pendiente',)

        tareas_list.append({
            'id': t.id,
            'cliente_codigo': cliente.id_cliente_codigo if cliente else '—',
            'cliente_nombre': cliente.nombre_apellidos if cliente else 'Sin nombre',
            'cliente_telefono1': cliente.celular_1 or '—',
            'cliente_telefono2': cliente.celular_2 or '—',
            'cliente_correo': cliente.correo if cliente else '—',
            'cliente_sin_contacto': bool(
                cliente and (not cliente.celular_1 and not cliente.celular_2)
            ),
            'servicio_codigo': serv.codigo if serv else '—',
            'servicio_estado': serv.estado_servicio.upper() if serv else '—',
            'plan_nombre': serv.plan.nombre if serv and serv.plan else '—',
            'tipo_ciclo': tipo_ciclo_t.upper(),
            'dias_restantes': dias_rest,
            'urgencia': urgencia,
            'empleado_id': t.empleado.id if t.empleado else None,
            'empleado_nombre': t.empleado.nombre_completo if t.empleado else 'Sin asignar',
            'estado_contacto': t.estado_contacto,
            'es_contactado': es_contactado,
            'observaciones': t.observaciones or '—',
            'fecha_asignacion': t.fecha_asignacion.strftime('%d/%m/%Y %H:%M') if t.fecha_asignacion else '—',
            'fecha_ejecucion': t.fecha_ejecucion.strftime('%d/%m/%Y %H:%M') if t.fecha_ejecucion else None,
            'fecha_vencimiento': t.fecha_vencimiento_tarea.strftime('%d/%m/%Y') if t.fecha_vencimiento_tarea else '—',
        })

    todas_ciclo = TareasLlamadas.objects.filter(fecha_asignacion__gte=inicio_ciclo)
    if not es_admin:
        todas_ciclo = todas_ciclo.filter(empleado_id=personal_id)

    total = todas_ciclo.count()
    completadas = todas_ciclo.exclude(estado_contacto='pendiente').count()
    pendientes = todas_ciclo.filter(estado_contacto='pendiente').count()
    vencidas = todas_ciclo.filter(
        estado_contacto='pendiente',
        fecha_vencimiento_tarea__lt=ahora
    ).count()
    urgentes = sum(
        1 for t in tareas_list
        if t['urgencia'] in ('CRITICO', 'URGENTE') and not t['es_contactado']
    )
    tasa_cumplimiento = round((completadas / total * 100), 1) if total > 0 else 0.0

    operadores = []
    if es_admin:
        ops = Usuario.objects.filter(rol='atc', activo=True).order_by('nombre_completo')
        for op in ops:
            total_op = TareasLlamadas.objects.filter(empleado_id=op.id, fecha_asignacion__gte=inicio_ciclo).count()
            comp_op = TareasLlamadas.objects.filter(
                empleado_id=op.id,
                fecha_asignacion__gte=inicio_ciclo
            ).exclude(estado_contacto='pendiente').count()
            tasa_op = round((comp_op / total_op * 100), 1) if total_op > 0 else 0.0
            operadores.append({
                'id': op.id,
                'nombre': op.nombre_completo,
                'total': total_op,
                'completadas': comp_op,
                'tasa': tasa_op
            })

    return JsonResponse({
        'status': 'success',
        'data': {
            'tareas': tareas_list,
            'tareas_nuevas_creadas': tareas_creadas,
            'kpis': {
                'total': total,
                'pendientes': pendientes,
                'completadas': completadas,
                'vencidas': vencidas,
                'urgentes': urgentes,
                'tasa_cumplimiento': tasa_cumplimiento,
            },
            'operadores': operadores,
        }
    })

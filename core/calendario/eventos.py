from datetime import datetime, date, time
from django.http import JsonResponse
from core.models.models_generados import ServiciosAbonados, FacturacionPagos, TicketsOrdenes
from core.auth.comun import checksession, senderror

def eventos(request):
    """
    API asíncrona para obtener eventos filtrados en base a fecha de inicio y fin.
    """
    if not checksession(request):
        return senderror('Sin sesión activa', status=401)

    start = request.GET.get('start')
    end = request.GET.get('end')
    modo = request.GET.get('modo', 'tickets') # tickets o clientes
    filtro_clientes = request.GET.get('filtro_clientes', 'instalaciones') # instalaciones o pagos

    if not start or not end:
        return senderror('Parámetros start y end requeridos', status=400)

    try:
        start_date = datetime.fromisoformat(start.replace('Z', '+00:00')).date() if 'T' in start else datetime.strptime(start, '%Y-%m-%d').date()
        end_date = datetime.fromisoformat(end.replace('Z', '+00:00')).date() if 'T' in end else datetime.strptime(end, '%Y-%m-%d').date()
    except ValueError:
        return senderror('Formato de fecha inválido', status=400)

    events = []

    if modo == 'clientes':
        if filtro_clientes == 'instalaciones':
            servicios = ServiciosAbonados.objects.filter(
                fecha_instalacion__range=(start_date, end_date)
            ).select_related('cliente')
            
            for s in servicios:
                events.append({
                    'id': f"inst-{s.id}",
                    'title': f"Instalación: {s.cliente.razon_social or s.cliente.nombre_apellidos}",
                    'start': s.fecha_instalacion.isoformat(),
                    'allDay': True,
                    'backgroundColor': '#10b981',
                    'borderColor': '#10b981',
                    'extendedProps': {
                        'tipo': 'instalacion',
                        'cliente_codigo': s.codigo,
                        'cliente_nombre': s.cliente.razon_social or s.cliente.nombre_apellidos,
                        'direccion': s.direccion_servicio,
                        'estado': s.estado_servicio
                    }
                })
        elif filtro_clientes == 'pagos':
            pagos = FacturacionPagos.objects.filter(
                tipo_transaccion='cargo',
                fecha_vencimiento__range=(start_date, end_date)
            ).select_related('servicio', 'servicio__cliente')

            for p in pagos:
                if p.servicio:
                    events.append({
                        'id': f"pago-{p.id}",
                        'title': f"Pago: {p.servicio.cliente.razon_social or p.servicio.cliente.nombre_apellidos} (S/ {p.monto})",
                        'start': p.fecha_vencimiento.isoformat(),
                        'allDay': True,
                        'backgroundColor': '#ef4444',
                        'borderColor': '#ef4444',
                        'extendedProps': {
                            'tipo': 'pago',
                            'cliente_codigo': p.servicio.codigo,
                            'cliente_nombre': p.servicio.cliente.razon_social or p.servicio.cliente.nombre_apellidos,
                            'monto': float(p.monto),
                            'descripcion': p.descripcion or 'Cobro mensualidad'
                        }
                    })

    else: # modo == 'tickets'
        tickets = TicketsOrdenes.objects.filter(
            estado__in=['pendiente', 'asignado', 'en_proceso']
        ).select_related('servicio', 'servicio__cliente')

        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)

        for t in tickets:
            fp = t.fecha_programada
            if fp:
                fp_naive = fp.replace(tzinfo=None) if hasattr(fp, 'tzinfo') and fp.tzinfo else fp
                if start_dt <= fp_naive <= end_dt:
                    color = '#3b82f6' if t.prioridad == 'alta' else '#f59e0b'
                    events.append({
                        'id': f"ticket-{t.id}",
                        'title': f"{t.nombre_ticket} - {t.servicio.cliente.razon_social or t.servicio.cliente.nombre_apellidos}",
                        'start': fp.isoformat(),
                        'allDay': False,
                        'backgroundColor': color,
                        'borderColor': color,
                        'extendedProps': {
                            'tipo': 'ticket',
                            'ticket_id': t.id,
                            'nombre': t.nombre_ticket,
                            'categoria': t.categoria,
                            'prioridad': t.prioridad,
                            'cliente': t.servicio.cliente.razon_social or t.servicio.cliente.nombre_apellidos,
                            'codigo_cliente': t.servicio.codigo,
                            'direccion': t.servicio.direccion_servicio,
                            'estado': t.estado
                        }
                    })

    return JsonResponse({'status': 'success', 'events': events})

import re as _re
from django.shortcuts import render
from django.http import HttpResponse
from core.models.models_generados import (
    Tickets, SedeRuc
)
from core.abonados.generador import (
    obtener_codigo_ticket_actualizado,
    obtener_codigo_cliente_actualizado,
    obtener_codigo_servicio_actualizado,
)

def imprimir(request):
    """GET /api/cliente/ticket/print/?ticket_id=<id> — Renderiza el template A5 del ticket."""
    if not request.session.get('username'):
        return HttpResponse('Sin sesión', status=401)
        
    ticket_id = request.GET.get('ticket_id')
    if not ticket_id:
        return HttpResponse('ticket_id requerido', status=400)
        
    try:
        ticket = Tickets.objects.select_related(
            'servicio', 'servicio__cliente',
            'servicio__plan', 'servicio__plan__sede',
        ).get(pk=int(ticket_id))

        sede = ticket.servicio.plan.sede if ticket.servicio and ticket.servicio.plan else None
        cliente = ticket.servicio.cliente if ticket.servicio else None
        servicio = ticket.servicio if ticket.servicio else None

        logo_url = ''
        if sede:
            srs = SedeRuc.objects.filter(sede=sede)
            sr = next((x for x in srs if x.logo_url), None)
            if sr and sr.logo_url:
                logo_url = sr.logo_url
            else:
                sr_ruc = next((x for x in srs), None)
                if sr_ruc and sr_ruc.ruc.logo_url:
                    logo_url = sr_ruc.ruc.logo_url

        codigo_ticket = obtener_codigo_ticket_actualizado(ticket)
        codigo_cliente = obtener_codigo_cliente_actualizado(cliente) if cliente else '—'
        codigo_servicio = obtener_codigo_servicio_actualizado(servicio) if servicio else '—'

        # Fetching assignee name (single technician from tecnico_asignado_id)
        tecnicos = []
        if ticket.tecnico_asignado_id:
            from core.models.usuarios import Usuario
            try:
                tecnico = Usuario.objects.get(pk=ticket.tecnico_asignado_id)
                tecnicos = [tecnico.nombre_completo]
            except Usuario.DoesNotExist:
                pass

        # Materiales from materiales_consumidos_json
        materiales = []
        if ticket.materiales_consumidos_json:
            for m in ticket.materiales_consumidos_json:
                materiales.append({
                    'descripcion': m.get('descripcion', ''),
                    'cantidad': m.get('cantidad', 0),
                    'precio_total': m.get('cantidad', 0) * m.get('precio_unitario', 0),
                })
        materiales_usados_list = []
        materiales_retirados_list = []
        for m in materiales:
            desc = m['descripcion'] or ''
            if '[RETIRO]' in desc.upper():
                desc_limpia = _re.sub(r'\[retiro\]', '', desc, flags=_re.IGNORECASE).strip()
                materiales_retirados_list.append(f"{desc_limpia} (Cant: {int(m['cantidad'])})")
            else:
                materiales_usados_list.append(f"{desc} (Cant: {int(m['cantidad'])})")

        materiales_usados_str = "<br>".join(materiales_usados_list) or "—"
        materiales_retirados_str = "<br>".join(materiales_retirados_list) or "—"

        from core.tickets.liquidacion import sistema_leer_liquidacion
        liq = sistema_leer_liquidacion(ticket.id)
        titulo_solucion = ''
        descripcion_solucion = ''
        problema = ''
        if liq:
            titulo_solucion = liq.get('titulo_solucion') or ''
            descripcion_solucion = liq.get('solucion') or ''
            problema = liq.get('problema') or ''

        context = {
            'ticket': ticket,
            'sede': sede,
            'logo_url': logo_url,
            'codigo_ticket': codigo_ticket,
            'codigo_cliente': codigo_cliente,
            'codigo_servicio': codigo_servicio,
            'tecnicos': tecnicos,
            'materiales': materiales,
            'ticket_materiales_usados': materiales_usados_str,
            'ticket_materiales_retirados': materiales_retirados_str,
            'titulo_solucion': titulo_solucion,
            'descripcion_solucion': descripcion_solucion,
            'problema': problema,
            'cliente_nombre': cliente.nombre_apellidos or cliente.razon_social or '—',
            'cliente_dni': cliente.dni or cliente.ruc or '—',
            'cliente_telefono': cliente.celular_1 or '—',
            'cliente_celular': cliente.celular_2 or '—',
            'cliente_correo': cliente.correo or '—',
            'cliente_direccion': cliente.direccion_fiscal or servicio.direccion_servicio or '—',
            'cliente_contrato': servicio.id if servicio else '—',
            'servicio_suministro': servicio.numero_suministro if servicio else '—',
            'servicio_plan': servicio.plan.nombre if servicio and servicio.plan else '—',
            'servicio_codigo': codigo_servicio if servicio else '—',
            'servicio_estado': servicio.estado_servicio if servicio else '—',
            'servicio_velocidad': servicio.plan.velocidad if servicio and servicio.plan else '—',
            'servicio_anexos': servicio.numero_anexos if servicio else '—',
            'servicio_sector': servicio.caja_nap.sector.nombre if servicio and servicio.caja_nap and servicio.caja_nap.sector else '—',
            'servicio_nap': servicio.caja_nap.codigo_identificador if servicio and servicio.caja_nap else '—',
            'servicio_puerto': servicio.puerto_nap if servicio else '—',
            'servicio_precinto': servicio.codigo_precinto if servicio else '—',
            'servicio_serie_equipo': servicio.router_serie if servicio else '—',
            'servicio_mac_equipo': servicio.router_mac if servicio else '—',
        }
        return render(request, 'cliente/ticket_print.html', context)

    except Tickets.DoesNotExist:
        return HttpResponse('Ticket no encontrado', status=404)
    except Exception as e:
        return HttpResponse(f'Error: {str(e)}', status=500)

"""
Liquidación de tickets: descriptiva (remoto) y por materiales (campo).
"""
import json
import calendar
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models.models_generados import (
    Abonados, FacturacionPagos, TicketsOrdenes, CacheSuministro, RucSedes, Ruc
)
from core.tickets.automation import execute_ticket_automation_on_liquidation


def _liquidacion_path(ticket_id):
    base = Path(settings.MEDIA_ROOT) / 'tickets' / str(ticket_id)
    base.mkdir(parents=True, exist_ok=True)
    return base / 'liquidacion.json'


def sistema_leer_liquidacion(ticket_id):
    path = _liquidacion_path(ticket_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError):
        return None


def _guardar_liquidacion(ticket_id, payload):
    path = _liquidacion_path(ticket_id)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return str(path.relative_to(settings.MEDIA_ROOT)).replace('\\', '/')


def _sanear_material_mac(mac_str):
    if not mac_str:
        return None
    mac_str = mac_str.strip()
    if mac_str == '' or mac_str.lower() in ('null', 'none', '-', '—'):
        return None
    import re
    if re.match(r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$', mac_str):
        return mac_str
    # Intenta formatear si es un string continuo de 12 caracteres (ej: AABBCCDDEEFF -> AA:BB:CC:DD:EE:FF)
    limpio = re.sub(r'[^0-9A-Fa-f]', '', mac_str)
    if len(limpio) == 12:
        formatted = ":".join(limpio[i:i+2] for i in range(0, 12, 2))
        if re.match(r'^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$', formatted):
            return formatted
    # Si no tiene el formato estándar de 12 dígitos, permitimos la cadena original
    return mac_str


@transaction.atomic
def sistema_liquidar_ticket(datos):
    """
    datos: ticket_id, personal_id, tipo (DESCRIPTIVA|MATERIALES),
           titulo_problema, problema, titulo_solucion, solucion,
           materiales [{descripcion, cantidad, precio_unitario}],
           generar_deuda_materiales, evidencia_url,
           direccion_servicio, nap_id, puerto_nap, presinto_numero,
           hub_borne_referencia, numero_anexos, fecha_instalacion,
           fecha_limite_corte, observaciones
    """
    ticket_id = datos.get('ticket_id')
    if not ticket_id:
        raise ValueError('ticket_id requerido')

    try:
        ticket = TicketsOrdenes.objects.select_related(
            'servicio', 'servicio__cliente'
        ).get(pk=ticket_id)
    except TicketsOrdenes.DoesNotExist:
        raise ValueError('Ticket no encontrado')

    if ticket.estado_ticket == 'LIQUIDADO':
        raise ValueError('El ticket ya está liquidado')

    tipo = (datos.get('tipo') or 'DESCRIPTIVA').upper()
    titulo_problema = (datos.get('titulo_problema') or '').strip()
    problema = (datos.get('problema') or '').strip()
    titulo_solucion = (datos.get('titulo_solucion') or '').strip()
    solucion = (datos.get('solucion') or '').strip()

    if tipo == 'DESCRIPTIVA':
        if not solucion:
            raise ValueError('La solución es obligatoria para la liquidación remota')
        if not titulo_solucion:
            titulo_solucion = 'Solución Remota'
        if not titulo_problema:
            titulo_problema = ticket.nombre_ticket or 'Problema Remoto'
        if not problema:
            problema = ticket.notas or 'Reportado por cliente'
        materiales = []
        total_materiales = Decimal('0')
    else:
        materiales = []
        total_materiales = Decimal('0')
        for item in datos.get('materiales') or []:
            cant = Decimal(str(item.get('cantidad') or 1))
            precio = Decimal(str(item.get('precio_unitario') or 0))
            linea = {
                'descripcion': (item.get('descripcion') or 'Material')[:200],
                'cantidad': float(cant),
                'precio_unitario': float(precio),
                'subtotal': float((cant * precio).quantize(Decimal('0.01'))),
            }
            materiales.append(linea)
            total_materiales += Decimal(str(linea['subtotal']))
        if not materiales:
            raise ValueError('Debe registrar al menos un material')

    # Obtener la suscripción asociada y ejecutar automatización por trigger de liquidación (motor centralizado)
    sub = ticket.suscripcion
    catalogo_ticket = ticket.catalogo_ticket
    
    # Ejecutar automatización al liquidar el ticket (motor centralizado)
    automation_result = execute_ticket_automation_on_liquidation({
        'nombre': ticket.nombre_ticket,
        'categoria': ticket.categoria,
        'modalidad': ticket.modalidad,
        'funciones_especiales': catalogo_ticket.funciones_especiales if catalogo_ticket else 'NO',
        'servicio_id': sub.id if sub else None,
        'cliente_id': sub.cliente_id if (sub and hasattr(sub, 'cliente')) else None,
        'plan_id': sub.plan_id if (sub and hasattr(sub, 'plan')) else None,
        'ticket_id': ticket_id,
        'genera_merma': catalogo_ticket.genera_merma if catalogo_ticket else False,
    })

    # Complement datos with values stored in ticket.configuracion_reglas at ticket creation time
    config_reglas = ticket.configuracion_reglas or {}
    if not datos.get('nuevo_plan_id') and config_reglas.get('nuevo_plan_id'):
        datos['nuevo_plan_id'] = config_reglas['nuevo_plan_id']
    if not datos.get('nuevo_suministro') and config_reglas.get('nuevo_suministro'):
        datos['nuevo_suministro'] = config_reglas['nuevo_suministro']

    # Lógica de automatización por trigger de liquidación (basada en resultado del motor)
    historial_plan = None
    ticket_merma_id = None
    router_changed = False
    old_router_modelo = ''
    old_router_serie = ''
    old_router_mac = ''
    new_router_modelo = ''
    new_router_serie = ''
    new_router_mac = ''
    
    if automation_result.get('status') == 'success' and automation_result.get('automation_type') == 'liquidation_trigger':
        actions = automation_result.get('actions_executed', [])
        for action in actions:
            action_type = action.get('action')
            
            if action_type == 'provision_services':
                # Instalación: aprovisionamiento y activación final de servicios
                if sub:
                    sub.estado_servicio = 'activo'
                    if not sub.fecha_instalacion:
                        sub.fecha_instalacion = timezone.localdate()
                    
            elif action_type == 'migrate_plan':
                # Migración de plan: corte de plan antiguo y activación de nuevo perfil
                from core.models.models_generados import Planes
                plan_id_val = datos.get('nuevo_plan_id') or datos.get('plan_id')
                nuevo_plan = None
                if plan_id_val:
                    try:
                        nuevo_plan = Planes.objects.get(pk=int(plan_id_val))
                    except Planes.DoesNotExist:
                        raise ValueError(f"El plan de destino con ID {plan_id_val} no existe.")
                elif datos.get('nuevo_plan_nombre'):
                    try:
                        nuevo_plan = Planes.objects.get(nombre=datos.get('nuevo_plan_nombre'), activo=True)
                    except Planes.DoesNotExist:
                        raise ValueError(f"El plan de destino '{datos.get('nuevo_plan_nombre')}' no existe o está inactivo.")
                
                if nuevo_plan and sub:
                    historial_plan = {
                        'plan_anterior_id': sub.plan_id,
                        'plan_anterior_nombre': sub.plan.nombre if sub.plan else '',
                        'plan_anterior_costo': float(sub.plan.costo_mensual) if sub.plan else 0.0,
                        'plan_nuevo_id': nuevo_plan.id,
                        'plan_nuevo_nombre': nuevo_plan.nombre,
                        'plan_nuevo_costo': float(nuevo_plan.costo_mensual),
                        'fecha_cambio': timezone.now().isoformat()
                    }
                    sub.plan = nuevo_plan
                    
            elif action_type == 'create_merma_ticket':
                # Retiro de Materiales / Genera Merma: generar ticket de Entrada de Merma
                materiales_retirados = [
                    f"- {item.get('descripcion')} (Cant: {item.get('cantidad')})"
                    for item in datos.get('materiales') or []
                    if '[RETIRO]' in item.get('descripcion', '').upper()
                ]
                notas_merma = f"Generado automáticamente tras liquidación del ticket de {ticket.nombre_ticket} T{ticket.id}."
                if materiales_retirados:
                    notas_merma += "\n\nMateriales Retirados:\n" + "\n".join(materiales_retirados)

                ticket_merma = TicketsOrdenes.objects.create(
                    servicio_id=sub.id if sub else None,
                    categoria='soporte',
                    area='infraestructura',
                    tecnologia='todos',
                    modalidad='remoto',
                    nombre_ticket='Entrada de Merma',
                    funcion_especial='si',
                    estado='pendiente',
                    prioridad='media',
                    precio_base=Decimal('0.00'),
                    fecha_creacion=timezone.now(),
                    notas=notas_merma
                )
                ticket_merma_id = ticket_merma.id

    evidencias = datos.get('evidencias') or []
    if not evidencias and datos.get('evidencia_url'):
        evidencias = [datos.get('evidencia_url')]
    evidencia_url = evidencias[0] if evidencias else None

    payload = {
        'ticket_id': ticket_id,
        'tipo': tipo,
        'titulo_problema': titulo_problema,
        'problema': problema,
        'titulo_solucion': titulo_solucion,
        'solucion': solucion,
        'materiales': materiales,
        'total_materiales': float(total_materiales),
        'personal_id': datos.get('personal_id'),
        'evidencia_url': evidencia_url,
        'evidencias': evidencias,
        'fecha': timezone.now().isoformat(),
        'historial_plan': historial_plan,
    }
    rel_path = _guardar_liquidacion(ticket_id, payload)

    # Guardar detalles de la solución remota en JSONB configuracion_reglas
    if tipo == 'DESCRIPTIVA':
        ticket.titulo_solucion_remota = titulo_solucion
        ticket.descripcion_cierre_remoto = solucion

    ticket.estado_ticket = 'LIQUIDADO'
    ticket.fecha_liquidacion = timezone.now()
    ticket.fecha_completado = timezone.now()
    ticket.ruta_foto_evidencia = evidencia_url
    ticket.save()

    if sub:
        # Si viene un cambio de suministro (ej. traslado externo), consultarlo en cache y actualizar
        nuevo_suministro = datos.get('nuevo_suministro') or datos.get('numero_suministro')
        if nuevo_suministro and nuevo_suministro != sub.numero_suministro:
            from core.abonados.suministros import consultar_suministro_con_cache
            res = consultar_suministro_con_cache(nuevo_suministro)
            if res and res.get('status') == 'success':
                sum_data = res['data']
                sub.numero_suministro = nuevo_suministro
                sub.direccion_servicio = sum_data.get('direccion') or sub.direccion_servicio
                sub.distrito = sum_data.get('distrito') or sub.distrito
                sub.provincia = sum_data.get('provincia') or sub.provincia
                sub.departamento = sum_data.get('departamento') or sub.departamento
                if sum_data.get('latitud'):
                    sub.latitud = Decimal(str(sum_data['latitud']))
                if sum_data.get('longitud'):
                    sub.longitud = Decimal(str(sum_data['longitud']))

        # Actualizar suscripción / servicio unificado
        nap_id_val = datos.get('nap_id')
        if nap_id_val and str(nap_id_val).strip() not in ('', 'None', 'null'):
            sub.caja_nap_id = int(nap_id_val)
        if datos.get('puerto_nap'):
            sub.puerto_nap = datos.get('puerto_nap')
        if datos.get('presinto_numero'):
            sub.presinto_numero = datos.get('presinto_numero')
        if datos.get('hub_borne_referencia'):
            sub.hub_borne_referencia = datos.get('hub_borne_referencia')
        num_anexos = datos.get('numero_anexos')
        if num_anexos is not None and str(num_anexos).strip() not in ('', 'None', 'null'):
            sub.numero_anexos = int(num_anexos)
        is_new_installation = not sub.fecha_instalacion or (ticket.categoria == 'instalacion')
        if is_new_installation:
            fecha_inst = timezone.localdate()
        else:
            fecha_inst = datos.get('fecha_instalacion') or sub.fecha_instalacion
            if isinstance(fecha_inst, str):
                try:
                    fecha_inst = datetime.strptime(fecha_inst[:10], '%Y-%m-%d').date()
                except ValueError:
                    fecha_inst = sub.fecha_instalacion or timezone.localdate()

        fecha_corte = datos.get('fecha_limite_corte') or sub.fecha_limite_corte
        plan = sub.plan
        if plan:
            dia_vencimiento = (plan.dia_vencimiento or 'fin_mes').strip().lower()
            dias_gracia = plan.dias_gracia if plan.dias_gracia is not None else 5
        else:
            dia_vencimiento = 'fin_mes'
            dias_gracia = 5

        # Recalculate cut-off date if this is a new installation/activation, or if cut-off date is not set
        if is_new_installation or not fecha_corte or not datos.get('fecha_limite_corte'):
            if dia_vencimiento == 'fin_mes':
                _, ultimo_dia = calendar.monthrange(fecha_inst.year, fecha_inst.month)
                due_date = date(fecha_inst.year, fecha_inst.month, ultimo_dia)
            else:
                # Same day next month
                if fecha_inst.month == 12:
                    next_year = fecha_inst.year + 1
                    next_month = 1
                else:
                    next_year = fecha_inst.year
                    next_month = fecha_inst.month + 1
                _, ultimo_dia_next = calendar.monthrange(next_year, next_month)
                dia_uso = min(fecha_inst.day, ultimo_dia_next)
                due_date = date(next_year, next_month, dia_uso)
            
            fecha_corte = due_date + timedelta(days=dias_gracia)
        elif isinstance(fecha_corte, str):
            try:
                fecha_corte = datetime.strptime(fecha_corte[:10], '%Y-%m-%d').date()
            except ValueError:
                fecha_corte = sub.fecha_limite_corte

        sub.fecha_instalacion = fecha_inst
        if fecha_corte:
            if isinstance(fecha_corte, date):
                sub.fecha_limite_corte = fecha_corte.strftime('%Y-%m-%d')
            else:
                sub.fecha_limite_corte = str(fecha_corte)
        if datos.get('observaciones'):
            sub.observaciones = datos.get('observaciones')
        
        # También permitir actualizar coordenadas manualmente
        lat_val = datos.get('gps_latitud') or datos.get('latitud')
        if lat_val and str(lat_val).strip() not in ('', 'None', 'null'):
            sub.latitud = Decimal(str(lat_val))
        lon_val = datos.get('gps_longitud') or datos.get('longitud')
        if lon_val and str(lon_val).strip() not in ('', 'None', 'null'):
            sub.longitud = Decimal(str(lon_val))
        if datos.get('direccion_servicio'):
            sub.direccion_servicio = datos.get('direccion_servicio')
        
        # Detectar cambios en router_modelo/serie/mac para registrar en el historial
        old_router_modelo = sub._get_dato_tecnico('router_modelo', '').strip() or 'Router Principal'
        old_router_serie = (sub.router_serie or '').strip()
        old_router_mac = (sub.router_mac or '').strip()
        
        new_router_modelo = (datos.get('router_modelo') or '').strip() if datos.get('router_modelo') is not None else old_router_modelo
        new_router_serie = (datos.get('router_serie') or '').strip() if datos.get('router_serie') is not None else old_router_serie
        new_router_mac = (datos.get('router_mac') or '').strip() if datos.get('router_mac') is not None else old_router_mac

        router_changed = False
        if datos.get('router_serie') is not None or datos.get('router_mac') is not None or datos.get('router_modelo') is not None:
            if new_router_serie != old_router_serie or new_router_mac != old_router_mac or new_router_modelo != old_router_modelo:
                router_changed = True

        # Actualizar campos de router (soportando limpieza y formateo flexible)
        if datos.get('router_serie') is not None:
            sub.router_serie = datos.get('router_serie').strip() or None
        if datos.get('router_mac') is not None:
            sub.router_mac = _sanear_material_mac(datos.get('router_mac'))
        if datos.get('router_modelo') is not None:
            sub._set_dato_tecnico('router_modelo', datos.get('router_modelo').strip() or None)

        # Sanear router_mac antes de guardar
        if sub.router_mac:
            sub.router_mac = _sanear_material_mac(sub.router_mac)

        sub.save()

        # Actualizar CacheSuministro si existe
        try:
            cache_entry = CacheSuministro.objects.filter(numero_suministro=sub.numero_suministro).first()
            if cache_entry:
                cache_entry.direccion = sub.direccion_servicio
                cache_entry.latitud = sub.latitud
                cache_entry.longitud = sub.longitud
                cache_entry.save()
        except Exception:
            pass

    # Registrar técnicos asignados en ticket_tecnicos_asignados
    tecnicos_ids = datos.get('tecnicos_asignados') or []
    if tecnicos_ids:
        from core.models.tickets import TicketTecnicosAsignados
        for tec_id in tecnicos_ids:
            TicketTecnicosAsignados.objects.get_or_create(
                ticket_orden=ticket,
                tecnico_id=int(tec_id)
            )

    # Registrar materiales utilizados en ticket_consumo_materiales
    if tipo == 'MATERIALES':
        from core.models.tickets import TicketConsumoMateriales
        TicketConsumoMateriales.objects.filter(ticket_orden=ticket).delete()
        for item in datos.get('materiales') or []:
            cant = Decimal(str(item.get('cantidad') or 1))
            precio = Decimal(str(item.get('precio_unitario') or 0))
            TicketConsumoMateriales.objects.create(
                ticket_orden=ticket,
                tecnico_id=int(datos.get('personal_id') or 1),
                descripcion=(item.get('descripcion') or 'Material')[:200],
                unidad_medida=(item.get('unidad_medida') or 'Unidad')[:20],
                cantidad=cant,
                precio_unitario=precio
            )

    # Registrar historial de cambio de router principal si hubo cambios
    if sub and router_changed:
        from core.models.tickets import TicketConsumoMateriales
        # Si había un router anterior, registrar su retiro
        if old_router_serie or old_router_mac:
            TicketConsumoMateriales.objects.create(
                ticket_orden=ticket,
                tecnico_id=int(datos.get('personal_id') or 1),
                descripcion=f"[RETIRO] {old_router_modelo} (Serie: {old_router_serie}, MAC: {old_router_mac})",
                unidad_medida="Unidad",
                cantidad=Decimal('1.00'),
                precio_unitario=Decimal('0.00'),
                material_serie=old_router_serie.strip()[:100] if old_router_serie else None,
                material_mac=_sanear_material_mac(old_router_mac)
            )
        # Si se instaló un nuevo router, registrar su instalación
        if new_router_serie or new_router_mac:
            TicketConsumoMateriales.objects.create(
                ticket_orden=ticket,
                tecnico_id=int(datos.get('personal_id') or 1),
                descripcion=f"{new_router_modelo} (Serie: {new_router_serie}, MAC: {new_router_mac})",
                unidad_medida="Unidad",
                cantidad=Decimal('1.00'),
                precio_unitario=Decimal('0.00'),
                material_serie=new_router_serie.strip()[:100] if new_router_serie else None,
                material_mac=_sanear_material_mac(new_router_mac)
            )

    # Buscar RUC emisor de la sede
    ruc_emisor = None
    if sub and sub.caja_nap and sub.caja_nap.sector and sub.caja_nap.sector.sede:
        sede = sub.caja_nap.sector.sede
        ruc_sede = RucSedes.objects.filter(sede=sede).first()
        if ruc_sede:
            ruc_emisor = ruc_sede.ruc
    if not ruc_emisor:
        ruc_emisor = Ruc.objects.filter(activo=True).first() or Ruc.objects.first()

    deuda_ticket_id = None
    deuda_materiales_id = None

    if sub and ruc_emisor:
        # 1. Procesar cobro / exoneración del Ticket (precio_base)
        precio_ticket = ticket.precio_base
        omitir_pago_ticket = datos.get('omitir_pago_ticket', False)
        motivo_omision_ticket = datos.get('motivo_omision_ticket', '')

        if precio_ticket > 0:
            if omitir_pago_ticket:
                # Transacción de exoneración para auditoría
                deuda_t = FacturacionPagos.objects.create(
                    servicio=sub,
                    ruc_emisor=ruc_emisor,
                    tipo_documento='nota_venta',
                    tipo_transaccion='exoneracion',
                    monto=precio_ticket,
                    exoneracion_deuda=True,
                    descripcion=f'Exoneración de pago de ticket T{ticket_id}. Motivo: {motivo_omision_ticket}'[:255],
                    vendedor_id=datos.get('personal_id') or None,
                    fecha_transaccion=timezone.now(),
                    fecha_vencimiento=timezone.now().date(),
                    fecha_creacion=timezone.now(),
                )
                deuda_ticket_id = deuda_t.id
            else:
                # Generar cargo por el ticket
                deuda_t = FacturacionPagos.objects.create(
                    servicio=sub,
                    ruc_emisor=ruc_emisor,
                    tipo_documento='nota_venta',
                    tipo_transaccion='cargo',
                    monto=precio_ticket,
                    descripcion=f'Cargo por ticket T{ticket_id}'[:255],
                    fecha_transaccion=timezone.now(),
                    fecha_vencimiento=timezone.now().date(),
                    fecha_creacion=timezone.now(),
                )
                deuda_ticket_id = deuda_t.id
                sub.deuda_acumulada = (sub.deuda_acumulada or Decimal('0')) + precio_ticket
                sub.save(update_fields=['deuda_acumulada'])

        # 2. Procesar cobro / exoneración de Materiales
        omitir_pago_materiales = datos.get('omitir_pago_materiales', False)
        motivo_omision_materiales = datos.get('motivo_omision_materiales', '')
        cobra_mat = False
        if ticket.configuracion_reglas and isinstance(ticket.configuracion_reglas, dict):
            cobra_mat = bool(ticket.configuracion_reglas.get('permisos', {}).get('cobra_materiales_liquidar', False))

        if tipo == 'MATERIALES' and total_materiales > 0 and datos.get('generar_deuda_materiales', cobra_mat):
            if omitir_pago_materiales:
                # Transacción de exoneración de materiales para auditoría
                deuda_m = FacturacionPagos.objects.create(
                    servicio=sub,
                    ruc_emisor=ruc_emisor,
                    tipo_documento='nota_venta',
                    tipo_transaccion='exoneracion',
                    monto=total_materiales,
                    exoneracion_deuda=True,
                    descripcion=f'Exoneración de materiales ticket T{ticket_id}. Motivo: {motivo_omision_materiales}'[:255],
                    vendedor_id=datos.get('personal_id') or None,
                    fecha_transaccion=timezone.now(),
                    fecha_vencimiento=timezone.now().date(),
                    fecha_creacion=timezone.now(),
                )
                deuda_materiales_id = deuda_m.id
            else:
                # Generar cargo por los materiales
                deuda_m = FacturacionPagos.objects.create(
                    servicio=sub,
                    ruc_emisor=ruc_emisor,
                    tipo_documento='nota_venta',
                    tipo_transaccion='cargo',
                    monto=total_materiales,
                    descripcion=f'Materiales ticket T{ticket_id}'[:255],
                    fecha_transaccion=timezone.now(),
                    fecha_vencimiento=timezone.now().date(),
                    fecha_creacion=timezone.now(),
                )
                deuda_materiales_id = deuda_m.id
                sub.deuda_acumulada = (sub.deuda_acumulada or Decimal('0')) + total_materiales
                sub.save(update_fields=['deuda_acumulada'])

    return {
        'ticket_id': ticket_id,
        'estado': 'LIQUIDADO',
        'liquidacion_path': rel_path,
        'deuda_ticket_id': deuda_ticket_id,
        'deuda_materiales_id': deuda_materiales_id,
        'total_materiales': float(total_materiales),
        'ticket_merma_id': ticket_merma_id,
    }

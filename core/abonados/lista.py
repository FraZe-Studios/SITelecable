from django.core.paginator import Paginator
from django.db.models import Prefetch, Q

# Importaciones sincronizadas con la capa core de la base de datos unificada
from core.models.models_generados import (
    Abonados, ServiciosAbonados, TicketsOrdenes, FacturacionPagos, Planes
)
from core.sede.sedeutils import strip_sede_prefijo

ESTADOS_ABIERTOS_TICKET = ('pendiente', 'asignado', 'en_proceso', 'en_espera')


def sistema_calcular_estado_comercial(cliente):
    """Calcula el estado comercial del abonado basado en sus deudas y servicios."""
    if cliente.tiene_deuda_activa:
        return 'MORA'
    subs = list(cliente.suscripciones.all())
    if not subs:
        return 'PENDIENTE'
    estados = {s.estado_servicio.upper() if s.estado_servicio else '' for s in subs}
    if 'SUSPENDIDO' in estados:
        return 'MORA'
        
    # Check if they are NUEVO: if the oldest installation date is within the last 30 days
    from datetime import date
    es_nuevo = False
    for s in subs:
        if s.fecha_instalacion and (date.today() - s.fecha_instalacion).days <= 30:
            es_nuevo = True
            break
            
    if es_nuevo:
        return 'NUEVO'
        
    if 'ACTIVO' in estados:
        return 'ACTIVO'
    if estados <= {'CORTADO'}:
        return 'CORTE'
    return 'PENDIENTE'


def sistema_listar_abonados(filtros):
    """
    filtros: q, estado, sede, paginate_by, page
    Retorna dict con page_obj, clientes enriquecidos y paginator para la SPA.
    """
    qs = Abonados.objects.all()

    q = (filtros.get('q') or '').strip()
    if q:
        if q.isdigit():
            qs = qs.filter(
                Q(id=int(q))
                | Q(dni__icontains=q)
                | Q(ruc__icontains=q)
                | Q(celular_1__icontains=q)
            )
        else:
            qs = qs.filter(
                Q(nombres_apellidos__icontains=q)
                | Q(razon_social__icontains=q)
            )

    sede = filtros.get('sede')
    if sede:
        qs = qs.filter(suscripciones__plan__sede_id=sede).distinct()

    estado = (filtros.get('estado') or '').strip().upper()
    if estado:
        candidatos = []
        prefetch = Prefetch(
            'suscripciones',
            queryset=ServiciosAbonados.objects.select_related('plan__sede'),
        )
        for cliente in qs.prefetch_related(prefetch):
            if sistema_calcular_estado_comercial(cliente) == estado:
                candidatos.append(cliente.id)
        qs = qs.filter(id__in=candidatos)

    per_page = int(filtros.get('paginate_by') or 50)
    per_page = per_page if per_page in (50, 100, 200) else 50
    page_num = int(filtros.get('page') or 1)

    paginator = Paginator(qs.order_by('-id'), per_page)
    page_obj = paginator.get_page(page_num)

    cliente_ids = [c.id for c in page_obj.object_list]
    
    # Consulta de órdenes vigentes mapeada sobre las columnas físicas reales del esquema
    tickets_pendientes = TicketsOrdenes.objects.filter(
        estado__in=ESTADOS_ABIERTOS_TICKET,
        servicio__cliente_id__in=cliente_ids,
    ).select_related('servicio')

    tickets_por_cliente = {}
    for ticket in tickets_pendientes:
        cid = ticket.servicio.cliente_id
        tickets_por_cliente.setdefault(cid, []).append(ticket)

    clientes = []
    # Indexación por clave primaria física 'id' para evitar columnas huérfanas
    prefetch = Prefetch(
        'suscripciones',
        queryset=ServiciosAbonados.objects.select_related('plan__sede').order_by('-id'),
    )
    for cliente in Abonados.objects.filter(id__in=cliente_ids).prefetch_related(prefetch):
        primera_sub = cliente.suscripciones.first()
        sede_nombre = ''
        if primera_sub and primera_sub.plan_id:
            sede_nombre = strip_sede_prefijo(primera_sub.plan.sede.nombre)

        direccion = cliente.direccion_fiscal
        if not direccion and primera_sub:
            direccion = primera_sub.direccion_servicio

        clientes.append({
            'pk': cliente.id_cliente_codigo,
            'codigo_cliente': cliente.id_cliente_codigo,
            'razon_social': cliente.razon_social or cliente.nombres_apellidos or 'S/N',
            'direccion_fiscal': direccion or '',
            'dni_ruc': cliente.ruc or cliente.dni or '—',
            'sede_nombre': sede_nombre or 'S/S',
            'estado_comercial': sistema_calcular_estado_comercial(cliente),
            'pending_tickets': tickets_por_cliente.get(cliente.id, []),
            'pending_orders': [],
            'tiene_deuda': cliente.tiene_deuda_activa,
        })

    # Preservar el ordenamiento exacto dictado por el paginador asíncrono
    orden = {cid: i for i, cid in enumerate(cliente_ids)}
    clientes.sort(key=lambda c: orden.get(parse_cliente_id_helper(c['codigo_cliente']), 999))

    return {
        'page_obj': page_obj,
        'paginator': paginator,
        'clientes': clientes,
    }


def parse_cliente_id_helper(formatted_id):
    """Helper interno para resolver el desempaquetado de códigos de cliente."""
    try:
        from core.abonados.geoutils import parse_cliente_id
        return parse_cliente_id(formatted_id)
    except Exception:
        return 0


def sistema_buscar_cliente_local(documento):
    """Busca un abonado en la persistencia local por su documento de identidad."""
    documento = (documento or '').strip()
    if not documento:
        return None
    if len(documento) == 8:
        return Abonados.objects.filter(dni=documento).first()
    if len(documento) == 11:
        return Abonados.objects.filter(ruc=documento).first()
    if documento.isdigit():
        return Abonados.objects.filter(id=int(documento)).first()
    return None


def sistema_deudas_cliente(cliente_id):
    """Retorna el listado de cargos financieros transaccionales pendientes del servicio."""
    from core.abonados.geoutils import parse_cliente_id
    cliente_id = parse_cliente_id(cliente_id)
            
    servicios = ServiciosAbonados.objects.filter(cliente_id=cliente_id, deuda_acumulada__gt=0)
    deudas_list = []
    
    for s in servicios:
        charges = FacturacionPagos.objects.filter(
            servicio=s,
            tipo_transaccion='cargo'
        ).order_by('-id')[:10]  # Alineado a la clave secuencial de auditoría
        
        for c in charges:
            deudas_list.append({
                'id': c.id,
                'concepto': c.descripcion or 'Cargo por servicio',
                'monto_actual': float(c.monto),
                'suministro_id': s.numero_suministro,
                'desvinculada': False,
            })
            
        if not charges:
            deudas_list.append({
                'id': 0,
                'concepto': 'Deuda acumulada de servicio',
                'monto_actual': float(s.deuda_acumulada),
                'suministro_id': s.numero_suministro,
                'desvinculada': False,
            })
            
    return deudas_list
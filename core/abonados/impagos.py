import re
from datetime import date, timedelta
from django.db import transaction
from django.utils import timezone
from core.models.models_generados import (
    Abonados, FacturacionPagos, ServiciosAbonados, TicketsOrdenes, CatalogoTickets
)

def obtener_cargos_pendientes(fecha_limite=None):
    """
    Retorna los cargos (FacturacionPagos) que no han sido pagados y que vencieron
    antes de la fecha_limite.
    """
    cargos_qs = FacturacionPagos.objects.filter(
        tipo_transaccion='cargo',
        monto__gt=0
    )
    if fecha_limite:
        cargos_qs = cargos_qs.filter(fecha_vencimiento__lt=fecha_limite)
    
    cargos = list(cargos_qs.select_related('servicio__cliente'))
    abonos = FacturacionPagos.objects.filter(tipo_transaccion='abono')
    
    pagados_ids = set()
    for ab in abonos:
        match = re.search(r'\[PAGO_CARGO_ID:\s*(\d+)\]', ab.descripcion or '')
        if match:
            pagados_ids.add(int(match.group(1)))

    cargos_pendientes = [c for c in cargos if c.id not in pagados_ids]
    return cargos_pendientes

def procesar_impagos():
    """
    Procesa impagos de clientes: suspende suscripciones vencidas y crea tickets de retención.
    """
    # 1. Suspender suscripciones con más de 30 días de deuda
    cutoff_date = date.today() - timedelta(days=30)
    cargos_pendientes_cutoff = obtener_cargos_pendientes(cutoff_date)
    servicio_ids_cutoff = set(c.servicio_id for c in cargos_pendientes_cutoff if c.servicio_id)
    
    suscripciones_actualizadas = ServiciosAbonados.objects.filter(
        id__in=servicio_ids_cutoff,
        estado_servicio='activo',
    ).update(estado_servicio='suspendido')
    
    # 2. Generar tickets de retención para deudas con más de 7 días
    retention_date = date.today() - timedelta(days=7)
    cargos_pendientes_retention = obtener_cargos_pendientes(retention_date)
    
    retention_catalogo = CatalogoTickets.objects.filter(
        nombre_ticket='Ticket de Retención',
        es_universal=True,
        activo=True
    ).first()
    
    tickets_generados = 0
    if retention_catalogo:
        for deuda in cargos_pendientes_retention:
            suscripcion = ServiciosAbonados.objects.filter(
                id=deuda.servicio_id,
                estado_servicio__in=['activo', 'suspendido']
            ).first()
            
            if not suscripcion:
                continue
            
            # Verificar si ya existe un ticket de retención en los últimos 7 días
            existing_ticket = TicketsOrdenes.objects.filter(
                servicio_id=suscripcion.id_suscripcion,
                catalogo_ticket_id=retention_catalogo.id,
                fecha_creacion__gte=timezone.now() - timedelta(days=7),
            ).exists()
            
            if existing_ticket:
                continue
            
            with transaction.atomic():
                TicketsOrdenes.objects.create(
                    servicio_id=suscripcion.id_suscripcion,
                    categoria='incidencia',  # Usar categoría válida
                    nombre_ticket=retention_catalogo.nombre_ticket,
                    area='planta_interna',
                    tecnologia='todos',
                    modalidad='remoto',
                    estado='pendiente',
                    prioridad='alta',
                    fecha_creacion=timezone.now(),
                    notas=f'Retención automática por impago desde {deuda.fecha_vencimiento}',
                    configuracion_reglas={'omite_generacion_deuda': True}
                )
                tickets_generados += 1

    return {
        'suscripciones_suspendidas': suscripciones_actualizadas,
        'tickets_retencion_creados': tickets_generados
    }

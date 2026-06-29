"""
Generación de tickets manuales (solicitud del cliente).
Permite seleccionar tipo de orden (remoto/campo) y describir el problema.
"""
from django.db import transaction
from django.utils import timezone

from core.models.models_generados import (
    Tickets, CatalogoTickets, Suscripciones,
)
from core.tickets.automation import execute_ticket_automation_on_creation


@transaction.atomic
def sistema_generar_ticket_manual(datos):
    """
    Genera un ticket manual solicitado por el cliente.
    
    datos: 
        - suscripcion_id: ID de la suscripción
        - catalogo_ticket_id: ID del ticket del catálogo
        - tipo_orden: 'REMOTO' o 'CAMPO' (opcional, se infiere del catálogo)
        - titulo_problema: Título del problema
        - descripcion_problema: Descripción detallada del problema
        - personal_id: ID del personal que registra (opcional)
    """
    suscripcion_id = datos.get('suscripcion_id')
    if not suscripcion_id:
        raise ValueError('suscripcion_id requerido')
    
    catalogo_ticket_id = datos.get('catalogo_ticket_id')
    if not catalogo_ticket_id:
        raise ValueError('catalogo_ticket_id requerido')
    
    titulo_problema = (datos.get('titulo_problema') or '').strip()
    if not titulo_problema:
        raise ValueError('titulo_problema requerido')
    
    descripcion_problema = (datos.get('descripcion_problema') or '').strip()
    if not descripcion_problema:
        raise ValueError('descripcion_problema requerido')
    
    # Verificar que la suscripción existe
    try:
        suscripcion = Suscripciones.objects.get(id=suscripcion_id)
    except Suscripciones.DoesNotExist:
        raise ValueError('Suscripción no encontrada')
    
    # Obtener el ticket del catálogo
    try:
        catalogo_ticket = CatalogoTickets.objects.get(
            id=catalogo_ticket_id,
            activo=True
        )
    except CatalogoTickets.DoesNotExist:
        raise ValueError('Ticket del catálogo no encontrado o inactivo')
    
    # Determinar el tipo_ticket enum basado en el catálogo
    tipo_ticket_enum = _determinar_tipo_ticket_enum(catalogo_ticket)
    
    # Determinar si es remoto o campo (prioridad: parámetro > catálogo)
    tipo_orden_param = (datos.get('tipo_orden') or '').upper()
    if tipo_orden_param in ('REMOTO', 'CAMPO'):
        modalidad = tipo_orden_param
    else:
        modalidad = catalogo_ticket.modalidad
    
    # Mapeo a enums válidos de la BD
    categoria_val = (catalogo_ticket.categoria or '').strip()
    categorias_validas_lower = [
        'incidencia', 'requerimiento', 'avería', 'averia',
        'instalacion', 'mantenimiento', 'soporte', 'cambio_plan', 'traslado', 'baja', 'reparacion', 'todos'
    ]
    if not categoria_val or categoria_val.lower() not in categorias_validas_lower:
        categoria_val = 'incidencia'
        
    area_val = (catalogo_ticket.area or 'soporte').lower()
    if area_val not in ['red', 'comercial', 'facturacion', 'soporte', 'infraestructura', 'todos']:
        area_val = 'soporte'
        
    tecnologia_val = (catalogo_ticket.tecnologia or 'todos').lower()
    if 'fibra' in tecnologia_val:
        tecnologia_val = 'fibra_optica'
    elif tecnologia_val not in ['fibra_optica', 'cobre', 'wireless', 'satelital', 'todos']:
        tecnologia_val = 'todos'
        
    modalidad_val = (modalidad or 'remoto').lower()
    if modalidad_val == 'campo':
        modalidad_val = 'presencial'
    elif modalidad_val not in ['presencial', 'remoto', 'programado', 'urgente', 'todos']:
        modalidad_val = 'remoto'

    # Crear el ticket
    ticket = Tickets.objects.create(
        servicio_id=suscripcion_id,
        categoria=categoria_val,
        nombre_ticket=catalogo_ticket.nombre_ticket,
        area=area_val,
        tecnologia=tecnologia_val,
        modalidad=modalidad_val,
        estado='pendiente',
        prioridad='media',
        precio_base=catalogo_ticket.precio_base or 0.00,
        fecha_creacion=timezone.now(),
        notas=f"Título: {titulo_problema}\n\nDescripción: {descripcion_problema}"
    )

    # Ejecutar automatización al crear el ticket (motor centralizado)
    automation_result = execute_ticket_automation_on_creation({
        'nombre': catalogo_ticket.nombre_ticket,
        'modalidad': modalidad_val,
        'funciones_especiales': catalogo_ticket.funciones_especiales,
        'servicio_id': suscripcion_id,
        'cliente_id': suscripcion.cliente_id if hasattr(suscripcion, 'cliente') else None,
        'ticket_id': ticket.id,
    })

    # Si la automatización es remota inmediata, marcar como liquidado
    if automation_result.get('status') == 'success' and automation_result.get('automation_type') == 'remote_immediate':
        ticket.estado = 'liquidado'
        ticket.fecha_liquidacion = timezone.now()
        ticket.save(update_fields=['estado', 'fecha_liquidacion'])
        
        # Ejecutar acciones específicas según el tipo de ticket
        if catalogo_ticket.nombre_ticket.lower() in ('activación lógica', 'activacion logica'):
            suscripcion.estado_servicio = 'activo'
            suscripcion.fecha_instalacion = timezone.now().date()
            suscripcion.save(update_fields=['estado_servicio', 'fecha_instalacion'])
        
        # Guardar archivo de liquidación descriptiva automatizada en disco
        try:
            import json
            from pathlib import Path
            from django.conf import settings
            
            base = Path(settings.MEDIA_ROOT) / 'tickets' / str(ticket.id)
            base.mkdir(parents=True, exist_ok=True)
            liq_path = base / 'liquidacion.json'
            
            solucion_msg = automation_result.get('actions_executed', [{}])[0].get('description', 'Automatización remota completada')
            
            payload = {
                'ticket_id': ticket.id,
                'tipo': 'DESCRIPTIVA',
                'titulo_problema': titulo_problema,
                'problema': descripcion_problema,
                'titulo_solucion': 'Aprovisionamiento Remoto Completado',
                'solucion': solucion_msg,
                'materiales': [],
                'total_materiales': 0.0,
                'personal_id': datos.get('personal_id'),
                'evidencia_url': None,
                'fecha': timezone.now().isoformat(),
            }
            liq_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
            
            ticket.direccion_antigua_historica = f'LIQ: {descripcion_problema[:200]}'[:255]
            ticket.save(update_fields=['direccion_antigua_historica'])
        except Exception:
            pass
    
    return {
        'ticket_id': ticket.id,
        'estado': ticket.estado_ticket,
        'tipo_ticket': categoria_val.upper(),
        'catalogo_ticket': catalogo_ticket.nombre_ticket,
        'modalidad': modalidad_val.upper(),
        'titulo_problema': titulo_problema,
        'fecha_creacion': ticket.fecha_creacion.isoformat(),
    }



def _determinar_tipo_ticket_enum(catalogo_ticket):
    """
    Determina el valor del enum tipo_ticket basado en el catálogo.
    Mapea los tickets del catálogo a los valores del enum legacy.
    """
    categoria = catalogo_ticket.categoria.lower()
    nombre = catalogo_ticket.nombre_ticket.lower()
    
    # Mapeo basado en categoría y nombre del ticket
    if 'instalación' in nombre or 'instalacion' in nombre:
        return 'INSTALACION'
    elif 'corte' in nombre or 'retención' in nombre or 'retencion' in nombre:
        return 'CORTE'
    elif 'reconexión' in nombre or 'reconexion' in nombre:
        return 'RECONEXION'
    elif 'retiro lógico' in nombre or 'retiro logico' in nombre:
        return 'RETIRO_LOGICO'
    elif 'retiro materiales' in nombre or 'materiales' in nombre:
        return 'RETIRO_MATERIALES'
    elif 'traslado externo' in nombre:
        return 'TRASLADO_EXTERNO'
    elif 'cambio equipo' in nombre or 'cambio de equipo' in nombre:
        return 'CAMBIO_EQUIPO'
    elif 'avería' in categoria or 'averia' in categoria:
        return 'AVERIA_PLANTA_INTERNA'
    else:
        # Por defecto para incidencias y requerimientos
        return 'PERMISOS'


def sistema_obtener_modalidad_ticket(catalogo_ticket_id):
    """
    Obtiene la modalidad (Remoto/Campo) de un ticket del catálogo.
    Útil para pre-llenar el formulario de generación de tickets.
    """
    try:
        catalogo_ticket = CatalogoTickets.objects.get(
            id=catalogo_ticket_id,
            activo=True
        )
        return {
            'modalidad': catalogo_ticket.modalidad,
            'cobra_materiales': catalogo_ticket.cobra_materiales_liquidar,
            'editar_mapa': catalogo_ticket.editar_mapa,
            'funciones_especiales': catalogo_ticket.funciones_especiales,
        }
    except CatalogoTickets.DoesNotExist:
        return None

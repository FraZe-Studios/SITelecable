"""
MOTOR DE AUTOMATIZACIÓN DE TICKETS OPERATIVOS

Este módulo centraliza la lógica de automatización para tickets operativos,
implementando dos tipos de automatizaciones:
1. Automatización Remota Inmediata (CERO CAMPO)
2. Automatización por Trigger de Liquidación (POST-CAMPO)

REGLAS DE DETECCIÓN Y EJECUCIÓN AUTOMÁTICA:
- Tickets con Modalidad "Remoto" y nombre específico → Automatización remota inmediata
- Tickets específicos al liquidarse → Trigger de liquidación
- Tickets con "NO" en FUNCIONES ESPECIALES → Flujo manual estándar
"""

from typing import Dict, Any, Optional
from enum import Enum


class AutomationType(Enum):
    """Tipos de automatización de tickets"""
    REMOTE_IMMEDIATE = "remote_immediate"  # Automatización remota inmediata (CERO CAMPO)
    LIQUIDATION_TRIGGER = "liquidation_trigger"  # Trigger de liquidación (POST-CAMPO)
    MANUAL = "manual"  # Flujo manual estándar


class TicketAutomationEngine:
    """
    Motor centralizado de automatización de tickets operativos.
    
    Este motor detecta automáticamente qué tipo de automatización aplicar
    basándose en las características del ticket y ejecuta las acciones
    correspondientes de forma centralizada.
    """
    
    # Tickets que requieren automatización remota inmediata (CERO CAMPO)
    REMOTE_IMMEDIATE_TICKETS = {
        "Activación lógica",
        "Configuración remota",
        "Reinicio lógico",
    }
    
    # Tickets que requieren trigger de liquidación (POST-CAMPO)
    LIQUIDATION_TRIGGER_TICKETS = {
        "Instalación",
        "Instalacion",
        "Migracion de plan",
        "Migración de plan",
        "Retiro de Materiales",
        "Retiro de materiales",
        "Corte temporal",
        "Corte Temporal",
        "Morosidad",
        "Corte definitivo",
        "Corte Definitivo",
        "Instalación de anexo",
        "Instalacion de anexo",
        "Corte de anexo",
    }
    
    # Tickets con funciones especiales (requieren flujo manual estándar)
    SPECIAL_FUNCTIONS_TICKETS = {
        "Cambio de equipo",
        "Instalación de anexo",
        "Traslado externo",
        "Expansión de red",
        "Instalación de NAP",
        "Cambio de poste",
        "Tendido de fibra",
        "Reubicación de red",
        "Instalación de mufa",
        "Auditoría técnica",
        "Retiro Lógico",
    }
    
    @classmethod
    def detect_automation_type(cls, ticket_data: Dict[str, Any]) -> AutomationType:
        """
        Detecta el tipo de automatización requerido para un ticket.
        
        Args:
            ticket_data: Diccionario con datos del ticket (modalidad, nombre, funciones_especiales, genera_merma)
            
        Returns:
            AutomationType: Tipo de automatización requerido
        """
        modalidad = ticket_data.get('modalidad', '').strip()
        nombre_ticket = ticket_data.get('nombre', '').strip()
        funciones_especiales = ticket_data.get('funciones_especiales', '').strip()
        genera_merma = bool(ticket_data.get('genera_merma', False))
        categoria = ticket_data.get('categoria', '').strip().lower()
        
        # Si explícitamente genera merma, es automatización por trigger de liquidación
        if genera_merma or nombre_ticket == "Retiro de Materiales":
            return AutomationType.LIQUIDATION_TRIGGER
            
        # Si es uno de los tickets con automatización por trigger de liquidación conocida, o es categoría/nombre instalación
        if nombre_ticket in cls.LIQUIDATION_TRIGGER_TICKETS or categoria == 'instalacion' or 'instalacion' in nombre_ticket.lower() or 'instalación' in nombre_ticket.lower():
            return AutomationType.LIQUIDATION_TRIGGER
        
        # REGLA 1: Tickets con funciones especiales → Flujo manual estándar
        if nombre_ticket in cls.SPECIAL_FUNCTIONS_TICKETS or funciones_especiales != 'NO':
            return AutomationType.MANUAL
        
        # REGLA 2: Automatización remota inmediata (CERO CAMPO)
        # Aplica a tickets con Modalidad "Remoto" que requieren acciones lógicas sobre la red
        if modalidad == 'Remoto' and nombre_ticket in cls.REMOTE_IMMEDIATE_TICKETS:
            return AutomationType.REMOTE_IMMEDIATE
        
        # Por defecto, flujo manual estándar
        return AutomationType.MANUAL
    
    @classmethod
    def execute_remote_immediate_automation(cls, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ejecuta automatización remota inmediata (CERO CAMPO).
        
        Esta automatización se ejecuta de forma 100% automatizada a través de
        APIs de aprovisionamiento sin enviar técnicos a campo.
        
        Tickets aplicables:
        - "Activación lógica": Cambia el estado del cliente en el core del sistema
        - "Configuración remota": Modifica parámetros técnicos en la OLT/Router
        - "Reinicio lógico": Envía comando de refresco de señal o IP al equipo del cliente
        
        Args:
            ticket_data: Diccionario con datos del ticket
            
        Returns:
            Dict con resultado de la automatización
        """
        nombre_ticket = ticket_data.get('nombre', '').strip()
        servicio_id = ticket_data.get('servicio_id')
        cliente_id = ticket_data.get('cliente_id')
        
        result = {
            'status': 'success',
            'automation_type': 'remote_immediate',
            'actions_executed': []
        }
        
        try:
            if nombre_ticket == "Activación lógica":
                # Cambia el estado del cliente en el core del sistema de forma automática
                result['actions_executed'].append({
                    'action': 'activate_client_in_core',
                    'description': 'Activación lógica del cliente en el sistema core',
                    'servicio_id': servicio_id,
                    'cliente_id': cliente_id
                })
                # Aquí iría la llamada real a la API del core del sistema
                # core_api.activate_client(servicio_id)
                
            elif nombre_ticket == "Configuración remota":
                # Modifica parámetros técnicos en la OLT/Router de forma directa
                result['actions_executed'].append({
                    'action': 'configure_olt_router',
                    'description': 'Configuración remota de parámetros técnicos en OLT/Router',
                    'servicio_id': servicio_id
                })
                # Aquí iría la llamada real a la API de aprovisionamiento
                # provisioning_api.configure_olt(servicio_id, params)
                
            elif nombre_ticket == "Reinicio lógico":
                # Envía comando inmediato de refresco de señal o IP al equipo del cliente
                result['actions_executed'].append({
                    'action': 'refresh_signal_ip',
                    'description': 'Reinicio lógico: refresco de señal o IP al equipo del cliente',
                    'servicio_id': servicio_id
                })
                # Aquí iría la llamada real a la API de aprovisionamiento
                # provisioning_api.refresh_signal(servicio_id)
            
            return result
            
        except Exception as e:
            return {
                'status': 'error',
                'automation_type': 'remote_immediate',
                'error': str(e)
            }
    
    @classmethod
    def execute_liquidation_trigger_automation(cls, ticket_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ejecuta automatización por trigger de liquidación (POST-CAMPO).
        
        Esta automatización se ejecuta en el segundo exacto en que un usuario
        o técnico presiona el botón "Liquidar" en ciertos tickets específicos.
        
        Tickets aplicables:
        - "Instalación": Dispara aprovisionamiento y activación final de servicios
        - "Migracion de plan": Corta plan antiguo y activa nuevo perfil de velocidad
        - "Retiro de Materiales": Genera ticket secundario de "Entrada de Merma"
        
        Args:
            ticket_data: Diccionario con datos del ticket
            
        Returns:
            Dict con resultado de la automatización
        """
        nombre_ticket = ticket_data.get('nombre', '').strip()
        categoria = ticket_data.get('categoria', '').strip().lower()
        servicio_id = ticket_data.get('servicio_id')
        plan_id = ticket_data.get('plan_id')
        cliente_id = ticket_data.get('cliente_id')
        
        result = {
            'status': 'success',
            'automation_type': 'liquidation_trigger',
            'actions_executed': []
        }
        
        try:
            if nombre_ticket in ("Instalación", "Instalacion") or categoria == 'instalacion' or 'instalacion' in nombre_ticket.lower() or 'instalación' in nombre_ticket.lower():
                # Al liquidarse en campo, dispara automáticamente el aprovisionamiento
                # y la activación final de los servicios en los sistemas de red
                result['actions_executed'].append({
                    'action': 'provision_services',
                    'description': 'Aprovisionamiento y activación final de servicios tras instalación',
                    'servicio_id': servicio_id,
                    'plan_id': plan_id
                })
                # Aquí iría la llamada real a la API de aprovisionamiento
                # provisioning_api.activate_services(servicio_id, plan_id)
                
            elif nombre_ticket in ("Migracion de plan", "Migración de plan"):
                # El sistema automatiza el cambio manteniendo el plan anterior
                # congelado como historial estático. Al liquidar, corta el plan antiguo
                # y activa el nuevo perfil de velocidad en tiempo real
                # Existing migrate_plan handling
                result['actions_executed'].append({
                    'action': 'migrate_plan',
                    'description': 'Migración de plan: corte de plan antiguo y activación de nuevo perfil',
                    'servicio_id': servicio_id,
                    'plan_id': plan_id,
                    'cliente_id': cliente_id
                })
                # New handling for Cambio de equipo (generar orden adicional)
                if nombre_ticket.lower() == 'cambio de equipo' or nombre_ticket.lower() == 'cambio equipo':
                    result['actions_executed'].append({
                        'action': 'derive_cambio_equipo',
                        'description': 'Genera orden adicional de Cambio de equipo al liquidar',
                        'servicio_id': servicio_id,
                        'cliente_id': cliente_id,
                        'ticket_origen_id': ticket_data.get('ticket_id')
                    })
                # Mantiene equipo: flag no action needed but record for audit
                if nombre_ticket.lower() == 'mantiene equipo':
                    result['actions_executed'].append({
                        'action': 'mantener_equipo',
                        'description': 'Mantiene el equipo anterior sin reemplazo',
                        'servicio_id': servicio_id
                    })
                # Editar mapa: update coordinates if provided (handled elsewhere)
                if nombre_ticket.lower() == 'editar mapa':
                    result['actions_executed'].append({
                        'action': 'editar_mapa',
                        'description': 'Actualiza posición NAP del cliente',
                        'servicio_id': servicio_id,
                        'nueva_latitud': ticket_data.get('gps_latitud') or ticket_data.get('latitud'),
                        'nueva_longitud': ticket_data.get('gps_longitud') or ticket_data.get('longitud')
                    })
                # Aquí iría la llamada real a la API del core del sistema
                # core_api.migrate_plan(servicio_id, plan_id, keep_history=True)
                
            # Retiro de Materiales o cualquier ticket con genera_merma habilitado
            if bool(ticket_data.get('genera_merma', False)) or nombre_ticket in ("Retiro de Materiales", "Retiro de materiales"):
                # Al cerrar la orden de campo en Planta Externa, el sistema genera
                # automáticamente un ticket secundario e independiente de "Entrada de Merma"
                # en el módulo de inventario/almacén para control de hardware recuperado
                result['actions_executed'].append({
                    'action': 'create_merma_ticket',
                    'description': 'Generación automática de ticket de Entrada de Merma en inventario',
                    'ticket_origen_id': ticket_data.get('ticket_id'),
                    'cliente_id': cliente_id
                })
            
            return result
            
        except Exception as e:
            return {
                'status': 'error',
                'automation_type': 'liquidation_trigger',
                'error': str(e)
            }
    
    @classmethod
    def execute_automation(cls, ticket_data: Dict[str, Any], trigger_event: str = 'creation') -> Dict[str, Any]:
        """
        Ejecuta la automatización correspondiente basándose en el tipo de ticket y evento.
        
        Args:
            ticket_data: Diccionario con datos del ticket
            trigger_event: Evento que dispara la automatización ('creation' o 'liquidation')
            
        Returns:
            Dict con resultado de la automatización
        """
        automation_type = cls.detect_automation_type(ticket_data)
        
        if automation_type == AutomationType.MANUAL:
            return {
                'status': 'manual',
                'automation_type': 'manual',
                'message': 'Este ticket sigue el flujo operativo estándar (manual)'
            }
        
        if trigger_event == 'creation' and automation_type == AutomationType.REMOTE_IMMEDIATE:
            return cls.execute_remote_immediate_automation(ticket_data)
        
        if trigger_event == 'liquidation' and automation_type == AutomationType.LIQUIDATION_TRIGGER:
            return cls.execute_liquidation_trigger_automation(ticket_data)
        
        return {
            'status': 'no_action',
            'automation_type': automation_type.value,
            'message': f'No se requiere automatización para el evento {trigger_event}'
        }


# Funciones de conveniencia para uso en views
def execute_ticket_automation_on_creation(ticket_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ejecuta automatización al crear un ticket.
    
    Esta función se llama automáticamente cuando se crea un nuevo ticket
    para determinar si requiere automatización remota inmediata.
    """
    return TicketAutomationEngine.execute_automation(ticket_data, trigger_event='creation')


def execute_ticket_automation_on_liquidation(ticket_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ejecuta automatización al liquidar un ticket.
    
    Esta función se llama automáticamente cuando se liquida un ticket
    para determinar si requiere trigger de liquidación.
    """
    return TicketAutomationEngine.execute_automation(ticket_data, trigger_event='liquidation')


def verificar_plazos_cortes_temporales():
    """
    Verifica los plazos de cortes temporales (clientes en estado suspendido).
    Genera notificaciones de llamada a los 83 días (1 semana antes) y
    tickets de Retiro Lógico y Retiro de Materiales a los 90 días (3 meses).
    """
    from django.utils import timezone
    from datetime import timedelta
    from decimal import Decimal
    from core.models.models_generados import (
        ServiciosAbonados, AuditoriaCambios, TareasLlamadas, TicketsOrdenes, Usuario
    )

    # 1. Obtener todos los servicios suspendidos activos
    suspendidos = ServiciosAbonados.objects.filter(estado_servicio='suspendido', activo=True)
    
    for sub in suspendidos:
        try:
            # 2. Buscar la fecha de suspensión en AuditoriaCambios
            audito = AuditoriaCambios.objects.filter(
                nombre_tabla='servicios_abonados',
                registro_id=sub.id,
                valores_nuevos__estado_servicio='suspendido'
            ).order_by('-fecha_evento').first()
            
            if audito:
                fecha_suspension = audito.fecha_evento
            else:
                # Fallback a fecha_actualizacion o fecha_creacion
                fecha_suspension = sub.fecha_actualizacion or sub.fecha_creacion or timezone.now()
            
            dias_transcurridos = (timezone.now() - fecha_suspension).days
            
            # Alerta/Notificación: 83 días (1 semana antes de los 90 días)
            if 83 <= dias_transcurridos < 90:
                # Verificar si ya existe una tarea de llamada reciente para evitar duplicar
                existe_llamada = TareasLlamadas.objects.filter(
                    servicio=sub,
                    estado_contacto='pendiente',
                    observaciones__icontains='Corte Temporal'
                ).exists()
                
                if not existe_llamada:
                    # Asignar a un usuario ATC o administrador disponible
                    empleado = (
                        Usuario.objects.filter(rol='atc', activo=True).first() or 
                        Usuario.objects.filter(rol='tac', activo=True).first() or 
                        Usuario.objects.filter(activo=True).first()
                    )
                    if empleado:
                        TareasLlamadas.objects.create(
                            servicio=sub,
                            empleado=empleado,
                            estado_contacto='pendiente',
                            fecha_asignacion=timezone.now(),
                            fecha_vencimiento_tarea=timezone.now() + timedelta(days=2),
                            observaciones=f"Notificación obligatoria antes del retiro: El cliente tiene {dias_transcurridos} días en suspensión por corte temporal. Consultar si reactivará el servicio para suspender el plazo de espera."
                        )
            
            # Generar tickets de retiro y dar de baja: 90 días o más
            elif dias_transcurridos >= 90:
                # Verificar si ya existen tickets de Retiro Lógico o de Materiales
                existe_retiro = TicketsOrdenes.objects.filter(
                    servicio=sub,
                    categoria='baja',
                    nombre_ticket__in=['Retiro Lógico', 'Retiro de Materiales']
                ).exists()
                
                if not existe_retiro:
                    # Crear primero el Retiro Lógico (modalidad remoto)
                    ticket_logico = TicketsOrdenes.objects.create(
                        servicio=sub,
                        categoria='baja',
                        area='planta_interna',
                        tecnologia='todos',
                        modalidad='remoto',
                        nombre_ticket='Retiro Lógico',
                        estado='pendiente',
                        prioridad='media',
                        precio_base=Decimal('0.00'),
                        fecha_creacion=timezone.now(),
                        notas=f"Generado automáticamente por el sistema tras cumplirse el plazo de 3 meses ({dias_transcurridos} días) en suspensión por corte temporal."
                    )
                    
                    # Crear luego el Retiro de Materiales (modalidad campo)
                    ticket_materiales = TicketsOrdenes.objects.create(
                        servicio=sub,
                        categoria='baja',
                        area='planta_externa',
                        tecnologia='todos',
                        modalidad='campo',
                        nombre_ticket='Retiro de Materiales',
                        estado='pendiente',
                        prioridad='media',
                        precio_base=Decimal('0.00'),
                        fecha_creacion=timezone.now(),
                        notas=f"Generado automáticamente por el sistema tras cumplirse el plazo de 3 meses ({dias_transcurridos} días) en suspensión por corte temporal y posterior al Retiro Lógico."
                    )
                    
                    # Cambiar estado del servicio a baja
                    sub.estado_servicio = 'baja'
                    sub.save(update_fields=['estado_servicio'])
        except Exception:
            # Continuar con el siguiente para evitar que falle todo el ciclo
            continue

# -*- coding: utf-8 -*-
"""
Utilidades para generar codigos unicos para clientes, servicios, tickets y personal.

Sistema de codificacion:
- Codigo de cliente: A00000001 (sin sector) o PREFIJO-A00000001 (con sector)
- Codigo de servicio: S1-PREFIJO-A00000001
- Codigo de ticket: prefijo + A00000001 (ej: INS000001)
- Codigo de personal: SATC000001, ATC000001, TAC000001, VEN000001, etc.
"""

from core.models.abonados import Abonados
from core.models.infraestructura import Sectores
from core.models.suscripciones import ServiciosAbonados


def resolver_sector_servicio(suscripcion):
    """
    Resuelve el sector real del servicio para codigos y reportes.

    Prioridad:
    1. Sector detectado por GPS dentro de un poligono activo.
    2. Sector vinculado a la caja NAP asignada.
    3. Sector activo de la sede del plan.
    """
    if not suscripcion:
        return None

    if suscripcion.latitud is not None and suscripcion.longitud is not None:
        from core.abonados.geoutils import buscar_sector_por_gps
        sector_gps = buscar_sector_por_gps(suscripcion.latitud, suscripcion.longitud)
        if sector_gps:
            return sector_gps

    if suscripcion.caja_nap and suscripcion.caja_nap.sector:
        return suscripcion.caja_nap.sector

    sede_id = getattr(getattr(suscripcion, 'plan', None), 'sede_id', None)
    if sede_id:
        return Sectores.objects.filter(sede_id=sede_id, activo=True).first()

    return None


def generar_codigo_cliente(abonado_id, sector_prefijo=None):
    """
    Genera el codigo de cliente segun el formato especificado.

    Args:
        abonado_id: ID del abonado
        sector_prefijo: Prefijo del sector (opcional)

    Returns:
        Codigo del cliente en formato A00000001 o PREFIJO-A00000001
    """
    id_str = str(abonado_id).zfill(8)

    if sector_prefijo:
        return f"{sector_prefijo.upper()}-A{id_str}"
    return f"A{id_str}"


def generar_codigo_servicio(suscripcion_id, sector_prefijo=None):
    """
    Genera el codigo de servicio segun el formato especificado.

    Args:
        suscripcion_id: ID de la suscripcion
        sector_prefijo: Prefijo del sector (opcional)

    Returns:
        Codigo del servicio en formato S1-PREFIJO-A00000001
    """
    id_str = str(suscripcion_id).zfill(8)

    if sector_prefijo:
        return f"S1-{sector_prefijo.upper()}-A{id_str}"
    return f"S1-A-{id_str}"


def generar_codigo_ticket(ticket_id, tipo_ticket):
    """
    Genera el codigo de ticket segun el formato especificado.

    Args:
        ticket_id: ID del ticket
        tipo_ticket: Tipo de ticket (ej: INSTALACION, ATENCION, VENTA, etc.)

    Returns:
        Codigo del ticket en formato prefijo+A0000001 (ej: INS000001)
    """
    prefijos_ticket = {
        'INSTALACION': 'INS',
        'ATENCION': 'ATE',
        'VENTA': 'VEN',
        'MODIFICACION': 'MOD',
        'ACTUALIZACION': 'ACT',
        'INCIDENCIA': 'INC',
        'MANTENIMIENTO': 'MAN',
        'REPARACION': 'REP',
    }

    prefijo = prefijos_ticket.get(tipo_ticket.upper(), 'INC')
    id_str = str(ticket_id).zfill(7)

    return f"{prefijo}{id_str}"


def generar_codigo_personal(personal_id, cargo):
    """
    Genera el codigo de personal segun el formato especificado.

    Args:
        personal_id: ID del personal
        cargo: Cargo del personal (ej: SATC, ATC, TAC, VENDEDOR, etc.)

    Returns:
        Codigo del personal en formato SATC000001, ATC000001, TAC000001, VEN000001, etc.
    """
    prefijos_cargo = {
        'SATC': 'SATC',
        'ATC': 'ATC',
        'TAC': 'TAC',
        'VENDEDOR': 'VEN',
        'TECNICO': 'TEC',
        'ADMINISTRADOR': 'ADM',
        'SUPERVISOR': 'SUP',
    }

    prefijo = prefijos_cargo.get(cargo.upper(), 'PER')
    id_str = str(personal_id).zfill(6)

    return f"{prefijo}{id_str}"


def obtener_codigo_cliente_actualizado(abonado):
    """
    Obtiene el codigo de cliente actualizado segun el sector real del servicio.
    """
    sub = abonado.suscripciones.filter(activo=True).first()
    sector = resolver_sector_servicio(sub)
    sector_prefijo = sector.prefijo_comercial if sector else None

    return generar_codigo_cliente(abonado.id, sector_prefijo)


def obtener_codigo_servicio_actualizado(suscripcion):
    """
    Obtiene el codigo de servicio actualizado segun el sector real del servicio.
    """
    sector = resolver_sector_servicio(suscripcion)
    sector_prefijo = sector.prefijo_comercial if sector else None

    return generar_codigo_servicio(suscripcion.id, sector_prefijo)


def obtener_codigo_ticket_actualizado(ticket):
    """
    Obtiene el codigo de ticket actualizado segun el sistema de codificacion.
    """
    tipo_ticket = ticket.categoria or ticket.tipo_ticket or 'INCIDENCIA'
    return generar_codigo_ticket(ticket.id, tipo_ticket)

"""
Permisos de edición en ficha de abonado y tickets.
"""

CARGOS_EDITAR_CLIENTE = frozenset({
    'ADMIN', 'ATC', 'SUPERVISOR_ATC', 'JEFE_TAC', 'TAC',
    'NOC', 'JEFE_NOC', 'TEC', 'JEFE_TEC', 'VENTAS',
})

CARGOS_EDITAR_SERVICIO = frozenset({
    'ADMIN', 'JEFE_TAC', 'JEFE_TEC', 'JEFE_NOC', 'TAC', 'NOC',
})

CARGOS_LIQUIDAR_TICKET = frozenset({
    'ADMIN', 'TAC', 'NOC', 'JEFE_TAC', 'JEFE_NOC', 'JEFE_TEC',
})

CARGOS_COBRAR = frozenset({
    'ADMIN', 'ATC', 'TAC', 'SUPERVISOR_ATC', 'JEFE_TAC',
})


def puede_editar_cliente(cargo):
    return (cargo or '').upper() in CARGOS_EDITAR_CLIENTE


def puede_editar_servicio(cargo, catalogo_ticket=None):
    cargo_upper = (cargo or '').upper()
    if cargo_upper not in CARGOS_EDITAR_SERVICIO:
        return False
    if catalogo_ticket and getattr(catalogo_ticket, 'requiere_nuevo_suministro', False):
        return cargo_upper in ('ADMIN', 'JEFE_TAC', 'JEFE_TEC')
    return True


def puede_liquidar_ticket(cargo):
    return (cargo or '').upper() in CARGOS_LIQUIDAR_TICKET


def puede_registrar_pago(cargo):
    return (cargo or '').upper() in CARGOS_COBRAR


def contexto_permisos_ficha(cargo):
    return {
        'editar_cliente': puede_editar_cliente(cargo),
        'editar_servicio': puede_editar_servicio(cargo),
        'liquidar_ticket': puede_liquidar_ticket(cargo),
        'registrar_pago': puede_registrar_pago(cargo),
        'es_tecnico': (cargo or '').upper() in ('TEC', 'JEFE_TEC', 'ADMIN'),
    }

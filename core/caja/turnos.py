"""
Gestión de caja y turnos para cobros de abonados.
"""
from decimal import Decimal

from django.utils import timezone

# from core.models.models_generados import CajasSedesMaestro, Personal, TurnosCaja
# TODO: Estos modelos son dummy en la nueva base de datos, necesitan ser reemplazados por los modelos correctos


def sistema_obtener_caja_sede(sede_id):
    # TODO: CajasSedesMaestro es un modelo dummy en la nueva base de datos
    # Necesita ser reemplazado por el modelo correcto
    return None


def sistema_turno_abierto(personal_id, sede_id=None):
    # TODO: TurnosCaja es un modelo dummy en la nueva base de datos
    # Necesita ser reemplazado por el modelo correcto
    return None


def sistema_abrir_turno(personal_id, sede_id, monto_apertura=0):
    # TODO: TurnosCaja es un modelo dummy en la nueva base de datos
    # Necesita ser reemplazado por el modelo correcto
    return None


def sistema_estado_turno_vendedor(personal_id, sede_id):
    # TODO: TurnosCaja y Personal son modelos dummy en la nueva base de datos
    # Necesitan ser reemplazados por los modelos correctos
    return {
        'turno_abierto': False,
        'turno_id': None,
        'mensaje': 'Función deshabilitada temporalmente - modelos dummy',
    }


def sistema_validar_metodo_pago(personal_id, caja_sede, metodo_db):
    """
    metodo_db: EFECTIVO o TRANSFERENCIA (YAPE/MIXTO se mapean antes de llamar).
    """
    # TODO: Personal es un modelo dummy en la nueva base de datos
    # Necesita ser reemplazado por el modelo correcto
    return True, 'Validación deshabilitada temporalmente'

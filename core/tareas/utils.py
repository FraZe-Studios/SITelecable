from datetime import date
from calendar import monthrange

def calcularfechavencimiento(servicio, hoy: date):
    """
    Calcula la próxima fecha de vencimiento del ciclo de pago de un servicio.
    Devuelve (fecha_limite: date, dias_restantes: int, tipo_ciclo: str) o None si no aplica.
    """
    plan = servicio.plan
    if not plan:
        return None

    tipo_ciclo = (plan.dia_vencimiento or '').strip().lower()

    if tipo_ciclo == 'fin_mes':
        ultimo_dia = monthrange(hoy.year, hoy.month)[1]
        fecha_limite = date(hoy.year, hoy.month, ultimo_dia)
    elif tipo_ciclo == 'fecha_instalacion':
        fecha_inst = servicio.fecha_instalacion
        if not fecha_inst:
            return None
        dia_inst = fecha_inst.day
        ultimo_dia_mes = monthrange(hoy.year, hoy.month)[1]
        dia_uso = min(dia_inst, ultimo_dia_mes)
        fecha_limite = date(hoy.year, hoy.month, dia_uso)
        if fecha_limite < hoy:
            if hoy.month == 12:
                fecha_limite = date(hoy.year + 1, 1, min(dia_inst, monthrange(hoy.year + 1, 1)[1]))
            else:
                siguiente_mes = hoy.month + 1
                fecha_limite = date(hoy.year, siguiente_mes, min(dia_inst, monthrange(hoy.year, siguiente_mes)[1]))
    else:
        return None

    dias_restantes = (fecha_limite - hoy).days
    return fecha_limite, dias_restantes, tipo_ciclo

def urgencianivel(dias_restantes):
    """Devuelve el nivel de urgencia según días restantes."""
    if dias_restantes < 0:
        return 'VENCIDA'
    elif dias_restantes <= 1:
        return 'CRITICO'
    elif dias_restantes <= 3:
        return 'URGENTE'
    elif dias_restantes <= 7:
        return 'ALERTA'
    else:
        return 'NORMAL'

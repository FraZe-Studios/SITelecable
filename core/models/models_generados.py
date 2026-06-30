# -*- coding: utf-8 -*-
# Forwarding compatibility layer for models_generados.py
# Re-exports all manually defined models and compatibility aliases.

from .soft_delete import SoftDeleteModel
from .usuarios import Usuario, Usuarios
from .abonados import Abonados
from .infraestructura import (
    Sedes, Sectores, Hubs, FibrasOpticas, Mufas, CajasNap
)
from .planes import Planes
from .suscripciones import ServiciosAbonados
from .facturacion import CajaMovimientos, FacturacionPagos, Cajas
from .tareas import TareasLlamadas
from .cache import CacheDni, CacheRuc, CacheSuministro
from .tickets import TicketsOrdenes, TicketsPlantillas
from .compat import *
from .auditoria import AuditoriaCambios

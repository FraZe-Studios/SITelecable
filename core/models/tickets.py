from django.db import models
from decimal import Decimal

class TicketsPlantillas(models.Model):
    id = models.AutoField(primary_key=True)
    nombre_ticket = models.CharField(max_length=200)
    categoria = models.CharField(max_length=30)
    area = models.CharField(max_length=30)
    tecnologia = models.CharField(max_length=30)
    modalidad = models.CharField(max_length=30)
    precio_base = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    configuracion_reglas = models.JSONField(default=dict, blank=True)
    funciones_especiales = models.JSONField(default=dict, blank=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'tickets_plantillas'
        db_table_comment = 'Catálogo maestro de tipos de tickets y sus plantillas de configuración'


class TicketsOrdenes(models.Model):
    id = models.AutoField(primary_key=True)
    servicio = models.ForeignKey('ServiciosAbonados', models.DO_NOTHING, blank=True, null=True)
    plantilla = models.ForeignKey(TicketsPlantillas, models.DO_NOTHING, db_column='plantilla_id')
    correlativo_ticket = models.IntegerField(default=0)
    codigo_ticket = models.CharField(max_length=50, blank=True, null=True)
    
    # Campos alineados estrictamente con tipos ENUM acotados de PostgreSQL
    categoria = models.CharField(max_length=30)  # categoria_ticket (instalacion, incidencia, averia, etc)
    area = models.CharField(max_length=30)       # area_ticket (planta_interna, planta_externa)
    tecnologia = models.CharField(max_length=30) # tecnologia_ticket (internet, tv, duo, todos)
    modalidad = models.CharField(max_length=30)  # modalidad_ticket (remoto, campo, presencial)
    nombre_ticket = models.CharField(max_length=200)
    estado = models.CharField(max_length=30, default='pendiente') # estado_ticket
    prioridad = models.CharField(max_length=30, default='media')   # prioridad_ticket
    
    precio_base = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Matrices modulares JSONB indexadas por GIN en la base de datos
    configuracion_reglas = models.JSONField(default=dict, blank=True)
    funciones_especiales = models.JSONField(default=dict, blank=True)
    
    empleado_atc_generador = models.ForeignKey('Usuario', models.DO_NOTHING, blank=True, null=True)
    tecnico_asignado_id = models.IntegerField(blank=True, null=True)
    ruta_foto_evidencia = models.TextField(blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    
    # Fechas configuradas bajo TIMESTAMPTZ nativo con zona horaria
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)
    fecha_completado = models.DateTimeField(blank=True, null=True)

    # Getters and setters for non-existent database fields stored in JSONB
    def _get_config_value(self, key, default=None):
        if not self.configuracion_reglas:
            return default
        return self.configuracion_reglas.get(key, default)

    def _set_config_value(self, key, value):
        if self.configuracion_reglas is None:
            self.configuracion_reglas = {}
        self.configuracion_reglas[key] = value

    # Helper methods for funciones_especiales
    def _get_funcion_especial(self, funcion_key):
        if not self.funciones_especiales:
            self.funciones_especiales = self._get_default_funciones_especiales()
        return self.funciones_especiales.get(funcion_key, {})

    def _set_funcion_especial(self, funcion_key, data):
        if self.funciones_especiales is None:
            self.funciones_especiales = self._get_default_funciones_especiales()
        self.funciones_especiales[funcion_key] = data

    def _get_default_funciones_especiales(self):
        return {
            "cambio_equipo": {
                "activado": False,
                "fecha_activacion": None,
                "equipo_anterior": None,
                "equipo_nuevo": None,
                "motivo": None,
                "estado": "pendiente"
            },
            "migracion_plan": {
                "activado": False,
                "fecha_activacion": None,
                "plan_anterior_id": None,
                "plan_nuevo_id": None,
                "fecha_corte": None,
                "fecha_activacion_nuevo": None,
                "estado": "pendiente"
            },
            "instalacion": {
                "activado": False,
                "fecha_activacion": None,
                "fecha_inicio": None,
                "fecha_fin": None,
                "tecnico_id": None,
                "estado": "pendiente"
            },
            "cobra_materiales": {
                "activado": False,
                "fecha_activacion": None,
                "materiales": [],
                "monto_total": 0.00,
                "estado": "pendiente"
            },
            "editar_mapa": {
                "activado": False,
                "fecha_activacion": None,
                "nap_id": None,
                "coordenadas_anteriores": None,
                "coordenadas_nuevas": None,
                "estado": "pendiente"
            },
            "mantiene_equipo": {
                "activado": False,
                "fecha_activacion": None,
                "equipo_mantenido": None,
                "estado": "pendiente"
            },
            "nuevo_suministro": {
                "activado": False,
                "fecha_activacion": None,
                "suministro_anterior": None,
                "suministro_nuevo": None,
                "estado": "pendiente"
            },
            "genera_merma": {
                "activado": False,
                "fecha_activacion": None,
                "materiales_merma": [],
                "motivo": None,
                "autorizado_por": None,
                "estado": "pendiente"
            },
            "corte_temporal": {
                "activado": False,
                "fecha_activacion": None,
                "fecha_reconexion": None,
                "motivo": None,
                "estado": "pendiente"
            },
            "morosidad": {
                "activado": False,
                "fecha_activacion": None,
                "dias_mora": None,
                "monto_deuda": None,
                "estado": "pendiente"
            },
            "corte_definitivo": {
                "activado": False,
                "fecha_activacion": None,
                "motivo": None,
                "fecha_retiro_equipo": None,
                "estado": "pendiente"
            },
            "instalacion_anexo": {
                "activado": False,
                "fecha_activacion": None,
                "tipo_anexo": None,
                "costo_mensual": None,
                "es_gratis_registro": False,
                "estado": "pendiente"
            },
            "corte_anexo": {
                "activado": False,
                "fecha_activacion": None,
                "anexo_id": None,
                "motivo": None,
                "estado": "pendiente"
            }
        }

    def activar_funcion(self, funcion_key, **kwargs):
        from django.utils import timezone
        funcion_data = self._get_funcion_especial(funcion_key)
        funcion_data['activado'] = True
        funcion_data['fecha_activacion'] = timezone.now().isoformat()
        funcion_data['estado'] = 'en_proceso'
        funcion_data.update(kwargs)
        self._set_funcion_especial(funcion_key, funcion_data)
        self.save(update_fields=['funciones_especiales'])

    def actualizar_estado_funcion(self, funcion_key, estado, **kwargs):
        funcion_data = self._get_funcion_especial(funcion_key)
        funcion_data['estado'] = estado
        funcion_data.update(kwargs)
        self._set_funcion_especial(funcion_key, funcion_data)
        self.save(update_fields=['funciones_especiales'])

    def completar_funcion(self, funcion_key, **kwargs):
        from django.utils import timezone
        funcion_data = self._get_funcion_especial(funcion_key)
        funcion_data['estado'] = 'completado'
        funcion_data.update(kwargs)
        self._set_funcion_especial(funcion_key, funcion_data)
        self.save(update_fields=['funciones_especiales'])

    @property
    def funcion_especial(self):
        return self._get_config_value('funcion_especial', '')

    @funcion_especial.setter
    def funcion_especial(self, value):
        self._set_config_value('funcion_especial', value)

    @property
    def modalidad_solucion(self):
        return self._get_config_value('modalidad_solucion', '')

    @modalidad_solucion.setter
    def modalidad_solucion(self, value):
        self._set_config_value('modalidad_solucion', value)

    @property
    def titulo_solucion_remota(self):
        return self._get_config_value('titulo_solucion_remota', '')

    @titulo_solucion_remota.setter
    def titulo_solucion_remota(self, value):
        self._set_config_value('titulo_solucion_remota', value)

    @property
    def descripcion_cierre_remoto(self):
        return self._get_config_value('descripcion_cierre_remoto', '')

    @descripcion_cierre_remoto.setter
    def descripcion_cierre_remoto(self, value):
        self._set_config_value('descripcion_cierre_remoto', value)

    @property
    def tac_noc_atendio(self):
        from .usuarios import Usuario
        uid = self._get_config_value('tac_noc_atendio_id')
        if uid:
            try:
                return Usuario.objects.get(pk=uid)
            except Usuario.DoesNotExist:
                return None
        return None

    @tac_noc_atendio.setter
    def tac_noc_atendio(self, value):
        if value:
            self._set_config_value('tac_noc_atendio_id', value.id if hasattr(value, 'id') else int(value))
        else:
            if self.configuracion_reglas:
                self.configuracion_reglas.pop('tac_noc_atendio_id', None)

    @property
    def despachador_noc_cierre(self):
        from .usuarios import Usuario
        uid = self._get_config_value('despachador_noc_cierre_id')
        if uid:
            try:
                return Usuario.objects.get(pk=uid)
            except Usuario.DoesNotExist:
                return None
        return None

    @despachador_noc_cierre.setter
    def despachador_noc_cierre(self, value):
        if value:
            self._set_config_value('despachador_noc_cierre_id', value.id if hasattr(value, 'id') else int(value))
        else:
            if self.configuracion_reglas:
                self.configuracion_reglas.pop('despachador_noc_cierre_id', None)

    @property
    def fecha_programada(self):
        val = self._get_config_value('fecha_programada')
        if val:
            try:
                from django.utils.dateparse import parse_datetime
                if isinstance(val, str):
                    return parse_datetime(val)
                return val
            except Exception:
                return val
        return None

    @fecha_programada.setter
    def fecha_programada(self, value):
        if value:
            if hasattr(value, 'isoformat'):
                self._set_config_value('fecha_programada', value.isoformat())
            else:
                self._set_config_value('fecha_programada', str(value))
        else:
            if self.configuracion_reglas:
                self.configuracion_reglas.pop('fecha_programada', None)

    @property
    def suscripcion(self):
        return self.servicio

    @suscripcion.setter
    def suscripcion(self, value):
        self.servicio = value

    @property
    def catalogo_ticket(self):
        from .compat import CatalogoTickets
        try:
            return CatalogoTickets.objects.filter(nombre_ticket=self.nombre_ticket).first()
        except Exception:
            return None

    @property
    def estado_ticket(self):
        if self.estado == 'completado':
            return 'LIQUIDADO'
        return self.estado.upper() if self.estado else ''

    @estado_ticket.setter
    def estado_ticket(self, value):
        val = str(value).upper() if value else ''
        if val in ('LIQUIDADO', 'COMPLETADO'):
            self.estado = 'completado'
        else:
            self.estado = val.lower()

    @property
    def tipo_ticket(self):
        return self.categoria.upper() if self.categoria else ''

    @tipo_ticket.setter
    def tipo_ticket(self, value):
        self.categoria = value.lower() if value else ''

    @property
    def nombre(self):
        return self.nombre_ticket

    @property
    def catalogo_nombre(self):
        return self.nombre_ticket

    @catalogo_nombre.setter
    def catalogo_nombre(self, value):
        self.nombre_ticket = value

    @property
    def fecha_liquidacion(self):
        return self.fecha_completado

    @fecha_liquidacion.setter
    def fecha_liquidacion(self, value):
        self.fecha_completado = value

    @property
    def rango_atencion(self):
        if not self.fecha_completado or not self.fecha_creacion:
            return "PENDIENTE"
        duration = self.fecha_completado - self.fecha_creacion
        from datetime import timedelta
        if duration <= timedelta(hours=24):
            return "ATENDIDO EN 24 HORAS"
        elif duration <= timedelta(hours=48):
            return "ATENDIDO EN 48 HORAS"
        else:
            return "EXCEDIDO"

    @property
    def tecnico_asignado(self):
        if self.tecnico_asignado_id:
            from .usuarios import Usuario
            try:
                return Usuario.objects.get(pk=self.tecnico_asignado_id)
            except Usuario.DoesNotExist:
                return None
        return None

    def save(self, *args, **kwargs):
        if not self.id:
            from django.db import connection
            with connection.cursor() as cursor:
                try:
                    cursor.execute("SELECT nextval('tickets_ordenes_id_seq');")
                    self.id = cursor.fetchone()[0]
                except Exception:
                    # Fallback for SQLite or systems without sequences
                    max_id = TicketsOrdenes.objects.all().order_by('-id').values_list('id', flat=True).first() or 0
                    self.id = max_id + 1

        if not self.correlativo_ticket:
            self.correlativo_ticket = self.id

        if not self.codigo_ticket:
            from core.abonados.generador import generar_codigo_ticket
            self.codigo_ticket = generar_codigo_ticket(self.id, self.categoria)

        if not self.plantilla_id:
            tpl = TicketsPlantillas.objects.filter(categoria=self.categoria, activo=True).first()
            if not tpl:
                tpl = TicketsPlantillas.objects.filter(activo=True).first()
            if not tpl:
                tpl = TicketsPlantillas.objects.create(
                    nombre_ticket=f"Plantilla {self.categoria.title()}",
                    categoria=self.categoria,
                    area=self.area or 'planta_externa',
                    tecnologia=self.tecnologia or 'todos',
                    modalidad=self.modalidad or 'campo',
                    precio_base=self.precio_base or Decimal('0.00'),
                    activo=True
                )
            self.plantilla = tpl

        cat = str(self.categoria).lower().strip() if self.categoria else ''
        if 'instal' in cat:
            self.categoria = 'instalacion'
        elif 'manten' in cat:
            self.categoria = 'mantenimiento'
        elif 'soport' in cat:
            self.categoria = 'soporte'
        elif 'cambio' in cat or 'migra' in cat:
            self.categoria = 'cambio_plan'
        elif 'traslado' in cat:
            self.categoria = 'traslado'
        elif 'baja' in cat or 'retiro' in cat:
            self.categoria = 'baja'
        elif 'repar' in cat:
            self.categoria = 'reparacion'
        elif 'pirat' in cat:
            self.categoria = 'incidencia'
        elif 'incid' in cat:
            self.categoria = 'incidencia'
        elif 'requer' in cat:
            self.categoria = 'requerimiento'
        elif 'aver' in cat:
            self.categoria = 'averia'
        else:
            self.categoria = 'incidencia'

        ar = str(self.area).lower().strip() if self.area else ''
        if 'extern' in ar or 'campo' in ar:
            self.area = 'planta_externa'
        else:
            self.area = 'planta_interna'

        tec = str(self.tecnologia).lower().strip() if self.tecnologia else ''
        if 'tv' in tec and 'internet' in tec:
            self.tecnologia = 'duo'
        elif 'tv' in tec:
            self.tecnologia = 'tv'
        elif 'internet' in tec or 'fibra' in tec:
            self.tecnologia = 'internet'
        else:
            self.tecnologia = 'todos'

        mod = str(self.modalidad).lower().strip() if self.modalidad else ''
        if 'remot' in mod:
            self.modalidad = 'remoto'
        else:
            self.modalidad = 'campo'

        est = str(self.estado).lower().strip() if self.estado else ''
        if est in ('liquidado', 'completado', 'cerrado'):
            self.estado = 'completado'
        elif est == 'asignado':
            self.estado = 'asignado'
        elif est in ('en_proceso', 'proceso'):
            self.estado = 'en_proceso'
        elif est in ('cancelado', 'anulado'):
            self.estado = 'cancelado'
        elif est in ('en_espera', 'espera'):
            self.estado = 'en_espera'
        else:
            self.estado = 'pendiente'

        prio = str(self.prioridad).lower().strip() if self.prioridad else ''
        if prio in ('baja', 'media', 'alta', 'critica'):
            self.prioridad = prio
        else:
            self.prioridad = 'media'

        if not self.configuracion_reglas:
            self.configuracion_reglas = {
                "permisos": {
                    "editar_mapa": False,
                    "mantiene_equipo_anterior": False,
                    "cobra_materiales_liquidar": False,
                    "requiere_nuevo_suministro": False,
                    "bloqueo_comercial_atc": False
                },
                "automatizacion_sistema": {
                    "es_automatico": False,
                    "comando_olt_core": None,
                    "requiere_api_externa": False
                }
            }

        super().save(*args, **kwargs)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'tickets_ordenes'
        db_table_comment = 'Tickets con soporte para solución remota y en campo'
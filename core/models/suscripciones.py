from django.db import models
from .soft_delete import SoftDeleteModel

class ServiciosAbonados(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    cliente = models.ForeignKey('Abonados', models.DO_NOTHING, db_column='abonado_id', related_name='suscripciones')
    caja_nap = models.ForeignKey('CajasNap', models.DO_NOTHING)
    plan = models.ForeignKey('Planes', models.DO_NOTHING)
    codigo = models.CharField(unique=True, max_length=50)
    numero_suministro = models.CharField(unique=True, max_length=20)
    
    # Columnas estructurales nativas recuperadas del esquema físico core
    numero_contrato = models.CharField(max_length=50, unique=True, blank=True, null=True)
    codigo_precinto = models.CharField(max_length=50, blank=True, null=True)
    router_serie = models.CharField(max_length=100, blank=True, null=True)
    router_mac = models.CharField(max_length=17, blank=True, null=True)
    vendedora = models.ForeignKey('Usuario', models.DO_NOTHING, blank=True, null=True, db_column='vendedora_id')
    
    direccion_servicio = models.TextField()
    distrito = models.CharField(max_length=100)
    provincia = models.CharField(max_length=100)
    departamento = models.CharField(max_length=100)
    deuda_acumulada = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    latitud = models.DecimalField(max_digits=10, decimal_places=8, blank=True, null=True)
    longitud = models.DecimalField(max_digits=11, decimal_places=8, blank=True, null=True)
    
    # Campo JSONB nativo modular con índice GIN en motor relacional
    control_operativo_json = models.JSONField(blank=True, null=True, default=dict)
    
    # Enum nativo de PostgreSQL: activo, suspendido, cortado, pendiente_instalacion, baja
    estado_servicio = models.CharField(max_length=30)  
    
    fecha_instalacion = models.DateField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    # Legacy compatibility properties
    @property
    def abonado(self):
        return self.cliente

    @property
    def codigo_servicio(self):
        return self.codigo

    @property
    def nap(self):
        return self.caja_nap

    @property
    def estado(self):
        return self.estado_servicio.upper() if self.estado_servicio else ""

    @property
    def gps_latitud(self):
        return self.latitud

    @property
    def gps_longitud(self):
        return self.longitud

    @property
    def gps_link(self):
        if self.latitud and self.longitud:
            return f"https://www.google.com/maps/search/?api=1&query={self.latitud},{self.longitud}"
        return ""

    @property
    def id_suscripcion(self):
        return self.id

    @property
    def estado_suscripcion(self):
        return self.estado_servicio.upper() if self.estado_servicio else ""

    @estado_suscripcion.setter
    def estado_suscripcion(self, value):
        if value:
            self.estado_servicio = value.lower()
        else:
            self.estado_servicio = 'activo'

    @property
    def fecha_contrato(self):
        return self.fecha_instalacion

    @fecha_contrato.setter
    def fecha_contrato(self, value):
        self.fecha_instalacion = value

    @property
    def suministro(self):
        return self

    @property
    def vendedor_original(self):
        return self.vendedora

    # Getters and setters for technical data stored in JSONB control_operativo_json
    def _get_dato_tecnico(self, key, default='—'):
        if not self.control_operativo_json or not isinstance(self.control_operativo_json, dict):
            return default
        datos = self.control_operativo_json.get('datos_tecnicos', {})
        if not isinstance(datos, dict):
            return default
        return datos.get(key, default)

    def _set_dato_tecnico(self, key, value):
        if not self.control_operativo_json or not isinstance(self.control_operativo_json, dict):
            self.control_operativo_json = {}
        if 'datos_tecnicos' not in self.control_operativo_json or not isinstance(self.control_operativo_json['datos_tecnicos'], dict):
            self.control_operativo_json['datos_tecnicos'] = {}
        self.control_operativo_json['datos_tecnicos'][key] = value

    @property
    def referencia_domicilio(self):
        return self._get_dato_tecnico('referencia_domicilio', '—')

    @referencia_domicilio.setter
    def referencia_domicilio(self, value):
        self._set_dato_tecnico('referencia_domicilio', value)

    @property
    def observaciones(self):
        return self._get_dato_tecnico('observaciones', '—')

    @observaciones.setter
    def observaciones(self, value):
        self._set_dato_tecnico('observaciones', value)

    @property
    def presinto_numero(self):
        return self._get_dato_tecnico('presinto_numero', '—')

    @presinto_numero.setter
    def presinto_numero(self, value):
        self._set_dato_tecnico('presinto_numero', value)

    @property
    def puerto_nap(self):
        return self._get_dato_tecnico('puerto_nap', '—')

    @puerto_nap.setter
    def puerto_nap(self, value):
        self._set_dato_tecnico('puerto_nap', value)

    @property
    def hub_borne_referencia(self):
        return self._get_dato_tecnico('hub_borne_referencia', '—')

    @hub_borne_referencia.setter
    def hub_borne_referencia(self, value):
        self._set_dato_tecnico('hub_borne_referencia', value)

    @property
    def numero_anexos(self):
        return self._get_dato_tecnico('numero_anexos', 0)

    @numero_anexos.setter
    def numero_anexos(self, value):
        self._set_dato_tecnico('numero_anexos', value)

    @property
    def router_modelo(self):
        return self._get_dato_tecnico('router_modelo', '—')

    @router_modelo.setter
    def router_modelo(self, value):
        self._set_dato_tecnico('router_modelo', value)

    @property
    def modelo_equipo(self):
        return self.router_modelo

    @modelo_equipo.setter
    def modelo_equipo(self, value):
        self.router_modelo = value

    @property
    def fecha_limite_corte(self):
        return self._get_dato_tecnico('fecha_limite_corte', None)

    @fecha_limite_corte.setter
    def fecha_limite_corte(self, value):
        self._set_dato_tecnico('fecha_limite_corte', value)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'servicios_abonados'
        db_table_comment = 'Servicios conectados a abonado y caja_nap con código auto-generado'

    def __str__(self):
        return self.codigo
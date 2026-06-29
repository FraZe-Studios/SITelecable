from django.db import models

class CacheDni(models.Model):
    id = models.AutoField(primary_key=True)
    dni_numero = models.CharField(unique=True, max_length=8) # Alineado con longitud exacta DNI Perú
    nombres = models.CharField(max_length=100, blank=True, null=True)
    apellidos = models.CharField(max_length=100, blank=True, null=True)
    fecha_expiracion = models.DateTimeField() # Tipo TIMESTAMPTZ implícito en el ORM
    fecha_consulta = models.DateTimeField(blank=True, null=True)
    datos_json = models.JSONField(blank=True, null=True) # Mapeo JSONB nativo de la SUNAT/RENIEC

    # Legacy compatibility properties
    @property
    def dni(self):
        return self.dni_numero

    @property
    def nombres_apellidos(self):
        return f"{self.nombres or ''} {self.apellidos or ''}".strip()

    @property
    def raw_response_json(self):
        return self.datos_json

    @property
    def ultima_actualizacion(self):
        return self.fecha_consulta

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'cache_dni'


class CacheRuc(models.Model):
    id = models.AutoField(primary_key=True)
    ruc_numero = models.CharField(unique=True, max_length=11) # Alineado con longitud exacta RUC
    razon_social = models.CharField(max_length=200, blank=True, null=True)
    fecha_expiracion = models.DateTimeField()
    fecha_consulta = models.DateTimeField(blank=True, null=True)
    datos_json = models.JSONField(blank=True, null=True)

    # Legacy compatibility properties
    @property
    def ruc(self):
        return self.ruc_numero

    @property
    def raw_response_json(self):
        return self.datos_json

    @property
    def ultima_actualizacion(self):
        return self.fecha_consulta

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'cache_ruc'


class CacheSuministro(models.Model):
    id = models.AutoField(primary_key=True)
    numero_suministro = models.CharField(unique=True, max_length=50)
    tipo_suministro = models.CharField(max_length=50, blank=True, null=True)
    estado_suministro = models.CharField(max_length=50, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    departamento = models.CharField(max_length=50, blank=True, null=True)
    provincia = models.CharField(max_length=50, blank=True, null=True)
    distrito = models.CharField(max_length=50, blank=True, null=True)
    # Coordenadas DECIMAL para soporte transicional sin alterar el rendimiento del mapa
    latitud = models.DecimalField(max_digits=10, decimal_places=8, blank=True, null=True)
    longitud = models.DecimalField(max_digits=11, decimal_places=8, blank=True, null=True)
    fecha_expiracion = models.DateTimeField()
    fecha_consulta = models.DateTimeField(blank=True, null=True)
    datos_json = models.JSONField(blank=True, null=True)

    # Legacy compatibility properties
    @property
    def gps_latitud(self):
        return self.latitud

    @property
    def gps_longitud(self):
        return self.longitud

    @property
    def raw_response_json(self):
        return self.datos_json

    @property
    def ultima_actualizacion(self):
        return self.fecha_consulta

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'cache_suministro'
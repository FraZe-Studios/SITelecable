from django.db import models
from .soft_delete import SoftDeleteModel

class Ruc(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    ruc_numero = models.CharField(unique=True, max_length=11)
    razon_social = models.CharField(max_length=200)
    direccion_fiscal = models.TextField()
    telefono_celular = models.CharField(max_length=20, blank=True, null=True)
    ruta_logo_boleta = models.TextField(blank=True, null=True)
    ruta_contrato_base_pdf = models.TextField(blank=True, null=True)
    ruta_certificado_p12 = models.TextField(blank=True, null=True)
    password_certificado_p12 = models.TextField(blank=True, null=True)
    usuario_sol = models.CharField(max_length=50, blank=True, null=True)
    password_sol = models.CharField(max_length=50, blank=True, null=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'ruc'
        db_table_comment = 'Información fiscal consolidada con relación flexible a sedes'

    def __str__(self):
        return f"{self.ruc_numero} - {self.razon_social}"

    @property
    def logo_url(self):
        return self.ruta_logo_boleta or ''

    @logo_url.setter
    def logo_url(self, value):
        self.ruta_logo_boleta = value

    @property
    def numero_ruc(self):
        return self.ruc_numero

    @numero_ruc.setter
    def numero_ruc(self, value):
        self.ruc_numero = value

    @property
    def certificado_p12(self):
        return self.ruta_certificado_p12 or ''

    @certificado_p12.setter
    def certificado_p12(self, value):
        self.ruta_certificado_p12 = value

    @property
    def clave_certificado(self):
        return self.password_certificado_p12 or ''

    @clave_certificado.setter
    def clave_certificado(self, value):
        self.password_certificado_p12 = value

    @property
    def clave_sol(self):
        return self.password_sol or ''

    @clave_sol.setter
    def clave_sol(self, value):
        self.password_sol = value

    @property
    def monto_recaudado_mes(self):
        return getattr(self, '_monto_recaudado_mes', 0.0)

    @monto_recaudado_mes.setter
    def monto_recaudado_mes(self, value):
        self._monto_recaudado_mes = float(value) if value is not None else 0.0

    @property
    def monto_recaudado_anio(self):
        return getattr(self, '_monto_recaudado_anio', 0.0)

    @monto_recaudado_anio.setter
    def monto_recaudado_anio(self, value):
        self._monto_recaudado_anio = float(value) if value is not None else 0.0

    @property
    def limite_mensual_boletas(self):
        return getattr(self, '_limite_mensual_boletas', 600000.00)

    @limite_mensual_boletas.setter
    def limite_mensual_boletas(self, value):
        self._limite_mensual_boletas = float(value) if value is not None else 600000.00

    @property
    def limite_mensual_facturas(self):
        return getattr(self, '_limite_mensual_facturas', 1200000.00)

    @limite_mensual_facturas.setter
    def limite_mensual_facturas(self, value):
        self._limite_mensual_facturas = float(value) if value is not None else 1200000.00


class RucSedes(models.Model):
    id = models.AutoField(primary_key=True)
    ruc = models.ForeignKey(Ruc, models.DO_NOTHING)
    sede = models.ForeignKey('Sedes', models.DO_NOTHING)
    fecha_vinculacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    
    permite_boleta = models.BooleanField(default=True)
    permite_factura = models.BooleanField(default=True)
    permite_nota_venta = models.BooleanField(default=True)
    permite_nota_deuda = models.BooleanField(default=True)
    formato_impresion = models.CharField(max_length=10, default='A4')
    logo_url = models.CharField(max_length=255, blank=True, null=True)
    contrato_pdf_path = models.CharField(max_length=255, blank=True, null=True)
    limite_recaudacion_mensual = models.DecimalField(max_digits=15, decimal_places=2, default=600000.00)
    prefijo_boleta = models.CharField(max_length=4, default='B001')
    prefijo_factura = models.CharField(max_length=4, default='F001')
    numero_actual_boleta = models.IntegerField(default=1)
    numero_actual_factura = models.IntegerField(default=1)
    activo = models.BooleanField(default=True)
    vinculado = models.BooleanField(default=True)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'ruc_sedes'
        unique_together = (('ruc', 'sede'),)
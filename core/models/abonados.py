from django.db import models
from .soft_delete import SoftDeleteModel

class Abonados(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    tipo_cliente = models.CharField(max_length=8)  # natural or juridico (Alineado a tipo_cliente_abonado)
    dni = models.CharField(unique=True, max_length=8, blank=True, null=True)
    ruc = models.CharField(unique=True, max_length=11, blank=True, null=True)
    nombres_apellidos = models.CharField(max_length=100, blank=True, null=True)
    razon_social = models.CharField(max_length=200, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    estado_civil = models.CharField(max_length=20, blank=True, null=True) # Alineado a tipo enum estado_civil
    celular_1 = models.CharField(max_length=20)
    celular_2 = models.CharField(max_length=20, blank=True, null=True)
    correo = models.CharField(max_length=100)
    direccion_fiscal = models.TextField()
    documentos_digitalizados = models.TextField(blank=True, null=True)
    empleado_firma = models.ForeignKey('Usuario', models.DO_NOTHING, blank=True, null=True)
    datos_adicionales_json = models.JSONField(default=dict, blank=True) # Mapeo de escalabilidad JSONB nativo
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    @property
    def tiene_deuda_activa(self):
        # pyrefly: ignore [missing-attribute]
        from datetime import date
        from core.models.models_generados import FacturacionPagos
        import re
        
        subs = list(self.suscripciones.all())
        sub_ids = [s.id for s in subs]
        if not sub_ids:
            return False
            
        overdue_cargos = FacturacionPagos.objects.filter(
            servicio_id__in=sub_ids,
            tipo_transaccion='cargo',
            fecha_vencimiento__lt=date.today(),
            monto__gt=0
        )
        if not overdue_cargos.exists():
            return False
            
        abonos = FacturacionPagos.objects.filter(
            servicio_id__in=sub_ids,
            tipo_transaccion='abono'
        )
        pagados_ids = set()
        for ab in abonos:
            match = re.search(r'\[PAGO_CARGO_ID:\s*(\d+)\]', ab.descripcion or '')
            if match:
                pagados_ids.add(int(match.group(1)))
                
        for cargo in overdue_cargos:
            if cargo.id not in pagados_ids:
                return True
                
        return False

    @property
    def id_cliente_codigo(self):
        # pyrefly: ignore [missing-import]
        from core.abonados.generador import obtener_codigo_cliente_actualizado
        return obtener_codigo_cliente_actualizado(self)

    # Compatibility properties (formerly monkey patches)
    @property
    def nombre_apellidos(self):
        return str(self.nombres_apellidos or self.razon_social or '')

    @property
    def dni_ruc(self):
        return self.dni if self.tipo_cliente == 'natural' else self.ruc

    @property
    def email(self):
        return self.correo

    @property
    def telefono1(self):
        return self.celular_1

    @property
    def telefono2(self):
        return self.celular_2

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'abonados'
        db_table_comment = 'Registro único de identidad natural o jurídica'

    def __str__(self):
        return self.nombre_apellidos
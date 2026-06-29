from django.db import models

class CajaMovimientos(models.Model):
    id = models.AutoField(primary_key=True)
    sede = models.ForeignKey('Sedes', models.DO_NOTHING)
    usuario = models.ForeignKey('Usuario', models.DO_NOTHING)
    tipo_movimiento = models.CharField(max_length=20)  # entrada_pago, salida_gasto (Alineado a tipo_movimiento_caja)
    metodo_pago = models.CharField(max_length=20)  # efectivo, transferencia, otros (Alineado a metodo_pago_caja)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    ruta_evidencia = models.TextField(blank=True, null=True)
    descripcion = models.TextField(blank=True, null=True)
    fecha_movimiento = models.DateTimeField(auto_now_add=True)  # Tipo TIMESTAMPTZ implícito con zona horaria
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'caja_movimientos'
        db_table_comment = 'Movimientos de caja diaria asociados a sedes and usuarios'


class Cajas(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    sede = models.ForeignKey('Sedes', models.DO_NOTHING)
    tipo_ubicacion = models.CharField(max_length=20)  # ENUM: tipo_ubicacion_caja
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    @property
    def configuracion_recaudo(self):
        import json
        from pathlib import Path
        from django.conf import settings
        
        path = Path(settings.BASE_DIR) / 'cajas_config.json'
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return data.get(str(self.id), {
                    "efectivo": True,
                    "transferencia": True
                })
            except Exception:
                pass
        return {
            "efectivo": True,
            "transferencia": True
        }

    @configuracion_recaudo.setter
    def configuracion_recaudo(self, value):
        import json
        from pathlib import Path
        from django.conf import settings
        
        path = Path(settings.BASE_DIR) / 'cajas_config.json'
        data = {}
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                pass
        
        data[str(self.id)] = {
            "efectivo": bool(value.get("efectivo", True)),
            "transferencia": bool(value.get("transferencia", True))
        }
        
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'cajas'
        db_table_comment = 'Estructura de cajas por sedes'


class FacturacionPagos(models.Model):
    id = models.AutoField(primary_key=True)
    servicio = models.ForeignKey('ServiciosAbonados', models.DO_NOTHING, related_name='deudas')
    ruc_emisor = models.ForeignKey('Ruc', models.DO_NOTHING)
    caja = models.ForeignKey(Cajas, models.DO_NOTHING, blank=True, null=True)
    usuario = models.ForeignKey('Usuario', models.DO_NOTHING, blank=True, null=True, db_column='usuario_id')
    tipo_documento = models.CharField(max_length=20)  # boleta, factura, nota_venta (Alineado a tipo_documento_fiscal)
    numero_documento = models.CharField(max_length=50, blank=True, null=True)
    tipo_transaccion = models.CharField(max_length=30)  # cargo, abono, ajuste_comercial, descuento, exoneracion
    metodo_pago = models.CharField(max_length=20, blank=True, null=True)  # efectivo, yape, plin, tarjeta, etc.
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    saldo_anterior = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    saldo_posterior = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    descripcion = models.TextField(blank=True, null=True)
    descuento_pago_anticipado = models.BooleanField(default=False, blank=True, null=True)
    exoneracion_deuda = models.BooleanField(default=False, blank=True, null=True)
    cuota_mensual_indexada = models.BooleanField(default=False, blank=True, null=True)
    numero_cuota = models.IntegerField(blank=True, null=True)
    vendedor = models.ForeignKey('Usuario', models.DO_NOTHING, blank=True, null=True, related_name='ventas_facturacion')
    fecha_transaccion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_vencimiento = models.DateField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)

    # Legacy compatibility properties
    @property
    def monto_original(self):
        return self.monto

    @property
    def monto_actual(self):
        return self.monto

    @property
    def concepto(self):
        return self.descripcion

    @property
    def cliente_id(self):
        return self.servicio.abonado.id_cliente_codigo if self.servicio and self.servicio.abonado else None

    @property
    def suministro_id(self):
        return self.servicio.numero_suministro if self.servicio else None

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'facturacion_pagos'
        db_table_comment = 'Historial financiero transaccional vinculado a servicios'
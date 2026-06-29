from django.db import models

class AuditoriaCambios(models.Model):
    id = models.AutoField(primary_key=True)
    nombre_tabla = models.CharField(max_length=100)
    registro_id = models.IntegerField()
    tipo_operacion = models.CharField(max_length=20)  # INSERT, UPDATE, DELETE (Alineado con el esquema SQL)
    usuario = models.ForeignKey('Usuario', models.SET_NULL, blank=True, null=True) # Soporta operaciones del sistema (null)
    fecha_evento = models.DateTimeField(auto_now_add=True)  # Equivalente a TIMESTAMPTZ con DEFAULT CURRENT_TIMESTAMP
    valores_antiguos = models.JSONField(blank=True, null=True) # Mapeo JSONB exacto
    valores_nuevos = models.JSONField(blank=True, null=True)  # Mapeo JSONB exacto
    columna_modificada = models.CharField(max_length=100, blank=True, null=True)
    contexto_operativo = models.TextField(blank=True, null=True)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'auditoria_cambios'
        db_table_comment = 'Tabla centralizada de auditoría que registra todos los cambios en tablas críticas del negocio'

    def __str__(self):
        return f"{self.tipo_operacion} en {self.nombre_tabla} (ID: {self.registro_id})"
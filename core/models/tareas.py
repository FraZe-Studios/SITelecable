from django.db import models

class TareasLlamadas(models.Model):
    id = models.AutoField(primary_key=True)
    servicio = models.ForeignKey('ServiciosAbonados', models.DO_NOTHING)
    empleado = models.ForeignKey('Usuario', models.DO_NOTHING)
    
    # Enum nativo de PostgreSQL: pendiente, notificado, mensaje_voz, sms, whatsapp, no_contesto, llamo_otro_numero, corto_llamada
    estado_contacto = models.CharField(max_length=30, default='pendiente')  
    
    observaciones = models.TextField(blank=True, null=True)
    fecha_asignacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)  # TIMESTAMPTZ nativo
    fecha_ejecucion = models.DateTimeField(blank=True, null=True)                      # TIMESTAMPTZ nativo
    fecha_vencimiento_tarea = models.DateTimeField()                                   # TIMESTAMPTZ nativo

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'tareas_llamadas'
        db_table_comment = 'Gestión operativa de llamadas de cobranza vinculada a servicios y ATC'

    def __str__(self):
        return f"Tarea {self.id} - Servicio: {self.servicio_id} ({self.estado_contacto})"
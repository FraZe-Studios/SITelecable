from django.db import models
from django.core.exceptions import ValidationError
from .soft_delete import SoftDeleteModel

class Materiales(SoftDeleteModel):
    """
    Modelo de Catálogo de Materiales y Equipos
    Soporta dos tipos: equipo y material
    """
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=200)
    
    # Enum nativo de PostgreSQL: equipo, materiales
    tipo_material = models.CharField(
        max_length=20,
        help_text='Tipo de material: equipo, materiales'
    )
    
    # Campos de identificación para equipos
    requiere_mac = models.BooleanField(
        default=False,
        help_text='Indica si el material requiere dirección MAC'
    )
    requiere_serie = models.BooleanField(
        default=False,
        help_text='Indica si el material requiere número de serie'
    )
    
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    def clean(self):
        """
        Validación de campos según tipo de material
        """
        super().clean()
        
        # Validar tipo_material
        tipos_validos = ['equipo', 'materiales']
        if self.tipo_material not in tipos_validos:
            raise ValidationError({
                'tipo_material': f'Tipo de material inválido. Debe ser uno de: {", ".join(tipos_validos)}'
            })

    def save(self, *args, **kwargs):
        """
        Sobrescritura de save para ejecutar validaciones
        """
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'materiales'
        db_table_comment = 'Catálogo de materiales y equipos con precios y metrajes'
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} ({self.tipo_material})"
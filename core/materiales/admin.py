from django.contrib import admin
from core.models.materiales import Materiales

@admin.register(Materiales)
class MaterialesAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'tipo_material', 'requiere_mac', 'requiere_serie', 'activo']
    list_filter = ['tipo_material', 'activo']
    search_fields = ['nombre', 'descripcion']
    list_editable = ['activo']
    readonly_fields = ['fecha_creacion', 'fecha_actualizacion']
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('nombre', 'tipo_material', 'descripcion', 'activo')
        }),
        ('Identificación', {
            'fields': ('requiere_mac', 'requiere_serie')
        }),
        ('Auditoría', {
            'fields': ('fecha_creacion', 'fecha_actualizacion'),
            'classes': ('collapse',)
        })
    )

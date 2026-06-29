from django.db import models
from django.core.exceptions import ValidationError
from .soft_delete import SoftDeleteModel

class Planes(SoftDeleteModel):
    """
    Modelo de Planes Comerciales de la Sede
    Soporta características técnicas flexibles mediante JSONB y validaciones transaccionales
    """
    id = models.AutoField(primary_key=True)
    sede = models.ForeignKey('Sedes', models.DO_NOTHING)
    nombre = models.CharField(max_length=100)
    
    # Enum nativo de PostgreSQL: internet, tv, duo, app, servicio
    tipo_servicio = models.CharField(max_length=20)  # internet, tv, duo, app, servicio (Alineado a tipo_servicio)
    tipo_cliente = models.CharField(max_length=20)   # residencial, corporativo (Alineado a tipo_cliente)
    
    costo_mensual = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Columna JSONB para características técnicas flexibles con estructura modular (Regla C5)
    caracteristicas_tecnicas_json = models.JSONField(
        default=dict,
        blank=True,
        help_text='JSONB modular dinámico: {"caracteristicas_base": {"velocidad_mbps": 100, "cantidad_canales": 120}, "activacion_funciones": {"admite_prorrogas": true, "compromisos_pago_flexibles": false, "bloqueo_automatico_mora": true, "prioridad_soporte_critica": false}, "permisos_formularios": {"requiere_api_externa_olt": false, "permite_cambio_mufa_campo": true}}'
    )
    
    # Campos legacy para compatibilidad (se sincronizan con JSONB)
    velocidad_mbps = models.IntegerField(blank=True, null=True)
    canales = models.IntegerField(blank=True, null=True)
    
    # Reglas de cobro y pago (almacenados en caracteristicas_tecnicas_json)
    dia_vencimiento = models.CharField(max_length=20)  # fin_mes, fecha_instalacion (Alineado a dia_vencimiento)
    dias_gracia = models.IntegerField(default=0, blank=True, null=True)
    
    descripcion = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    # Legacy compatibility properties
    @property
    def velocidad(self):
        return f"{self.velocidad_mbps} Mbps" if self.velocidad_mbps else ""

    @velocidad.setter
    def velocidad(self, value):
        if isinstance(value, int):
            self.velocidad_mbps = value
        elif isinstance(value, str):
            import re
            m = re.search(r'\d+', value)
            if m:
                self.velocidad_mbps = int(m.group(0))

    @property
    def nombre_plan(self):
        return self.nombre

    @nombre_plan.setter
    def nombre_plan(self, value):
        self.nombre = value

    @property
    def costo_plan(self):
        return self.costo_mensual

    @costo_plan.setter
    def costo_plan(self, value):
        self.costo_mensual = value

    @property
    def cantidad_canales_tv(self):
        return self.canales

    @cantidad_canales_tv.setter
    def cantidad_canales_tv(self, value):
        self.canales = value

    @property
    def admite_prorroga(self):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        activacion_funciones = caracteristicas.get('activacion_funciones', {})
        return activacion_funciones.get('admite_prorrogas', False)

    @admite_prorroga.setter
    def admite_prorroga(self, value):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        if 'activacion_funciones' not in caracteristicas:
            caracteristicas['activacion_funciones'] = {}
        caracteristicas['activacion_funciones']['admite_prorrogas'] = value
        self.caracteristicas_tecnicas_json = caracteristicas

    @property
    def admite_prorrateo(self):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        activacion_funciones = caracteristicas.get('activacion_funciones', {})
        return activacion_funciones.get('admite_prorrateo_parcial', True)

    @admite_prorrateo.setter
    def admite_prorrateo(self, value):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        if 'activacion_funciones' not in caracteristicas:
            caracteristicas['activacion_funciones'] = {}
        caracteristicas['activacion_funciones']['admite_prorrateo_parcial'] = value
        self.caracteristicas_tecnicas_json = caracteristicas

    @property
    def configuracion_fecha_pago(self):
        return self.dia_vencimiento

    @configuracion_fecha_pago.setter
    def configuracion_fecha_pago(self, value):
        self.dia_vencimiento = value

    @property
    def dias_amnistia(self):
        return self.dias_gracia

    @dias_amnistia.setter
    def dias_amnistia(self, value):
        self.dias_gracia = value

    @property
    def monto_descuento_pago_anticipado(self):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        activacion_funciones = caracteristicas.get('activacion_funciones', {})
        return activacion_funciones.get('descuento_pago_anticipado_monto', 0.00)

    @monto_descuento_pago_anticipado.setter
    def monto_descuento_pago_anticipado(self, value):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        if 'activacion_funciones' not in caracteristicas:
            caracteristicas['activacion_funciones'] = {}
        caracteristicas['activacion_funciones']['descuento_pago_anticipado_monto'] = value
        self.caracteristicas_tecnicas_json = caracteristicas

    @property
    def dias_anticipacion_descuento(self):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        activacion_funciones = caracteristicas.get('activacion_funciones', {})
        return activacion_funciones.get('descuento_pago_anticipado_dias', 0)

    @dias_anticipacion_descuento.setter
    def dias_anticipacion_descuento(self, value):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        if 'activacion_funciones' not in caracteristicas:
            caracteristicas['activacion_funciones'] = {}
        caracteristicas['activacion_funciones']['descuento_pago_anticipado_dias'] = value
        self.caracteristicas_tecnicas_json = caracteristicas

    @property
    def admite_compromiso_pago(self):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        activacion_funciones = caracteristicas.get('activacion_funciones', {})
        return activacion_funciones.get('compromisos_pago_flexibles', False)

    @admite_compromiso_pago.setter
    def admite_compromiso_pago(self, value):
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        if 'activacion_funciones' not in caracteristicas:
            caracteristicas['activacion_funciones'] = {}
        caracteristicas['activacion_funciones']['compromisos_pago_flexibles'] = value
        self.caracteristicas_tecnicas_json = caracteristicas

    @property
    def extra_data(self):
        if not hasattr(self, '_extra_cache'):
            self._extra_cache = {}
            if self.descripcion and self.descripcion.strip().startswith('{'):
                try:
                    import json
                    self._extra_cache = json.loads(self.descripcion)
                except Exception:
                    pass
        return self._extra_cache

    def save_extra_data(self):
        if hasattr(self, '_extra_cache') and self._extra_cache:
            import json
            self.descripcion = json.dumps(self._extra_cache)

    @property
    def conexiones_tv_gratis(self):
        return self.extra_data.get('conexiones_tv_gratis', 2)

    @conexiones_tv_gratis.setter
    def conexiones_tv_gratis(self, value):
        self.extra_data['conexiones_tv_gratis'] = int(value) if value is not None else 2
        self.save_extra_data()

    @property
    def costo_conexion_tv_adicional(self):
        return self.extra_data.get('costo_conexion_tv_adicional', 0.0)

    @costo_conexion_tv_adicional.setter
    def costo_conexion_tv_adicional(self, value):
        self.extra_data['costo_conexion_tv_adicional'] = float(value) if value is not None else 0.0
        self.save_extra_data()

    # ============================================================================
    # MÉTODOS DE VALIDACIÓN DE CARACTERÍSTICAS TÉCNICAS
    # ============================================================================
    
    def clean(self):
        """
        Validación transaccional de características técnicas según tipo de servicio
        Cumple con las Reglas de Oro (A, B, C, D)
        Estructura JSONB modular: caracteristicas_base, activacion_funciones, permisos_formularios
        """
        super().clean()
        
        tipos_validos = ['internet', 'tv', 'duo', 'app', 'servicio']
        if self.tipo_servicio not in tipos_validos:
            raise ValidationError({
                'tipo_servicio': f'Tipo de servicio inválido. Debe ser uno de: {", ".join(tipos_validos)}'
            })
        
        clientes_validos = ['residencial', 'corporativo']
        if self.tipo_cliente not in clientes_validos:
            raise ValidationError({
                'tipo_cliente': f'Tipo de cliente inválido. Debe ser uno de: {", ".join(clientes_validos)}'
            })
        
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        
        if not isinstance(caracteristicas, dict):
            raise ValidationError({
                'caracteristicas_tecnicas_json': 'El campo debe ser un objeto JSON válido'
            })
        
        caracteristicas_base = caracteristicas.get('caracteristicas_base', {})
        
        if self.tipo_servicio in ['internet', 'duo', 'servicio']:
            if not caracteristicas_base.get('velocidad_mbps'):
                raise ValidationError({
                    'caracteristicas_tecnicas_json': f'Para planes de tipo {self.tipo_servicio} se requiere velocidad_mbps en caracteristicas_base'
                })
        
        if self.tipo_servicio in ['tv', 'duo', 'servicio']:
            if not caracteristicas_base.get('cantidad_canales'):
                raise ValidationError({
                    'caracteristicas_tecnicas_json': f'Para planes de tipo {self.tipo_servicio} se requiere cantidad_canales en caracteristicas_base'
                })
        
        vencimientos_validos = ['fin_mes', 'fecha_instalacion']
        if self.dia_vencimiento not in vencimientos_validos:
            raise ValidationError({
                'dia_vencimiento': f'Día de vencimiento inválido. Debe ser uno de: {", ".join(vencimientos_validos)}'
            })
    
    def save(self, *args, **kwargs):
        """
        Sobrescritura de save para sincronizar campos legacy con JSONB modular
        y garantizar consistencia transaccional
        """
        caracteristicas = self.caracteristicas_tecnicas_json or {}
        
        if self.velocidad_mbps is not None or self.canales is not None:
            if 'caracteristicas_base' not in caracteristicas:
                caracteristicas['caracteristicas_base'] = {}
            if 'activacion_funciones' not in caracteristicas:
                caracteristicas['activacion_funciones'] = {}
            if 'permisos_formularios' not in caracteristicas:
                caracteristicas['permisos_formularios'] = {}
            
            caracteristicas_base = caracteristicas['caracteristicas_base']
            
            if self.velocidad_mbps is not None:
                caracteristicas_base['velocidad_mbps'] = self.velocidad_mbps
            if self.canales is not None:
                caracteristicas_base['cantidad_canales'] = self.canales
            
            if caracteristicas_base.get('velocidad_mbps') is not None:
                self.velocidad_mbps = caracteristicas_base['velocidad_mbps']
            if caracteristicas_base.get('cantidad_canales') is not None:
                self.canales = caracteristicas_base['cantidad_canales']
            
            self.caracteristicas_tecnicas_json = caracteristicas
        
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'planes'
        db_table_comment = 'Planes de servicio asociados a sedes con reglas de cobro'

    def __str__(self):
        return self.nombre
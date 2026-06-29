from decimal import Decimal
from django.db import models
from .soft_delete import SoftDeleteModel, SoftDeleteManager

# ─── CUSTOM MANAGERS FOR LEGACY COMPATIBILITY ──────────────────────────────

class SedesManager(SoftDeleteManager):
    def create(self, *args, **kwargs):
        sector = kwargs.pop('sector', None)
        sector_id = kwargs.pop('sector_id', None)
        instance = super().create(*args, **kwargs)
        if sector:
            sector.sede = instance
            sector.save(update_fields=['sede'])
        elif sector_id:
            from core.models.infraestructura import Sectores
            Sectores.objects.filter(pk=sector_id).update(sede=instance)
        return instance


class SectoresManager(SoftDeleteManager):
    def create(self, *args, **kwargs):
        if 'codigo' in kwargs:
            kwargs['nombre'] = kwargs.pop('codigo')
        if 'prefijo' in kwargs:
            kwargs['prefijo_comercial'] = kwargs.pop('prefijo')
        
        kwargs.pop('latitud_centro', None)
        kwargs.pop('longitud_centro', None)
        if 'coordenadas' in kwargs:
            import json
            coords_val = kwargs.pop('coordenadas')
            try:
                parsed = json.loads(coords_val)
                if isinstance(parsed, list):
                    kwargs['poligono_coordenadas_json'] = parsed
                else:
                    kwargs['poligono_coordenadas_json'] = []
            except Exception:
                kwargs['poligono_coordenadas_json'] = []
        
        if 'sede_id' in kwargs and kwargs['sede_id'] is None:
            kwargs.pop('sede_id')
        if 'sede' not in kwargs and 'sede_id' not in kwargs:
            from core.models.infraestructura import Sedes
            sede = Sedes.objects.first() or Sedes.objects.create(nombre="Sede Central")
            kwargs['sede'] = sede
            
        return super().create(*args, **kwargs)


class HubsManager(SoftDeleteManager):
    def create(self, *args, **kwargs):
        if 'codigo' in kwargs:
            kwargs['nombre'] = kwargs.pop('codigo')
        if 'sede' not in kwargs and 'sede_id' not in kwargs:
            from core.models.infraestructura import Sedes
            sede = Sedes.objects.first() or Sedes.objects.create(nombre="Sede Central")
            kwargs['sede'] = sede
        return super().create(*args, **kwargs)


class FibrasOpticasManager(SoftDeleteManager):
    def create(self, *args, **kwargs):
        if 'codigo_identificador' in kwargs:
            kwargs['nombre'] = kwargs.pop('codigo_identificador')
        if 'hub_id' in kwargs:
            kwargs['hub_origen_id'] = kwargs.pop('hub_id')
        if 'hub_origen_id' in kwargs and kwargs['hub_origen_id'] is None:
            kwargs.pop('hub_origen_id')
        if 'hub_origen' not in kwargs and 'hub_origen_id' not in kwargs:
            from core.models.infraestructura import Hubs
            hub = Hubs.objects.first()
            if not hub:
                from core.models.infraestructura import Sedes
                sede = Sedes.objects.first() or Sedes.objects.create(nombre="Sede Central")
                hub = Hubs.objects.create(sede=sede, nombre="HUB Principal")
            kwargs['hub_origen'] = hub

        import json
        coords_array = []
        if 'coordenadas_ruta' in kwargs:
            coords_val = kwargs.pop('coordenadas_ruta')
            try:
                parsed = json.loads(coords_val)
                if isinstance(parsed, list):
                    coords_array = parsed
            except Exception:
                pass

        # Store metadata in a separate dict if needed, but ruta_coordenadas_json must be an array
        meta_dict = {}
        for key in ['latitud_inicio', 'longitud_inicio', 'latitud_fin', 'longitud_fin', 'cantidad_buffers', 'hilos_por_buffer', 'capacidad_total']:
            if key in kwargs:
                val = kwargs.pop(key)
                if isinstance(val, Decimal):
                    val = float(val)
                meta_dict[key] = val

        # Set ruta_coordenadas_json as array (required by database constraint)
        kwargs['ruta_coordenadas_json'] = coords_array
        
        return super().create(*args, **kwargs)


class MufasManager(SoftDeleteManager):
    def create(self, *args, **kwargs):
        if 'codigo_identificador' in kwargs:
            kwargs['nombre'] = kwargs.pop('codigo_identificador')
        return super().create(*args, **kwargs)


class CajasNapManager(SoftDeleteManager):
    def create(self, *args, **kwargs):
        if 'codigo_identificador' in kwargs:
            kwargs['codigo'] = kwargs.pop('codigo_identificador')
        if 'cantidad_puertos' in kwargs:
            kwargs['capacidad_puertos'] = str(kwargs.pop('cantidad_puertos'))
        if 'capacidad_puertos' not in kwargs:
            kwargs['capacidad_puertos'] = '16'
        if 'estado_precinto' not in kwargs:
            kwargs['estado_precinto'] = 'activo'
        if 'estado_puertos' not in kwargs:
            kwargs['estado_puertos'] = {}
        
        # Validar que el personal asignado tenga habilidades para manipular materiales
        if 'personal_id' in kwargs or 'personal' in kwargs:
            from core.models.usuarios import Usuario

            personal_id = kwargs.get('personal_id')
            if not personal_id and 'personal' in kwargs:
                personal = kwargs['personal']
                if hasattr(personal, 'id'):
                    personal_id = personal.id

            if personal_id:
                try:
                    usuario = Usuario.objects.get(id=personal_id)
                    habilidades_json = usuario.habilidades_json or {}
                    if not habilidades_json.get('puede_omitir_cobro_materiales', False):
                        raise ValueError(
                            f"El personal ID {personal_id} no tiene la habilidad 'puede_omitir_cobro_materiales' "
                            f"requerida para manipular materiales en infraestructura"
                        )
                except Usuario.DoesNotExist:
                    raise ValueError(f"Personal ID {personal_id} no encontrado")
        
        if 'fibra_optica' not in kwargs and 'fibra_optica_id' not in kwargs:
            from core.models.infraestructura import FibrasOpticas
            fibra = FibrasOpticas.objects.first()
            if not fibra:
                from core.models.infraestructura import Hubs
                hub = Hubs.objects.first()
                if not hub:
                    from core.models.infraestructura import Sedes
                    sede = Sedes.objects.first() or Sedes.objects.create(nombre="Sede Central")
                    hub = Hubs.objects.create(sede=sede, nombre="HUB Principal")
                fibra = FibrasOpticas.objects.create(hub_origen=hub, nombre="Fibra Principal")
            kwargs['fibra_optica'] = fibra
        
        if ('sector' not in kwargs or kwargs['sector'] is None) and ('sector_id' not in kwargs or kwargs['sector_id'] is None):
            from core.models.infraestructura import Sectores
            sector = Sectores.objects.first()
            if not sector:
                from core.models.infraestructura import Sedes
                sede = Sedes.objects.first() or Sedes.objects.create(nombre="Sede Central")
                sector = Sectores.objects.create(
                    sede=sede,
                    nombre="Sector Central",
                    prefijo_comercial="CEN",
                    activo=True
                )
            kwargs['sector'] = sector

        instance = super().create(*args, **kwargs)
        instance.refresh_from_db()
        return instance


# ─── MODELS DEFINITION ───────────────────────────────────────────────────────

class Sedes(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)
    latitud = models.DecimalField(max_digits=10, decimal_places=8, blank=True, null=True)
    longitud = models.DecimalField(max_digits=11, decimal_places=8, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)
    objects = SedesManager()

    @property
    def activa(self):
        return self.activo

    @activa.setter
    def activa(self, value):
        self.activo = value

    @property
    def sector(self):
        return self.sectores_set.first()

    @sector.setter
    def sector(self, value):
        if value is not None:
            value.sede = self
            value.save(update_fields=['sede'])

    @property
    def sector_id(self):
        sec = self.sector
        return sec.id if sec else None

    @sector_id.setter
    def sector_id(self, value):
        from core.models.infraestructura import Sectores
        if value is not None:
            sector = Sectores.objects.filter(pk=value).first()
            if sector:
                sector.sede = self
                sector.save(update_fields=['sede'])
            else:
                raise ValueError(f"Sector con ID {value} no encontrado")

    @property
    def telefono(self):
        return "064466080"

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'sedes'
        db_table_comment = 'Sedes operativas con coordenadas latitud/longitud (sin PostGIS)'

    def __str__(self):
        return self.nombre




class Sectores(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    sede = models.ForeignKey(Sedes, models.DO_NOTHING, db_column='sede_id')
    nombre = models.CharField(max_length=100)
    prefijo_comercial = models.CharField(max_length=20)
    poligono_coordenadas_json = models.JSONField(default=list, blank=True, null=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    objects = SectoresManager()

    @property
    def codigo(self):
        return self.nombre
    @codigo.setter
    def codigo(self, val):
        self.nombre = val

    @property
    def prefijo(self):
        return self.prefijo_comercial
    @prefijo.setter
    def prefijo(self, val):
        self.prefijo_comercial = val

    @property
    def coordenadas(self):
        import json
        if self.poligono_coordenadas_json:
            return json.dumps(self.poligono_coordenadas_json)
        return ''
    @coordenadas.setter
    def coordenadas(self, value):
        import json
        try:
            self.poligono_coordenadas_json = json.loads(value)
        except Exception:
            self.poligono_coordenadas_json = []

    @property
    def latitud_centro(self):
        return Decimal('0')
    @latitud_centro.setter
    def latitud_centro(self, value):
        pass

    @property
    def longitud_centro(self):
        return Decimal('0')
    @longitud_centro.setter
    def longitud_centro(self, value):
        pass

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'sectores'
        db_table_comment = 'Sectores geográficos vinculados a sedes (sin perímetro GIS)'

    def __str__(self):
        return self.nombre


class Hubs(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    sede = models.ForeignKey(Sedes, models.DO_NOTHING, db_column='sede_id')
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)
    potencia_optica_salida = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    latitud = models.DecimalField(max_digits=10, decimal_places=8, blank=True, null=True)
    longitud = models.DecimalField(max_digits=11, decimal_places=8, blank=True, null=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    objects = HubsManager()

    @property
    def codigo(self):
        return self.nombre
    @codigo.setter
    def codigo(self, val):
        self.nombre = val

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'hubs'
        db_table_comment = 'Hubs ópticos conectados a sedes con coordenadas latitud/longitud'

    def __str__(self):
        return self.nombre


class FibrasOpticas(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    hub_origen = models.ForeignKey(Hubs, models.DO_NOTHING, db_column='hub_origen_id')
    nombre = models.CharField(max_length=100)
    ruta_coordenadas_json = models.JSONField(default=list, blank=True, null=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    objects = FibrasOpticasManager()

    @property
    def codigo_identificador(self):
        return self.nombre
    @codigo_identificador.setter
    def codigo_identificador(self, val):
        self.nombre = val

    @property
    def hub_id(self):
        return self.hub_origen_id
    @hub_id.setter
    def hub_id(self, val):
        self.hub_origen_id = val

    @property
    def latitud_inicio(self):
        if self.ruta_coordenadas_json and isinstance(self.ruta_coordenadas_json, list) and len(self.ruta_coordenadas_json) > 0:
            return Decimal(str(self.ruta_coordenadas_json[0][0]))
        return Decimal('0')

    @latitud_inicio.setter
    def latitud_inicio(self, value):
        pass  # Cannot set individual coordinates when using array structure

    @property
    def longitud_inicio(self):
        if self.ruta_coordenadas_json and isinstance(self.ruta_coordenadas_json, list) and len(self.ruta_coordenadas_json) > 0:
            return Decimal(str(self.ruta_coordenadas_json[0][1]))
        return Decimal('0')

    @longitud_inicio.setter
    def longitud_inicio(self, value):
        pass  # Cannot set individual coordinates when using array structure

    @property
    def latitud_fin(self):
        if self.ruta_coordenadas_json and isinstance(self.ruta_coordenadas_json, list) and len(self.ruta_coordenadas_json) > 0:
            return Decimal(str(self.ruta_coordenadas_json[-1][0]))
        return Decimal('0')

    @latitud_fin.setter
    def latitud_fin(self, value):
        pass  # Cannot set individual coordinates when using array structure

    @property
    def longitud_fin(self):
        if self.ruta_coordenadas_json and isinstance(self.ruta_coordenadas_json, list) and len(self.ruta_coordenadas_json) > 0:
            return Decimal(str(self.ruta_coordenadas_json[-1][1]))
        return Decimal('0')

    @longitud_fin.setter
    def longitud_fin(self, value):
        pass  # Cannot set individual coordinates when using array structure

    @property
    def cantidad_buffers(self):
        return 1  # Default value, not stored in array structure

    @property
    def quantity_buffers(self):
        return self.cantidad_buffers

    @cantidad_buffers.setter
    def cantidad_buffers(self, value):
        pass  # Not stored in array structure

    @property
    def hilos_por_buffer(self):
        return 12  # Default value, not stored in array structure

    @hilos_por_buffer.setter
    def hilos_por_buffer(self, value):
        pass  # Not stored in array structure

    @property
    def capacidad_total(self):
        return 12  # Default value, not stored in array structure

    @capacidad_total.setter
    def capacidad_total(self, value):
        pass  # Not stored in array structure

    @property
    def coordenadas_ruta(self):
        import json
        if isinstance(self.ruta_coordenadas_json, list):
            return json.dumps(self.ruta_coordenadas_json)
        return json.dumps([])

    @coordenadas_ruta.setter
    def coordenadas_ruta(self, value):
        import json
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                self.ruta_coordenadas_json = parsed
                return
        except Exception:
            pass
        self.ruta_coordenadas_json = []

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'fibras_opticas'
        db_table_comment = 'Tendido físico de red con descripción en texto (sin PostGIS)'

    def __str__(self):
        return self.nombre


class Mufas(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    registro_coordenadas_json = models.JSONField(default=dict, blank=True, null=True)
    capacidad_hilos = models.IntegerField(default=12)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    objects = MufasManager()

    @property
    def codigo_identificador(self):
        return self.nombre
    @codigo_identificador.setter
    def codigo_identificador(self, val):
        self.nombre = val

    @property
    def latitud(self):
        if self.registro_coordenadas_json and isinstance(self.registro_coordenadas_json, dict):
            return self.registro_coordenadas_json.get('latitud')
        return None

    @latitud.setter
    def latitud(self, value):
        if not isinstance(self.registro_coordenadas_json, dict):
            self.registro_coordenadas_json = {}
        self.registro_coordenadas_json['latitud'] = value

    @property
    def longitud(self):
        if self.registro_coordenadas_json and isinstance(self.registro_coordenadas_json, dict):
            return self.registro_coordenadas_json.get('longitud')
        return None

    @longitud.setter
    def longitud(self, value):
        if not isinstance(self.registro_coordenadas_json, dict):
            self.registro_coordenadas_json = {}
        self.registro_coordenadas_json['longitud'] = value

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'mufas'
        db_table_comment = 'Mufas como puntos de interconexión con coordenadas latitud/longitud'

    def __str__(self):
        return self.nombre


class CajasNap(SoftDeleteModel):
    id = models.AutoField(primary_key=True)
    sector = models.ForeignKey(Sectores, models.DO_NOTHING, db_column='sector_id')
    fibra_optica = models.ForeignKey(FibrasOpticas, models.DO_NOTHING, db_column='fibra_optica_id')
    codigo = models.CharField(unique=True, max_length=50)
    latitud = models.DecimalField(max_digits=10, decimal_places=8, blank=True, null=True)
    longitud = models.DecimalField(max_digits=11, decimal_places=8, blank=True, null=True)
    estado_precinto = models.CharField(max_length=20)
    codigo_precinto = models.CharField(max_length=50, blank=True, null=True)
    capacidad_puertos = models.CharField(max_length=8)
    estado_puertos = models.JSONField()
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)

    objects = CajasNapManager()

    @property
    def codigo_nap(self):
        return self.codigo

    @property
    def codigo_identificador(self):
        return self.codigo
    @codigo_identificador.setter
    def codigo_identificador(self, val):
        self.codigo = val

    @property
    def cantidad_puertos(self):
        return self.capacidad_puertos
    @cantidad_puertos.setter
    def cantidad_puertos(self, val):
        self.capacidad_puertos = str(val)

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'cajas_nap'
        db_table_comment = 'Cajas NAP vinculadas a sector y fibra óptica con código auto-generado'

    def __str__(self):
        return self.codigo
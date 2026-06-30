import json
from datetime import datetime
from pathlib import Path
from decimal import Decimal
from django.db import models
from .usuarios import Usuario, Usuarios
from .abonados import Abonados
from .infraestructura import Sedes, CajasNap, FibrasOpticas, Sectores
from .planes import Planes
from .suscripciones import ServiciosAbonados
from .facturacion import FacturacionPagos, CajaMovimientos
from .tickets import TicketsOrdenes
from .ruc import Ruc, RucSedes

# ─── COMPATIBILITY ALIASES FOR OLD MODEL NAMES ──────────────────────────────
Personal = Usuarios
Clientes = Abonados
Naps = CajasNap
Suscripciones = ServiciosAbonados
Deudas = FacturacionPagos
Fibras = FibrasOpticas
Tickets = TicketsOrdenes
RucsGlobales = Ruc
SedeRuc = RucSedes
TransaccionesPagos = FacturacionPagos

# ─── MOCK / DUMMY MODELS FOR REMOVED SCHEMAS ───────────────────────────────

class DummyManager(models.Manager):
    def get_queryset(self):
        return MockQuerySet([], model=self.model)
    def count(self):
        return 0
    def exists(self):
        return False
    def create(self, *args, **kwargs):
        inst = self.model()
        for k, v in kwargs.items():
            setattr(inst, k, v)
        inst.id = 1
        return inst

class Contratos(models.Model):
    titulo = models.CharField(max_length=100)
    introduccion = models.TextField(blank=True, null=True)
    clausulas = models.TextField(blank=True, null=True)
    pdf_template_path = models.CharField(max_length=255, blank=True, null=True)
    velocidad_garantizada = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    plazo_atencion_horas = models.IntegerField(blank=True, null=True)
    costo_reconexion = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    ruc_facturacion_id = models.IntegerField(blank=True, null=True)
    sede = models.ForeignKey(Sedes, models.DO_NOTHING, blank=True, null=True)
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_contratos'

class PlanAnexosTv(models.Model):
    plan = models.ForeignKey(Planes, models.DO_NOTHING)
    nombre = models.CharField(max_length=100)
    precio_adicional = models.DecimalField(max_digits=10, decimal_places=2)
    activo = models.BooleanField(default=True)
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_plan_anexos_tv'

def matches_filter(obj, q_obj):
    from django.db.models import Q
    if not isinstance(q_obj, Q):
        # Es una tupla (clave, valor)
        k, v = q_obj
        lookup = 'exact'
        clean_k = k
        if '__' in k:
            parts = k.split('__')
            if parts[-1] in ('exact', 'iexact', 'contains', 'icontains', 'in', 'gt', 'gte', 'lt', 'lte', 'isnull'):
                lookup = parts[-1]
                clean_k = '__'.join(parts[:-1])
        
        val = obj
        for part in clean_k.split('__'):
            if val is None:
                break
            val = getattr(val, part, None)
            
        if lookup == 'exact':
            if hasattr(val, 'id'):
                return val.id == v
            return val == v
        elif lookup == 'iexact':
            return str(val or '').lower() == str(v or '').lower()
        elif lookup == 'contains':
            return str(v) in str(val or '')
        elif lookup == 'icontains':
            return str(v).lower() in str(val or '').lower()
        elif lookup == 'in':
            try:
                return val in v
            except TypeError:
                return False
        elif lookup == 'gt':
            try:
                return val > v
            except TypeError:
                return False
        elif lookup == 'gte':
            try:
                return val >= v
            except TypeError:
                return False
        elif lookup == 'lt':
            try:
                return val < v
            except TypeError:
                return False
        elif lookup == 'lte':
            try:
                return val <= v
            except TypeError:
                return False
        elif lookup == 'isnull':
            return (val is None) == bool(v)
            
        return val == v

    # Es un objeto Q
    results = []
    for child in q_obj.children:
        results.append(matches_filter(obj, child))
    
    if q_obj.connector == Q.OR:
        return any(results) if results else True
    else:
        return all(results) if results else True


_count_sentinel = object()


class MockQuerySet(list):
    def __init__(self, seq=(), model=None):
        super().__init__(seq)
        self.model = model

    def get(self, *args, **kwargs):
        res = self.filter(*args, **kwargs)
        if len(res) == 0:
            if self.model:
                raise self.model.DoesNotExist("Object does not exist")
            raise Exception("DoesNotExist")
        if len(res) > 1:
            raise Exception("MultipleObjectsReturned")
        return res[0]

    def order_by(self, *fields):
        if not fields:
            return self
        # Ordenar por el primer campo especificado
        field = fields[0]
        reverse = field.startswith('-')
        clean_field = field.lstrip('-')
        self.sort(key=lambda x: getattr(x, clean_field, '') or '', reverse=reverse)
        return self

    def filter(self, *args, **kwargs):
        filtered = self
        for q_obj in args:
            filtered = [x for x in filtered if matches_filter(x, q_obj)]
        for k, v in kwargs.items():
            filtered = [x for x in filtered if matches_filter(x, (k, v))]
        return MockQuerySet(filtered, model=self.model)

    def exclude(self, *args, **kwargs):
        matching = self.filter(*args, **kwargs)
        matching_ids = {id(x) for x in matching}
        return MockQuerySet([x for x in self if id(x) not in matching_ids], model=self.model)

    def count(self, value=_count_sentinel, /):
        if value is not _count_sentinel:
            return super().count(value)
        return len(self)

    def exists(self):
        return len(self) > 0

    def delete(self):
        from django.conf import settings
        ids_to_del = {x.pk for x in self if getattr(x, 'pk', None) is not None}
        if not ids_to_del:
            return (0, {})
            
        is_catalogo = False
        is_material = False
        for x in self:
            if x.__class__.__name__ == 'CatalogoTickets':
                is_catalogo = True
                break
            elif x.__class__.__name__ == 'MaterialesConfiguracion':
                is_material = True
                break

        if is_catalogo:
            path = Path(settings.BASE_DIR) / 'catalogo_tickets_config.json'
            if path.exists():
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    data = [x for x in data if x.get('id') not in ids_to_del]
                    with open(path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=4)
                except Exception:
                    pass
        elif is_material:
            path = Path(settings.BASE_DIR) / 'materiales_config.json'
            if path.exists():
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    data = [x for x in data if x.get('id') not in ids_to_del]
                    with open(path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=4)
                except Exception:
                    pass
        return (len(self), {})

    def all(self):
        return self

    def none(self):
        return MockQuerySet([], model=self.model)

    def first(self):
        return self[0] if self else None

    def last(self):
        return self[-1] if self else None

    def values(self, *fields, **expressions):
        result = []
        for x in self:
            d = {}
            if fields:
                for f in fields:
                    d[f] = getattr(x, f, None)
            else:
                if hasattr(x, '_meta'):
                    for f in x._meta.fields:
                        d[f.name] = getattr(x, f.name, None)
                else:
                    d = x.__dict__.copy()
                    d.pop('_state', None)
            result.append(d)
        return MockQuerySet(result, model=self.model)

    def values_list(self, *fields, flat=False, named=False):
        result = []
        for x in self:
            if flat:
                if len(fields) != 1:
                    raise TypeError("flat=True can only be used with a single field")
                val = getattr(x, fields[0], None)
                result.append(val)
            else:
                vals = tuple(getattr(x, f, None) for f in fields)
                result.append(vals)
        return MockQuerySet(result, model=self.model)

    def distinct(self, *fields):
        seen = []
        for item in self:
            if item not in seen:
                seen.append(item)
        return MockQuerySet(seen, model=self.model)

    def aggregate(self, **kwargs):
        """Implement aggregate method for MockQuerySet"""
        from decimal import Decimal
        result = {}
        for alias, func in kwargs.items():
            # Handle Sum aggregation
            if hasattr(func, 'name') and func.name == 'Sum':
                field_name = func.source_expressions[0].name if hasattr(func, 'source_expressions') else str(func)
                total = Decimal('0')
                for item in self:
                    value = getattr(item, field_name, Decimal('0'))
                    if value is not None:
                        try:
                            total += Decimal(str(value))
                        except:
                            pass
                result[alias] = total
            # Handle Count aggregation
            elif hasattr(func, 'name') and func.name == 'Count':
                result[alias] = len(self)
            # Handle other aggregations with default values
            else:
                result[alias] = Decimal('0')
        return result


from .tickets import TicketsPlantillas

class CatalogoTickets(TicketsPlantillas):
    class Meta:
        proxy = True

    def save(self, *args, **kwargs):
        # Asegurar que funciones_especiales tenga la estructura correcta
        if not self.funciones_especiales or not isinstance(self.funciones_especiales, dict):
            self.funciones_especiales = {}
        # Estructura por defecto de funciones especiales
        default_structure = {
            "cambio_equipo": {
                "activado": False,
                "fecha_activacion": None,
                "equipo_anterior": None,
                "equipo_nuevo": None,
                "motivo": None,
                "estado": "pendiente"
            },
            "migracion_plan": {
                "activado": False,
                "fecha_activacion": None,
                "plan_anterior_id": None,
                "plan_nuevo_id": None,
                "fecha_corte": None,
                "fecha_activacion_nuevo": None,
                "estado": "pendiente"
            },
            "instalacion": {
                "activado": False,
                "fecha_activacion": None,
                "fecha_inicio": None,
                "fecha_fin": None,
                "tecnico_id": None,
                "estado": "pendiente"
            },
            "cobra_materiales": {
                "activado": False,
                "fecha_activacion": None,
                "materiales": [],
                "monto_total": 0.00,
                "estado": "pendiente"
            },
            "editar_mapa": {
                "activado": False,
                "fecha_activacion": None,
                "nap_id": None,
                "coordenadas_anteriores": None,
                "coordenadas_nuevas": None,
                "estado": "pendiente"
            },
            "mantiene_equipo": {
                "activado": False,
                "fecha_activacion": None,
                "equipo_mantenido": None,
                "estado": "pendiente"
            },
            "nuevo_suministro": {
                "activado": False,
                "fecha_activacion": None,
                "suministro_anterior": None,
                "suministro_nuevo": None,
                "estado": "pendiente"
            },
            "genera_merma": {
                "activado": False,
                "fecha_activacion": None,
                "materiales_merma": [],
                "motivo": None,
                "autorizado_por": None,
                "estado": "pendiente"
            },
            "corte_temporal": {
                "activado": False,
                "fecha_activacion": None,
                "fecha_reconexion": None,
                "motivo": None,
                "estado": "pendiente"
            },
            "morosidad": {
                "activado": False,
                "fecha_activacion": None,
                "dias_mora": None,
                "monto_deuda": None,
                "estado": "pendiente"
            },
            "corte_definitivo": {
                "activado": False,
                "fecha_activacion": None,
                "motivo": None,
                "fecha_retiro_equipo": None,
                "estado": "pendiente"
            },
            "instalacion_anexo": {
                "activado": False,
                "fecha_activacion": None,
                "tipo_anexo": None,
                "costo_mensual": None,
                "es_gratis_registro": False,
                "estado": "pendiente"
            },
            "corte_anexo": {
                "activado": False,
                "fecha_activacion": None,
                "anexo_id": None,
                "motivo": None,
                "estado": "pendiente"
            },
            "reiniciar_servicio": {
                "activado": False,
                "fecha_activacion": None,
                "fecha_liquidacion": None,
                "nuevo_ciclo_facturacion": None,
                "estado": "pendiente"
            }
        }
        # Asegurar que todas las claves existan
        for key, value in default_structure.items():
            if key not in self.funciones_especiales:
                self.funciones_especiales[key] = value.copy()
            # Si el valor es un booleano, convertirlo a estructura
            elif isinstance(self.funciones_especiales[key], bool):
                old_value = self.funciones_especiales[key]
                self.funciones_especiales[key] = value.copy()
                self.funciones_especiales[key]['activado'] = old_value
            # Si ya existe como dict, NO sobrescribir el valor de activado
            elif isinstance(self.funciones_especiales[key], dict):
                # Solo asegurar que tenga la estructura completa, pero mantener activado existente
                pass
        super().save(*args, **kwargs)

    @property
    def nombre(self):
        return self.nombre_ticket
    
    @nombre.setter
    def nombre(self, value):
        self.nombre_ticket = value

    @property
    def es_universal(self):
        return True

    @property
    def flag_funciones_especiales(self):
        return any(v.get('activado') for v in self.funciones_especiales.values()) if self.funciones_especiales else False
    @flag_funciones_especiales.setter
    def flag_funciones_especiales(self, value):
        pass

    def _get_permiso(self, key, default=False):
        permisos = self.configuracion_reglas.get('permisos', {}) if self.configuracion_reglas else {}
        return permisos.get(key, default)

    def _set_permiso(self, key, value):
        if not self.configuracion_reglas:
            self.configuracion_reglas = {}
        if 'permisos' not in self.configuracion_reglas:
            self.configuracion_reglas['permisos'] = {}
        self.configuracion_reglas['permisos'][key] = value

    @property
    def editar_mapa(self):
        return self._get_permiso('editar_mapa')
    @editar_mapa.setter
    def editar_mapa(self, value):
        self._set_permiso('editar_mapa', value)

    @property
    def mantiene_equipo_anterior(self):
        return self._get_permiso('mantiene_equipo_anterior')
    @mantiene_equipo_anterior.setter
    def mantiene_equipo_anterior(self, value):
        self._set_permiso('mantiene_equipo_anterior', value)

    @property
    def cobra_materiales_liquidar(self):
        return self._get_permiso('cobra_materiales_liquidar')
    @cobra_materiales_liquidar.setter
    def cobra_materiales_liquidar(self, value):
        self._set_permiso('cobra_materiales_liquidar', value)

    @property
    def requiere_nuevo_suministro(self):
        return self._get_permiso('requiere_nuevo_suministro')
    @requiere_nuevo_suministro.setter
    def requiere_nuevo_suministro(self, value):
        self._set_permiso('requiere_nuevo_suministro', value)

    def _get_funcion_activa(self, key):
        if not self.funciones_especiales:
            return False
        func = self.funciones_especiales.get(key, {})
        if isinstance(func, dict):
            return func.get('activado', False)
        # Si el valor es un booleano directo (compatibilidad con datos antiguos)
        if isinstance(func, bool):
            return func
        return False

    def _set_funcion_activa(self, key, value):
        if not self.funciones_especiales:
            self.funciones_especiales = {}
        if key not in self.funciones_especiales:
            self.funciones_especiales[key] = {'activado': False}
        self.funciones_especiales[key]['activado'] = value

    @property
    def cambio_equipo(self):
        return self._get_funcion_activa('cambio_equipo')
    @cambio_equipo.setter
    def cambio_equipo(self, value):
        self._set_funcion_activa('cambio_equipo', value)

    @property
    def migracion_plan(self):
        return self._get_funcion_activa('migracion_plan')
    @migracion_plan.setter
    def migracion_plan(self, value):
        self._set_funcion_activa('migracion_plan', value)

    @property
    def es_instalacion(self):
        return self._get_funcion_activa('instalacion')
    @es_instalacion.setter
    def es_instalacion(self, value):
        self._set_funcion_activa('instalacion', value)

    @property
    def cobra_materiales(self):
        return self._get_funcion_activa('cobra_materiales')
    @cobra_materiales.setter
    def cobra_materiales(self, value):
        self._set_funcion_activa('cobra_materiales', value)

    @property
    def genera_merma(self):
        return self._get_funcion_activa('genera_merma')
    @genera_merma.setter
    def genera_merma(self, value):
        self._set_funcion_activa('genera_merma', value)

    @property
    def corte_temporal(self):
        return self._get_funcion_activa('corte_temporal')
    @corte_temporal.setter
    def corte_temporal(self, value):
        self._set_funcion_activa('corte_temporal', value)

    @property
    def morosidad(self):
        return self._get_funcion_activa('morosidad')
    @morosidad.setter
    def morosidad(self, value):
        self._set_funcion_activa('morosidad', value)

    @property
    def corte_definitivo(self):
        return self._get_funcion_activa('corte_definitivo')
    @corte_definitivo.setter
    def corte_definitivo(self, value):
        self._set_funcion_activa('corte_definitivo', value)

    @property
    def instalacion_anexo(self):
        return self._get_funcion_activa('instalacion_anexo')
    @instalacion_anexo.setter
    def instalacion_anexo(self, value):
        self._set_funcion_activa('instalacion_anexo', value)

    @property
    def corte_anexo(self):
        return self._get_funcion_activa('corte_anexo')
    @corte_anexo.setter
    def corte_anexo(self, value):
        self._set_funcion_activa('corte_anexo', value)

    @property
    def reiniciar_servicio(self):
        return self._get_funcion_activa('reiniciar_servicio')
    @reiniciar_servicio.setter
    def reiniciar_servicio(self, value):
        self._set_funcion_activa('reiniciar_servicio', value)


class JSONBackedDummyManager(models.Manager):
    def _get_file_path(self):
        from django.conf import settings
        return Path(settings.BASE_DIR) / 'materiales_config.json'

    def _read_data(self):
        path = self._get_file_path()
        if not path.exists():
            return []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def _write_data(self, data):
        path = self._get_file_path()
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass

    def get_queryset(self):
        records = self._read_data()
        instances = []
        for r in records:
            inst = self.model()
            inst.id = r.get('id')
            inst.nombre_material = r.get('nombre_material', '')
            inst.metraje_limite_gratis = r.get('metraje_limite_gratis', 0)
            inst.precio_exceso_metro = r.get('precio_exceso_metro', 0.0)
            inst.precio_venta_equipo = r.get('precio_venta_equipo', 0.0)
            instances.append(inst)
        return MockQuerySet(instances, model=self.model)

    def all(self):
        return self.get_queryset()

    def get(self, *args, **kwargs):
        pk = kwargs.get('pk') or kwargs.get('id')
        if pk is not None:
            records = self.get_queryset()
            for r in records:
                if r.pk == int(pk):
                    return r
        raise self.model.DoesNotExist()

    def filter(self, *args, **kwargs):
        return self.get_queryset().filter(*args, **kwargs)

    def create(self, *args, **kwargs):
        inst = self.model()
        for k, v in kwargs.items():
            setattr(inst, k, v)
        inst.save()
        return inst


class MaterialesConfiguracion(models.Model):
    nombre_material = models.CharField(max_length=100)
    metraje_limite_gratis = models.IntegerField(default=0)
    precio_exceso_metro = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    precio_venta_equipo = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    objects = JSONBackedDummyManager()

    def save(self, *args, **kwargs):
        import json
        from pathlib import Path
        from django.conf import settings
        path = Path(settings.BASE_DIR) / 'materiales_config.json'
        
        data = []
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                pass
                
        if not self.id:
            max_id = max([x.get('id', 0) for x in data], default=0)
            self.id = max_id + 1
            
        record = {
            'id': self.id,
            'nombre_material': getattr(self, 'nombre_material', ''),
            'metraje_limite_gratis': getattr(self, 'metraje_limite_gratis', 0),
            'precio_exceso_metro': float(getattr(self, 'precio_exceso_metro', 0.0) or 0.0),
            'precio_venta_equipo': float(getattr(self, 'precio_venta_equipo', 0.0) or 0.0),
        }
        
        updated = False
        for i, r in enumerate(data):
            if r.get('id') == self.id:
                data[i] = record
                updated = True
                break
        if not updated:
            data.append(record)
            
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass

    def delete(self, *args, **kwargs):
        import json
        from pathlib import Path
        from django.conf import settings
        path = Path(settings.BASE_DIR) / 'materiales_config.json'
        if self.id and path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                data = [x for x in data if x.get('id') != self.id]
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4)
            except Exception:
                pass
        return (1, {})

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_materiales_configuracion'

class ConfiguracionPreciosTickets(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_config_precios'

class JSONBackedComprobantesSunatManager(models.Manager):
    def _get_file_path(self):
        from django.conf import settings
        return Path(settings.BASE_DIR) / 'comprobantes_sunat.json'

    def _read_data(self):
        path = self._get_file_path()
        if not path.exists():
            return []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def _write_data(self, data):
        path = self._get_file_path()
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass

    def get_queryset(self):
        records = self._read_data()
        instances = []
        for r in records:
            inst = self.model()
            inst.id = r.get('id')
            inst.ruc_emisor_id = r.get('ruc_emisor_id')
            inst.cliente_id = r.get('cliente_id')
            inst.tipo_comprobante = r.get('tipo_comprobante', '')
            inst.serie = r.get('serie', '')
            inst.correlativo = r.get('correlativo', 0)
            inst.monto_subtotal = Decimal(str(r.get('monto_subtotal', '0.00')))
            inst.monto_igv = Decimal(str(r.get('monto_igv', '0.00')))
            inst.monto_total = Decimal(str(r.get('monto_total', '0.00')))
            fe = r.get('fecha_emision')
            if fe:
                try:
                    inst.fecha_emision = datetime.fromisoformat(fe)
                except Exception:
                    inst.fecha_emision = None
            else:
                inst.fecha_emision = None
            inst.xml_url = r.get('xml_url', '')
            inst.pdf_url = r.get('pdf_url', '')
            inst.estado_sunat = r.get('estado_sunat', 'pendiente')
            inst.codigo_hash = r.get('codigo_hash', '')
            inst.codigo_qr = r.get('codigo_qr', '')
            inst.mensaje_error_sunat = r.get('mensaje_error_sunat', '')
            instances.append(inst)
        return MockQuerySet(instances, model=self.model)

    def all(self):
        return self.get_queryset()

    def get(self, *args, **kwargs):
        pk = kwargs.get('pk') or kwargs.get('id')
        if pk is not None:
            records = self.get_queryset()
            for r in records:
                if r.pk == int(pk):
                    return r
        raise self.model.DoesNotExist()

    def filter(self, *args, **kwargs):
        return self.get_queryset().filter(*args, **kwargs)

    def exclude(self, *args, **kwargs):
        return self.get_queryset().exclude(*args, **kwargs)

    def create(self, *args, **kwargs):
        inst = self.model()
        for k, v in kwargs.items():
            setattr(inst, k, v)
        inst.save()
        return inst

class ComprobantesSunat(models.Model):
    id = models.BigAutoField(primary_key=True)
    ruc_emisor_id = models.IntegerField(blank=True, null=True)
    cliente_id = models.CharField(max_length=50, blank=True, null=True)
    tipo_comprobante = models.TextField()
    serie = models.CharField(max_length=4)
    correlativo = models.IntegerField()
    monto_subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    monto_igv = models.DecimalField(max_digits=10, decimal_places=2)
    monto_total = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_emision = models.DateTimeField(blank=True, null=True)
    xml_url = models.CharField(max_length=255, blank=True, null=True)
    pdf_url = models.CharField(max_length=255, blank=True, null=True)

    objects = JSONBackedComprobantesSunatManager()

    @property
    def ruc_emisor(self):
        try:
            return Ruc.objects.get(pk=self.ruc_emisor_id)
        except Exception:
            return None

    @property
    def cliente(self):
        try:
            return Abonados.objects.get(pk=self.cliente_id)
        except Exception:
            return None

    def save(self, *args, **kwargs):
        from django.conf import settings
        path = Path(settings.BASE_DIR) / 'comprobantes_sunat.json'
        
        data = []
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                data = []

        if not self.id:
            self.id = max([x.get('id', 0) for x in data] or [0]) + 1

        if hasattr(self.fecha_emision, 'isoformat'):
            fe_str = self.fecha_emision.isoformat()
        else:
            fe_str = str(self.fecha_emision) if self.fecha_emision else None

        row = {
            'id': self.id,
            'ruc_emisor_id': self.ruc_emisor_id,
            'cliente_id': self.cliente_id,
            'tipo_comprobante': self.tipo_comprobante,
            'serie': self.serie,
            'correlativo': self.correlativo,
            'monto_subtotal': float(self.monto_subtotal) if self.monto_subtotal is not None else 0.0,
            'monto_igv': float(self.monto_igv) if self.monto_igv is not None else 0.0,
            'monto_total': float(self.monto_total) if self.monto_total is not None else 0.0,
            'fecha_emision': fe_str,
            'xml_url': self.xml_url,
            'pdf_url': self.pdf_url,
            'estado_sunat': getattr(self, 'estado_sunat', 'pendiente'),
            'codigo_hash': getattr(self, 'codigo_hash', ''),
            'codigo_qr': getattr(self, 'codigo_qr', ''),
            'mensaje_error_sunat': getattr(self, 'mensaje_error_sunat', ''),
        }

        found = False
        for i, item in enumerate(data):
            if item.get('id') == self.id:
                data[i] = row
                found = True
                break
        if not found:
            data.append(row)

        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass
        return self

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_comprobantes'

class JSONBackedNotasVentaManager(models.Manager):
    def _get_file_path(self):
        from django.conf import settings
        return Path(settings.BASE_DIR) / 'notas_venta_internas.json'

    def _read_data(self):
        path = self._get_file_path()
        if not path.exists():
            return []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def _write_data(self, data):
        path = self._get_file_path()
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass

    def get_queryset(self):
        records = self._read_data()
        instances = []
        for r in records:
            inst = self.model()
            inst.id = r.get('id')
            inst.cliente_id = r.get('cliente_id')
            inst.monto_total = Decimal(str(r.get('monto_total', '0.00')))
            fe = r.get('fecha_registro')
            if fe:
                try:
                    inst.fecha_registro = datetime.fromisoformat(fe)
                except Exception:
                    inst.fecha_registro = None
            else:
                inst.fecha_registro = None
            inst.state = r.get('state', 'PENDIENTE_CONVERSION')
            instances.append(inst)
        return MockQuerySet(instances, model=self.model)

    def all(self):
        return self.get_queryset()

    def get(self, *args, **kwargs):
        pk = kwargs.get('pk') or kwargs.get('id')
        if pk is not None:
            records = self.get_queryset()
            for r in records:
                if r.pk == int(pk):
                    return r
        raise self.model.DoesNotExist()

    def filter(self, *args, **kwargs):
        return self.get_queryset().filter(*args, **kwargs)

    def create(self, *args, **kwargs):
        inst = self.model()
        for k, v in kwargs.items():
            setattr(inst, k, v)
        inst.save()
        return inst

class NotasVentaInternas(models.Model):
    id = models.BigAutoField(primary_key=True)
    cliente_id = models.CharField(max_length=50, blank=True, null=True)
    monto_total = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_registro = models.DateTimeField(blank=True, null=True)
    state = models.TextField()

    objects = JSONBackedNotasVentaManager()

    def save(self, *args, **kwargs):
        from django.conf import settings
        path = Path(settings.BASE_DIR) / 'notas_venta_internas.json'
        
        data = []
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                data = []

        if not self.id:
            self.id = max([x.get('id', 0) for x in data] or [0]) + 1

        if hasattr(self.fecha_registro, 'isoformat'):
            fe_str = self.fecha_registro.isoformat()
        else:
            fe_str = str(self.fecha_registro) if self.fecha_registro else None

        row = {
            'id': self.id,
            'cliente_id': self.cliente_id,
            'monto_total': float(self.monto_total) if self.monto_total is not None else 0.0,
            'fecha_registro': fe_str,
            'state': getattr(self, 'state', 'PENDIENTE_CONVERSION'),
        }

        found = False
        for i, item in enumerate(data):
            if item.get('id') == self.id:
                data[i] = row
                found = True
                break
        if not found:
            data.append(row)

        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
        except Exception:
            pass
        return self

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_notas_venta'

class TurnosCaja(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_turnos_caja'

class VersionSistema(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_version'

class CacheApiDni(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_cache_dni'

class CacheApiRuc(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_cache_ruc'

class CacheApiSuministro(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_cache_suministro'

class SuministrosPredio(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_suministros'

class CajasSedesMaestro(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_cajas_sedes'

class ConfigNotificaciones(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_config_notif'

class EquipoCliente(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_equipo_cliente'

class TareasCobranzaAtc(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_tareas_cobranza'

class SuscripcionAppsAdicionales(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_suscripcion_apps'

class SuscripcionCuotas(models.Model):
    objects = DummyManager()
    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'dummy_suscripcion_cuotas'

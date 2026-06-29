import bcrypt
from django.db import models
from .soft_delete import SoftDeleteModel

def default_dispositivos_y_seguridad():
    return {
        "pcs_confianza": [],
        "codigo_verificacion": {
            "codigo": None,
            "expira_en": None,
            "pc_pendiente_hash": None
        }
    }

def default_habilidades_json():
    return {
        "habilidades_globales": {
            "tickets_cobro": {
                "descuento_maximo_porcentaje": 0,
                "cuotas_maximas": 0
            },
            "deudas_antiguas": {
                "descuento_maximo_porcentaje": 0,
                "cuotas_maximas": 0
            },
            "planes_mensuales": {
                "descuento_maximo_porcentaje": 100,
                "meses_maximos": 0,
                "requiere_autorizacion_supervisor": False
            }
        }
    }

class Usuario(models.Model):
    id = models.AutoField(primary_key=True)
    username = models.CharField(unique=True, max_length=50)
    password = models.CharField(max_length=255, db_column='password_hash') # Alineado con datos.sql
    nombre_completo = models.CharField(max_length=150)
    email = models.CharField(unique=True, max_length=100)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    
    # Enum nativo de PostgreSQL: tac, noc, atc, ventas, tec (Alineado a rol_usuario)
    rol = models.CharField(max_length=20)  
    
    supervisor = models.ForeignKey('self', models.DO_NOTHING, db_column='supervisor_id', blank=True, null=True)
    sede_id = models.IntegerField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    
    # Fechas configuradas bajo TIMESTAMPTZ nativo con zona horaria
    fecha_creacion = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True, blank=True, null=True)
    
    dispositivos_y_seguridad = models.JSONField(
        default=default_dispositivos_y_seguridad,
        blank=True,
        null=True
    )
    
    habilidades_json = models.JSONField(
        default=default_habilidades_json,
        blank=True,
        null=True
    )

    # Django user compatibility properties
    @property
    def is_active(self):
        return self.activo

    @property
    def nombre_apellidos(self):
        return self.nombre_completo

    @property
    def cargo(self):
        return self.rol

    @property
    def personal(self):
        return self

    @property
    def sede(self):
        if self.sede_id:
            from .infraestructura import Sedes
            try:
                return Sedes.objects.get(id=self.sede_id)
            except Sedes.DoesNotExist:
                return None
        return None

    @property
    def tipo_caja_autorizada(self):
        return 'AMBOS'

    @tipo_caja_autorizada.setter
    def tipo_caja_autorizada(self, val):
        pass

    @property
    def permiso_efectivo(self):
        ds = self.dispositivos_y_seguridad or {}
        return ds.get('caja_permisos', {}).get('efectivo', True)

    @permiso_efectivo.setter
    def permiso_efectivo(self, val):
        if not isinstance(self.dispositivos_y_seguridad, dict):
            self.dispositivos_y_seguridad = default_dispositivos_y_seguridad()
        if 'caja_permisos' not in self.dispositivos_y_seguridad:
            self.dispositivos_y_seguridad['caja_permisos'] = {}
        self.dispositivos_y_seguridad['caja_permisos']['efectivo'] = bool(val)

    @property
    def permiso_transferencia(self):
        ds = self.dispositivos_y_seguridad or {}
        return ds.get('caja_permisos', {}).get('transferencia', True)

    @permiso_transferencia.setter
    def permiso_transferencia(self, val):
        if not isinstance(self.dispositivos_y_seguridad, dict):
            self.dispositivos_y_seguridad = default_dispositivos_y_seguridad()
        if 'caja_permisos' not in self.dispositivos_y_seguridad:
            self.dispositivos_y_seguridad['caja_permisos'] = {}
        self.dispositivos_y_seguridad['caja_permisos']['transferencia'] = bool(val)

    @property
    def cajas_permitidas(self):
        ds = self.dispositivos_y_seguridad or {}
        return ds.get('caja_permisos', {}).get('cajas_permitidas', [])

    @cajas_permitidas.setter
    def cajas_permitidas(self, val):
        if not isinstance(self.dispositivos_y_seguridad, dict):
            self.dispositivos_y_seguridad = default_dispositivos_y_seguridad()
        if 'caja_permisos' not in self.dispositivos_y_seguridad:
            self.dispositivos_y_seguridad['caja_permisos'] = {}
        try:
            self.dispositivos_y_seguridad['caja_permisos']['cajas_permitidas'] = [int(x) for x in val]
        except Exception:
            self.dispositivos_y_seguridad['caja_permisos']['cajas_permitidas'] = []

    @property
    def correo(self):
        return self.email

    @correo.setter
    def correo(self, value):
        self.email = value

    @property
    def celular(self):
        return self.telefono

    @celular.setter
    def celular(self, value):
        self.telefono = value

    @is_active.setter
    def is_active(self, value):
        self.activo = value

    @property
    def is_superuser(self):
        return self.rol == 'tac'

    @is_superuser.setter
    def is_superuser(self, value):
        pass

    @property
    def is_staff(self):
        return self.rol in ['tac', 'noc']

    @is_staff.setter
    def is_staff(self, value):
        pass

    @property
    def last_login(self):
        return self.fecha_actualizacion

    @last_login.setter
    def last_login(self, value):
        pass

    def set_password(self, raw_password):
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt()
        self.password = bcrypt.hashpw(raw_password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, raw_password):
        """Verify password using bcrypt"""
        if not self.password:
            return False
        try:
            return bcrypt.checkpw(raw_password.encode('utf-8'), self.password.encode('utf-8'))
        except Exception:
            return False

    class Meta:
        app_label = 'core'
        managed = False
        db_table = 'usuarios'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return self.username

# Plural alias for backwards compatibility
Usuarios = Usuario
-- ============================================================================
-- ESQUEMA COMPLETO UNIFICADO DEL SISTEMA DE GESTION DE TELECOMUNICACIONES
-- ============================================================================
-- Fusion definitiva con correcciones arquitectónicas aplicadas
-- - PostGIS nativo para geolocalización (Reglas B1, B2, B4)
-- - Purga de planta externa MVP (Regla C2)
-- - ENUMs unificados (Regla B3)
-- - Auditoría con TIMESTAMPTZ (Regla D4)
-- ============================================================================

SET client_min_messages TO WARNING;

-- ============================================================================
-- EXTENSIONES NATIVAS
-- ============================================================================

-- PostGIS se instalará vía Application Stack Builder cuando esté disponible
-- Temporalmente usando latitud/longitud DECIMAL para compatibilidad
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TIPOS ENUM NATIVOS (Actualizados - Filtro Anti-Tablas)
-- ============================================================================

-- Roles de usuarios internos (administradores y empleados unificados)
CREATE TYPE rol_usuario AS ENUM ('admin', 'tac', 'noc', 'atc', 'ventas', 'tec');

-- Tipo de servicio para planes
CREATE TYPE tipo_servicio AS ENUM ('internet', 'tv', 'duo', 'app', 'servicio');

-- Tipo de cliente para planes
CREATE TYPE tipo_cliente AS ENUM ('residencial', 'corporativo');

-- Estado civil para personas naturales
CREATE TYPE estado_civil AS ENUM ('soltero', 'casado', 'divorciado', 'viudo', 'conviviente');

-- Tipo de cliente (natural o juridico)
CREATE TYPE tipo_cliente_abonado AS ENUM ('natural', 'juridico');

-- Operador movil del cliente
CREATE TYPE operador_movil AS ENUM ('claro', 'movistar', 'entel', 'bitel', 'otro');

-- Categorias de tickets (ENUM estandarizado en minusculas)
CREATE TYPE categoria_ticket AS ENUM ('instalacion', 'incidencia', 'requerimiento', 'averia', 'cortes', 'pirateria', 'otros', 'todos');

-- Areas operativas de tickets (ENUM estandarizado en minusculas)
CREATE TYPE area_ticket AS ENUM ('planta_interna', 'planta_externa', 'todos');

-- Tecnologias involucradas en tickets (ENUM estandarizado en minusculas)
CREATE TYPE tecnologia_ticket AS ENUM ('internet', 'tv', 'duo', 'todos');

-- Modalidades de atencion en tickets (ENUM estandarizado en minusculas)
CREATE TYPE modalidad_ticket AS ENUM ('remoto', 'campo', 'todos');

-- Dia de vencimiento para planes
CREATE TYPE dia_vencimiento AS ENUM ('fin_mes', 'fecha_instalacion');

-- Estados de tickets
CREATE TYPE estado_ticket AS ENUM ('pendiente', 'asignado', 'en_proceso', 'completado', 'cancelado', 'en_espera');

-- Prioridades de tickets
CREATE TYPE prioridad_ticket AS ENUM ('baja', 'media', 'alta', 'critica');

-- Estado del servicio del abonado
CREATE TYPE estado_servicio AS ENUM ('activo', 'suspendido', 'cortado', 'pendiente_instalacion', 'baja');

-- Estado de cuenta financiera
CREATE TYPE estado_cuenta AS ENUM ('al_dia', 'vencido', 'en_acuerdo', 'judicial');

-- Tipo de documento fiscal emitido
CREATE TYPE tipo_documento_fiscal AS ENUM ('boleta', 'factura', 'nota_venta');

-- Metodo de pago
CREATE TYPE metodo_pago AS ENUM ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia', 'deposito');

-- Tipo de transaccion financiera
CREATE TYPE tipo_transaccion AS ENUM ('cargo', 'abono', 'ajuste_comercial', 'descuento', 'exoneracion', 'salida_gasto');

-- Modalidad de solucion de ticket
CREATE TYPE modalidad_solucion AS ENUM ('remota', 'campo');

-- Capacidad de puertos en cajas NAP
CREATE TYPE capacidad_puertos AS ENUM ('8', '16');

-- Estado del precinto de seguridad
CREATE TYPE estado_precinto AS ENUM ('activo', 'roto', 'cambiado', 'sin_precinto');

-- Estado del contacto en llamadas de cobranza
CREATE TYPE estado_contacto_llamada AS ENUM (
    'pendiente',
    'notificado',
    'mensaje_voz',
    'sms',
    'whatsapp',
    'no_contesto',
    'llamo_otro_numero',
    'corto_llamada'
);

-- Tipo de material/equipo
CREATE TYPE tipo_material AS ENUM ('equipo', 'materiales');

-- ============================================================================
-- TABLA: sedes (Regla B1: Geolocalizacion temporal con DECIMAL)
-- ============================================================================
CREATE TABLE sedes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    direccion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sedes_nombre ON sedes (nombre);

CREATE INDEX idx_sedes_coordenadas ON sedes (latitud, longitud);

-- ============================================================================
-- ENUM: tipo_ubicacion_caja (Sistema de Cajas Simplificado)
-- ============================================================================
CREATE TYPE tipo_ubicacion_caja AS ENUM ('oficina', 'campo');

-- ============================================================================
-- TABLA: cajas (Estructura de cajas por sedes)
-- ============================================================================
CREATE TABLE cajas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    sede_id INTEGER NOT NULL REFERENCES sedes (id) ON DELETE RESTRICT,
    tipo_ubicacion tipo_ubicacion_caja NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cajas_sede ON cajas (sede_id);

-- ============================================================================
-- TABLA: usuarios (Regla A2: Unificacion de personal interno)
-- ============================================================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    rol rol_usuario NOT NULL,
    supervisor_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
    sede_id INTEGER REFERENCES sedes (id) ON DELETE RESTRICT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dispositivos_y_seguridad JSONB NOT NULL DEFAULT '{
        "pcs_confianza": [],
        "codigo_verificacion": {
            "codigo": null,
            "expira_en": null,
            "pc_pendiente_hash": null
        }
    }'::jsonb,
    habilidades_json JSONB NOT NULL DEFAULT '{
        "habilidades_globales": {
            "tickets_cobro": {
                "descuento_maximo_porcentaje": 90,
                "cuotas_maximas": 3
            },
            "deudas_antiguas": {
                "descuento_maximo_porcentaje": 90,
                "cuotas_maximas": 6
            },
            "planes_mensuales": {
                "descuento_maximo_porcentaje": 100,
                "meses_maximos": 3,
                "requiere_autorizacion_supervisor": true
            }
        }
    }'::jsonb,
    CONSTRAINT chk_usuarios_dispositivos CHECK (jsonb_typeof(dispositivos_y_seguridad) = 'object'),
    CONSTRAINT chk_usuarios_habilidades CHECK (jsonb_typeof(habilidades_json) = 'object')
);

CREATE INDEX idx_usuarios_rol ON usuarios (rol);

CREATE INDEX idx_usuarios_supervisor ON usuarios (supervisor_id);

CREATE INDEX idx_usuarios_sede ON usuarios (sede_id);

CREATE INDEX idx_usuarios_dispositivos_seguridad ON usuarios USING gin (dispositivos_y_seguridad);



-- ============================================================================
-- TABLA: ruc (Regla A1: Datos fiscales consolidados)
-- ============================================================================
CREATE TABLE ruc (
    id SERIAL PRIMARY KEY,
    ruc_numero VARCHAR(11) UNIQUE NOT NULL,
    razon_social VARCHAR(200) NOT NULL,
    direccion_fiscal TEXT NOT NULL,
    telefono_celular VARCHAR(20),
    ruta_logo_boleta TEXT,
    ruta_contrato_base_pdf TEXT,
    ruta_certificado_p12 TEXT,
    password_certificado_p12 TEXT,
    usuario_sol VARCHAR(50),
    password_sol VARCHAR(50),
    prefijo_boleta VARCHAR(4) DEFAULT 'B001',
    prefijo_factura VARCHAR(4) DEFAULT 'F001',
    numero_inicio_boleta INTEGER DEFAULT 1,
    numero_inicio_factura INTEGER DEFAULT 1,
    numero_actual_boleta INTEGER DEFAULT 1,
    numero_actual_factura INTEGER DEFAULT 1,
    formato_impresion VARCHAR(10) DEFAULT 'A4',
    permite_boleta BOOLEAN DEFAULT TRUE,
    permite_factura BOOLEAN DEFAULT TRUE,
    permite_nota_venta BOOLEAN DEFAULT TRUE,
    permite_nota_deuda BOOLEAN DEFAULT TRUE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ruc_numero ON ruc (ruc_numero);

-- ============================================================================
-- TABLA: ruc_sedes (Relacion jerarquica flexible)
-- ============================================================================
CREATE TABLE ruc_sedes (
    id SERIAL PRIMARY KEY,
    ruc_id INTEGER NOT NULL REFERENCES ruc (id) ON DELETE CASCADE,
    sede_id INTEGER NOT NULL REFERENCES sedes (id) ON DELETE CASCADE,
    fecha_vinculacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    permite_boleta BOOLEAN DEFAULT TRUE,
    permite_factura BOOLEAN DEFAULT TRUE,
    permite_nota_venta BOOLEAN DEFAULT TRUE,
    permite_nota_deuda BOOLEAN DEFAULT TRUE,
    formato_impresion VARCHAR(10) DEFAULT 'A4',
    logo_url VARCHAR(255),
    contrato_pdf_path VARCHAR(255),
    limite_recaudacion_mensual DECIMAL(15, 2) DEFAULT 600000.00,
    prefijo_boleta VARCHAR(4) DEFAULT 'B001',
    prefijo_factura VARCHAR(4) DEFAULT 'F001',
    numero_actual_boleta INTEGER DEFAULT 1,
    numero_actual_factura INTEGER DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    vinculado BOOLEAN DEFAULT TRUE,
    UNIQUE (ruc_id, sede_id)
);

-- ============================================================================
-- TABLA: cache_ruc (Cache de consultas a SUNAT)
-- ============================================================================
CREATE TABLE cache_ruc (
    id SERIAL PRIMARY KEY,
    ruc_numero VARCHAR(11) UNIQUE NOT NULL,
    razon_social VARCHAR(200),
    fecha_expiracion TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_consulta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    datos_json JSONB
);

CREATE INDEX idx_cache_ruc_numero ON cache_ruc (ruc_numero);

CREATE INDEX idx_cache_ruc_expiracion ON cache_ruc (fecha_expiracion);

-- ============================================================================
-- TABLA: cache_dni (Cache de consultas a RENIEC)
-- ============================================================================
CREATE TABLE cache_dni (
    id SERIAL PRIMARY KEY,
    dni_numero VARCHAR(8) UNIQUE NOT NULL,
    nombres VARCHAR(100),
    apellidos VARCHAR(100),
    fecha_expiracion TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_consulta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    datos_json JSONB
);

CREATE INDEX idx_cache_dni_numero ON cache_dni (dni_numero);

CREATE INDEX idx_cache_dni_expiracion ON cache_dni (fecha_expiracion);

-- ============================================================================
-- TABLA: cache_suministro (Cache de consultas de suministros)
-- ============================================================================
CREATE TABLE cache_suministro (
    id SERIAL PRIMARY KEY,
    numero_suministro VARCHAR(50) UNIQUE NOT NULL,
    tipo_suministro VARCHAR(50),
    estado_suministro VARCHAR(50),
    direccion TEXT,
    departamento VARCHAR(50),
    provincia VARCHAR(50),
    distrito VARCHAR(50),
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    fecha_expiracion TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_consulta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    datos_json JSONB
);

CREATE INDEX idx_cache_suministro_numero ON cache_suministro (numero_suministro);

CREATE INDEX idx_cache_suministro_expiracion ON cache_suministro (fecha_expiracion);





-- ============================================================================
-- TABLA: planes (Regla C1: Funcionalidades esenciales del MVP)
-- ============================================================================
CREATE TABLE planes (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES sedes (id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    tipo_servicio tipo_servicio NOT NULL,
    tipo_cliente tipo_cliente NOT NULL,
    costo_mensual DECIMAL(10, 2) NOT NULL,
    caracteristicas_tecnicas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    velocidad_mbps INTEGER,
    canales INTEGER,
    dia_vencimiento dia_vencimiento NOT NULL DEFAULT 'fin_mes',
    dias_gracia INTEGER DEFAULT 5,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_planes_caracteristicas CHECK (jsonb_typeof(caracteristicas_tecnicas_json) = 'object')
);

CREATE INDEX idx_planes_sede ON planes (sede_id);

CREATE INDEX idx_planes_tipo_servicio ON planes (tipo_servicio);

CREATE INDEX idx_planes_tipo_cliente ON planes (tipo_cliente);

CREATE INDEX idx_planes_activo ON planes (activo);

COMMENT ON COLUMN planes.caracteristicas_tecnicas_json IS 'Matriz técnica modular dinámica indexada mediante GIN. Estructura se construye dinámicamente:
{
  "caracteristicas_base": {
    "velocidad_mbps": 100,
    "cantidad_canales": 140,
    "aplicaciones_digitales": ["netflix"]
  },
  "activacion_funciones": {
    "admite_prorrogas": true,
    "compromisos_pago_flexibles": false,
    "bloqueo_automatico_mora": true,
    "prioridad_soporte_critica": false
  },
  "permisos_formularios": {
    "requiere_api_externa_olt": false,
    "permite_cambio_mufa_campo": true
  }
}';



-- ============================================================================
-- TABLA: materiales (Catálogo de materiales y equipos)
-- ============================================================================
CREATE TABLE materiales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    tipo_material tipo_material NOT NULL,
    requiere_mac BOOLEAN DEFAULT FALSE,
    requiere_serie BOOLEAN DEFAULT FALSE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_materiales_tipo ON materiales (tipo_material);

CREATE INDEX idx_materiales_activo ON materiales (activo);

CREATE INDEX idx_materiales_nombre ON materiales (nombre);

-- ============================================================================
-- TABLA: sectores (Regla A4: Relacion de infraestructura por cascada)
-- ============================================================================
CREATE TABLE sectores (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES sedes (id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    prefijo_comercial VARCHAR(20) NOT NULL,
    poligono_coordenadas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_prefijo_formato CHECK (
        prefijo_comercial ~* '^[a-z0-9]+$'
    ),
    CONSTRAINT chk_sectores_poligono CHECK (jsonb_typeof(poligono_coordenadas_json) = 'array')
);

CREATE INDEX idx_sectores_sede ON sectores (sede_id);

CREATE INDEX idx_sectores_prefijo ON sectores (prefijo_comercial);

-- ============================================================================
-- TABLA: hubs (Regla B1: Geolocalizacion temporal con DECIMAL)
-- ============================================================================
CREATE TABLE hubs (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES sedes (id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    potencia_optica_salida DECIMAL(10, 2),
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hubs_sede ON hubs (sede_id);

CREATE INDEX idx_hubs_coordenadas ON hubs (latitud, longitud);

-- ============================================================================
-- TABLA: fibras_opticas (Regla C2: Simplificada - Sin control de hilos)
-- ============================================================================
CREATE TABLE fibras_opticas (
    id SERIAL PRIMARY KEY,
    hub_origen_id INTEGER NOT NULL REFERENCES hubs (id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    ruta_coordenadas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fibras_ruta CHECK (jsonb_typeof(ruta_coordenadas_json) = 'array')
);

CREATE INDEX idx_fibras_opticas_hub ON fibras_opticas (hub_origen_id);

-- ============================================================================
-- TABLA: mufas (Regla C2: Nodo lógico temporal con DECIMAL - Sin mapa_fusiones)
-- ============================================================================
CREATE TABLE mufas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    registro_coordenadas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    capacidad_hilos INTEGER NOT NULL DEFAULT 12,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mufas_coordenadas CHECK (jsonb_typeof(registro_coordenadas_json) = 'object' OR jsonb_typeof(registro_coordenadas_json) = 'array')
);

-- ============================================================================
-- TABLA: cajas_nap (Regla A4: Relacion por cascada desde sector)
-- ============================================================================
CREATE TABLE cajas_nap (
    id SERIAL PRIMARY KEY,
    sector_id INTEGER NOT NULL REFERENCES sectores (id) ON DELETE RESTRICT,
    fibra_optica_id INTEGER NOT NULL REFERENCES fibras_opticas (id) ON DELETE RESTRICT,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    estado_precinto estado_precinto NOT NULL DEFAULT 'activo',
    codigo_precinto VARCHAR(50),
    capacidad_puertos capacidad_puertos NOT NULL,
    estado_puertos JSONB NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_estado_puertos CHECK (
        jsonb_typeof(estado_puertos) = 'object'
    )
);

CREATE INDEX idx_cajas_nap_sector ON cajas_nap (sector_id);

CREATE INDEX idx_cajas_nap_fibra ON cajas_nap (fibra_optica_id);

CREATE INDEX idx_cajas_nap_codigo ON cajas_nap (codigo);

CREATE INDEX idx_cajas_nap_coordenadas ON cajas_nap (latitud, longitud);

-- ============================================================================
-- TABLA: abonados (Regla A1: Datos maestros centralizados)
-- ============================================================================
CREATE TABLE abonados (
    id SERIAL PRIMARY KEY,
    tipo_cliente tipo_cliente_abonado NOT NULL,
    dni VARCHAR(8) UNIQUE,
    ruc VARCHAR(11) UNIQUE,
    nombres_apellidos VARCHAR(100),
    razon_social VARCHAR(200),
    fecha_nacimiento DATE,
    estado_civil estado_civil,
    celular_1 VARCHAR(20) NOT NULL,
    celular_2 VARCHAR(20),
    correo VARCHAR(100) NOT NULL,
    direccion_fiscal TEXT NOT NULL,
    documentos_digitalizados TEXT,
    empleado_firma_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
    datos_adicionales_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_dni_ruc_exclusivo CHECK (
        (
            tipo_cliente = 'natural'
            AND dni IS NOT NULL
            AND ruc IS NULL
        )
        OR (
            tipo_cliente = 'juridico'
            AND ruc IS NOT NULL
            AND dni IS NULL
        )
    ),
    CONSTRAINT chk_dni_formato CHECK (
        dni IS NULL
        OR dni ~ '^[0-9]{8}$'
    ),
    CONSTRAINT chk_ruc_formato CHECK (
        ruc IS NULL
        OR ruc ~ '^[0-9]{11}$'
    ),
    CONSTRAINT chk_abonados_datos CHECK (jsonb_typeof(datos_adicionales_json) = 'object')
);

CREATE INDEX idx_abonados_dni ON abonados (dni);

CREATE INDEX idx_abonados_ruc ON abonados (ruc);

CREATE INDEX idx_abonados_correo ON abonados (correo);

CREATE INDEX idx_abonados_celular_1 ON abonados (celular_1);

-- ============================================================================
-- TABLA: servicios_abonados (Regla A4: Relacion por cascada)
-- ============================================================================
CREATE TABLE servicios_abonados (
    id SERIAL PRIMARY KEY,
    abonado_id INTEGER NOT NULL REFERENCES abonados (id) ON DELETE RESTRICT,
    caja_nap_id INTEGER NOT NULL REFERENCES cajas_nap (id) ON DELETE RESTRICT,
    plan_id INTEGER NOT NULL REFERENCES planes (id) ON DELETE RESTRICT,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    numero_suministro VARCHAR(20) NOT NULL UNIQUE,
    numero_contrato VARCHAR(50) UNIQUE,
    codigo_precinto VARCHAR(50),
    router_serie VARCHAR(100),
    router_mac VARCHAR(17),
    vendedora_id INTEGER REFERENCES usuarios (id) ON DELETE RESTRICT,
    direccion_servicio TEXT NOT NULL,
    distrito VARCHAR(100) NOT NULL,
    provincia VARCHAR(100) NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    deuda_acumulada DECIMAL(12, 2) DEFAULT 0,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    control_operativo_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado_servicio estado_servicio NOT NULL DEFAULT 'pendiente_instalacion',
    fecha_instalacion DATE,
    fecha_facturacion DATE,
    fecha_reconexion DATE,
    fecha_proximo_pago DATE,
    fecha_suspension DATE,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_servicios_control CHECK (jsonb_typeof(control_operativo_json) = 'object'),
    CONSTRAINT chk_router_mac CHECK (router_mac IS NULL OR router_mac ~ '^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}$')
);

CREATE INDEX idx_servicios_abonado ON servicios_abonados (abonado_id);

CREATE INDEX idx_servicios_caja_nap ON servicios_abonados (caja_nap_id);

CREATE INDEX idx_servicios_plan ON servicios_abonados (plan_id);

CREATE INDEX idx_servicios_codigo ON servicios_abonados (codigo);

CREATE INDEX idx_servicios_suministro ON servicios_abonados (numero_suministro);

CREATE INDEX idx_servicios_numero_contrato ON servicios_abonados (numero_contrato);

CREATE INDEX idx_servicios_router_mac ON servicios_abonados (router_mac);

CREATE INDEX idx_servicios_router_serie ON servicios_abonados (router_serie);

CREATE INDEX idx_servicios_vendedora ON servicios_abonados (vendedora_id);

CREATE INDEX idx_servicios_estado ON servicios_abonados (estado_servicio);

CREATE INDEX idx_servicios_coordenadas ON servicios_abonados (latitud, longitud);

-- ============================================================================
-- TABLA: tickets_plantillas (Catálogo Maestro de Tipos de Tickets)
-- ============================================================================
CREATE TABLE tickets_plantillas (
    id SERIAL PRIMARY KEY,
    nombre_ticket VARCHAR(200) NOT NULL,
    categoria categoria_ticket NOT NULL,
    area area_ticket NOT NULL,
    tecnologia tecnologia_ticket NOT NULL,
    modalidad modalidad_ticket NOT NULL,
    precio_base DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    configuracion_reglas JSONB NOT NULL DEFAULT '{
        "permisos": {
            "editar_mapa": false,
            "mantiene_equipo_anterior": false,
            "cobra_materiales_liquidar": false,
            "requiere_nuevo_suministro": false,
            "bloqueo_comercial_atc": false
        },
        "automatizacion_sistema": {
            "es_automatico": false,
            "comando_olt_core": null,
            "requiere_api_externa": false
        }
    }'::jsonb,
    funciones_especiales JSONB NOT NULL DEFAULT '{
        "cambio_equipo": {
            "activado": false,
            "fecha_activacion": null,
            "equipo_anterior": null,
            "equipo_nuevo": null,
            "motivo": null,
            "estado": "pendiente"
        },
        "migracion_plan": {
            "activado": false,
            "fecha_activacion": null,
            "plan_anterior_id": null,
            "plan_nuevo_id": null,
            "fecha_corte": null,
            "fecha_activacion_nuevo": null,
            "estado": "pendiente"
        },
        "instalacion": {
            "activado": false,
            "fecha_activacion": null,
            "fecha_inicio": null,
            "fecha_fin": null,
            "tecnico_id": null,
            "estado": "pendiente"
        },
        "cobra_materiales": {
            "activado": false,
            "fecha_activacion": null,
            "materiales": [],
            "monto_total": 0.00,
            "estado": "pendiente"
        },
        "editar_mapa": {
            "activado": false,
            "fecha_activacion": null,
            "nap_id": null,
            "coordenadas_anteriores": null,
            "coordenadas_nuevas": null,
            "estado": "pendiente"
        },
        "mantiene_equipo": {
            "activado": false,
            "fecha_activacion": null,
            "equipo_mantenido": null,
            "estado": "pendiente"
        },
        "nuevo_suministro": {
            "activado": false,
            "fecha_activacion": null,
            "suministro_anterior": null,
            "suministro_nuevo": null,
            "estado": "pendiente"
        },
        "genera_merma": {
            "activado": false,
            "fecha_activacion": null,
            "materiales_merma": [],
            "motivo": null,
            "autorizado_por": null,
            "estado": "pendiente"
        },
        "corte_temporal": {
            "activado": false,
            "fecha_activacion": null,
            "fecha_reconexion": null,
            "motivo": null,
            "estado": "pendiente"
        },
        "morosidad": {
            "activado": false,
            "fecha_activacion": null,
            "dias_mora": null,
            "monto_deuda": null,
            "estado": "pendiente"
        },
        "corte_definitivo": {
            "activado": false,
            "fecha_activacion": null,
            "motivo": null,
            "fecha_retiro_equipo": null,
            "estado": "pendiente"
        },
        "instalacion_anexo": {
            "activado": false,
            "fecha_activacion": null,
            "tipo_anexo": null,
            "costo_mensual": null,
            "es_gratis_registro": false,
            "estado": "pendiente"
        },
        "corte_anexo": {
            "activado": false,
            "fecha_activacion": null,
            "anexo_id": null,
            "motivo": null,
            "estado": "pendiente"
        }
    }'::jsonb,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_plantillas_config CHECK (jsonb_typeof(configuracion_reglas) = 'object'),
    CONSTRAINT chk_plantillas_funciones CHECK (jsonb_typeof(funciones_especiales) = 'object')
);

CREATE INDEX idx_tickets_plantillas_nombre ON tickets_plantillas (nombre_ticket);

-- ============================================================================
-- TABLA: tickets_ordenes (Historial Global de Tickets de los Clientes)
-- ============================================================================
CREATE TABLE tickets_ordenes (
    id SERIAL PRIMARY KEY,
    correlativo_ticket INTEGER NOT NULL,
    codigo_ticket VARCHAR(50) UNIQUE NOT NULL,
    servicio_id INTEGER NOT NULL REFERENCES servicios_abonados (id) ON DELETE RESTRICT,
    plantilla_id INTEGER NOT NULL REFERENCES tickets_plantillas (id) ON DELETE RESTRICT,
    categoria categoria_ticket NOT NULL,
    area area_ticket NOT NULL,
    tecnologia tecnologia_ticket NOT NULL,
    modalidad modalidad_ticket NOT NULL,
    nombre_ticket VARCHAR(200) NOT NULL,
    estado estado_ticket NOT NULL DEFAULT 'pendiente',
    prioridad prioridad_ticket NOT NULL DEFAULT 'media',
    precio_base DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    configuracion_reglas JSONB NOT NULL,
    funciones_especiales JSONB NOT NULL,
    empleado_atc_generador_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
    tecnico_asignado_id INTEGER REFERENCES usuarios (id) ON DELETE RESTRICT,
    materiales_consumidos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ruta_foto_evidencia TEXT,
    notas TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_completado TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_tickets_config CHECK (jsonb_typeof(configuracion_reglas) = 'object'),
    CONSTRAINT chk_tickets_funciones CHECK (jsonb_typeof(funciones_especiales) = 'object'),
    CONSTRAINT chk_tickets_materiales CHECK (jsonb_typeof(materiales_consumidos_json) = 'array')
);

CREATE INDEX idx_tickets_busqueda_operativa ON tickets_ordenes (estado, area, categoria);

CREATE INDEX idx_tickets_ordenes_categoria ON tickets_ordenes (categoria);

CREATE INDEX idx_tickets_ordenes_area ON tickets_ordenes (area);

CREATE INDEX idx_tickets_ordenes_tecnologia ON tickets_ordenes (tecnologia);

CREATE INDEX idx_tickets_ordenes_modalidad ON tickets_ordenes (modalidad);

CREATE INDEX idx_tickets_ordenes_estado ON tickets_ordenes (estado);

CREATE INDEX idx_tickets_ordenes_prioridad ON tickets_ordenes (prioridad);

CREATE INDEX idx_tickets_ordenes_servicio ON tickets_ordenes (servicio_id);

CREATE INDEX idx_tickets_ordenes_plantilla ON tickets_ordenes (plantilla_id);

CREATE INDEX idx_tickets_ordenes_atc_generador ON tickets_ordenes (empleado_atc_generador_id);

CREATE INDEX idx_tickets_ordenes_fecha_creacion ON tickets_ordenes (fecha_creacion);



-- ============================================================================
-- TABLA: facturacion_pagos (Regla D3: Separacion de flujos dinamicos)
-- ============================================================================
CREATE TABLE facturacion_pagos (
    id SERIAL PRIMARY KEY,
    servicio_id INTEGER NOT NULL REFERENCES servicios_abonados (id) ON DELETE RESTRICT,
    ruc_emisor_id INTEGER NOT NULL REFERENCES ruc (id) ON DELETE RESTRICT,
    caja_id INTEGER REFERENCES cajas (id) ON DELETE RESTRICT,
    usuario_id INTEGER REFERENCES usuarios (id) ON DELETE RESTRICT,
    tipo_documento tipo_documento_fiscal NOT NULL,
    numero_documento VARCHAR(50),
    tipo_transaccion tipo_transaccion NOT NULL,
    metodo_pago metodo_pago,
    monto DECIMAL(12, 2) NOT NULL,
    saldo_anterior DECIMAL(12, 2),
    saldo_posterior DECIMAL(12, 2),
    descripcion TEXT,
    descuento_pago_anticipado BOOLEAN DEFAULT FALSE,
    exoneracion_deuda BOOLEAN DEFAULT FALSE,
    cuota_mensual_indexada BOOLEAN DEFAULT FALSE,
    numero_cuota INTEGER,
    vendedor_id INTEGER REFERENCES usuarios (id) ON DELETE RESTRICT,
    fecha_transaccion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata_transaccion_json JSONB DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT chk_facturacion_metadata CHECK (jsonb_typeof(metadata_transaccion_json) = 'object')
);

CREATE INDEX idx_facturacion_servicio ON facturacion_pagos (servicio_id);

CREATE INDEX idx_facturacion_ruc_emisor ON facturacion_pagos (ruc_emisor_id);

CREATE INDEX idx_facturacion_caja ON facturacion_pagos (caja_id);

CREATE INDEX idx_facturacion_caja_fecha ON facturacion_pagos (caja_id, fecha_transaccion);

CREATE INDEX idx_facturacion_usuario ON facturacion_pagos (usuario_id);

CREATE INDEX idx_facturacion_tipo_documento ON facturacion_pagos (tipo_documento);

CREATE INDEX idx_facturacion_tipo_transaccion ON facturacion_pagos (tipo_transaccion);

CREATE INDEX idx_facturacion_fecha_transaccion ON facturacion_pagos (fecha_transaccion);

CREATE INDEX idx_facturacion_fecha_vencimiento ON facturacion_pagos (fecha_vencimiento);

CREATE INDEX idx_facturacion_vendedor ON facturacion_pagos (vendedor_id);

-- ============================================================================
-- TABLA: tareas_llamadas (Regla C1: Funcionalidades esenciales del MVP)
-- ============================================================================
CREATE TABLE tareas_llamadas (
    id SERIAL PRIMARY KEY,
    servicio_id INTEGER NOT NULL REFERENCES servicios_abonados (id) ON DELETE RESTRICT,
    empleado_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
    estado_contacto estado_contacto_llamada NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_ejecucion TIMESTAMP WITH TIME ZONE,
    fecha_vencimiento_tarea TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_tareas_llamadas_pendientes ON tareas_llamadas (
    empleado_id,
    estado_contacto,
    fecha_vencimiento_tarea
);

CREATE INDEX idx_tareas_llamadas_servicio ON tareas_llamadas (servicio_id);

CREATE INDEX idx_tareas_llamadas_estado ON tareas_llamadas (estado_contacto);

CREATE INDEX idx_tareas_llamadas_fecha_asignacion ON tareas_llamadas (fecha_asignacion);

CREATE INDEX idx_tareas_llamadas_fecha_vencimiento ON tareas_llamadas (fecha_vencimiento_tarea);

-- ============================================================================
-- TABLA: auditoria_cambios (Control estricto de trazabilidad global)
-- ============================================================================
CREATE TABLE auditoria_cambios (
    id SERIAL PRIMARY KEY,
    nombre_tabla VARCHAR(100) NOT NULL,
    registro_id INTEGER NOT NULL,
    tipo_operacion VARCHAR(20) NOT NULL,
    usuario_id INTEGER REFERENCES usuarios (id) ON DELETE SET NULL,
    fecha_evento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    valores_antiguos JSONB,
    valores_nuevos JSONB,
    columna_modificada VARCHAR(100),
    contexto_operativo TEXT,
    CONSTRAINT chk_auditoria_valores_antiguos CHECK (valores_antiguos IS NULL OR jsonb_typeof(valores_antiguos) = 'object'),
    CONSTRAINT chk_auditoria_valores_nuevos CHECK (valores_nuevos IS NULL OR jsonb_typeof(valores_nuevos) = 'object')
);

CREATE INDEX idx_auditoria_tabla ON auditoria_cambios (nombre_tabla);
CREATE INDEX idx_auditoria_registro ON auditoria_cambios (nombre_tabla, registro_id);
CREATE INDEX idx_auditoria_fecha ON auditoria_cambios (fecha_evento);
CREATE INDEX idx_auditoria_usuario ON auditoria_cambios (usuario_id);
CREATE INDEX idx_auditoria_valores_antiguos ON auditoria_cambios USING GIN (valores_antiguos);
CREATE INDEX idx_auditoria_valores_nuevos ON auditoria_cambios USING GIN (valores_nuevos);

-- ============================================================================
-- TABLA: caja_movimientos (Movimientos diarios de caja chica)
-- ============================================================================
CREATE TABLE caja_movimientos (
    id SERIAL PRIMARY KEY,
    sede_id INTEGER NOT NULL REFERENCES sedes (id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id) ON DELETE RESTRICT,
    tipo_movimiento VARCHAR(20) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL,
    monto DECIMAL(12, 2) NOT NULL,
    ruta_evidencia TEXT,
    descripcion TEXT,
    fecha_movimiento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_caja_movimientos_sede ON caja_movimientos (sede_id);
CREATE INDEX idx_caja_movimientos_usuario ON caja_movimientos (usuario_id);
CREATE INDEX idx_caja_movimientos_fecha ON caja_movimientos (fecha_movimiento);

-- ============================================================================
-- LÓGICA DE NEGOCIO (Filtros, Secuencias, Acciones y Vistas)
-- ============================================================================



-- ============================================================================
-- VISTAS
-- ============================================================================




-- ============================================================================
-- COMENTARIOS DE DOCUMENTACION
-- ============================================================================

COMMENT ON TABLE usuarios IS 'Tabla unificada para administradores y empleados con jerarquia operativa';

COMMENT ON TABLE sedes IS 'Sedes operativas con coordenadas latitud/longitud DECIMAL (temporal - migrar a PostGIS cuando esté disponible)';

COMMENT ON TABLE ruc IS 'Informacion fiscal consolidada con relacion flexible a sedes';

COMMENT ON TABLE planes IS 'Planes de servicio asociados a sedes con reglas de cobro';

COMMENT ON TABLE sectores IS 'Sectores geograficos vinculados a sedes';

COMMENT ON TABLE hubs IS 'Hubs opticos conectados a sedes con coordenadas latitud/longitud DECIMAL (temporal - migrar a PostGIS cuando esté disponible)';

COMMENT ON TABLE fibras_opticas IS 'Tendido lógico de red entre hubs (sin control de hilos individuales)';

COMMENT ON TABLE mufas IS 'Mufas como nodos lógicos de interconexión con coordenadas latitud/longitud DECIMAL (temporal - migrar a PostGIS cuando esté disponible, sin mapa_fusiones)';

COMMENT ON TABLE cajas_nap IS 'Cajas NAP vinculadas a sector y fibra optica con coordenadas latitud/longitud DECIMAL (temporal - migrar a PostGIS cuando esté disponible)';

COMMENT ON TABLE abonados IS 'Registro unico de identidad natural o juridica';

COMMENT ON TABLE servicios_abonados IS 'Servicios conectados a abonado y caja_nap con coordenadas latitud/longitud DECIMAL (temporal - migrar a PostGIS cuando esté disponible)';

COMMENT ON TABLE tickets_plantillas IS 'Catálogo maestro de tipos de tickets y sus plantillas de configuración';

COMMENT ON TABLE tickets_ordenes IS 'Historial global de todos los tickets generados para todos los clientes';

COMMENT ON TABLE facturacion_pagos IS 'Historial financiero y de arqueo de caja transaccional consolidado';

COMMENT ON TABLE tareas_llamadas IS 'Gestion operativa de llamadas de cobranza vinculada a servicios y ATC';

COMMENT ON TABLE auditoria_cambios IS 'Tabla central de auditoria para trazabilidad global de cambios en formato JSONB';

COMMENT ON COLUMN sectores.poligono_coordenadas_json IS 'Polígono que define el perímetro del sector en formato de arreglo de coordenadas: [[lat, lng], [lat, lng], ...]';

COMMENT ON COLUMN fibras_opticas.ruta_coordenadas_json IS 'Trazado secuencial de la ruta física del tendido de fibra en formato de arreglo: [[lat, lng], [lat, lng], ...]';

COMMENT ON COLUMN mufas.registro_coordenadas_json IS 'Registro flexible de puntos de anclaje de la mufa: {"anclajes": [{"nombre": "A1", "coordenadas": [lat, lng]}]} o similar';

COMMENT ON COLUMN facturacion_pagos.metadata_transaccion_json IS 'Detalle dinámico de la transacción (ítems, descuentos aplicados, respuestas SUNAT): {"items": [], "sunat_hash": "...", "sunat_response": "..."}';

COMMENT ON COLUMN abonados.datos_adicionales_json IS 'Informacion comercial variable: referencias de casa, color de fachada, telefono de respaldo, etc.';

COMMENT ON COLUMN servicios_abonados.numero_contrato IS 'Numero unico de contrato fisico legalizado para control documental';

COMMENT ON COLUMN servicios_abonados.codigo_precinto IS 'Numero de precinto fisico de seguridad colocado en la Caja NAP';

COMMENT ON COLUMN servicios_abonados.router_serie IS 'Numero de serie del router del cliente en planta interna';

COMMENT ON COLUMN servicios_abonados.router_mac IS 'Direccion MAC del router del cliente en planta interna (formato XX:XX:XX:XX:XX:XX)';

COMMENT ON COLUMN servicios_abonados.vendedora_id IS 'ID de la vendedora que realizo la venta para metricas de rendimiento';

COMMENT ON COLUMN servicios_abonados.control_operativo_json IS 'Matriz JSONB dinamica para control operativo: parametros ONT (potencia_dbm, modelo), promesas/descuentos pendientes (monto, periodo_aplicacion, autorizado_por_id), paquetes de apps gratuitas/combinadas (aplicacion, costo_exoneracion)';

COMMENT ON COLUMN tickets_ordenes.configuracion_reglas IS 'Matriz JSONB dinamica que contiene permisos, automatizacion de sistemas y comandos OLT/Core';
# REGLAS DE BASE DE DATOS - SIT TELECABLE

## ACTUALIZACIÓN DEL MAPA DE MODELOS

Para mantener el mapa de modelos actualizado con cada cambio en la base de datos, ejecutar:

```bash
python manage.py generar_mapa_modelos
```

Esto generará/actualizará el archivo `database/mapa_modelos.md` con la estructura actual de todos los modelos del sistema.

---

## 1. ARQUITECTURA GLOBAL Y MODULAR

**Centralización de Clientes:**
- Datos maestros (DNI, RUC, nombres, correos) en entidad centralizada de clientes
- Un cliente puede tener múltiples contratos de servicios en diferentes ubicaciones
- Prohibido duplicar datos de contacto en tablas de conexiones físicas o suministros

**Unificación de Personal:**
- Prohibido crear tablas separadas para "administradores" y "empleados"
- Personal unificado en estructura jerárquica con relaciones de supervisión

**Compatibilidad Django:**
- Estructura de clientes compatible con autenticación nativo de Django
- Longitudes exactas para DNI (8 dígitos) y RUC (11 dígitos) según normas peruanas

**Relaciones por Cascada:**
- Prohibido cruzar relaciones foráneas
- Suministro se vincula a su punto de red directo (Caja NAP)
- Sistema deduce Hub y Sede por herencia lógica ascendente (sin llaves duplicadas)

## 2. GEOLocalización SIN DEPENDENCIAS EXTERNAS

**Puntos Únicos (Sedes, Hubs, Servicios):**
- Usar columnas decimales tradicionales: latitud (DECIMAL), longitud (DECIMAL)
- Prohibido usar PostGIS o extensiones espaciales de base de datos

**Datos Complejos (Polígonos, Trazados, Mufas):**
- Usar columnas JSONB nativas de PostgreSQL
- Estructura JSON: `{"coordenadas": [[lat, lon], ...], "tipo": "poligono"}`
- Procesamiento espacial en Backend Python (no en base de datos)

**Prohibiciones:**
- Prohibido PostGIS
- Prohibido extensiones espaciales de base de datos
- Prohibido funciones espaciales en SQL

## 3. FILTROS OPERATIVOS (ANTI-TABLAS)

**Categorías Estáticas:**
- Áreas de tickets, Tecnologías, Modalidades de soporte, Categorías de incidencias
- Si no requieren panel administrativo para crear/borrar en caliente → usar tipos enumerados nativos
- Prohibido crear tablas independientes con IDs para filtros operativos

**Tipos Enumerados PostgreSQL:**
```sql
CREATE TYPE tipo_ticket AS ENUM ('INSTALACION', 'REPARACION', 'MANTENIMIENTO');
CREATE TYPE tecnologia AS ENUM ('FIBRA', 'COAXIAL', 'WIRELESS');
```

## 4. PURE-STORE (CERO LÓGICA EN BASE DE DATOS)

**Prohibiciones Estrictas:**
- Prohibido CREATE FUNCTION (funciones personalizadas)
- Prohibido CREATE TRIGGER (disparadores)
- Prohibido procedimientos almacenados
- Prohibido lógica de negocio en base de datos

**Lógica en Backend:**
- Códigos correlativos de tickets → Python
- Facturación dinámica → Python
- Logs de auditoría → Python
- Base de datos = almacén relacional limpio y rápido

## 5. ESCALABILIDAD MEDIANTE JSONB

**Tabla Planes:**
- Columna `caracteristicas_tecnicas_json` (JSONB) con índices GIN
- Estructura modular sin columnas físicas adicionales:
```json
{
  "caracteristicas_base": {
    "velocidad_mbps": 100,
    "cantidad_canales": 150,
    "aplicaciones_digitales": ["netflix", "youtube"]
  },
  "activacion_funciones": {
    "admite_prorrogas": true,
    "compromisos_pago_flexibles": true,
    "bloqueo_automatico_mora": false
  },
  "permisos_formularios": {
    "requiere_api_externa_olt": false,
    "permite_cambio_mufa_campo": true
  }
}
```
- Prohibido agregar columnas físicas para cada funcionalidad comercial

**Generalización:**
- Ante nuevo requerimiento → usar JSONB existente
- Prohibido ALTER TABLE ADD COLUMN (salvo JSONB)

## 6. GESTIÓN DE TICKETS

**Plantillas vs Tickets Reales:**
- Plantillas: `servicio_id IS NULL`, `correlativo_ticket = 0`, `codigo_ticket = NULL`
- Tickets reales: `servicio_id IS NOT NULL`, correlativo inicia en 1, código con prefijos (I-, R-, V-)

**Numeración:**
- Correlativo único solo para tickets asignados a cliente real
- Prefijos por categoría definidos en backend Python

## 7. INTEGRIDAD Y PROTECCIÓN

**Restricciones de Eliminación:**
- Si entidad tiene registros dependientes activos → impedir eliminación
- Prohibido borrado en cascada de infraestructura con clientes en producción
- Error operativo en frontend no debe eliminar nodo de red

**Separación de Flujos:**
- Infraestructura estática (red) independiente de transacciones dinámicas
- Cliente/nodo existen por sí mismos
- Tickets, facturas, pagos apuntan referencialmente (no integridad física)

**Zona Horaria:**
- Fechas, auditoría, historiales con tipos temporales con zona horaria nativa
- Compatible con auditorías de sistemas, pasarelas de pago, facturación electrónica
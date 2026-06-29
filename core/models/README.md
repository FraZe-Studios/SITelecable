# El sistema debe adaptarse a la base de datos

Este módulo define la capa de datos en Django (`core/models/`) mapeada directamente a partir del esquema físico en PostgreSQL (`database/esquema_completo.sql`).

---

## 1. Mapeo Unidireccional y Adaptabilidad (`managed = False`)

Todos los modelos están configurados bajo la directiva `managed = False`. Esto significa que Django **no genera migraciones automáticas ni modifica el esquema físico**. La base de datos de PostgreSQL (`database/esquema_completo.sql`) es la fuente única de verdad. Cualquier cambio en la BD (tablas, columnas o tipos de datos) requiere adaptar manualmente las clases e imports de Django a dicha estructura.

---

## 2. Mapa de Conexiones (Qué se conecta con qué)

### A. Infraestructura Física de Red
- **Sedes (`Sedes`)**: Punto de inicio geográfico del servicio.
- **Sectores (`Sectores`)**: Subdivisiones lógicas y geográficas asociadas a una sede (`sede_id`).
- **Cajas NAP (`CajasNap`)**: Cajas terminales ópticas asociadas a un sector (`sector_id`).
- **Servicios Abonados (`ServiciosAbonados`)**: Cada suscripción de cliente se asocia a una Caja NAP física a través de `caja_nap_id`. De esta jerarquía (Servicio -> NAP -> Sector -> Sede) el sistema deduce dinámicamente la sucursal de pertenencia.
- **Hubs, Mufas y Fibras**: Conectan la planta externa desde la sede hasta los abonados finales.

### B. Configuración de Facturación y Series SUNAT
- **Ruc (`Ruc`)**: Configuración fiscal maestra de la empresa.
- **RucSedes (`RucSedes`)**: Vinculación intermedia (`ruc_sedes` en la BD) para asociar un RUC a una sede física.
  - Almacena columnas clave para SUNAT: `prefijo_boleta`, `prefijo_factura`, `numero_actual_boleta` y `numero_actual_factura`.
  - Al emitirse una boleta o factura, el sistema busca en esta tabla las series correspondientes según la sede del cliente para evitar colisión de numeraciones.

### C. Tickets de Trabajo y Gestión
- **CatalogoTickets (`CatalogoTickets`)**: Plantillas maestras de los tipos de tickets disponibles.
- **TicketsOrdenes (`TicketsOrdenes`)**: Órdenes de trabajo asociadas a un servicio (`servicio_id`).
  - Utiliza el tipo ENUM `categoria_ticket` definido de forma estricta en PostgreSQL.
  - En `TicketsOrdenes.save()`, el sistema remapea automáticamente cualquier categoría obsoleta (como `'pirateria'` y `'otros'`) a `'incidencia'` / `'requerimiento'` antes de guardar para satisfacer las restricciones de base de datos.
  - Almacena parámetros variables y flags en el campo JSONB `configuracion_reglas` (omite deudas, cambio de equipos, etc.).

### D. Capa Financiera y Transaccional
- **FacturacionPagos (`FacturacionPagos`)**: Registro de deudas (cargos) y cobros (abonos) vinculados a una suscripción de cliente.
- **CajaMovimientos (`CajaMovimientos`)**: Movimientos diarios de caja chica (efectivo, transferencia) asociados a una sede y un cajero.

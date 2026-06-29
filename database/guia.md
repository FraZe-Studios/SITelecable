# Guía de Conexiones y Arquitectura SIT Telecable

Este documento detalla las interconexiones físicas y lógicas de los componentes en la base de datos y la lógica del sistema.

## 1. Conexiones Físicas e Infraestructura de Red

La infraestructura de red se organiza en una jerarquía física estricta. Las relaciones foráneas directas se simplifican para evitar dependencias cruzadas redundantes:

- **Suscripción (ServiciosAbonados)**: Cada suscripción activa se asocia directamente a una **Caja NAP** mediante la columna `caja_nap_id`.
- **Caja NAP**: Cada Caja NAP pertenece a un **Sector** (`sector_id`).
- **Sector**: Cada Sector pertenece a una **Sede** (`sede_id`).
- **Fibras Ópticas y Mufas**: Las fibras ópticas conectan **Hubs** con **Mufas** y **Cajas NAP**.

El sistema en Python deduce dinámicamente el Hub y la Sede de una suscripción ascendiendo por la jerarquía (Suscripción -> Caja NAP -> Sector -> Sede).

---

## 2. Emisión SUNAT por Sucursal (RucSedes)

Para cumplir con las normas de SUNAT que exigen que cada sucursal emita comprobantes con series separadas (por ejemplo, Huancayo F001 y La Oroya F002):

- La tabla intermedia **`ruc_sedes`** actúa como puente de vinculación entre la configuración fiscal del **`ruc`** y la sucursal física **`sedes`**.
- Almacena columnas clave de SUNAT:
  - `prefijo_boleta` (VARCHAR(4) por defecto 'B001')
  - `prefijo_factura` (VARCHAR(4) por defecto 'F001')
  - `numero_actual_boleta` (INTEGER)
  - `numero_actual_factura` (INTEGER)
- Cuando el sistema genera un pago y emite la boleta/factura correspondiente, consulta el prefijo y número correlativo en `ruc_sedes` según la sede del cliente, garantizando series diferenciadas sin colisiones.

---

## 3. Catálogo Maestro de Plantillas de Tickets

La base de datos maneja un catálogo maestro en la tabla `tickets_plantillas`. 
- **Categorías Estrictas:** PostgreSQL restringe las categorías de tickets usando el tipo ENUM `categoria_ticket` (valores como `'instalacion'`, `'incidencia'`, `'averia'`, `'requerimiento'`, `'mantenimiento'`, `'soporte'`, `'cambio_plan'`, `'traslado'`, `'baja'`, `'reparacion'`).
- **Remapeo de Categorías en Caliente:** Para evitar excepciones del motor de base de datos (`invalid input value for enum`), la lógica de negocio en Django intercepta en el método `save()` categorías no contempladas de forma nativa (por ejemplo, remapeando reportes de piratería `'pirat'` o categorías de fallback a la categoría estándar `'incidencia'`).
- **Estructura JSONB:** Las plantillas de tickets y las órdenes reales almacenan campos de comportamiento flexible en la columna JSONB `funciones_especiales` (incluyendo flags y datos para `cambio_equipo`, `migracion_plan`, `instalacion`, `cobra_materiales`, etc.). Esto garantiza la compatibilidad entre el motor de base de datos y Django sin alterar las columnas físicas de la tabla.

# Reglas de Arquitectura del Módulo de Organización y Configuración de Sedes
🗺️ Mapa de Componentes Locales (Pendiente de Validación)
Nota: Las rutas, archivos físicos y dependencias exactas de la interfaz de organización e infraestructura quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios para cumplir estrictamente con la norma de nomenclatura monopalabra.

**Rutas del Módulo Organización**
- Plantillas HTML principales y componentes:
  - `templates/organizacion/organizacion.html`
  - `templates/organizacion/components/modals/confirm_modal.html`
  - `templates/organizacion/components/modals/import_modal.html`
  - `templates/organizacion/components/modals/org_modal.html`
  - `templates/organizacion/components/modals/sede_config_overlay.html`
  - `templates/organizacion/components/forms/organizacion_form.html`
  - `templates/organizacion/components/forms/sede_form.html`
  - `templates/organizacion/sede/datos.html`
  - `templates/organizacion/sede/planes.html`
  - `templates/organizacion/sede/rucs.html`
  - `templates/organizacion/sede/ticket_print.html`

**Hojas de estilo CSS**
- `static/css/organizacion.css`

**JavaScript**
- `static/js/organizacion/organizacion.js`
- `static/js/organizacion/organizacion_component.js`
- `static/js/organizacion/charts/map_chart.js`
- `static/js/organizacion/charts/stats_chart.js`
- `static/js/global/theme_controller.js`   *(gestión del modo claro/oscuro)*

**Endpoints API (Python)**
- `core/views_organizacion.py` contiene los endpoints:
  - `api_organizacion_sedes`
  - `api_organizacion_materiales`
  - `api_organizacion_tickets`
  - `api_organizacion_personal`

🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Control de Infraestructura y Capas del Mapa
La interfaz principal de este módulo contiene el mapa geoespacial unificado del sistema. La UI debe estructurar capas de visualización asíncronas para renderizar y gestionar de forma aislada o conjunta los siguientes elementos clave de la red:

Nivel Operativo: Clientes, Sedes y Sectores.

Nivel de Planta Externa: HUBs, Mufas, NAPs y tendidos de Fibra óptica.

2. Panel de Configuración Modular por Sede
Al seleccionar una Sede, la interfaz se despliega en ventanas modales internas divididas estrictamente en los siguientes 7 submódulos funcionales:

A. Datos Estructurales y GPS
B. Configuración de RUC y Facturación
Límites Mensuales de Recaudación
Vista Previa
C. Catálogo de Planes
D. Gestión de Personal
E. Matriz de Habilidades
F. Inventario de Materiales
G. Control de Tickets y Funciones Automatizadas

3. Arquitectura SPA sin Redirecciones
  - `templates/organizacion/sede/planes.html`
  - `templates/organizacion/sede/rucs.html`
  - `templates/organizacion/sede/ticket_print.html`

- **CSS**
  - `static/css/organizacion.css`

- **JavaScript**
  - `static/js/organizacion/organizacion.js`
  - `static/js/organizacion/organizacion_component.js`
  - `static/js/organizacion/charts/map_chart.js`
  - `static/js/organizacion/charts/stats_chart.js`
  - `static/js/global/theme_controller.js`

- **Python Endpoints**
  - `core/views_organizacion.py` (endpoints: `api_organizacion_sedes`, `api_organizacion_materiales`, `api_organizacion_tickets`, `api_organizacion_personal`)
4. Cero Comentarios en HTML y Limpieza Absoluta
    Los archivos HTML pertenecientes a la infraestructura y configuración de organización no contendrán comentarios de desarrollo (`<!-- ... -->`).

## Funciones Especiales

- **Migración de plan** – Al liquidar, corta el plan actual y activa el nuevo plan seleccionado.
- **Derivar orden de Cambio de equipo** – Genera automáticamente una orden adicional para cambio de equipo al liquidar.
- **Instalación** – Activa flujo de instalación.
- **Cobra materiales** – Genera cargo por materiales.
- **Editar mapa** – Permite editar posición NAP.
- **Mantiene equipo** – El equipo anterior se mantiene.
- **Nuevo suministro** – Requiere N° suministro nuevo.
- **Genera merma** – Registra baja de materiales.
- **Cambio de equipo** – Activa flujo de reemplazo de dispositivo.
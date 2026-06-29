rutas.calendario.md: Reglas de Arquitectura del Módulo de Calendario
🗺️ Mapa de Componentes Locales (Pendiente de Validación)
Nota: Las rutas y archivos exactos de este módulo quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios para cumplir estrictamente con la norma de nomenclatura monopalabra.
**Rutas del Módulo Calendario**
- Plantilla HTML: `templates/calendario/calendario.html`
- Componentes reutilizables: `templates/calendario/components/…`

**Hojas de estilo CSS**
- `static/global/css/global.css`
- `static/global/css/layout.css`
- `static/css/calendario.css`

**JavaScript**
- `static/js/calendario/calendario.js`
- `static/global/js/theme_controller.js`   *(gestión del modo claro/oscuro)*

**Endpoints API (Python)**
- `core/views_calendario.py` contiene los endpoints:
  - `calendario_view`
  - `api_calendario_resumen`
  - `api_calendario_tickets`
  - `api_calendario_actualizar`
🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Separación de Vistas (Tickets y Clientes Independientes)
La interfaz del calendario debe segmentar de forma clara y separada la visualización de Tickets y la de Clientes/Facturación mediante filtros de alternancia asíncronos. Queda prohibido mezclar ambos flujos en un mismo pool de eventos sin control del usuario.

2. Control de Clientes, Ciclos de Facturación y Seguimiento
Origen del Ciclo: La presencia de un cliente en el calendario de pagos se calcula dinámicamente desde su fecha de instalación original, proyectando sus mensualidades según la configuración específica de su plan de internet/cable.

Métricas de Recaudación: La interfaz debe proveer contadores resumidos en las vistas de Día, Semana y Mes que reflejen con precisión cuántos clientes inician ciclo de pago o registran deudas en dichos rangos de tiempo.

Trazabilidad de Auditoría: La vista detallada del cliente en este módulo debe permitir el seguimiento histórico de sus aportes, mostrando obligatoriamente los datos de quién lo registró en el sistema y quién lo atendió en los procesos de contrato e instalación.

3. Control de Tickets, Generación y Reprogramación
Métricas Operativas: Los tickets se visualizan de manera aislada por rangos de Día, Semana y Mes, desglosando de forma transparente la identidad del personal que generó el ticket y del técnico o ATC que lo atendió.

Gestión Dinámica: La interfaz debe habilitar la reprogramación de fechas de los tickets mediante acciones interactivas dentro del calendario, impactando directamente la asignación temporal sin salir del módulo.

4. Atajos Directos (Fichas del Cliente)
Tanto los eventos de la sección de Clientes como los eventos de la sección de Tickets deben incluir un componente de enlace rápido (Atajo) que abra de forma inmediata la ficha de administración resumida del cliente en una ventana emergente.

5. Exportación de Datos a Excel (Descarga Limpia)
El módulo debe incorporar un control de descarga de reportes en formato Excel de manera segmentada:

Sección Clientes: Exportación del listado de abonados filtrados por fecha de pago, incluyendo la trazabilidad de registro y contratos.

Sección Tickets: Exportación de las órdenes del día, semana o mes seleccionado, detallando creadores, asignados y estados actuales.

6. Restricción por Sede, Filtros y Ventas ATC
Comportamiento por Defecto: Al cargar el calendario, los datos de tickets y registros de clientes se filtran automáticamente mostrando únicamente la sede vinculada al perfil del personal en sesión. El personal de ATC solo visualizará sus ventas y su historial resumido de actividades de forma nativa.

Filtro Especial Inter-Sedes: La visualización de órdenes o clientes pertenecientes a otras sedes queda restringida. Solo se permitirá su despliegue mediante la activación explícita de un filtro especial de sedes, condicionado a los permisos de supervisión del usuario.

7. Arquitectura SPA y Ventanas Modales
Toda la interacción de reprogramación, la visualización del pool lateral de elementos sin programar, las consultas de historial resumido de clientes y la apertura de las fichas de abonados se procesarán en ventanas emergentes o modales internos, garantizando que el usuario de ATC no abandone la pantalla del calendario operativo.

8. Cero Comentarios en HTML y Limpieza Absoluta
Los archivos HTML pertenecientes a este módulo no pueden contener comentarios de desarrollo (``). Solo se permiten etiquetas de estructura y títulos visibles.

Cualquier duda de uso técnico, códigos de colores de los eventos o instrucciones de reprogramación se resolverá visualmente dentro del componente de ayuda interactiva (?), el cual desplegará un modal limpio con los puntos correspondientes.
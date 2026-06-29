rutas.global.md: Reglas de Arquitectura del Módulo Global y Componentes Reutilizables
🗺️ Mapa de Componentes Locales (Pendiente de Validación)
Nota: Las rutas, archivos físicos y dependencias exactas de los elementos compartidos quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios para cumplir estrictamente con la norma de nomenclatura monopalabra.

**Rutas del Módulo Global**
- Plantillas HTML: `templates/global/base.html`, `templates/global/components/…` (fragmentos reutilizables como encabezados, pies, modales)

**Hojas de estilo CSS**
- `static/css/global.css`

**JavaScript**
- `static/js/global/theme_controller.js`   *(gestión del modo claro/oscuro y notificaciones globales)*

**Endpoints API (Python)**
- `core/views.py` contiene los endpoints globales compartidos:
  - `api_global_config`
  - `api_global_tema`
  - `api_global_notificaciones`
  - `api_global_plantilla`

🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Polimorfismo Estructural de Documentos (Doble Propósito)
Absolutamente todos los layouts de documentos oficiales del sistema (Tickets/Órdenes, Boletas, Facturas, Notas de Venta) se diseñan bajo un único componente HTML global y reutilizable por tipo de documento.

Modo Vista Previa: El componente debe ser capaz de renderizarse de forma pasiva dentro de ventanas emergentes o modales de interfaz, mostrando los datos comerciales de manera estática para auditoría rápida del personal de ATC o Supervisión.

Modo Utilidad Operativa: El mismo archivo debe proveer la lógica visual limpia para los flujos de impresión física, exportación a archivos PDF o procesamiento transaccional de emisión, prohibiendo la duplicidad de archivos HTML para el mismo formato.

2. Encapsulamiento y Cero Redundancia UI
Queda terminantemente prohibido reescribir estructuras HTML repetitivas en las pantallas del sistema. Elementos comunes como tablas de reportes, encabezados de sedes, selectores de fechas, inputs de búsqueda por DNI/RUC o listados de transacciones se encapsulan como fragmentos globales.

El llamado de estas estructuras en los módulos independientes se realizará de manera limpia utilizando las etiquetas nativas de Django ({% include %}), reduciendo la extensión de las pantallas por debajo del límite normativo.

3. Centralización de Estilos Líquidos y Componentes Globales
Las interfaces del sistema no manejan estilos CSS aislados para componentes comunes. Los botones, modales de ventanas SPA, contenedores de alertas y el comportamiento visual del componente de ayuda (?) se gobiernan globalmente desde el archivo componentes.css.

Toda la paleta cromática y estructural debe estar amarrada a variables nativas líquidas, asegurando que cualquier llamada asíncrona o componente dinámico asimile el cambio de tema (Claro / Oscuro) de forma nativa e inmediata.

4. Desacoplamiento de Interactividad Compartida (JS Global)
El archivo JavaScript global se limita estrictamente a la manipulación genérica del DOM común: apertura/cierre automatizado de ventanas modales, el disparador visual del sistema de notificaciones Toast (SITAlert.show), la persistencia del tema en el almacenamiento local y la inicialización del componente interactivo de ayuda.

Toda validación analítica o procesamiento de datos de negocio de los documentos se delega a las capas asíncronas del backend.

5. Cero Comentarios en HTML y Limpieza Absoluta
Los archivos HTML globales y fragmentos reutilizables no contienen comentarios de desarrollo (<!-- -->). La estructura se mantiene limpia utilizando únicamente etiquetas semánticas y títulos.

El funcionamiento, estructura de parámetros requeridos para los fragmentos ({% include %}) y guías de reutilización técnica se documentarán visualmente dentro del componente de ayuda interactiva (?), desplegando un modal explicativo en pantalla cuando sea consultado por el desarrollador.
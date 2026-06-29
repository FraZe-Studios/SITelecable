Reglas de Arquitectura del Módulo de Facturación Electrónica SUNAT
🗺️ Mapa de Componentes Locales (Pendiente de Validación)
Nota: Las rutas, archivos físicos y dependencias exactas de este módulo quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios para cumplir estrictamente con la norma de nomenclatura monopalabra.
**Rutas del Módulo SUNAT**
- Plantillas HTML: `templates/sunat/sunat.html`, `templates/sunat/components/…` (modales, reportes)

**Hojas de estilo CSS**
- `static/css/sunat.css`

**JavaScript**
- `static/js/sunat/sunat.js`
- `static/js/global/theme_controller.js`   *(gestión del modo claro/oscuro)*

**Endpoints API (Python)**
- `core/views_sunat.py` contiene los endpoints:
  - `api_sunat_libros`
  - `api_sunat_descargar_xml`
  - `api_sunat_descargar_pdf`
  - `api_sunat_consultar_estado`


🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Restricción Estricta de Acceso por Rol (Admin y Supervisor)
La interfaz visual del panel de control de SUNAT, los libros contables y las herramientas de descarga fiscal quedan estrictamente restringidas para los roles de Administrador y Supervisor.

Si un usuario con rol operativo (como ATC o técnico) intenta forzar la ruta o consumir los endpoints de este módulo, la interfaz bloqueará la renderización de datos por completo. A nivel de servidor, se rechazará la petición mediante un código de estado 403 Forbidden.

2. Visor Histórico de Comprobantes y Libros por Resumen
La interfaz debe proveer filtros asíncronos para agrupar y auditar de forma limpia el historial de facturación de la empresa estructurado en los siguientes rangos temporales obligatorios:

Día / Semana / Mes / Año

Libros Contables Electrónicos: Sección dedicada a la visualización resumida de los libros de ingresos y ventas declarados, consolidando montos, estados de envío y resúmenes de transacciones por periodos fiscales sin mezclar datos operativos de cobranza.

3. Repositorio de Descargas de Documentos Fiscales
La interfaz debe implementar un panel de descarga directa y asíncrona que permita extraer los archivos físicos requeridos por la empresa y las auditorías contables:

Archivos Técnicos: Descarga del archivo estructurado XML, el archivo compreso ZIP y la Constancia de Recepción (CDR) emitida por SUNAT.

Formatos Corporativos: Descarga de reportes unificados en formatos Excel y PDF (formato A4 o formato ticket de los comprobantes emitidos).

4. Integración con el Componente Global de Vista Previa
La visualización visual previa de los comprobantes electrónicos (Boletas, Facturas, Notas de Crédito) antes de su descarga o impresión obligatoriamente debe invocar al componente polimórfico global unificado. Queda prohibida la duplicación de código o layouts HTML para la maquetación de los documentos impresos dentro de este módulo.

5. Arquitectura SPA y Ventanas Emergentes
Todo el flujo de transmisión manual, la consulta de estados de respuesta de SUNAT, el desglose de los libros contables resumidos y la configuración de filtros por RUC emisor se procesará en ventanas modales internas, manteniendo de forma limpia la persistencia del panel de control de SUNAT y evitando las recargas totales de la página.

6. Cero Comentarios en HTML y Limpieza Absoluta
El archivo HTML de facturación SUNAT no contendrá comentarios de desarrollo (<!-- -->). La estructura se mantendrá exclusivamente con etiquetas semánticas claras y títulos visibles.

Los manuales técnicos de contingencia fiscal, los códigos de error comunes de SUNAT (ej: rechazos de firmas) o los pasos para la renovación del certificado .p12 se documentarán visualmente dentro del componente de ayuda interactiva (?), desplegando un modal limpio explicativo.
Reglas de Arquitectura del Módulo de Tareas de Notificación ATC
🗺️ Mapa de Componentes Locales (Pendiente de Validación)
Nota: Las rutas, archivos físicos y dependencias exactas de este módulo quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios para cumplir estrictamente con la norma de nomenclatura monopalabra.

**Rutas del Módulo Tareas**
- Plantillas HTML: `templates/tareas/tareas.html`, `templates/tareas/components/…` (modales, formularios de notificación)

**Hojas de estilo CSS**
- `static/css/tareas.css`

**JavaScript**
- `static/js/tareas/tareas.js`
- `static/js/global/theme_controller.js`   *(gestión del modo claro/oscuro)*

**Endpoints API (Python)**
- `core/views_tareas.py` contiene los endpoints:
  - `api_tareas_lista`
  - `api_tareas_asignar`
  - `api_tareas_actualizar_estado`
  - `api_tareas_historial`

🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Inyección Acumulativa Diaria por Ciclo de Facturación (Proceso Progresivo)
Carga Progresiva por Día: Queda terminantemente prohibido cargar todas las notificaciones del mes en un solo bloque masivo. Las tareas se incrementan y se acumulan en los paneles de los operadores de ATC día por día, de forma automatizada.

Disparador de Ventana: Cada vez que un usuario del sistema cumple con su fecha calendario específica dentro de su ciclo de facturación, el backend calcula el umbral de anticipación e inyecta al abonado en el pool de tareas exactamente 15 días antes de su vencimiento individual, acumulándose progresivamente en las listas de trabajo diarias de los operadores.

2. Reparto Equitativo y Balanceado de Carga (Algoritmo de Equidad)
Distribución Exacta por Partes Iguales: La interfaz reflejará la asignación balanceada gestionada por el servidor. Si existen 60 clientes en el pool de alertas y hay 6 usuarios de ATC disponibles, el sistema obligatoriamente asignará 10 clientes a cada uno, sin importar si sus fechas de vencimiento pertenecen a fin de mes o a días de instalación distribuidos.

Compensación Dinámica: La UI debe mostrar contadores de progreso individuales. Si un operador de ATC ha completado 500 notificaciones y otro registra 450, el sistema priorizará la asignación de los nuevos registros acumulados al segundo operador hasta nivelar las métricas de cumplimiento, impidiendo la sobrecarga de trabajo en un solo usuario.

3. Registro de Gestión y Evidencias de Notificación
Cada tarea asignada en la pantalla del ATC debe contar con un panel de controles interactivos para auditar el cumplimiento del trabajo, incluyendo de forma obligatoria las siguientes opciones de estado:

Canales de Envío: Selección explícita del medio utilizado (WhatsApp, Mensaje de Texto (SMS), Llamada / Mensaje de Voz).

Resultados Operativos: Botones de estado rápido para marcar el fin de la tarea (Notificado, No contestó, Notificado a otro celular).

Bitácora de Comentarios: Espacio de texto obligatorio para que el operador detalle las incidencias o respuestas del abonado, cuya persistencia alimentará directamente el historial del cliente.

4. Arquitectura SPA y Ventanas de Gestión
La revisión de las listas de tareas asignadas, la apertura del formulario de evidencias para cada cliente y el control de los indicadores de equidad entre operadores se procesarán mediante componentes dinámicos y ventanas modales internas. Queda prohibido recargar la página del sistema para salvar los estados de las llamadas.

5. Cero Comentarios en HTML y Limpieza Absoluta
Los archivos HTML correspondientes a este módulo no contendrán comentarios ocultos de desarrollo (``). La estructura se mantendrá exclusivamente con etiquetas semánticas claras y títulos de sección visibles.

La tabla de equivalencias de asignación, las políticas de llamadas telefónicas y las instrucciones para el uso correcto de las plantillas de WhatsApp se documentarán visualmente dentro del componente de ayuda interactiva (?), desplegando un modal limpio con la información correspondiente.
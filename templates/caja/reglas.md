Reglas de Arquitectura del Módulo de Caja
🗺️ Mapa de Componentes Locales (Pendiente de Validación)
Nota: Las rutas y archivos exactos de este módulo quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios.
**Rutas del Módulo Caja**
- Plantilla HTML: `templates/caja/caja.html`
- Componentes reutilizables: `templates/caja/components/…` (si existieran)

**Hojas de estilo CSS**
- `static/global/css/global.css`
- `static/global/css/layout.css`
- `static/css/caja.css`

**JavaScript**
- `static/js/caja/caja.js`
- `static/global/js/theme_controller.js`   *(gestión del modo claro/oscuro)*

**Endpoints API (Python)**
- `core/views_caja.py` contiene los endpoints:
  - `caja_view`
  - `api_caja_resumen`
  - `api_caja_movimientos`
  - `api_caja_registrar`
  - `api_caja_toggle_permiso`
🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Control de Permisos y Acceso ATC
El acceso operativo para registrar abonos dentro de este módulo queda restringido exclusivamente al personal de Atención al Cliente (ATC) vinculado formalmente a la caja de la sede correspondiente.

Si el usuario en sesión no cuenta con los permisos de seguridad activos para registrar transacciones, la interfaz bloqueará los controles por completo. A nivel de servidor, se rechazará cualquier inserción mediante un código de estado 403 Forbidden.

2. Reinicio Automático e Inmutabilidad de Fechas
El saldo de la caja se restablece a S/ 0.00 de forma automatizada al iniciar cada día (00:00:00).

La interfaz permite navegar de manera histórica hacia fechas anteriores (ayer, antes de ayer, etc.) mediante selectores asíncronos. Al consultar el historial, los datos de días pasados se renderizan de forma estrictamente estática (vista de auditoría), quedando prohibida cualquier edición o inserción sobre fechas cerradas.

3. Filtros Personales y Consolidación de Sede
Filtro por Persona (ATC): Los usuarios operativos visualizan por defecto únicamente sus propios aportes y movimientos individuales. La interfaz debe calcular y mostrar el monto exacto en efectivo que dicho cajero específico debería tener físicamente en su poder.

Caja Total de Sede: Si múltiples usuarios de ATC abonan a la misma sede, aquellos con nivel de acceso autorizado podrán alternar la vista entre el desglose personal y el log consolidado de la caja total de la sede para el cuadre general.

4. Desacoplamiento de Flujos (Registro desde Clientes)
Queda estrictamente prohibido duplicar o procesar la lógica de administración, facturación o cobranza directa de clientes dentro del módulo de caja.

El registro y la gestión de los pagos se realizan exclusivamente desde el módulo o sistema de Clientes. La interfaz del módulo de Caja se limita estrictamente a actuar como un visor del historial, flujo de caja, movimientos personales y control del estado financiero diario de la sede vinculada.

5. Arquitectura SPA y Ventanas Modales
Todo el control de los filtros por fecha, visualización del log histórico, y administración de permisos de los cajeros se ejecutará mediante ventanas emergentes o modales dinámicos. Queda prohibido romper la persistencia de la pantalla principal mediante recargas completas o redirecciones de página.

6. Cero Comentarios en HTML y Limpieza Absoluta
El archivo HTML de caja no puede contener comentarios de desarrollo (``). Solo se permiten etiquetas de estructura y títulos visibles.

Cualquier duda operativa, instrucciones de cuadre o aclaraciones técnicas sobre el flujo de efectivo y transferencias se resolverá visualmente dentro del componente de ayuda interactiva (?). Este botón desplegará un modal limpio con los puntos correspondientes.
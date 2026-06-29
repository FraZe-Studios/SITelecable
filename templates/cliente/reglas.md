rutas.clientes.md: Reglas de Arquitectura del Módulo de Clientes
🗺️ Mapa de Componentes Locales (Ruta: c:/Users/ffran/Documents/SITelecable/templates/cliente)
Nota: Las rutas, archivos físicos y dependencias exactas de este módulo quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios para cumplir estrictamente con la norma de nomenclatura monopalabra.

**Rutas del Módulo Cliente**
- Plantillas HTML: `templates/cliente/abonados.html`, `templates/cliente/ficha.html`, `templates/cliente/modal_registro.html`, `templates/cliente/ticket_print.html`
- Componentes reutilizables: `templates/cliente/components/` (incluye `modal_registro.html`, `ficha_servicio_panel.html`)

**Archivos JavaScript utilizados**
- `static/js/abonados/abonados-main.js`
- `static/js/abonados/abonados-registro.js`
- `static/js/global/theme_controller.js`
- `static/js/organizacion/image-compressor.js`

**Hojas de estilo CSS**
- `static/css/abonados.css`
- `static/css/dashboard.css`
- `static/css/login.css`
- `static/css/navigation.css`
- `static/css/organizacion.css`

**Endpoints API (Python)**
- `core/views_abonados.py` contiene los endpoints:
  - `api_abonados_contexto`
  - `api_abonados_consultar_documento`
  - `api_abonados_evaluar_registro`
  - `api_abonados_consultar_suministro`
  - `api_abonados_registrar`
  - `api_abonados_subir_documento`
  - `api_abonados_generar_deuda`
  - `api_abonados_compromiso_pago`
  - `api_abonados_generar_ticket`
  - `api_abonados_turno_caja`
  - `api_abonados_turno_caja_abrir`
  - `api_abonados_registrar_pago`
  - `api_abonados_liquidar_ticket`
  - `api_abonados_actualizar_cliente`
  - `api_abonados_actualizar_servicio`
  - `api_abonados_derivar_ticket`


🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Gestión Segmentada de Órdenes (Planta Externa e Interna)
Planta Externa (Infraestructura Global): La interfaz debe permitir la generación masiva de órdenes técnicas basadas en criterios de red (por Sector, por NAP, por Caídas o por Mufas). Ante una avería masiva, la UI debe propagar la orden a todos los clientes afectados perimetralmente de forma automática.

Planta Interna (Individual): Formulario atómico para reportar incidencias específicas cliente por cliente, destinado exclusivamente a fallas del servicio en el domicilio del abonado.

2. Ficha Integrada del Cliente y Gestión Financiera
La ficha del cliente centraliza de forma unificada los datos del abonado, el estado de su servicio y los siguientes flujos operativos obligatorios:

Registro de Pagos: Panel directo para la recepción de abonos en efectivo o transferencias.

Compromisos de Pago: Control de prórrogas que detiene temporalmente y de forma automática la orden de corte programada.

Generación de Deuda: Herramienta para cargar saldos en contra del cliente. Si se genera deuda de forma explícita, la interfaz debe reflejar el estado de corte inmediato por morosidad.

3. Liquidación Operativa y Derivación de Órdenes
Liquidación Remota y de Campo: Al cerrar una orden, la UI habilitará de forma obligatoria los campos de: Título de Solución, Materiales/Equipos utilizados, Técnicos que atendieron y el Nombre del usuario que liquida.

Derivación de Flujo: La interfaz debe permitir derivar o clasificar la orden según su naturaleza física: si el problema es puramente de sistema/configuración (Remoto) o si requiere intervención de infraestructura (Campo).

4. Historial Detallado y Repositorio de Documentos
El módulo de clientes debe estructurar pestañas de historial independientes para auditar: Órdenes de Campo, Órdenes Remotas, Pagos, e Historial de Documentos.

Repositorio de Archivos: Sección de carga asíncrona para almacenar digitalmente los documentos obligatorios de validación del cliente: Contrato firmado, DNI y Recibo de Luz.

5. Automatización de Altas y Ciclo de Bajas Técnicas
Instalación Automática: El registro exitoso de un nuevo cliente dispara en segundo plano la emisión inmediata de una orden de instalación, cuya ejecución final dependerá de la configuración activa del ticket en su sede correspondiente.

Flujo de Abandono (2 Semanas): Si un cliente permanece en estado de corte y no solicita una reconexión en el lapso estricto de dos (2) semanas, el sistema activa automáticamente un seguimiento que genera las órdenes consecutivas de Retiro Lógico y Retiro de Materiales (recuperación de equipos).

6. Omisiones de Pago, Descuentos y Trazabilidad de Beneficios
Omisión y Gratuidad: Se permite omitir pagos de servicios o de tickets con costo (ej: reconexiones bonificadas). La interfaz de pagos debe registrar estos movimientos generando una boleta marcada explícitamente con el estado "Gratis" o "Beneficio", la cual no se envía a SUNAT.

Postergación de Adelantos: Si se omite el pago adelantado del servicio, la deuda se marca como Pendiente en el historial, permitiendo la navegación del cliente sin deudas activas hasta el fin del mes corriente.

Automatización de Planes: Los descuentos se jalan y aplican de forma automatizada basándose en las reglas previas del plan contratado. Todo descuento u omisión registrará obligatoriamente el nombre del personal que otorgó el beneficio.

7. Facturación Electrónica Automatizada (DNI / RUC)
El componente de emisión de comprobantes debe seleccionar de forma automatizada el tipo de documento según los datos vigentes del cliente:

Si el cliente posee RUC, se asocia la Factura jalando los datos de la sede y de la empresa.

Si el cliente posee DNI, se emite automáticamente la Boleta de Venta vinculando los datos específicos de su servicio técnico.

8. Hoja de Notas y Pactos Operativos (Garantía de Atención)
La ficha del cliente incorporará de forma obligatoria una Hoja de Notas Histórica e Inmutable.

Este espacio está destinado a que el personal de ATC redacte textualmente los pactos, acuerdos o beneficios verbales ofrecidos al cliente. Cada nota guardará automáticamente la fecha, hora y el nombre del operador que la registró, garantizando que cualquier otro personal que atienda al cliente a posteriori conozca el acuerdo exacto y pueda cumplirlo sin contradicciones.

9. Arquitectura SPA y Ventanas Modales
Todo el flujo de registro, visualización de fichas, subida de contratos, liquidación de materiales y revisión de la hoja de notas se procesará mediante modales e interfaces asíncronas sobre la misma pantalla. Queda prohibido romper el entorno operativo con recargas completas.

10. Cero Comentarios en HTML y Limpieza Absoluta
Los archivos HTML pertenecientes a este módulo no pueden contener comentarios de desarrollo (<!-- -->). Solo se permiten etiquetas de estructura y títulos visibles.

Cualquier duda técnica sobre la liquidación de equipos, aplicación de descuentos o políticas de retiro se resolverá visualmente en el componente de ayuda interactiva (?), desplegando un modal limpio con la información correspondiente.
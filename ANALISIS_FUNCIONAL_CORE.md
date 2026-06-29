# ANÁLISIS FUNCIONAL - DIRECTORIO CORE

## EXPLICACIÓN DE CADA ARCHIVO Y SU FUNCIÓN

### 1. views.py (676 líneas) - VIOLA REGLA DE UNA RESPONSABILIDAD
**Función actual:** Mezcla dashboard principal y organización de red

**Funciones contenidas:**
- `dashboard_view` - Panel de control principal con KPIs
- `organizacion_view` - Mapa interactivo de planta de red
- `api_organizacion_guardar` - Guardar elemento de red (SEDE, HUB, NAP, MUFA, SECTOR, FIBRA)
- `api_organizacion_actualizar` - Actualizar elemento de red existente
- `api_organizacion_eliminar` - Eliminar elemento de red
- `api_organizacion_importar_excel` - Importar elementos desde Excel
- `api_organizacion_descargar_modelo` - Descargar plantilla Excel
- `api_organizacion_exportar_excel` - Exportar elementos a Excel
- `api_organizacion_vertices_sector` - Guardar vértices de sector
- `api_organizacion_vertices_fibra` - Guardar vértices de fibra

**Problema:** Mezcla 2 dominios diferentes (dashboard y organización)

**División requerida:**
- `views/dashboard.py` - Solo dashboard_view
- `views/organizacion.py` - Solo funciones de organización de red

---

### 2. views_abonados.py (1,284 líneas) - VIOLA REGLA DE UNA RESPONSABILIDAD
**Función actual:** Mezcla 6 dominios diferentes en un solo archivo

**Funciones contenidas:**
- `abonados_list_view` - Listado de abonados
- `abonado_ficha_view` - Ficha de cliente
- `api_abonados_contexto` - Contexto del vendedor
- `api_abonados_consultar_documento` - Consultar DNI/RUC
- `api_abonados_evaluar_registro` - Evaluar registro de cliente
- `api_abonados_consultar_suministro` - Consultar suministro
- `api_abonados_registrar` - Registrar cliente
- `api_abonados_subir_documento` - Subir documentos (DNI, contrato)
- `api_abonados_generar_deuda` - Generar deuda
- `api_abonados_editar_deuda` - Editar deuda
- `api_abonados_eliminar_deuda` - Eliminar deuda
- `api_abonados_compromiso_pago` - Compromiso de pago
- `api_abonados_generar_ticket` - Generar ticket
- `api_abonados_turno_caja` - Consultar turno caja
- `api_abonados_turno_caja_abrir` - Abrir turno caja
- `api_abonados_registrar_pago` - Registrar pago
- `api_abonados_liquidar_ticket` - Liquidar ticket
- `api_abonados_actualizar_cliente` - Actualizar cliente
- `api_abonados_actualizar_servicio` - Actualizar servicio
- `api_abonados_derivar_ticket` - Derivar ticket
- `api_cliente_ticket_print` - Imprimir ticket
- `api_abonados_infraestructura_red` - Infraestructura de red
- `api_abonados_generar_ticket_masivo` - Generar tickets masivos
- `api_abonados_registrar_multipago` - Registrar múltiples pagos
- `api_abonados_sistema_procesar_facturacion_mensual` - Facturación mensual

**Problema:** Mezcla 6 dominios (registro, deuda, tickets, pagos, infraestructura, facturación)

**División requerida:**
- `views/abonados_registro.py` - Registro, evaluación, consulta documentos, subir documentos
- `views/abonados_deuda.py` - Generar, editar, eliminar deuda, compromiso pago
- `views/abonados_pago.py` - Turno caja, registrar pago, multipago
- `views/abonados_ticket.py` - Generar, liquidar, derivar ticket, imprimir
- `views/abonados_infraestructura.py` - Infraestructura de red
- `views/abonados_facturacion.py` - Facturación mensual

---

### 3. views_auth.py (214 líneas) - CUMPLE REGLA
**Función:** Autenticación y sesión

**Funciones contenidas:**
- `login_view` - Renderizar login
- `logout_view` - Cerrar sesión
- `api_login` - API de autenticación
- `api_check_session` - Verificar sesión activa

**Estado:** CORRECTO - Un solo dominio (autenticación)

**Acción:** Mover a `views/auth.py` sin dividir

---

### 4. views_caja.py (312 líneas) - CUMPLE REGLA
**Función:** Gestión de caja diaria

**Funciones contenidas:**
- `caja_view` - Vista de caja
- `api_caja_resumen` - Resumen de caja
- `api_caja_movimientos` - Listar movimientos
- `api_caja_registrar` - Registrar movimiento
- `api_caja_toggle_permiso` - Toggle permisos cajero

**Estado:** CORRECTO - Un solo dominio (caja)

**Acción:** Mover a `views/caja.py` sin dividir

---

### 5. views_calendario.py (184 líneas) - CUMPLE REGLA
**Función:** Calendario de tickets

**Funciones contenidas:**
- `calendario_view` - Vista de calendario
- `api_calendario_eventos` - Listar eventos por fecha
- `api_calendario_reprogramar_ticket` - Reprogramar ticket (drag and drop)
- `api_calendario_tickets_sin_programar` - Listar tickets sin programar

**Estado:** CORRECTO - Un solo dominio (calendario)

**Acción:** Mover a `views/calendario.py` sin dividir

---

### 6. views_planes.py (186 líneas) - SIN FUNCIONES
**Función:** Planes (no tiene funciones definidas)

**Estado:** ARCHIVO VACÍO O SOLO IMPORTS

**Acción:** Revisar contenido completo, probablemente eliminar

---

### 7. views_ruc.py (688 líneas) - CUMPLE REGLA
**Función:** Gestión de RUCs y comprobantes SUNAT

**Funciones contenidas:**
- `api_sede_rucs_list` - Listar RUCs de sede
- `api_sede_rucs_create` - Crear RUC global y vincular a sede
- `api_sede_rucs_detail` - Detalle/actualizar/eliminar RUC
- `api_sede_rucs_contrato` - Subir contrato PDF
- `api_sede_rucs_comprobante_view` - Ver PDF/XML comprobante
- `api_sede_rucs_nota_venta_convertir` - Convertir nota venta
- `api_sede_rucs_contrato_view` - Ver contrato PDF
- `api_sede_rucs_desvincular` - Desvincular RUC
- `api_sede_rucs_vincular` - Vincular RUC
- `api_sede_rucs_disponibles` - RUCs disponibles
- `api_sede_rucs_comprobante_preview` - Vista previa comprobante
- `validar_emision_comprobante` - Validar emisión

**Estado:** CORRECTO - Un solo dominio (RUC/comprobantes)

**Acción:** Mover a `views/ruc.py` sin dividir

---

### 8. views_sede.py (987 líneas) - VIOLA REGLA DE UNA RESPONSABILIDAD
**Función actual:** Mezcla configuración de sede con múltiples sub-dominios

**Funciones contenidas:**
- `api_sede_config_get` - Obtener datos de sede
- `api_sede_config_save_datos` - Guardar datos base de sede
- `api_sede_config_save_ruc` - Vincular RUC a sede
- `api_sede_config_delete_ruc` - Desvincular RUC
- `api_sede_config_save_contrato` - Guardar contrato legal
- `api_sede_config_save_plan` - Guardar plan comercial
- `api_sede_config_delete_plan` - Eliminar plan
- `api_sede_config_plan_dinamico` - Configuración dinámica JSONB
- `api_sede_config_save_personal` - Guardar personal
- `api_sede_config_delete_personal` - Eliminar personal
- `api_sede_config_vincular_personal` - Vincular personal
- `api_sede_config_save_habilidades` - Guardar habilidades vendedor
- `api_sede_config_save_material` - Guardar material
- `api_sede_config_delete_material` - Eliminar material
- Funciones de catálogo de tickets

**Problema:** Mezcla 5 sub-dominios (datos, RUC, contrato, planes, personal, materiales, catálogo)

**División requerida:**
- `views/sede_config.py` - Datos base de sede
- `views/sede_ruc.py` - Configuración RUC de sede
- `views/sede_planes.py` - Planes comerciales
- `views/sede_personal.py` - Personal de sede
- `views/sede_materiales.py` - Materiales y catálogo

---

### 9. views_sunat.py (292 líneas) - CUMPLE REGLA
**Función:** Dashboard SUNAT y envío de comprobantes

**Funciones contenidas:**
- `sunat_dashboard_view` - Vista de SUNAT
- `api_sunat_listar_comprobantes` - Listar comprobantes
- `api_sunat_enviar_comprobante` - Enviar comprobante a SUNAT
- `base64_to_bytes` - Helper conversión

**Estado:** CORRECTO - Un solo dominio (SUNAT)

**Acción:** Mover a `views/sunat.py` sin dividir

---

### 10. views_tareas.py (340 líneas) - CUMPLE REGLA
**Función:** Gestión de tareas de cobranza ATC

**Funciones contenidas:**
- `tareas_list_view` - Vista de tareas
- `api_tareas_auto_generar` - Auto-generar tareas del ciclo
- `api_tareas_registrar_contacto` - Registrar resultado de llamada
- `api_tareas_listar` - Alias para compatibilidad
- `api_tareas_repartir` - Deprecated
- `_calcular_fecha_vencimiento` - Helper cálculo
- `_urgencia_nivel` - Helper urgencia

**Estado:** CORRECTO - Un solo dominio (tareas)

**Acción:** Mover a `views/tareas.py` sin dividir

---

### 11. ticket_automation.py (439 líneas) - FUERA DE LUGAR
**Función:** Motor de automatización de tickets

**Estado:** Es lógica de negocio, no debe estar suelto en core/

**Acción:** Mover a `logic/ticket_automation.py`

---

### 12. serializers.py (8,864 bytes) - FUERA DE LUGAR
**Función:** Serializadores Django REST Framework

**Estado:** Debe estar con las APIs

**Acción:** Mover a `apis/serializers.py`

---

## RESUMEN DE ACCIONES REQUERIDAS

### ARCHIVOS QUE DEBEN DIVIDIRSE (VIOLAN REGLA DE UNA RESPONSABILIDAD)
1. **views.py** → Dividir en 2 archivos (dashboard, organización)
2. **views_abonados.py** → Dividir en 6 archivos (registro, deuda, pago, ticket, infraestructura, facturación)

### ARCHIVOS QUE DEBEN MOVERSE (ESTÁN FUERA DE LUGAR)
1. **ticket_automation.py** → Mover a `logic/`
2. **serializers.py** → Mover a `apis/`

### ARCHIVOS QUE SOLO DEBEN MOVERSE (ESTÁN BIEN ESTRUCTURADOS)
1. **views_auth.py** → Mover a `views/auth.py`
2. **views_caja.py** → Mover a `views/caja.py`
3. **views_calendario.py** → Mover a `views/calendario.py`
4. **views_planes.py** → Mover a `views/planes.py`
5. **views_ruc.py** → Mover a `views/ruc.py`
6. **views_sede.py** → Mover a `views/sede.py`
7. **views_sunat.py** → Mover a `views/sunat.py`
8. **views_tareas.py** → Mover a `views/tareas.py`

### ARCHIVOS QUE SE MANTIENEN EN CORE/ (DJANGO LOS BUSCA AHÍ)
- `admin.py`, `apps.py`, `__init__.py`, `backends.py`, `middleware.py`, `tests.py`

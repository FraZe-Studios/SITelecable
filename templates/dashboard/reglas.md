🗺️ Mapa de Componentes Locales (Pendiente de Validación)
Nota: Las rutas, archivos físicos y dependencias exactas de este módulo quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios para cumplir estrictamente con la norma de nomenclatura monopalabra.

🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Restricción Absoluta de Procesamiento (Capa Core APIs Limpia)
Los archivos HTML y JS del Dashboard se limitan exclusivamente a la inicialización, maquetación y renderizado visual de los gráficos (manipulación del DOM y librerías de gráficos como Chart.js o D3.js).

Queda rotundamente prohibido realizar cálculos matemáticos, agrupaciones de datos (JSON.reduce, loops pesados) o procesamiento analítico dentro de la interfaz. Todo volumen numérico y porcentaje debe ser entregado por el backend completamente digerido y listo para pintar.

2. Consumo Asíncrono de Indicadores Estructurados
La interfaz consumirá los datos agregados de negocio mediante endpoints JSON limpios, estructurados bajo los siguientes 13 bloques analíticos de control:

**Rutas del Módulo Dashboard**
- Plantillas HTML: `templates/dashboard/dashboard.html`, `templates/dashboard/components/…` (modales, filtros, tarjetas)
- Componentes reutilizables: `templates/dashboard/components/` (e.g., `filtros.html`, `grafico_card.html`)

**Hojas de estilo CSS**
- `static/css/dashboard.css`
- `static/css/global.css`

**JavaScript**
- `static/js/dashboard/dashboard.js`
- `static/js/global/theme_controller.js`   *(gestión del modo claro/oscuro)*

**Endpoints API (Python)**
- `core/views_dashboard.py` contiene los endpoints:
  - `api_dashboard_resumen`
  - `api_dashboard_kpis`
  - `api_dashboard_tickets`
  - `api_dashboard_actualizar_filtro`

1. Gestión Operativa General: Control de flujo temporal (Día, Semana, Mes) de órdenes emitidas, atendidas, anuladas y pendientes acumuladas; porcentaje general de cumplimiento; mapas de calor de días y horas con mayor carga de trabajo.

2. Analítica por Personal Técnico: Gráficos de asignación, productividad, comparativas entre técnicos, tiempos promedio de atención, ranking de efectividad y mapas de asignación por sede o zona geográfica.

3. Infraestructura, Sedes y Sectores: Métricas geolocalizadas de órdenes por Sede y Sector. Visualización de zonas críticas: sectores con mayor reincidencia de averías, retiros, instalaciones y demoras operativas.

4. Tipo de Servicio: Desglose del rendimiento y volumetría de problemas específicos clasificados por producto contratado: DUO, Internet y TV Cable.

5. Tipo de Orden vs Estado: Matriz visual cruzada que enfrenta los tipos de requerimiento (Averías, Retiros, Reconexiones, Requerimientos, Cortes, Instalaciones, Cambios de equipo, Traslados, Migraciones) contra sus estados actuales (Atendidas, Anuladas, Pendientes).

6. Frecuencia de Motivos: Clasificación y ranking de los diagnósticos más comunes registrados (ej: "sin señal", "potencia elevada", "cambio de equipo") cruzados por sede, sector y técnico.

7. Tiempos de Respuesta y SLA (Acuerdo de Nivel de Servicio): Monitoreo crítico de plazos. Segmentación visual de órdenes atendidas dentro de las primeras 24 horas, 48 horas, órdenes excedidas en tiempo máximo y porcentajes de cumplimiento de plazos.

8. Reprogramaciones: Trazabilidad de órdenes postergadas. Gráficos de reprogramaciones por sede, técnico y motivo; cálculo del promedio de días transcurridos entre la emisión, la reprogramación y la atención final.

9. Gestión Operativa de ATC: Medición del desempeño del personal de atención al cliente: órdenes registradas, cerradas y anuladas por operador; comparativos de carga de pendientes por usuario de ATC.

10. Comportamiento y Reincidencia de Abonados (CRM Operativo): Identificación de clientes críticos con mayor cantidad de averías acumuladas, órdenes pendientes acumuladas e historial de órdenes repetitivas.

11. Bloque Comparativo Histórico: Panel de contraste temporal y de rendimiento (Año 2025 vs 2026, Mes actual vs Mes anterior, Sede contra Sede, Técnico contra Técnico).

12. Alertas Visuales Automáticas: Tarjetas de notificación crítica en tiempo real para: órdenes pendientes de más de 24 horas, sectores con anomalías masivas en el día, órdenes sin técnico asignado o registros sin fecha de atención.

13. Calidad de Datos e Inconsistencias: Módulo de control interno para listar errores de registro que deben ser subsanados (órdenes sin código, inconsistencias de sedes, o fechas de atención previas a la fecha de emisión).

3. Vista de Prioridad Directa (KPIs Críticos)
La pantalla principal del Dashboard debe destacar en su fila superior de control los siguientes 6 indicadores clave de rendimiento solicitados por supervisión:

Porcentaje general de órdenes atendidas por Sede: Desglose comparativo inmediato entre las sedes de Jauja, Oroya y Huancayo.

Porcentaje de cumplimiento en tiempo óptimo: Proporción de órdenes solucionadas estrictamente en el rango de 24 a 48 horas.

Volumen de producción técnica: Cantidad neta de órdenes atendidas individualmente por cada técnico del sistema.

Porcentaje de órdenes reprogramadas: Ratio de incidencias postergadas sobre el total emitido.

Porcentaje de órdenes anuladas: Ratio de solicitudes canceladas en el sistema.

Distribución de tipos de orden por sede: Gráfico de barras agrupadas que muestre la cantidad de averías, instalaciones y cortes activos divididos por cada sede física.

4. Arquitectura SPA y Ventanas de Detalle
El cuadro de mandos debe mantener su persistencia de datos de forma limpia. El filtrado por fechas, el cambio entre sedes o la apertura del desglose de un gráfico para auditar una lista de órdenes específica se realizará exclusivamente mediante componentes interactivos asíncronos y modales internos, respetando el principio de Single Page Application.

5. Cero Comentarios en HTML y Módulo de Ayuda ?
El archivo HTML del dashboard no contendrá comentarios ocultos de desarrollo (<!-- -->).

La definición exacta de cada fórmula analítica, la explicación de cómo se calcula el SLA de 24/48 horas o el significado de los rangos de productividad se documentarán exclusivamente dentro del botón de ayuda interactiva (?), desplegando un modal explicativo limpio en pantalla.
# REGLAS DE CAPA DE PRESENTACIÓN: TEMPLATES HTML Y JS ACOPLADO 
## Propósito 
Contiene la estructura de las interfaces organizadas por módulos de negocio independientes. 
 
## Reglas y Limitaciones Estrictas 
1. **Métrica de Extensión:** Ningún archivo HTML o JS de interfaz individual (ej: `sistema_dashboard.js`) podrá exceder las **1,000 líneas de código**. Si se supera, el componente debe fragmentarse en sub-componentes asíncronos. 
2. **Separación de Lógica:** El archivo JS acoplado al HTML (ej: `dashboard.js`) es estrictamente para la interactividad de la UI (manejo del DOM, renderizado de datos, captura de eventos). La lógica analítica pesada o validaciones críticas se consumen mediante llamadas asíncronas a la capa CORE/LOGIC o API. 
3. **Modularidad:** Todo componente estructural repetitivo (tablas de reportes, formularios) debe encapsularse en componentes reutilizables o fragmentos mediante etiquetas de Django (`{% include %}`). 

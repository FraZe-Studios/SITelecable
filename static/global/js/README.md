# REGLAS DE INTERACCIÓN DINÁMICA: JS GLOBAL 
## Propósito 
Alojar scripts globales encargados de la manipulación estética de la UI, animaciones y persistencia de estados visuales. 
 
## Reglas y Limitaciones Estrictas 
1. **Métrica de Extensión:** El archivo `theme_controller.js` u otros complementos globales no podrán exceder bajo ningún concepto las **1,000 líneas de código**. 
2. **Cero Lógica de Negocio:** Este directorio es exclusivo para el comportamiento visual (Ej: Alternar clase para Modo Oscuro, abrir/cerrar sidebar, efectos de sombras dinámicas). No realiza cálculos de datos, ni lógica del sistema, ni peticiones directas de negocio. 
3. **JS Puro y Modular:** El código escrito aquí debe estar optimizado para rendimiento en navegadores móviles reduciendo el impacto en el renderizado del DOM. 

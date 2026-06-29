# REGLAS DE HOJAS DE ESTILO: CSS GLOBAL Y EXPLÍCITO 
## Propósito 
Definición atómica de variables visuales y layouts estructurados por tipo de pantalla (Celular, Tablet, PC). 
 
## Reglas y Limitaciones Estrictas 
1. **Variables Nativas Obligatorias:** Prohibido escribir colores rígidos (Hexadecimal/RGB) directamente en las clases. Todo debe mapearse en `global_theme.css` mediante :root (ej: `--bg-primary`). 
2. **Soporte Claro/Oscuro:** Las paletas de colores deben responder de forma nativa al cambio de modo mediante variables css funcionales e intercambiables. 
3. **Diseño Responsivo Fluido:** El archivo `layout.css` mapeará las dimensiones explícitas utilizando Media Queries adaptables. Se prohíben tamaños fijos en píxeles para contenedores principales. 
4. **Aislamiento de HTML:** Queda estrictamente prohibido incrustar atributos style="..." dentro de las plantillas HTML. 

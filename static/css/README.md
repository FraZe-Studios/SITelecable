# Hojas de Estilo Específicas del Módulo (CSS Específicos)

## Propósito
Este directorio contiene las hojas de estilo específicas para los diferentes módulos y páginas del sistema (ej: `dashboard.css`, `operaciones.css`, `caja.css`). Estos estilos complementan y personalizan la interfaz de usuario para flujos y componentes especializados del negocio.

## Reglas y Limitaciones Estrictas

1. **Importación Obligatoria del CSS Global:**
   Toda hoja de estilo específica creada en este directorio debe importar **rígidamente** el CSS global al inicio del archivo. Queda prohibida la creación de hojas de estilo aisladas que no hereden el sistema de diseño centralizado.
   
   La importación debe realizarse utilizando la directiva `@import` de la siguiente manera:
   ```css
   @import url('../global/css/global_theme.css');
   @import url('../global/css/layout.css');
   ```
   O en su defecto, importando el archivo unificado consolidado:
   ```css
   @import url('../global/css/global.css');
   ```

2. **Uso Exclusivo de Variables Globales:**
   Queda estrictamente prohibido definir colores rígidos (hexadecimales, rgb, etc.) o valores de espaciado/bordes fijos directamente en los estilos de este directorio. Cualquier regla de color, grosor de borde, sombra o curvatura debe utilizar de manera obligatoria las variables definidas en el tema global (ej. `var(--primary)`, `var(--bg-surface)`, `var(--radius-md)`).

3. **Independencia Responsiva:**
   Los estilos específicos deben ser completamente responsivos por sí mismos, respetando los breakpoints globales de `layout.css` y asegurando una correcta visualización en móviles, tablets y PC.

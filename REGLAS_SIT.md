# REGLAS_SIT: Reglas de Desarrollo Estrictas del Sistema SIT Telecable

## 1. NOMENCLATURA MONOPALABRA (ESTRICTO)

Todos los archivos del sistema (`.py`, `.html`, `.css`, `.js`, `.md`, `.json`) deben nombrarse utilizando **una sola palabra**. Prohibido usar guiones bajos, guiones medios o camelCase.

## 2. UNA RESPONSABILIDAD POR ARCHIVO

Prohibido combinar lógica de diferentes dominios de negocio en un solo archivo. Cada archivo debe tener UNA sola responsabilidad.

## 3. LÍMITE DE 1,000 LÍNEAS

Ningún archivo puede superar 1,000 líneas de código. Si excede este límite, debe fragmentarse obligatoriamente por dominios de negocio.

## 4. BASE DE DATOS - PROHIBICIONES

- Prohibido ALTER TABLE, DROP COLUMN, ADD COLUMN o cualquier modificación DDL
- Prohibido migrations que alteren esquema existente en producción
- Prohibido Raw SQL que manipule estructura de base de datos
- Prohibido campos rígidos nuevos (usar JSONB)
- Prohibido renombrar tablas o columnas
- Prohibido eliminar índices o constraints sin autorización
- Prohibido modificar tipos de datos de columnas existentes
- Prohibido queries N+1 (usar select_related, prefetch_related)
- Prohibido transacciones sin @transaction.atomic
- Prohibido hardcoding de credenciales (usar variables de entorno)
- Prohibido confundir base de datos con funciones: La lógica de negocio debe estar en Python, no en triggers o stored procedures de base de datos

## 5. SOFT DELETE OBLIGATORIO

Prohibido DELETE físico en SQL. Usar borrado lógico con campo `activo=True/False`.

## 6. PROHIBIDO ALERT NATIVO

Prohibido usar alert(), confirm(), prompt(). Usar sistema Toast SITAlert.show.

## 7. PROHIBIDO COMENTARIOS EN HTML

Prohibido comentarios de desarrollo <!-- --> en HTML. Usar componente de ayuda (?).

## 8. ARQUITECTURA SPA

Prohibido redireccionar a páginas externas. Todo en modales/ventanas emergentes.

## 9. SISTEMA DE PRUEBAS SEPARADO

**Prohibido Código de Pruebas en Core:**
- Prohibido archivos de seed, datos de prueba, o comandos de prueba en `core/management/commands/`
- Prohibido datos mock o de desarrollo mezclados con lógica de producción
- `core/` debe contener solo lógica de producción

**Sistema de Pruebas Independiente:**
- Las pruebas deben estar en carpeta separada: `pruebas/`
- Sistema de pruebas con interfaz propia para testing rápido
- Botones para: iniciar sesión admin/empleado, registrar cliente, probar funcionalidades
- No afecta el sistema de producción
- Permite encontrar errores rápidamente sin entrar a producción
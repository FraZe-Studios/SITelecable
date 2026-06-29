# SISTEMA DE PRUEBAS - SIT TELECABLE

Sistema de pruebas separado para testing rápido sin afectar producción.

## Propósito
- Probar funcionalidades rápidamente sin entrar a producción
- Encontrar errores de forma ágil
- Interfaz de consola C# para testing con diferentes roles

## Estructura
- `Program.cs` - Aplicación de consola C# para pruebas
- `SITTelecablePruebas.csproj` - Proyecto .NET 8.0
- `seed/` - Archivos de seed/datos de prueba (separados de core)
- `commands/` - Comandos de Django solo para pruebas (separados de core)

## Requisitos
- .NET 8.0 SDK instalado
- Python y Django (para ejecutar comandos Django desde el sistema)

## Uso
1. Ejecutar `ejecutar_pruebas.bat` desde la raíz del proyecto
2. El sistema compilará y ejecutará la aplicación de consola C#
3. Usar el menú interactivo para probar funcionalidades
4. No afecta el sistema de producción en `core/`

## Funcionalidades
- **Autenticación:** Login como admin/empleado, cerrar sesión
- **Clientes:** Registrar cliente, consultar por DNI, consultar suministro
- **Tickets:** Generar ticket instalación/reparación, liquidar ticket
- **Pagos:** Generar deuda, registrar pago, abrir turno caja
- **Sistema:** Cargar/limpiar datos de prueba, generar mapa de modelos, ejecutar comandos Django

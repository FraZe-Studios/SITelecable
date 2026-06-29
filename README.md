# SITelecable - Sistema de Gestión de Infraestructura de Red y Clientes

Sistema de gestión de clientes e infraestructura de red/servicios basado en geolocalización. Desarrollado con Django Backend + Frontend con Mapas.

## 🏗️ Arquitectura

La arquitectura lógica de la infraestructura sigue una jerarquía estricta y relacional:
- **Sede** (Nivel 1)
- **Sector/Polígono** (Nivel 2)
- **Cliente con GPS** (Nivel 3)

## 🚀 Características Principales

- Gestión de abonados y clientes con geolocalización
- Sistema de organización por sedes y sectores
- Gestión de caja y facturación
- Calendario de tareas y visitas
- Consulta de RUC/DNI con cache optimizado
- Sistema de archivos comprimidos para optimización de almacenamiento
- Auditoría inmutable de operaciones
- Modo claro/oscuro nativo

## 📋 Requisitos

### Python
```bash
pip install -r requirements.txt
```

### Dependencias del Sistema

#### Windows
- **Ghostscript**: https://www.ghostscript.com/download/gsdnld.html
- **LibreOffice**: https://www.libreoffice.org/download/download/
- **ZSTD**: https://github.com/facebook/zstd/releases (agregar al PATH)

#### Linux
```bash
sudo apt-get install ghostscript libreoffice zstd
```

## 🔧 Instalación

1. Clonar el repositorio
```bash
git clone https://github.com/FraZe-Studios/SITelecable.git
cd SITelecable
```

2. Instalar dependencias de Python
```bash
pip install -r requirements.txt
```

3. Configurar la base de datos PostgreSQL en `settings.py` (o usar variables de entorno en `.env`)

4. Ejecutar el instalador SQL
```bash
database\instalador_sql.bat
```

Este script crea todas las tablas del sistema en PostgreSQL. Django usa sesiones basadas en archivos (no requiere tablas en la base de datos).

5. Iniciar el servidor
```bash
python manage.py runserver
```

## 📁 Estructura del Proyecto

```
SITelecable/
├── core/               # Lógica del negocio
│   ├── apis/          # Endpoints JSON limpios
│   ├── logic/         # Servicios y helpers
│   ├── models/        # Modelos de datos
│   └── views/         # Vistas Django
├── templates/         # Plantillas HTML por módulo
├── static/           # CSS y JS organizados por módulo
├── archivos/         # Sistema de gestión de archivos
├── database/         # Scripts y documentación de BD
└── sitelecable/      # Configuración Django
```

## 🎯 Reglas de Desarrollo

El proyecto sigue reglas estrictas de desarrollo documentadas en `REGLAS_SIT.md`:

- **Nomenclatura monopalabra** para todos los archivos
- **Aislamiento de funciones** (única responsabilidad)
- **Prohibición de comentarios en HTML** (usar componente de ayuda `?`)
- **Arquitectura SPA** (todo en ventanas/modales)
- **Soft delete obligatorio** (no eliminación física)
- **Límite de 1,000 líneas** por archivo
- **Mapeo local descentralizado** con archivos `rutas.[modulo].md`

## 🔐 Seguridad

- Soft delete obligatorio para trazabilidad
- Protección contra inyecciones SQL (ORM Django)
- Auditoría inmutable de operaciones
- Cache relacional para optimizar costos de APIs externas

## 📄 Documentación

- `REGLAS_SIT.md` - Reglas estrictas de desarrollo
- `archivos/README.md` - Sistema de gestión de archivos
- `database/` - Documentación de base de datos

## 👥 Desarrollado por

FraZe Studios

## 📝 Licencia

Proyecto privado - FraZe Studios

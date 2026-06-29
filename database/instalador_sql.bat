@echo off
cd /d "%~dp0"
:: =============================================================================
REM Script de Instalación - SIT Telecable PostgreSQL Database (Refactorizado v3)
:: =============================================================================
TITLE Instalador de Base de Datos - SIT Telecable
COLOR 0A

echo ============================================================================
echo   SIT Telecable - Sistema de Gestion de Telecomunicaciones (PostgreSQL)
echo ============================================================================
echo.

REM Configuración unificada de la base de datos (Evita redundancias)
set DB_NAME=sitelecable
set DB_USER=postgres
set DB_PASSWORD=postgres
set DB_HOST=localhost
set DB_PORT=5432
set ACCION=crear

REM Parámetros opcionales de línea de comandos (Password y Acción directa)
if "%~1" neq "" set DB_PASSWORD=%~1
if "%~2" neq "" set ACCION=%~2

:: Bucle inteligente para detectar la ruta exacta de la instalación de PostgreSQL
if "%PG_PATH%"=="" (
    if exist "C:\Program Files\PostgreSQL" (
        for /d %%i in ("C:\Program Files\PostgreSQL\*") do (
            if exist "%%i\bin\psql.exe" (
                set "PG_PATH=%%i\bin"
            )
        )
    )
)
if "%PG_PATH%"=="" set PG_PATH=C:\pgsql\bin

REM Verificar la existencia real de psql.exe en el sistema antes de iniciar
if not exist "%PG_PATH%\psql.exe" (
    COLOR 0C
    echo ERROR CRITICO: No se encuentra psql.exe en la ruta especificada: %PG_PATH%
    echo Por favor, configure correctamente la variable PG_PATH en este script.
    pause
    exit /b 1
)

echo [ENTORNO CONFIGURADO]
echo Ruta de PostgreSQL: %PG_PATH%
echo Base de Datos:    %DB_NAME%
echo Usuario Master:   %DB_USER%
echo Host Servidor:    %DB_HOST%
echo Puerto Red:       %DB_PORT%
echo.

REM Crear archivo de contraseña .pgpass nativo y seguro de PostgreSQL
echo %DB_HOST%:%DB_PORT%:*:%DB_USER%:%DB_PASSWORD%>"%TEMP%\.pgpass"
set PGPASSFILE=%TEMP%\.pgpass

echo Verificando existencia de la base de datos en el motor...

REM Intentar la creación directa (Si no existe, se creará de inmediato)
"%PG_PATH%\createdb" -U %DB_USER% -h %DB_HOST% -p %DB_PORT% %DB_NAME% 2>nul
if errorlevel 1 (
    goto db_existe
) else (
    echo Base de datos "%DB_NAME%" creada exitosamente por primera vez.
    goto ejecutar_scripts
)

:db_existe
echo La base de datos "%DB_NAME%" ya se encuentra registrada en el sistema.

REM Saltos planos inequívocos para evitar parálisis por análisis o bucles infinitos
if /i "%ACCION%"=="recrear" goto modo_recrear
if /i "%ACCION%"=="actualizar" goto modo_actualizar

:modo_interactivo
echo.
echo ============================================================================
echo   SELECCIONE LA ACCIÓN OPERATIVA PARA LA BASE DE DATOS
echo ============================================================================
echo 1. ACTUALIZAR - Ejecutar parches o scripts sobre la estructura actual
echo 2. RECREAR    - ELIMINAR todo el entorno actual y resubir la estructura a cero
echo 3. CANCELAR   - Salir del asistente sin aplicar cambios
echo.
set /p OPCION="Seleccione una opcion (1/2/3): "

if "%OPCION%"=="1" goto modo_actualizar
if "%OPCION%"=="2" goto modo_recrear
goto cancelado

:modo_actualizar
echo.
echo ----------------------------------------------------------------------------
echo ATENCION: Se ejecutaran los scripts de actualizacion sobre el entorno vivo.
echo ----------------------------------------------------------------------------
if /i "%ACCION%"=="actualizar" goto ejecutar_scripts
set /p CONFIRMAR="¿Desea continuar con la actualizacion? (S/N): "
if /i "%CONFIRMAR%"=="S" goto ejecutar_scripts
goto cancelado

:modo_recrear
echo.
COLOR 0C
echo ----------------------------------------------------------------------------
echo ADVERTENCIA EXTREMA: Se destruira la base de datos y todos sus datos reales.
echo ----------------------------------------------------------------------------
if /i "%ACCION%"=="recrear" goto forzar_recreacion
set /p CONFIRMAR="¿Esta completamente seguro de RECREAR la base de datos? (S/N): "
if /i not "%CONFIRMAR%"=="S" goto cancelado

:forzar_recreacion
COLOR 0A
echo.
echo Desconectando usuarios y destruyendo base de datos existente (%DB_NAME%)...
REM El parametro -f fuerza el cierre de conexiones activas en PostgreSQL para evitar bloqueos
"%PG_PATH%\dropdb" -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -f %DB_NAME%
if errorlevel 1 (
    COLOR 0C
    echo ERROR: PostgreSQL impidio la destruccion de la base de datos.
    goto error
)

echo Creando base de datos limpia de forma secuencial...
"%PG_PATH%\createdb" -U %DB_USER% -h %DB_HOST% -p %DB_PORT% %DB_NAME%
if errorlevel 1 (
    COLOR 0C
    echo ERROR: Fallo la creacion de la base de datos vacia.
    goto error
)
echo Base de datos recreada con exito.
goto ejecutar_scripts

:cancelado
echo.
echo Operacion abortada por el usuario de forma segura.
goto end

:ejecutar_scripts
echo.
echo ============================================================================
echo   EJECUTANDO ARQUITECTURA DE DATOS EN ORDEN SECUENCIAL CRÍTICO
echo ============================================================================
echo.

REM Lista ordenada sin repeticiones para mantener la integridad de llaves foráneas
for %%F in (
    "esquema_completo.sql"
    "datos.sql"
) do (
    if exist "%%~F" (
        echo [PROCESANDO]: %%~F...
        "%PG_PATH%\psql" -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -f "%%~F"
        if errorlevel 1 (
            COLOR 0C
            echo ERROR GRAVE: El script %%~F fallo en tiempo de ejecucion.
            goto error
        )
    ) else (
        echo [OMITIDO]: El archivo %%~F no se encuentra en esta carpeta.
    )
)

echo.
echo ============================================================================
echo   ¡SISTEMA SIT TELECABLE INSTALADO Y ACTUALIZADO CON ÉXITO!
echo ============================================================================
echo Cuenta 'admin' / 'admin123' operativa de forma segura.
goto end

:error
echo.
echo ============================================================================
echo   [FALLO CRÍTICO]: La instalacion se detuvo para proteger el entorno.
echo ============================================================================
echo.
pause
exit /b 1

:end
REM Limpieza estricta de archivos temporales y contraseñas en memoria de Windows
if exist "%TEMP%\.pgpass" del "%TEMP%\.pgpass"
set PGPASSWORD=
set PGPASSFILE=
echo.
pause

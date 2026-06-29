@echo off
SETLOCAL EnableDelayedExpansion

:: ==========================================
:: CONFIGURACIÓN DEL PROYECTO
:: ==========================================
SET PORT=8000
SET PYTHON_EXEC="C:\Users\ffran\AppData\Local\Programs\Python\Python312\python.exe"

echo ===================================================
echo   Levantando Entorno de Desarrollo: Django
echo ===================================================

:: 1. Validar si existe el ejecutable de Python especificado
if not exist %PYTHON_EXEC% (
    echo [ERROR] No se encontro el ejecutable de Python en la ruta:
    echo %PYTHON_EXEC%
    goto :error
)

:: 2. Asegurar dependencias criticas del proyecto
echo [INFO] Verificando dependencias requeridas...
%PYTHON_EXEC% -m pip install --quiet -r requirements.txt

:: 3. Matar procesos previos colgados en el puerto de Django
echo [INFO] Monitoreando estado del puerto %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT% ^| findstr LISTENING') do (
    if not "%%a" == "" (
        echo [WARNING] Detectado proceso colgado en el puerto %PORT% ^(PID: %%a^). Liberando puerto...
        taskkill /f /pid %%a >nul 2>&1
    )
)

:: 4. Lanzar el servidor de desarrollo
echo [SUCCESS] Entorno verificado. Iniciando Django localmente en http://127.0.0.1:%PORT%/
echo [INFO] Para detener el servidor, presiona CTRL + C en esta ventana.
echo -------------------------------------------------------------------

%PYTHON_EXEC% manage.py runserver 0.0.0.0:%PORT%

:error
pause
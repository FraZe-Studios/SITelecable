Reglas de Arquitectura del Módulo de Login
🗺️ Mapa de Componentes Locales (Ruta: c:/Users/ffran/Documents/SITElecable/templates/auth)
Nota: Las rutas y archivos exactos de este módulo quedan en estado pendiente. Se actualizarán físicamente una vez confirmado el árbol definitivo de directorios.

**Rutas del Módulo Auth**
- Plantillas HTML: `templates/auth/login.html`
- Componentes reutilizables: `templates/auth/…` (fragmentos o modales que se añadan en el futuro)

**Hojas de estilo CSS**
- `static/global/css/global.css`
- `static/global/css/layout.css`
- `static/css/login.css`

**JavaScript**
- `static/global/js/login.js`
- `static/global/js/theme_controller.js`   *(gestión del modo claro/oscuro)*

**Endpoints API (Python)**
- `core/views_auth.py` contiene los endpoints de autenticación:
  - `api_autenticar_usuario`
  - `api_cerrar_sesion`
  - `api_obtener_roles`
  - `api_validar_2fa`

🔒 Reglas Estrictas de la Capa de Presentación e Interfaz
1. Control de Roles en Pantalla
La interfaz debe capturar el rol del usuario autenticado (Administrador, Supervisor, Operador, etc.) devuelto por el backend en el flujo asíncrono.

Queda estrictamente prohibido renderizar elementos de UI o accesos de control que no correspondan al rol verificado. La interfaz se adapta dinámicamente ocultando o mostrando las ventanas modales de trabajo autorizadas según el nivel de acceso.

2. Restricción de Dispositivos de Confianza y Doble Factor (2FA)
Límite de Equipos: El sistema permite un máximo estricto de dos (2) computadores o dispositivos de confianza por cuenta de usuario.

Desvinculación desde el Sistema Principal: La interfaz del sistema principal debe incluir un componente visual (ventana/modal) que liste los dispositivos de confianza registrados. Desde aquí se permite la eliminación física de una PC de confianza.

Flujo del Aplicativo Móvil: Al eliminar una PC de confianza, el sistema fuerza al usuario a iniciar sesión introduciendo un código dinámico temporal (OTP) generado por el aplicativo móvil de verificación de dos pasos en desarrollo.

3. Concurrencia de Sesión Única (Tokens de Verificación)
El sistema admite estrictamente una (1) sola sesión activa por cuenta de usuario en tiempo real.
Al iniciar sesión en un nuevo navegador o equipo, el token de verificación de la sesión anterior debe quedar automáticamente invalidado en el backend, impidiendo la navegación concurrente en dos entornos simultáneos.

4. Persistencia Global del Cambio de Tema
El botón de cambio de tema (Modo Claro / Modo Oscuro) se ubica estructuralmente en la interfaz base, pero su interactividad y persistencia deben funcionar de forma global para todo el sistema.

Al interactuar con el interruptor de tema, este alterará las variables nativas líquidas de global.css de manera inmediata sin recargar la página, guardando la preferencia del usuario en el almacenamiento local del navegador (localStorage) para que se aplique automáticamente en cualquier ventana o módulo posterior.

5. Cero Comentarios en HTML y Limpieza Absoluta
El archivo HTML de login no puede contener comentarios de desarrollo (``). Solo se permiten etiquetas de estructura y títulos visibles.

Cualquier duda, instrucción de soporte para el usuario o aclaración técnica sobre el flujo de inicio de sesión, recuperación de credenciales o enrolamiento del 2FA móvil, se resolverá visualmente dentro del componente de ayuda interactiva (?). Este botón desplegará un modal limpio con los puntos de ayuda correspondientes.
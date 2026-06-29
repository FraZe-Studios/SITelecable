document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginAlert = document.getElementById('loginAlert');
    const alertMessage = document.getElementById('alertMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');

    // =============================================================================
    // 1. TEMA CLARO / OSCURO (SOL AMARILLO Y LUNA AZUL)
    // =============================================================================
    const getSavedTheme = () => {
        return localStorage.getItem('theme') || 'light';
    };

    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    };

    // Aplicar tema inicial
    applyTheme(getSavedTheme());

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    });

    // =============================================================================
    // 2. LOGICA DE AUTENTICACION Y CONTROL DE FORMULARIO
    // =============================================================================
    // =============================================================================
    // 3. GENERACIÓN DE HUELLA DIGITAL DE DISPOSITIVO (WebGL + Hardware)
    // =============================================================================
    async function generateDeviceFingerprint() {
        let fp = "";
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    fp += gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) + "~";
                    fp += gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) + "~";
                }
                fp += gl.getParameter(gl.VERSION) + "~";
                fp += gl.getParameter(gl.SHADING_LANGUAGE_VERSION) + "~";
                fp += gl.getParameter(gl.VENDOR) + "~";
            }
        } catch (e) {
            fp += "no-webgl~";
        }
        fp += screen.width + "x" + screen.height + "x" + screen.colorDepth + "~";
        fp += window.devicePixelRatio + "~";
        fp += new Date().getTimezoneOffset() + "~";
        fp += navigator.userAgent + "~";
        fp += navigator.language + "~";
        fp += (navigator.hardwareConcurrency || 0);

        try {
            const msgUint8 = new TextEncoder().encode(fp);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (err) {
            let hash = 0;
            for (let i = 0; i < fp.length; i++) {
                const char = fp.charCodeAt(i);
                hash = (hash << 5) - hash + char;
                hash = hash & hash;
            }
            return "fallback_" + Math.abs(hash).toString(16);
        }
    }

    let pollInterval = null;

    const stopPolling = () => {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        submitBtn.disabled = false;
        btnText.textContent = "Ingresar";
        btnText.style.display = 'block';
        btnSpinner.style.display = 'none';
    };

    if (usernameInput) usernameInput.addEventListener('input', stopPolling);
    if (passwordInput) passwordInput.addEventListener('input', stopPolling);

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Limpiar alertas y detener polling previo
            stopPolling();
            loginAlert.style.display = 'none';
            const duplicateAlert = document.getElementById('duplicateSessionAlert');
            if (duplicateAlert) {
                duplicateAlert.style.display = 'none';
            }

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username || !password) {
                showAlert('Por favor, ingresa tu usuario y contraseña.');
                return;
            }

            setLoading(true);

            try {
                const csrfTokenInput = document.querySelector('[name=csrfmiddlewaretoken]');
                const csrfToken = csrfTokenInput ? csrfTokenInput.value : '';

                // Obtener huella digital del dispositivo
                const deviceFingerprint = await generateDeviceFingerprint();

                const executeLogin = async (isPoll = false) => {
                    const response = await fetch('/api/login/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken
                        },
                        body: JSON.stringify({ username, password, deviceFingerprint })
                    });

                    const data = await response.json();

                    if (response.ok && data.status === 'success') {
                        stopPolling();
                        localStorage.setItem('session_username', data.username);
                        localStorage.setItem('session_token', data.token);
                        window.location.href = '/dashboard/';
                    } else if (data.status === 'REQUERID_VERIFICACION_MOVIL') {
                        showAlert(data.mensaje || data.message || 'Límite de equipos alcanzado. Confirme desde su móvil.');
                        
                        // Configurar UI para espera
                        submitBtn.disabled = true;
                        btnText.textContent = "Esperando móvil...";
                        btnText.style.display = 'block';
                        btnSpinner.style.display = 'block';

                        // Iniciar polling si no está activo
                        if (!pollInterval) {
                            pollInterval = setInterval(() => {
                                executeLogin(true);
                            }, 3000);
                        }
                    } else {
                        stopPolling();
                        showAlert(data.message || data.mensaje || 'Error al iniciar sesión.');
                    }
                };

                await executeLogin();

            } catch (error) {
                console.error('Login error:', error);
                stopPolling();
                showAlert('Error de conexión con el servidor. Inténtalo de nuevo.');
            }
        });
    }

    function showAlert(message) {
        alertMessage.textContent = message;
        loginAlert.style.display = 'flex';
        loginAlert.style.animation = 'none';
        loginAlert.offsetHeight; // trigger reflow
        loginAlert.style.animation = null;
    }

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnSpinner.style.display = 'block';
        } else {
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            btnSpinner.style.display = 'none';
        }
    }
});

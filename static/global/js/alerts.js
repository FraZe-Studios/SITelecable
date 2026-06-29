/**
 * alerts.js - Sistema de alertas y notificaciones estéticas para SIT Telecable.
 * Crea un contenedor global de toasts e intercepta llamadas a window.alert()
 * para transformarlas en notificaciones no bloqueantes premium.
 */
class SITAlertManager {
    constructor() {
        this.container = null;
        // Esperamos a DOMContentLoaded por seguridad si se carga muy temprano
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.container = document.querySelector('.toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Muestra una notificación Toast animada y premium.
     * @param {string} message - Mensaje de la notificación.
     * @param {string} type - Tipo: 'danger' (error), 'warning' (advertencia), 'success' (éxito), 'info' (información).
     * @param {number} duration - Duración en milisegundos (0 para que no desaparezca solo).
     */
    show(message, type = 'info', duration = 5000) {
        if (!this.container || !document.body.contains(this.container)) {
            this.init();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // SVG Icon según el tipo
        let iconSvg = '';
        if (type === 'danger') {
            iconSvg = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        } else if (type === 'warning') {
            iconSvg = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        } else if (type === 'success') {
            iconSvg = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else {
            iconSvg = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="9" x2="12.01" y2="9"></line></svg>`;
        }

        toast.innerHTML = `
            ${iconSvg}
            <div class="toast-content">${message}</div>
            <button class="toast-close" aria-label="Cerrar" title="Cerrar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        // Cerrar al hacer clic en el botón de cerrar
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        this.container.appendChild(toast);

        // Descarte automático
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(toast);
            }, duration);
        }

        return toast;
    }

    dismiss(toast) {
        if (!toast.classList.contains('toast-fade-out')) {
            toast.classList.add('toast-fade-out');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
            // Failsafe por si no dispara transitionend
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 400);
        }
    }
}

// Inicializar de forma global
window.SITAlert = new SITAlertManager();

// Sobrescribir de forma segura window.alert para interceptar los mensajes de error/alert nativos
const nativeAlert = window.alert;
window.alert = function(message) {
    if (typeof message === 'string' || typeof message === 'number') {
        const msgStr = String(message);
        const lower = msgStr.toLowerCase();
        let type = 'info';

        // Clasificación por palabras clave
        if (lower.includes('error') || lower.includes('conexión') || lower.includes('fallo') || lower.includes('incorrect') || lower.includes('inválido') || lower.includes('limitar') || lower.includes('no hay') || lower.includes('no se')) {
            type = 'danger';
        } else if (lower.includes('advertencia') || lower.includes('cuidado') || lower.includes('selecciona') || lower.includes('atención') || lower.includes('por favor') || lower.includes('debe tener')) {
            type = 'warning';
        } else if (lower.includes('correcto') || lower.includes('exitoso') || lower.includes('actualizado') || lower.includes('guardado') || lower.includes('✓') || lower.includes('vinculado') || lower.includes('eliminado')) {
            type = 'success';
        }

        window.SITAlert.show(msgStr, type);
        console.log(`[SITAlert Interceptor - ${type.toUpperCase()}] ${msgStr}`);
    } else {
        // En caso de que se pase un objeto complejo o comportamiento no previsto
        nativeAlert(message);
    }
};

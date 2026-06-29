/**
 * tooltips.js - Sistema de tooltips estéticos y dinámicos para SIT Telecable.
 * Intercepta los atributos 'title' de cualquier elemento y muestra un tooltip premium.
 */
document.addEventListener('DOMContentLoaded', () => {
    let activeTooltip = null;

    const createTooltip = (target, text) => {
        // Eliminar tooltip activo si existe
        removeActiveTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);

        // Calcular posición
        const rect = target.getBoundingClientRect();
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Centrado horizontal
        const x = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
        // Justo encima del elemento con 8px de margen
        const y = rect.top - tooltip.offsetHeight - 8;

        // Limitar márgenes de la pantalla para evitar que se desborde
        const finalX = Math.max(8, Math.min(window.innerWidth - tooltip.offsetWidth - 8, x));
        const finalY = scrollTop + y;

        tooltip.style.left = `${finalX}px`;
        tooltip.style.top = `${finalY}px`;

        // Pequeña micro-animación al renderizar
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });

        activeTooltip = tooltip;
        target._tooltipEl = tooltip;
    };

    const removeActiveTooltip = (target) => {
        if (activeTooltip) {
            activeTooltip.classList.remove('show');
            // Esperar transición de opacidad y eliminar del DOM
            const elToRemove = activeTooltip;
            setTimeout(() => {
                elToRemove.remove();
            }, 150);
            activeTooltip = null;
        }
        if (target && target._tooltipEl) {
            target._tooltipEl = null;
        }
    };

    // Usamos delegación de eventos con la fase de captura para mouseenter/mouseleave
    document.addEventListener('mouseenter', (e) => {
        const target = e.target.closest && e.target.closest('[title]');
        if (!target) return;

        const text = target.getAttribute('title');
        if (!text || text.trim() === '') return;

        // Guardar título original para evitar tooltip nativo
        target.setAttribute('data-tooltip-text', text);
        target.removeAttribute('title');

        createTooltip(target, text);
    }, true);

    document.addEventListener('mouseleave', (e) => {
        const target = e.target.closest && e.target.closest('[data-tooltip-text]');
        if (!target) return;

        const text = target.getAttribute('data-tooltip-text');
        if (text) {
            target.setAttribute('title', text);
            target.removeAttribute('data-tooltip-text');
        }

        removeActiveTooltip(target);
    }, true);

    // Evitar que queden tooltips flotando al hacer clic o scroll
    document.addEventListener('click', (e) => {
        const target = e.target.closest && e.target.closest('[data-tooltip-text]');
        if (target) {
            const text = target.getAttribute('data-tooltip-text');
            if (text) {
                target.setAttribute('title', text);
                target.removeAttribute('data-tooltip-text');
            }
            removeActiveTooltip(target);
        } else {
            removeActiveTooltip();
        }
    });

    window.addEventListener('scroll', () => removeActiveTooltip(), { passive: true });
});

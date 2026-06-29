/**
 * static/js/organizacion_sede.js
 * Módulo: Panel de Configuración Maestro de Sede
 * Carga cada pestaña de forma asíncrona desde templates/organizacion/sede/
 * Requiere: getCookie() disponible globalmente.
 */

(function () {
    'use strict';

    // ── Estado del módulo ──────────────────────────────────────────────────
    let currentSedeId = null;
    let activeSedeTab = 'datos';

    // Caché de templates ya descargados para evitar múltiples fetches
    const _tabCache = {};

    // ── Elementos DOM ──────────────────────────────────────────────────────
    const sedeConfigOverlay = document.getElementById('sedeConfigOverlay');
    const sedeConfigCloseBtn = document.getElementById('sedeConfigCloseBtn');
    const sedeConfigTitle = document.getElementById('sedeConfigTitle');
    const sedeConfigSubtitle = document.getElementById('sedeConfigSubtitle');
    const sedeConfigBody = document.getElementById('sedeConfigBody');

    // ── Helpers ────────────────────────────────────────────────────────────
    function getCookie(name) {
        const val = `; ${document.cookie}`;
        const parts = val.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return '';
    }
    // Exponemos getCookie globalmente para que los sub-templates puedan usarla
    window.getCookie = getCookie;

    function showSpinner() {
        sedeConfigBody.innerHTML = `
            <div class="sede-loading-spinner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span>Cargando datos de la sede...</span>
            </div>`;
    }

    function showError(msg) {
        sedeConfigBody.innerHTML = `
            <div style="padding:2rem;text-align:center;color:var(--danger);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:36px;height:36px;margin-bottom:.5rem;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p>${msg}</p>
            </div>`;
    }

    // ── Carga del template de una pestaña vía fetch ────────────────────────
    async function loadTabTemplate(tabName) {
        if (_tabCache[tabName]) return _tabCache[tabName];
        const resp = await fetch(`/static/organizacion/sede/${tabName}.html`);
        if (!resp.ok) throw new Error(`No se pudo cargar la pestaña '${tabName}'`);
        const html = await resp.text();
        _tabCache[tabName] = html;
        return html;
    }

    // ── Renderiza la pestaña activa ────────────────────────────────────────
    async function renderActiveSedeTab() {
        if (!window.currentSedeConfigData) return;
        showSpinner();

        try {
            const html = await loadTabTemplate(activeSedeTab);

            // Inyectar el HTML del tab en el body del modal
            sedeConfigBody.innerHTML = html;

            // Ejecutar los scripts inline del fragmento cargado
            // (los scripts dentro de innerHTML no se ejecutan automáticamente)
            sedeConfigBody.querySelectorAll('script').forEach(oldScript => {
                const newScript = document.createElement('script');
                newScript.textContent = oldScript.textContent;
                oldScript.replaceWith(newScript);
            });

            // Llamar al render específico de cada tab (expuesto por el script inline)
            const renderFn = window[`renderSedeTab${capitalize(activeSedeTab)}`];
            if (typeof renderFn === 'function') {
                renderFn();
            }
        } catch (err) {
            showError(`Error al cargar pestaña: ${err.message}`);
        }
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ── API pública: Abrir panel de configuración ──────────────────────────
    window.openSedeConfig = async function (sedeId, initialTab = 'datos') {
        currentSedeId = sedeId;
        window.currentSedeId = sedeId;

        sedeConfigOverlay.classList.add('open');
        showSpinner();
        sedeConfigSubtitle.textContent = 'Cargando...';

        try {
            const resp = await fetch(`/api/sede/config/?sede_id=${sedeId}`);
            const res = await resp.json();

            if (res.status === 'success') {
                window.currentSedeConfigData = res;

                const prefijo = res.datos_sede.sector_prefijo || '';
                const baseName = res.datos_sede.nombre;

                sedeConfigTitle.textContent = `Gestión Sede: ${baseName}`;
                sedeConfigSubtitle.innerHTML = `Sede Activa: <strong>${baseName}${prefijo ? ' (' + prefijo + ')' : ''}</strong>`;

                // Activar pestaña inicial
                document.querySelectorAll('.sede-tab-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.tab === initialTab);
                });
                activeSedeTab = initialTab;

                // Limpiar caché para forzar re-render con datos frescos
                Object.keys(_tabCache).forEach(k => delete _tabCache[k]);

                await renderActiveSedeTab();
            } else {
                showError(`Error al cargar configuración: ${res.message}`);
                setTimeout(() => sedeConfigOverlay.classList.remove('open'), 3000);
            }
        } catch (err) {
            showError('Error de conexión con el servidor.');
            setTimeout(() => sedeConfigOverlay.classList.remove('open'), 3000);
        }
    };

    // Alias para el popup del mapa
    window.editarSedePopup = function (id) {
        window.openSedeConfig(id);
    };

    // ── Event listeners del modal ──────────────────────────────────────────
    sedeConfigCloseBtn?.addEventListener('click', () => {
        sedeConfigOverlay.classList.remove('open');
        window.currentSedeConfigData = null;
        window.currentSedeId = null;
    });

    // Cerrar al hacer click en el overlay fuera del modal
    sedeConfigOverlay?.addEventListener('click', e => {
        if (e.target === sedeConfigOverlay) {
            sedeConfigOverlay.classList.remove('open');
            window.currentSedeConfigData = null;
            window.currentSedeId = null;
        }
    });

    // Delegación de clic en pestañas
    document.querySelectorAll('.sede-tab-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.sede-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSedeTab = btn.dataset.tab;
            await renderActiveSedeTab();
        });
    });

    // Añadir estilo de animación spin si no existe
    if (!document.getElementById('sede-spin-style')) {
        const style = document.createElement('style');
        style.id = 'sede-spin-style';
        style.textContent = `@keyframes spin{to{transform:rotate(360deg)}}`;
        document.head.appendChild(style);
    }

})();

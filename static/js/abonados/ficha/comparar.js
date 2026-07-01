/**
 * comparar.js - Modal de Comparación de Liquidación vs Evidencias Fotográficas
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('fichaApp');
        if (!app) return;

        // ── Abrir modal de comparar liquidación ───────────────────────────────
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-ver-liquidacion');
            if (!btn) return;

            const ticketId = btn.dataset.ticketId;
            const suscripcionId = btn.dataset.suscripcion;

            let ticketObj = null;
            try {
                const ticketsScript = document.getElementById(`tickets-data-${suscripcionId}`);
                if (ticketsScript) {
                    const ticketsArray = JSON.parse(ticketsScript.textContent || '[]');
                    ticketObj = ticketsArray.find(t => String(t.id) === String(ticketId));
                }
            } catch (err) {
                console.error('Error al parsear tickets-data:', err);
            }

            if (!ticketObj) return;

            const modal = document.getElementById('modal-comparar-liquidacion');
            if (!modal) return;

            // ── Cabecera ──────────────────────────────────────────────────────
            const titleEl = modal.querySelector('#comp-title');
            if (titleEl) {
                titleEl.innerHTML = `<i class="fa-solid fa-code-compare" style="color:var(--primary-color);"></i> Comparar Liquidación — Ticket T${ticketObj.id}`;
            }

            // ── Footer: fecha, técnicos, usuario ──────────────────────────────
            let fechaLiq = '—';
            if (ticketObj.fecha_liquidacion && ticketObj.fecha_liquidacion !== 'None') {
                fechaLiq = String(ticketObj.fecha_liquidacion).replace('T', ' ').substring(0, 19);
            }
            const fechaFooterEl = modal.querySelector('#comp-fecha-footer');
            if (fechaFooterEl) fechaFooterEl.textContent = fechaLiq;

            const tecnicos = (ticketObj.tecnicos && ticketObj.tecnicos.length > 0)
                ? ticketObj.tecnicos.join(', ')
                : 'Ninguno asignado';
            const tecnicosFooterEl = modal.querySelector('#comp-tecnicos-footer');
            if (tecnicosFooterEl) tecnicosFooterEl.textContent = tecnicos;

            // ── Materiales y evidencias ───────────────────────────────────────
            let usuarioLiq = '—';
            let materialesUsados = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem; text-align:center;">Ninguno registrado</div>';
            let materialesRetirados = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem; text-align:center;">Ninguno registrado</div>';
            let evidencias = [];

            if (ticketObj.liquidacion && typeof ticketObj.liquidacion === 'object') {
                const liq = ticketObj.liquidacion;

                if (liq.usuario_liquidacion?.nombre_apellidos) {
                    usuarioLiq = liq.usuario_liquidacion.nombre_apellidos;
                } else if (liq.personal_id) {
                    usuarioLiq = `Usuario #${liq.personal_id}`;
                }

                if (Array.isArray(liq.evidencias) && liq.evidencias.length > 0) {
                    evidencias = liq.evidencias;
                } else if (liq.evidencia_url) {
                    evidencias = [liq.evidencia_url];
                }

                if (Array.isArray(liq.materiales) && liq.materiales.length > 0) {
                    const usados = [];
                    const retirados = [];

                    liq.materiales.forEach(m => {
                        const isRetiro = m.descripcion.toUpperCase().includes('[RETIRO]');
                        const descLimpia = m.descripcion.replace(/\[RETIRO\]\s*/i, '').trim();

                        let icon = '<i class="fa-solid fa-box" style="color:var(--text-muted);"></i>';
                        const descUpper = descLimpia.toUpperCase();
                        if (descUpper.includes('ROUTER') || descUpper.includes('ONU') || descUpper.includes('HUAWEI')) {
                            icon = '<i class="fa-solid fa-wifi" style="color:var(--primary-color);"></i>';
                        } else if (descUpper.includes('COAXIAL') || descUpper.includes('CABLE')) {
                            icon = '<i class="fa-solid fa-cable-car" style="color:#ef4444;"></i>';
                        } else if (descUpper.includes('CONECTOR')) {
                            icon = '<i class="fa-solid fa-circle-nodes" style="color:#3b82f6;"></i>';
                        } else if (descUpper.includes('FIBRA')) {
                            icon = '<i class="fa-solid fa-circle-dot" style="color:#10b981;"></i>';
                        }

                        const htmlRow = `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface); border:1px solid var(--border-color); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='none'">
                                <div style="display:flex; align-items:center; gap:0.65rem;">
                                    ${icon}
                                    <span style="font-weight:600; color:var(--text-color); font-size:0.88rem;">${descLimpia}</span>
                                </div>
                                <div style="background:var(--bg-surface-active); color:var(--text-color); font-weight:700; font-size:0.8rem; padding:0.2rem 0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                                    Cant: ${m.cantidad}
                                </div>
                            </div>
                        `;

                        if (isRetiro) retirados.push(htmlRow);
                        else usados.push(htmlRow);
                    });

                    if (usados.length > 0) materialesUsados = usados.join('');
                    if (retirados.length > 0) materialesRetirados = retirados.join('');
                }
            }

            const usuarioEl = modal.querySelector('#comp-usuario-liq');
            if (usuarioEl) usuarioEl.textContent = usuarioLiq;

            const usadosEl = modal.querySelector('#comp-materiales-usados');
            if (usadosEl) usadosEl.innerHTML = materialesUsados;

            const retiradosEl = modal.querySelector('#comp-materiales-retirados');
            if (retiradosEl) retiradosEl.innerHTML = materialesRetirados;

            // ── Galería de evidencias ─────────────────────────────────────────
            const imgContainer = modal.querySelector('#comp-img-container');
            const thumbnailsBox = modal.querySelector('#comp-thumbnails-box');
            const thumbnailsContainer = modal.querySelector('#comp-thumbnails-container');

            let currentImageIndex = 0;

            function setMainImage(url) {
                if (url) {
                    currentImageIndex = evidencias.indexOf(url);
                    if (currentImageIndex === -1) currentImageIndex = 0;

                    imgContainer.innerHTML = `
                        <a href="${url}" target="_blank" title="Click para abrir en pestaña completa">
                            <img src="${url}" alt="Evidencia de Liquidación" style="max-width:100%; max-height:380px; object-fit:contain; border-radius:var(--radius-sm); border:1px solid var(--border-color); cursor:zoom-in; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        </a>`;
                } else {
                    imgContainer.innerHTML = `
                        <div style="color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:0.5rem; justify-content:center;">
                            <i class="fa-solid fa-image-slash" style="font-size:2.5rem; opacity:0.5;"></i>
                            <span>No se subió evidencia fotográfica para este ticket.</span>
                        </div>`;
                }

                thumbnailsContainer?.querySelectorAll('.comp-thumb-btn').forEach(thumbBtn => {
                    if (thumbBtn.dataset.url === url) {
                        thumbBtn.style.border = '2px solid var(--primary-color)';
                        thumbBtn.style.opacity = '1';
                    } else {
                        thumbBtn.style.border = '1px solid var(--border-color)';
                        thumbBtn.style.opacity = '0.6';
                    }
                });
            }

            // Botones de navegación prev/next
            const prevBtn = modal.querySelector('#comp-prev-btn');
            const nextBtn = modal.querySelector('#comp-next-btn');

            if (evidencias.length > 1) {
                prevBtn.style.display = 'flex';
                nextBtn.style.display = 'flex';

                const newPrevBtn = prevBtn.cloneNode(true);
                const newNextBtn = nextBtn.cloneNode(true);
                prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
                nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

                newPrevBtn.addEventListener('click', () => {
                    currentImageIndex = (currentImageIndex - 1 + evidencias.length) % evidencias.length;
                    setMainImage(evidencias[currentImageIndex]);
                });

                newNextBtn.addEventListener('click', () => {
                    currentImageIndex = (currentImageIndex + 1) % evidencias.length;
                    setMainImage(evidencias[currentImageIndex]);
                });
            } else {
                if (prevBtn) prevBtn.style.display = 'none';
                if (nextBtn) nextBtn.style.display = 'none';
            }

            // Miniaturas
            if (evidencias.length > 0) {
                setMainImage(evidencias[0]);

                if (evidencias.length > 1) {
                    const countSpan = modal.querySelector('#comp-thumbnail-count');
                    if (countSpan) countSpan.textContent = evidencias.length;

                    if (thumbnailsBox) thumbnailsBox.style.display = 'flex';
                    if (thumbnailsContainer) {
                        thumbnailsContainer.innerHTML = evidencias.map(url => `
                            <button type="button" class="comp-thumb-btn" data-url="${url}" style="flex-shrink:0; width:50px; height:50px; padding:0; border:1px solid var(--border-color); border-radius:var(--radius-sm); overflow:hidden; cursor:pointer; opacity:0.6; transition: opacity 0.2s; background: var(--bg-surface);">
                                <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                            </button>
                        `).join('');

                        thumbnailsContainer.querySelectorAll('.comp-thumb-btn').forEach(thumbBtn => {
                            thumbBtn.addEventListener('click', () => setMainImage(thumbBtn.dataset.url));
                        });
                    }
                } else {
                    if (thumbnailsBox) thumbnailsBox.style.display = 'none';
                    if (thumbnailsContainer) thumbnailsContainer.innerHTML = '';
                }
            } else {
                setMainImage(null);
                if (thumbnailsBox) thumbnailsBox.style.display = 'none';
                if (thumbnailsContainer) thumbnailsContainer.innerHTML = '';
            }

            modal.style.display = 'flex';
        });

        // ── Cerrar modal comparar ─────────────────────────────────────────────
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('modal-comparar-liquidacion');
            if (!modal) return;
            if (
                e.target.classList.contains('modal-close-btn') ||
                e.target.closest('.modal-close-btn') ||
                e.target === modal
            ) {
                modal.style.display = 'none';
            }
        });
    });

})();

/**
 * Gestión de RUCs por sede: SUNAT, límites, comprobantes, contratos y vista previa
 */

document.addEventListener('DOMContentLoaded', () => {

    let currentSedeId = null;
    let rucsList = [];
    let filteredRucs = [];
    let fileManager = null;

    const fmtMoney = n => `S/ ${(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const pctBar = (used, limit) => {
        const p = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
        const color = p >= 90 ? 'var(--danger)' : p >= 70 ? '#f59e0b' : 'var(--primary)';
        return `<div style="background:var(--bg-surface-hover);border-radius:4px;height:6px;margin-top:4px;"><div style="width:${p}%;background:${color};height:100%;border-radius:4px;"></div></div>`;
    };

    const previewUrl = (rucId, comprobanteId, tipo) => {
        const base = comprobanteId
            ? `/api/sede/rucs/${rucId}/comprobante/${comprobanteId}/vista-previa/?sede_id=${currentSedeId}`
            : `/api/sede/rucs/${rucId}/comprobante/vista-previa/?sede_id=${currentSedeId}&tipo=${tipo || 'BOLETA'}`;
        return base;
    };

    window.initSedeRucsModule = (sedeId) => {
        currentSedeId = sedeId;
        window.currentSedeId = sedeId; // Also set global for backup
        fileManager = new FileManager({
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.85,
            maxFileSizeKB: 500
        });
        loadRucsData();
    };

    const loadRucsData = async () => {
        const container = document.getElementById('rucsListContainer');
        try {
            const resp = await fetch(`/api/sede/rucs/?sede_id=${currentSedeId}`);
            const res = await resp.json();
            if (res.status === 'success') {
                rucsList = res.rucs || [];
                filteredRucs = [...rucsList];
                renderRucsList();
            } else if (container) {
                container.innerHTML = `<p style="color:var(--danger);padding:1rem;">${res.message}</p>`;
            }
        } catch (err) {
            if (container) container.innerHTML = '<p style="color:var(--danger);padding:1rem;">Error al cargar RUCs</p>';
        }
    };

    const renderRucsList = () => {
        const container = document.getElementById('rucsListContainer');
        if (!container) return;

        if (!filteredRucs.length) {
            container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);">
                <p>No hay RUCs en esta sede.</p>
                <p style="font-size:0.85rem;">Agregue un RUC nuevo o vincule uno existente.</p>
            </div>`;
            return;
        }

        container.innerHTML = filteredRucs.map(ruc => {
            const limite = ruc.limite_recaudacion_mensual || 600000;
            const vinculado = ruc.vinculado !== false;
            const activo = ruc.sede_ruc_activo !== false;
            const itemClass = vinculado ? 'ruc-item' : 'ruc-item ruc-item-desvinculado';
            return `
            <div class="${itemClass}" data-ruc-id="${ruc.id}">
                <div class="ruc-header">
                    <div>
                        <div class="ruc-number">${ruc.numero}</div>
                        <div class="ruc-razon-social">${ruc.razon_social}</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${!vinculado ? '<span class="config-badge config-badge-warning">Desvinculado</span>' : ''}
                        ${vinculado && activo ? '<span class="config-badge config-badge-success">Vinculado</span>' : ''}
                        ${vinculado && !activo ? '<span class="config-badge config-badge-danger">Inactivo</span>' : ''}
                        ${ruc.limite_alcanzado && vinculado ? '<span class="config-badge config-badge-danger">Límite alcanzado</span>' : ''}
                    </div>
                </div>
                <div class="ruc-details">
                    <div class="ruc-detail">
                        <span class="ruc-label">Recaudado mes:</span>
                        <span class="ruc-value">${fmtMoney(ruc.monto_recaudado_mes)} / ${fmtMoney(limite)}</span>
                        ${pctBar(ruc.monto_recaudado_mes, limite)}
                    </div>
                    <div class="ruc-detail">
                        <span class="ruc-label">Emisión:</span>
                        <span class="ruc-value" style="font-size:0.75rem;">
                            ${!vinculado ? 'No puede emitir — desvinculado' :
                              `Boleta: ${ruc.permite_boleta ? 'SI' : 'NO'} | Factura: ${ruc.permite_factura ? 'SI' : 'NO'} | N.Venta: ${ruc.permite_nota_venta ? 'SI' : 'NO'}`}
                        </span>
                    </div>
                </div>
                <div class="ruc-actions">
                    <button type="button" class="ruc-action-btn btn-view" onclick="viewRucDetails(${ruc.id})" title="Ver detalle y comprobantes">${GLOBAL_ICONS.view()}</button>
                    ${vinculado
                        ? `<button type="button" class="ruc-action-btn btn-delete" onclick="deleteRuc(${ruc.id})" title="Desvincular">${GLOBAL_ICONS.delete()}</button>`
                        : `<button type="button" class="ruc-action-btn btn-link" onclick="vincularRuc(${ruc.id})" title="Vincular">${GLOBAL_ICONS.add()}</button>`}
                </div>
            </div>`;
        }).join('');
    };

    window.openComprobantePreview = (rucId, comprobanteId, tipo) => {
        window.open(previewUrl(rucId, comprobanteId, tipo), '_blank', 'width=900,height=700');
    };

    window.searchRucs = (query) => {
        const q = query.toLowerCase();
        filteredRucs = rucsList.filter(r =>
            r.numero.toLowerCase().includes(q) || r.razon_social.toLowerCase().includes(q)
        );
        renderRucsList();
    };

    window.vincularRuc = async (rucId) => {
        const fd = new FormData();
        // Use currentSedeId from module or fallback to global
        const sedeIdToUse = currentSedeId || window.currentSedeId;
        if (!sedeIdToUse) {
            alert('Error: No se pudo identificar la sede. Por favor recargue la página.');
            return;
        }
        fd.append('sede_id', sedeIdToUse);
        try {
            const resp = await fetch(`/api/sede/rucs/${rucId}/vincular/`, {
                method: 'POST',
                body: fd,
                headers: { 'X-CSRFToken': window.getCookie('csrftoken') }
            });
            const res = await resp.json();
            if (res.status === 'success') {
                loadRucsData();
                alert('RUC vinculado correctamente. Ya puede emitir comprobantes.');
            } else alert(res.message);
        } catch (e) { alert('Error al vincular RUC'); }
    };

    window.vincularRucExistente = async () => {
        // Use currentSedeId from module or fallback to global
        const sedeIdToUse = currentSedeId || window.currentSedeId;
        if (!sedeIdToUse) {
            alert('Error: No se pudo identificar la sede. Por favor recargue la página.');
            return;
        }
        try {
            const resp = await fetch(`/api/sede/rucs/disponibles/?sede_id=${sedeIdToUse}`);
            const res = await resp.json();
            if (res.status !== 'success' || !res.rucs.length) {
                alert('No hay RUCs globales disponibles para vincular. Cree uno nuevo.');
                return;
            }
            const opciones = res.rucs.map(r =>
                `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border:1px solid var(--border-color);border-radius:6px;margin-bottom:0.5rem;cursor:pointer;">
                    <input type="radio" name="ruc_pick" value="${r.id}">
                    <span><strong>${r.numero_ruc}</strong> — ${r.razon_social}</span>
                </label>`
            ).join('');
            const html = `
            <div id="vincularRucOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem;">
                <div style="background:var(--bg-surface);border-radius:12px;padding:1.5rem;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;">
                    <h3 style="margin:0 0 1rem;">Vincular RUC existente</h3>
                    <form id="vincularRucForm">${opciones}
                        <div style="text-align:right;margin-top:1rem;">
                            <button type="button" class="config-btn-secondary" onclick="document.getElementById('vincularRucOverlay').remove()" title="Cancelar">${GLOBAL_ICONS.cancel()} Cancelar</button>
                            <button type="submit" class="config-btn-add" style="margin-left:0.5rem;" title="Vincular">${GLOBAL_ICONS.add()} Vincular RUC</button>
                        </div>
                    </form>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            document.getElementById('vincularRucForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const picked = document.querySelector('[name="ruc_pick"]:checked');
                if (!picked) { alert('Seleccione un RUC'); return; }
                document.getElementById('vincularRucOverlay').remove();
                await window.vincularRuc(parseInt(picked.value, 10));
            });
        } catch (e) { alert('Error al cargar RUCs disponibles'); }
    };

    window.viewRucDetails = async (rucId) => {
        try {
            const resp = await fetch(`/api/sede/rucs/${rucId}/?sede_id=${currentSedeId}`);
            const res = await resp.json();
            if (res.status !== 'success') { alert(res.message); return; }
            const r = res.ruc;
            const vinculado = r.vinculado !== false;

            const comps = (r.comprobantes || []).map(c => `
                <tr>
                    <td>${c.tipo_comprobante}</td>
                    <td>${c.serie}-${String(c.correlativo).padStart(8, '0')}</td>
                    <td>${fmtMoney(c.monto_total)}</td>
                    <td>${c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-PE') : '—'}</td>
                    <td style="text-align:right;white-space:nowrap;">
                        <button type="button" class="config-btn-icon" style="padding:0.2rem 0.5rem;" onclick="openComprobantePreview(${rucId}, ${c.id})" title="Ver comprobante">${GLOBAL_ICONS.view()}</button>
                    </td>
                </tr>`).join('');

            const compsBody = comps || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">
                Sin comprobantes emitidos aún.
            </td></tr>`;

            const html = `
            <div class="modal-overlay" id="rucDetailOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem;">
                <div style="background:var(--bg-surface);border-radius:12px;max-width:860px;width:100%;max-height:90vh;overflow-y:auto;padding:1.5rem;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;gap:1rem;">
                        <div>
                            <h3 style="margin:0;">${r.numero} — ${r.razon_social}</h3>
                            <p style="margin:0.25rem 0 0;font-size:0.85rem;color:var(--text-muted);">${r.direccion_fiscal || ''}</p>
                            ${!vinculado ? '<p style="color:var(--danger);font-size:0.8rem;margin-top:0.5rem;">Desvinculado — no puede emitir hasta vincular de nuevo.</p>' : ''}
                        </div>
                        <button type="button" onclick="closeRucDetailModal()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;">×</button>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;">
                        <button type="button" class="config-btn-secondary" onclick="closeRucDetailModal(); editRuc(${rucId});" title="Editar RUC">${GLOBAL_ICONS.edit()} Editar RUC</button>
                        <button type="button" class="config-btn-secondary" onclick="openComprobantePreview(${rucId}, null, 'BOLETA')" title="Vista previa Boleta">${GLOBAL_ICONS.view()} Boleta</button>
                        <button type="button" class="config-btn-secondary" onclick="openComprobantePreview(${rucId}, null, 'FACTURA')" title="Vista previa Factura">${GLOBAL_ICONS.view()} Factura</button>
                        ${!vinculado ? `<button type="button" class="config-btn-add" onclick="closeRucDetailModal(); vincularRuc(${rucId});" title="Vincular a sede">${GLOBAL_ICONS.add()} Vincular a Sede</button>` : ''}
                        ${r.contrato ? `
                            <button type="button" class="config-btn-secondary" onclick="window.open('/api/sede/rucs/${rucId}/contrato/ver/?sede_id=${currentSedeId}','_blank')" title="Ver Contrato">
                                ${GLOBAL_ICONS.view()} Ver PDF
                            </button>
                            <label class="config-btn-secondary" style="cursor:pointer;" title="Actualizar Contrato PDF">
                                ${GLOBAL_ICONS.upload()} Actualizar PDF
                                <input type="file" accept=".pdf" style="display:none;" onchange="uploadContratoFromDetail(${rucId}, this.files[0])">
                            </label>
                        ` : `
                            <label class="config-btn-secondary" style="cursor:pointer;" title="Subir Contrato PDF">
                                ${GLOBAL_ICONS.upload()} Subir PDF
                                <input type="file" accept=".pdf" style="display:none;" onchange="uploadContratoFromDetail(${rucId}, this.files[0])">
                            </label>
                        `}
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                        <div style="background:var(--bg-surface-hover);padding:0.75rem;border-radius:8px;">
                            <div style="font-size:0.75rem;color:var(--text-muted);">Recaudado mes</div>
                            <div style="font-weight:700;">${fmtMoney(r.monto_recaudado_mes)}</div>
                            ${pctBar(r.monto_recaudado_mes, r.limite_recaudacion_mensual)}
                        </div>
                        <div style="background:var(--bg-surface-hover);padding:0.75rem;border-radius:8px;">
                            <div style="font-size:0.75rem;color:var(--text-muted);">Recaudado año</div>
                            <div style="font-weight:700;">${fmtMoney(r.monto_recaudado_anio)}</div>
                        </div>
                    </div>
                    <h4 style="margin:0 0 0.5rem;font-size:0.9rem;">Comprobantes emitidos (documento al cliente)</h4>
                    <table class="config-table" style="font-size:0.8rem;">
                        <thead><tr><th>Tipo</th><th>Número</th><th>Monto</th><th>Fecha</th><th></th></tr></thead>
                        <tbody>${compsBody}</tbody>
                    </table>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        } catch (e) {
            alert('Error al cargar detalle del RUC');
        }
    };

    window.closeRucDetailModal = () => document.getElementById('rucDetailOverlay')?.remove();

    window.uploadContratoFromDetail = async (rucId, file) => {
        if (!file) return;
        const fd = new FormData();
        fd.append('contrato', file);
        fd.append('sede_id', currentSedeId);
        try {
            const resp = await fetch(`/api/sede/rucs/${rucId}/contrato/`, { method: 'POST', body: fd });
            const res = await resp.json();
            if (res.status === 'success') {
                closeRucDetailModal();
                loadRucsData();
                alert('Contrato subido correctamente');
            } else alert(res.message);
        } catch (e) { alert('Error al subir contrato'); }
    };

    window.editRuc = async (rucId) => {
        let ruc = rucsList.find(r => r.id === rucId);
        if (!ruc) {
            try {
                const resp = await fetch(`/api/sede/rucs/${rucId}/?sede_id=${currentSedeId}`);
                const res = await resp.json();
                if (res.status === 'success') ruc = res.ruc;
            } catch (e) {}
        }
        if (!ruc) { alert('No se pudo cargar el RUC'); return; }
        window.addNewRuc(ruc);
    };

    window.deleteRuc = async (rucId) => {
        if (!confirm('¿Desvincular este RUC de la sede?\n\nSeguirá visible como desvinculado y no podrá emitir hasta que lo vincule de nuevo.')) return;
        try {
            const resp = await fetch(`/api/sede/rucs/${rucId}/desvincular/?sede_id=${currentSedeId}`, {
                method: 'POST',
                headers: { 'X-CSRFToken': window.getCookie('csrftoken') }
            });
            const res = await resp.json();
            if (res.status === 'success') loadRucsData();
            else alert(res.message);
        } catch (e) { alert('Error al desvincular RUC'); }
    };

    const appendCheckbox = (fd, name, form) => {
        fd.set(name, form.querySelector(`[name="${name}"]`)?.checked ? 'true' : 'false');
    };

    const esc = s => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    window.addNewRuc = (existing = null) => {
        const isEdit = !!existing;
        const logoPreviewHtml = existing?.logo_url
            ? `<img src="${esc(existing.logo_url)}" style="max-height:50px;margin-top:8px;border-radius:4px;">`
            : '';
        // Capture sede_id at modal creation time
        const sedeIdAtCreation = currentSedeId || window.currentSedeId;
        const modalHtml = `
            <div class="modal-overlay" id="rucModalOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem;">
                <div class="modal-content" style="background:var(--bg-surface);border-radius:12px;padding:2rem;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                        <h3 style="margin:0;">${isEdit ? 'Editar RUC' : 'Agregar Nuevo RUC'}</h3>
                        <button type="button" onclick="closeRucModal()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">×</button>
                    </div>
                    <form id="rucForm">
                        <input type="hidden" name="sede_id" value="${sedeIdAtCreation || ''}">
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Número de RUC *</label>
                            <input type="text" class="config-form-input" name="numero_ruc" required pattern="[0-9]{11}" placeholder="11 dígitos" value="${esc(existing?.numero)}" ${isEdit ? 'readonly' : ''}>
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Razón Social *</label>
                            <input type="text" class="config-form-input" name="razon_social" required value="${esc(existing?.razon_social)}">
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Dirección Fiscal</label>
                            <input type="text" class="config-form-input" name="direccion_fiscal" value="${esc(existing?.direccion_fiscal)}">
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Teléfono / Celular</label>
                            <input type="text" class="config-form-input" name="telefono_celular" value="${esc(existing?.telefono_celular)}" placeholder="Ej. 999999999">
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Usuario SOL</label>
                            <input type="text" class="config-form-input" name="usuario_sol" value="${esc(existing?.usuario_sol)}">
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Clave SOL</label>
                            <input type="password" class="config-form-input" name="clave_sol" placeholder="${isEdit ? 'Dejar vacío para no cambiar' : ''}" autocomplete="new-password">
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Logo de la Empresa</label>
                            <div class="file-upload-container">
                                <svg class="file-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;margin-bottom:0.5rem;color:var(--text-muted);">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <div class="file-upload-text" style="font-size:0.85rem;font-weight:600;margin-bottom:0.2rem;">Haga clic o arrastre el logo aquí</div>
                                <div class="file-upload-subtext" style="font-size:0.75rem;color:var(--text-muted);">PNG, JPG, JPEG (Máx. 500KB)</div>
                                <input type="file" id="logoInput" name="logo" accept="image/*">
                            </div>
                            <div id="logoPreview">${logoPreviewHtml}</div>
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Certificado P12 ${existing?.certificado_p12 ? '(Cargado — suba otro para reemplazar)' : ''}</label>
                            <div class="file-upload-container">
                                <svg class="file-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;margin-bottom:0.5rem;color:var(--text-muted);">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                                <div class="file-upload-text" style="font-size:0.85rem;font-weight:600;margin-bottom:0.2rem;">Haga clic o arrastre el certificado .p12 aquí</div>
                                <div class="file-upload-subtext" style="font-size:0.75rem;color:var(--text-muted);">Archivo de firma digital (.p12)</div>
                                <input type="file" id="certificadoInput" name="certificado_p12" accept=".p12">
                            </div>
                            <div id="certificadoPreview"></div>
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Clave del Certificado P12</label>
                            <input type="password" class="config-form-input" name="clave_certificado" placeholder="${isEdit ? 'Dejar vacío para no cambiar' : ''}" autocomplete="new-password">
                        </div>
                        <div style="border-top:1px solid var(--border-color);padding-top:1rem;">
                            <h4 style="margin:0 0 1rem;font-size:0.95rem;">Límite de Recaudación Mensual</h4>
                            <input type="number" class="config-form-input" name="limite_recaudacion_mensual" value="${existing?.limite_recaudacion_mensual || 600000}" min="0" step="0.01">
                        </div>
                        <div style="border-top:1px solid var(--border-color);padding-top:1rem;margin-top:1rem;">
                            <h4 style="margin:0 0 1rem;font-size:0.95rem;">Series y Correlativos SUNAT</h4>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                                <div class="config-form-group">
                                    <label>Prefijo Boletas</label>
                                    <input type="text" class="config-form-input" name="prefijo_boleta" maxlength="4" placeholder="Ej. B001" value="${esc(existing?.prefijo_boleta || 'B001')}">
                                </div>
                                <div class="config-form-group">
                                    <label>Número Actual Boletas</label>
                                    <input type="number" class="config-form-input" name="numero_actual_boleta" min="1" placeholder="Ej. 1" value="${existing?.numero_actual_boleta || 1}">
                                </div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                                <div class="config-form-group">
                                    <label>Prefijo Facturas</label>
                                    <input type="text" class="config-form-input" name="prefijo_factura" maxlength="4" placeholder="Ej. F001" value="${esc(existing?.prefijo_factura || 'F001')}">
                                </div>
                                <div class="config-form-group">
                                    <label>Número Actual Facturas</label>
                                    <input type="number" class="config-form-input" name="numero_actual_factura" min="1" placeholder="Ej. 1" value="${existing?.numero_actual_factura || 1}">
                                </div>
                            </div>
                        </div>
                        <div style="border-top:1px solid var(--border-color);padding-top:1rem;margin-top:1rem;">
                            <h4 style="margin:0 0 1rem;font-size:0.95rem;">Permisos de emisión en esta sede</h4>
                            <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
                                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" name="permite_boleta" ${existing?.permite_boleta !== false ? 'checked' : ''}><span>Boletas</span></label>
                                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" name="permite_factura" ${existing?.permite_factura !== false ? 'checked' : ''}><span>Facturas</span></label>
                                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" name="permite_nota_venta" ${existing?.permite_nota_venta !== false ? 'checked' : ''}><span>Nota Venta</span></label>
                                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" name="permite_nota_deuda" ${existing?.permite_nota_deuda !== false ? 'checked' : ''}><span>Nota Deuda</span></label>
                                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;"><input type="checkbox" name="activo" ${existing?.sede_ruc_activo !== false ? 'checked' : ''}><span>Activo para emitir</span></label>
                            </div>
                            <div class="config-form-group">
                                <label>Formato impresión comprobante</label>
                                <select class="config-form-input" name="formato_impresion">
                                    <option value="A4" ${existing?.formato_impresion === 'A4' ? 'selected' : ''}>A4</option>
                                    <option value="A5" ${existing?.formato_impresion === 'A5' ? 'selected' : ''}>A5</option>
                                    <option value="TICKET" ${existing?.formato_impresion === 'TICKET' ? 'selected' : ''}>Ticket</option>
                                </select>
                            </div>
                        </div>
                        <div style="text-align:right;margin-top:1.5rem;">
                            <button type="button" onclick="closeRucModal()" class="config-btn-secondary" title="Cancelar">${GLOBAL_ICONS.cancel()} Cancelar</button>
                            <button type="submit" class="config-btn-save" style="margin-left:0.5rem;" title="Guardar RUC">${GLOBAL_ICONS.save()} Guardar RUC</button>
                        </div>
                    </form>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const logoInput = document.getElementById('logoInput');
        const logoPreview = document.getElementById('logoPreview');
        logoInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !fileManager) return;
            try {
                const processed = await fileManager.processFile(file);
                logoPreview.innerHTML = `<img src="${processed.preview}" style="max-height:60px;border-radius:4px;margin-top:8px;">`;
                logoInput._compressed = processed.compressed;
                logoInput._compressedName = processed.name;
            } catch (err) { logoPreview.textContent = 'Error al procesar imagen'; }
        });

        const certificadoInput = document.getElementById('certificadoInput');
        const certificadoPreview = document.getElementById('certificadoPreview');
        certificadoInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                certificadoPreview.innerHTML = `
                    <div class="file-info" style="margin-top: 8px;">
                        <span class="file-info-name">${esc(file.name)}</span>
                        <span class="file-info-size">(${Math.round(file.size / 1024)} KB)</span>
                    </div>`;
            } else {
                certificadoPreview.innerHTML = '';
            }
        });

        document.getElementById('rucForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const fd = new FormData(form);
            // Use hidden field first (set at modal creation), then module, then global
            let sedeIdToUse = form.querySelector('[name="sede_id"]')?.value || currentSedeId || window.currentSedeId;
            console.log('sedeIdToUse:', sedeIdToUse, 'from hidden:', form.querySelector('[name="sede_id"]')?.value, 'module:', currentSedeId, 'global:', window.currentSedeId);
            if (!sedeIdToUse) {
                alert('Error: No se pudo identificar la sede. Por favor recargue la página.');
                return;
            }
            // Ensure sede_id is in FormData (override if already present)
            fd.set('sede_id', sedeIdToUse);
            appendCheckbox(fd, 'permite_boleta', form);
            appendCheckbox(fd, 'permite_factura', form);
            appendCheckbox(fd, 'permite_nota_venta', form);
            appendCheckbox(fd, 'permite_nota_deuda', form);
            appendCheckbox(fd, 'activo', form);
            if (logoInput?._compressed) {
                fd.set('logo', logoInput._compressed, logoInput._compressedName || 'logo.jpg');
            }
            const url = isEdit ? `/api/sede/rucs/${existing.id}/` : '/api/sede/rucs/';
            try {
                const resp = await fetch(url, { method: 'POST', body: fd, headers: { 'X-CSRFToken': window.getCookie('csrftoken') } });
                const res = await resp.json();
                console.log('Server response:', res);
                if (res.status === 'success') {
                    closeRucModal();
                    loadRucsData();
                    alert(isEdit ? 'RUC actualizado correctamente' : 'RUC guardado y vinculado');
                } else {
                    alert(`Error del servidor: ${res.message || 'Error desconocido'}`);
                    console.error('Error details:', res);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                alert('Error al guardar RUC. Verifique la consola para más detalles.');
            }
        });
    };

    window.closeRucModal = () => document.getElementById('rucModalOverlay')?.remove();
});

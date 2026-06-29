/**
 * cajas.js
 * Gestión de Cajas por sede, sus canales de recaudo y personal autorizado.
 */

document.addEventListener('DOMContentLoaded', () => {

    const UBICACION_LABELS = {
        oficina: '🏢 Oficina',
        campo: '🛜 Campo',
    };

    let editingCajaId = null;
    let linkingCajaId = null;

    window.initSedeCajasModule = () => renderCajasTab();

    const getCajas = () => window.currentSedeConfigData?.cajas || [];
    const getPersonal = () => window.currentSedeConfigData?.personal || [];

    const renderCajasTab = () => {
        const body = document.getElementById('sedeConfigBody');
        if (!body) return;

        const lista = getCajas();

        body.innerHTML = `
            <div class="config-card sede-tab-panel">
                <div class="config-card-title config-card-header">
                    <span>Cajas Autorizadas de la Sede</span>
                    <button type="button" class="config-btn-save" id="btnNuevaCaja" title="Nueva Caja">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        Nueva Caja
                    </button>
                </div>
                <p class="config-panel-desc">
                    Configure las cajas diarias de la sede (oficina o campo), sus canales de recaudo admitidos y el personal autorizado para realizar cobros en cada una.
                </p>
                <div class="config-table-wrap">
                    <table class="config-table">
                        <thead>
                            <tr>
                                <th>Nombre Caja</th>
                                <th>Ubicación</th>
                                <th>Recaudos Permitidos</th>
                                <th>Personal Autorizado</th>
                                <th style="text-align:right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderCajaRows(lista)}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('btnNuevaCaja')?.addEventListener('click', () => openCajaForm());
        
        body.querySelectorAll('[data-edit-caja]').forEach(btn => {
            btn.addEventListener('click', () => openCajaForm(parseInt(btn.dataset.editCaja, 10)));
        });
        
        body.querySelectorAll('[data-del-caja]').forEach(btn => {
            btn.addEventListener('click', () => eliminarCaja(parseInt(btn.dataset.delCaja, 10)));
        });

        body.querySelectorAll('[data-link-caja]').forEach(btn => {
            btn.addEventListener('click', () => openCajaPersonalForm(parseInt(btn.dataset.linkCaja, 10)));
        });
    };

    const renderCajaRows = (lista) => {
        if (!lista.length) {
            return `<tr class="config-empty-row"><td colspan="5">Sin cajas configuradas para esta sede.</td></tr>`;
        }
        
        const personalSede = getPersonal();

        return lista.map(c => {
            // Canales de recaudo
            const rec = c.recaudo || { efectivo: true, transferencia: true };
            const tags = [];
            if (rec.efectivo) tags.push('<span class="config-badge config-badge-success">💵 Efectivo</span>');
            if (rec.transferencia) tags.push('<span class="config-badge config-badge-info">🏦 Bancos/Virtual</span>');
            if (tags.length === 0) tags.push('<span class="config-badge config-badge-danger">Ninguno</span>');

            // Filtrar personal que tiene esta caja autorizada
            const autorizados = personalSede.filter(p => p.cajas_permitidas && p.cajas_permitidas.includes(c.id));
            const usernames = autorizados.map(p => `<strong>${p.username}</strong>`).join(', ') || '<span style="color:var(--text-muted); font-style:italic;">Nadie</span>';

            return `
                <tr>
                    <td><strong>${c.nombre}</strong></td>
                    <td><span class="config-badge">${UBICACION_LABELS[c.tipo_ubicacion] || c.tipo_ubicacion}</span></td>
                    <td><div style="display:flex; gap:0.25rem; flex-wrap:wrap;">${tags.join('')}</div></td>
                    <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${autorizados.map(p => p.nombre_apellidos).join(', ')}">
                        ${usernames}
                    </td>
                    <td class="config-cell-actions" style="text-align:right;">
                        <button type="button" class="config-btn-secondary" data-link-caja="${c.id}" style="padding:0.3rem 0.6rem; font-size:0.75rem; margin-right:4px;" title="Personal Autorizado">🔑 Permisos</button>
                        <button type="button" class="config-btn-icon" data-edit-caja="${c.id}" title="Editar">${GLOBAL_ICONS.edit()}</button>
                        <button type="button" class="config-btn-icon config-btn-icon-danger" data-del-caja="${c.id}" title="Eliminar">${GLOBAL_ICONS.delete()}</button>
                    </td>
                </tr>`;
        }).join('');
    };

    const openCajaForm = (cajaId = null) => {
        document.getElementById('cajaFormModalOverlay')?.remove();
        document.getElementById('cajaPersonalModalOverlay')?.remove();

        editingCajaId = cajaId;
        let c = { nombre: '', tipo_ubicacion: 'oficina', recaudo: { efectivo: true, transferencia: true } };
        
        if (cajaId) {
            const found = getCajas().find(x => x.id === cajaId);
            if (found) c = found;
        }

        const overlay = document.createElement('div');
        overlay.id = 'cajaFormModalOverlay';
        overlay.className = 'org-modal-overlay open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = `
            <div class="org-modal" style="max-width: 480px;">
                <div class="org-modal-header">
                    <div class="org-modal-title">
                        <span class="org-modal-title-dot" style="background:var(--primary);"></span>
                        <span>${cajaId ? 'Editar Caja' : 'Nueva Caja Diaria'}</span>
                    </div>
                    <button class="org-modal-close" id="btnCancelCajaFormClose" aria-label="Cerrar" title="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="cajaSaveForm">
                    <div class="org-modal-body" style="padding: 1.25rem 1.5rem;">
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Nombre de Caja *</label>
                            <input type="text" class="config-form-input" name="nombre" value="${c.nombre}" required placeholder="Ej. Caja Chica Principal">
                        </div>
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Ubicación *</label>
                            <select class="config-form-input" name="tipo_ubicacion" required>
                                <option value="oficina" ${c.tipo_ubicacion === 'oficina' ? 'selected' : ''}>🏢 Oficina / Sede</option>
                                <option value="campo" ${c.tipo_ubicacion === 'campo' ? 'selected' : ''}>🛜 Campo / Cobro Externo</option>
                            </select>
                        </div>
                        <div class="config-form-group" style="margin-bottom:0.5rem;">
                            <label style="margin-bottom:0.5rem; display:block;">Canales de Recaudo Autorizados *</label>
                            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; cursor:pointer;">
                                    <input type="checkbox" name="recaudo_efectivo" ${c.recaudo?.efectivo ? 'checked' : ''}>
                                    <span>Efectivo (Cash)</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; cursor:pointer;">
                                    <input type="checkbox" name="recaudo_transferencia" ${c.recaudo?.transferencia ? 'checked' : ''}>
                                    <span>Transferencia / Virtual / Cheque</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="org-modal-footer" style="padding: 1rem 1.5rem; border-top: var(--border-thin) solid var(--border-color); display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button type="button" class="btn-cancel" id="btnCancelCajaForm" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancelar</button>
                        <button type="submit" class="btn-save" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Guardar Caja</button>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(overlay);

        const closeForm = () => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 200);
            editingCajaId = null;
        };

        document.getElementById('btnCancelCajaForm')?.addEventListener('click', closeForm);
        document.getElementById('btnCancelCajaFormClose')?.addEventListener('click', closeForm);
        document.getElementById('cajaSaveForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('[type="submit"]');
            btn.disabled = true;
            
            const fd = new FormData(e.target);
            const data = {
                sede_id: window.currentSedeId,
                caja_id: editingCajaId,
                nombre: fd.get('nombre').trim(),
                tipo_ubicacion: fd.get('tipo_ubicacion'),
                recaudo: {
                    efectivo: fd.get('recaudo_efectivo') === 'on',
                    transferencia: fd.get('recaudo_transferencia') === 'on'
                }
            };

            try {
                const resp = await fetch('/api/sede/config/caja/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                    body: JSON.stringify(data),
                });
                const res = await resp.json();
                if (res.status === 'success') {
                    await window.openSedeConfig(window.currentSedeId, 'cajas');
                    SITAlert.show('Caja guardada correctamente.', 'success');
                    closeForm();
                } else {
                    SITAlert.show(`Error: ${res.message}`, 'error');
                    btn.disabled = false;
                }
            } catch (err) {
                SITAlert.show('Error al guardar la caja.', 'error');
                btn.disabled = false;
            }
        });
    };

    const eliminarCaja = async (cajaId) => {
        if (!confirm('¿Está seguro de que desea desactivar esta caja? Ya no se podrá operar con ella.')) return;

        try {
            const resp = await fetch('/api/sede/config/caja/eliminar/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify({ caja_id: cajaId })
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await window.openSedeConfig(window.currentSedeId, 'cajas');
                SITAlert.show('Caja desactivada correctamente.', 'success');
            } else {
                SITAlert.show(`Error: ${res.message}`, 'error');
            }
        } catch (err) {
            SITAlert.show('Error al eliminar la caja.', 'error');
        }
    };

    const openCajaPersonalForm = (cajaId) => {
        document.getElementById('cajaFormModalOverlay')?.remove();
        document.getElementById('cajaPersonalModalOverlay')?.remove();

        linkingCajaId = cajaId;
        const caja = getCajas().find(x => x.id === cajaId);
        if (!caja) return;

        const personalSede = getPersonal();

        const checkboxes = personalSede.map(p => {
            const hasAccess = p.cajas_permitidas && p.cajas_permitidas.includes(cajaId);
            return `
                <label style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; cursor:pointer; font-size:0.85rem; background: var(--bg-surface-active); margin-bottom: 0.4rem;">
                    <span><strong>${p.username}</strong> — ${p.nombre_apellidos} (${p.cargo})</span>
                    <input type="checkbox" class="personal-access-check" data-user-id="${p.id}" ${hasAccess ? 'checked' : ''}>
                </label>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.id = 'cajaPersonalModalOverlay';
        overlay.className = 'org-modal-overlay open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = `
            <div class="org-modal" style="max-width: 500px;">
                <div class="org-modal-header">
                    <div class="org-modal-title">
                        <span class="org-modal-title-dot" style="background:var(--primary);"></span>
                        <span>Permisos de Personal: ${caja.nombre}</span>
                    </div>
                    <button class="org-modal-close" id="btnCancelCajaPersonalClose" aria-label="Cerrar" title="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="cajaPersonalForm">
                    <div class="org-modal-body" style="padding: 1.25rem 1.5rem; max-height: 380px; overflow-y: auto;">
                        <p class="config-panel-desc" style="margin-bottom:1rem;">Marque los empleados que tendrán acceso para operar y abonar en esta caja diaria.</p>
                        <div style="display:flex; flex-direction:column; gap:0.2rem;">
                            ${checkboxes || '<span style="color:var(--text-muted);">Sin personal registrado en esta sede.</span>'}
                        </div>
                    </div>
                    <div class="org-modal-footer" style="padding: 1rem 1.5rem; border-top: var(--border-thin) solid var(--border-color); display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button type="button" class="btn-cancel" id="btnCancelCajaPersonal" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancelar</button>
                        <button type="submit" class="btn-save" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Guardar Permisos</button>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(overlay);

        const closeForm = () => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 200);
            linkingCajaId = null;
        };

        document.getElementById('btnCancelCajaPersonal')?.addEventListener('click', closeForm);
        document.getElementById('btnCancelCajaPersonalClose')?.addEventListener('click', closeForm);
        document.getElementById('cajaPersonalForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('[type="submit"]');
            btn.disabled = true;

            const checks = e.target.querySelectorAll('.personal-access-check');
            const personalIds = [];
            checks.forEach(chk => {
                if (chk.checked) {
                    personalIds.push(parseInt(chk.dataset.userId, 10));
                }
            });

            const data = {
                caja_id: linkingCajaId,
                personal_ids: personalIds
            };

            try {
                const resp = await fetch('/api/sede/config/caja/personal/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                    body: JSON.stringify(data)
                });
                const res = await resp.json();
                if (res.status === 'success') {
                    await window.openSedeConfig(window.currentSedeId, 'cajas');
                    SITAlert.show('Permisos de caja actualizados.', 'success');
                    closeForm();
                } else {
                    SITAlert.show(`Error: ${res.message}`, 'error');
                    btn.disabled = false;
                }
            } catch (err) {
                SITAlert.show('Error al guardar permisos de caja.', 'error');
                btn.disabled = false;
            }
        });
    };

});

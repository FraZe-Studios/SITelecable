/**
 * Gestión de Personal por sede — permisos, usuario y caja autorizada
 */

document.addEventListener('DOMContentLoaded', () => {

    const CARGOS = {
        admin: 'Admin',
        jefe_noc: 'Jefe NOC',
        jefe_tac: 'Jefe TAC',
        jefe_tec: 'Jefe TEC',
        supervisor_atc: 'Supervisor ATC',
        noc: 'NOC',
        tac: 'TAC',
        atc: 'ATC',
        tec: 'Técnico',
        ventas: 'Vendedor',
    };

    const TIPO_CAJA = {
        SOLO_EFECTIVO: 'Solo efectivo',
        SOLO_TRANSFERENCIA: 'Solo transferencia',
        AMBOS: 'Ambos',
    };

    let editingPersonalId = null;

    window.initSedePersonalModule = () => renderPersonalTab();

    const getPersonal = () => window.currentSedeConfigData?.personal || [];

    const renderPersonalTab = () => {
        const body = document.getElementById('sedeConfigBody');
        if (!body) return;

        const lista = getPersonal();

        body.innerHTML = `
            <div class="config-card sede-tab-panel">
                <div class="config-card-title config-card-header">
                    <span>Personal de la Sede</span>
                    <div style="display:flex; gap:0.5rem;">
                        <button type="button" class="config-btn-secondary" id="btnVincularPersonal" style="padding:0.35rem 0.75rem;font-size:0.8rem;" title="Vincular Personal">Vincular Existente</button>
                        <button type="button" class="config-btn-save" id="btnNuevoPersonal" title="Agregar Personal">${GLOBAL_ICONS.add(16)} Nuevo Empleado</button>
                    </div>
                </div>
                <p class="config-panel-desc">
                    Configure empleados, credenciales de acceso y cajas autorizadas para cobros.
                </p>
                <div id="vincularPersonalContainer" style="display:none;"></div>
                <div id="personalFormContainer" style="display:none;"></div>
                <div class="config-table-wrap">
                    <table class="config-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Cargo</th>
                                <th>Correo / Celular</th>
                                <th>Supervisor</th>
                                <th>Usuario</th>
                                <th>Caja</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderPersonalRows(lista)}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('btnNuevoPersonal')?.addEventListener('click', () => openPersonalForm());
        document.getElementById('btnVincularPersonal')?.addEventListener('click', () => openVincularForm());
        body.querySelectorAll('[data-edit-personal]').forEach(btn => {
            btn.addEventListener('click', () => openPersonalForm(parseInt(btn.dataset.editPersonal, 10)));
        });
        body.querySelectorAll('[data-del-personal]').forEach(btn => {
            btn.addEventListener('click', () => eliminarPersonal(parseInt(btn.dataset.delPersonal, 10)));
        });
    };

    const renderPersonalRows = (lista) => {
        if (!lista.length) {
            return `<tr class="config-empty-row"><td colspan="7">Sin personal registrado.</td></tr>`;
        }
        return lista.map(p => `
            <tr>
                <td><strong>${p.nombre_apellidos}</strong></td>
                <td><span class="config-badge">${CARGOS[p.cargo] || p.cargo}</span></td>
                <td>
                    <div>${p.correo}</div>
                    <small style="color:var(--text-muted);">${p.celular || '—'}</small>
                </td>
                <td>${p.supervisor_nombre || '—'}</td>
                <td>
                    ${p.tiene_usuario
                        ? `<span class="config-badge ${p.is_active ? 'config-badge-success' : 'config-badge-danger'}">${p.username}</span>`
                        : '<span style="color:var(--text-muted);">Sin usuario</span>'}
                </td>
                <td>
                    ${p.cajas_permitidas && p.cajas_permitidas.length > 0
                        ? p.cajas_permitidas.length + ' caja(s)'
                        : '<span style="color:var(--text-muted);">Sin cajas</span>'}
                </td>
                <td class="config-cell-actions">
                    ${p.username === 'admin'
                        ? `<span style="color:var(--text-muted); font-size:0.75rem; font-weight:bold; padding-right:8px;">Root Admin</span>`
                        : `
                            <button type="button" class="config-btn-icon" data-edit-personal="${p.id}" title="Editar">${GLOBAL_ICONS.edit()}</button>
                            <button type="button" class="config-btn-icon config-btn-icon-danger" data-del-personal="${p.id}" title="Desvincular">${GLOBAL_ICONS.delete()}</button>
                        `
                    }
                </td>
            </tr>`).join('');
    };

    let closeFormGlobal = null;
    let closeVincularFormGlobal = null;

    const openVincularForm = () => {
        document.getElementById('personalFormModalOverlay')?.remove();
        document.getElementById('vincularPersonalModalOverlay')?.remove();

        const disponibles = window.currentSedeConfigData?.personal_disponible || [];
        
        const overlay = document.createElement('div');
        overlay.id = 'vincularPersonalModalOverlay';
        overlay.className = 'org-modal-overlay open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        if (!disponibles.length) {
            overlay.innerHTML = `
                <div class="org-modal" style="max-width: 440px;">
                    <div class="org-modal-header">
                        <div class="org-modal-title">
                            <span class="org-modal-title-dot" style="background:var(--primary);"></span>
                            <span>Vincular Empleado Existente</span>
                        </div>
                        <button class="org-modal-close" id="btnCancelVincularClose" aria-label="Cerrar" title="Cerrar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div class="org-modal-body" style="padding: 1.25rem 1.5rem;">
                        <p style="color:var(--text-muted); font-size:0.85rem; margin:0;">No hay más personal disponible para vincular en el sistema.</p>
                    </div>
                    <div class="org-modal-footer" style="padding: 1rem 1.5rem; border-top: var(--border-thin) solid var(--border-color); display:flex; justify-content:flex-end;">
                        <button type="button" class="btn-cancel" id="btnCancelVincular" style="padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;">Cerrar</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            
            const closeVincular = () => {
                overlay.classList.remove('open');
                setTimeout(() => overlay.remove(), 200);
            };
            document.getElementById('btnCancelVincular')?.addEventListener('click', closeVincular);
            document.getElementById('btnCancelVincularClose')?.addEventListener('click', closeVincular);
            return;
        }

        const options = disponibles.map(p => 
            `<option value="${p.id}">${p.nombre_apellidos} (${CARGOS[p.cargo] || p.cargo})</option>`
        ).join('');

        overlay.innerHTML = `
            <div class="org-modal" style="max-width: 460px;">
                <div class="org-modal-header">
                    <div class="org-modal-title">
                        <span class="org-modal-title-dot" style="background:var(--primary);"></span>
                        <span>Vincular Empleado Existente</span>
                    </div>
                    <button class="org-modal-close" id="btnCancelVincularClose" aria-label="Cerrar" title="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="vincularPersonalForm">
                    <div class="org-modal-body" style="padding: 1.25rem 1.5rem;">
                        <p class="config-panel-desc" style="margin-bottom:1rem;">Asocie un empleado ya registrado en el sistema que no se encuentre asignado a otra sede.</p>
                        <div class="config-form-group">
                            <label>Seleccione empleado *</label>
                            <select class="config-form-input" name="personal_id" required>
                                <option value="">— Seleccione —</option>
                                ${options}
                            </select>
                        </div>
                    </div>
                    <div class="org-modal-footer" style="padding: 1rem 1.5rem; border-top: var(--border-thin) solid var(--border-color); display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button type="button" class="btn-cancel" id="btnCancelVincular" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancelar</button>
                        <button type="submit" class="btn-save" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Vincular</button>
                    </div>
                </form>
            </div>`;
        document.body.appendChild(overlay);

        const closeVincular = () => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 200);
        };
        closeVincularFormGlobal = closeVincular;

        document.getElementById('btnCancelVincular')?.addEventListener('click', closeVincular);
        document.getElementById('btnCancelVincularClose')?.addEventListener('click', closeVincular);
        document.getElementById('vincularPersonalForm')?.addEventListener('submit', guardarVinculacionPersonal);
    };

    const guardarVinculacionPersonal = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            sede_id: window.currentSedeId,
            personal_id: parseInt(fd.get('personal_id'), 10),
        };

        const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true;

        try {
            const resp = await fetch('/api/sede/config/personal/vincular/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify(data),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await window.openSedeConfig(window.currentSedeId, 'personal');
                SITAlert.show('Personal vinculado correctamente.', 'success');
                if (typeof closeVincularFormGlobal === 'function') closeVincularFormGlobal();
            } else {
                SITAlert.show(`Error: ${res.message}`, 'error');
                btn.disabled = false;
            }
        } catch (err) {
            SITAlert.show('Error al vincular personal.', 'error');
            btn.disabled = false;
        }
    };

    const openPersonalForm = (personalId = null) => {
        editingPersonalId = personalId;
        document.getElementById('personalFormModalOverlay')?.remove();
        document.getElementById('vincularPersonalModalOverlay')?.remove();

        const p = personalId ? getPersonal().find(x => x.id === personalId) : null;
        const supervisores = getPersonal().filter(x => x.id !== personalId);
        const supOptions = '<option value="">— Sin supervisor —</option>' + supervisores.map(s =>
            `<option value="${s.id}" ${p?.supervisor_id == s.id ? 'selected' : ''}>${s.nombre_apellidos} (${CARGOS[s.cargo] || s.cargo})</option>`
        ).join('');

        const cargoOptions = Object.entries(CARGOS).map(([k, v]) =>
            `<option value="${k}" ${p?.cargo === k ? 'selected' : ''}>${v}</option>`
        ).join('');

        // Obtener cajas disponibles de la sede
        const cajasDisponibles = window.currentSedeConfigData?.cajas || [];
        const cajasPermitidas = p?.cajas_permitidas || [];
        const cajasCheckboxes = cajasDisponibles.map(caja => `
            <label class="config-check-inline" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; cursor:pointer; margin-bottom:0.25rem;">
                <input type="checkbox" name="cajas_permitidas" value="${caja.id}" ${cajasPermitidas.includes(caja.id) ? 'checked' : ''}>
                <span>${caja.nombre} (${caja.tipo_ubicacion})</span>
            </label>
        `).join('');

        const overlay = document.createElement('div');
        overlay.id = 'personalFormModalOverlay';
        overlay.className = 'org-modal-overlay open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = `
            <div class="org-modal" style="max-width: 540px;">
                <div class="org-modal-header">
                    <div class="org-modal-title">
                        <span class="org-modal-title-dot" style="background:var(--primary);"></span>
                        <span>${p ? 'Editar Empleado' : 'Nuevo Empleado'}</span>
                    </div>
                    <button class="org-modal-close" id="btnCancelPersonalClose" aria-label="Cerrar" title="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="personalForm">
                    <div class="org-modal-body" style="padding: 1.25rem 1.5rem; max-height: 440px; overflow-y: auto;">
                        <div class="config-form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                            <div class="config-form-group">
                                <label>Nombre y apellidos *</label>
                                <input type="text" class="config-form-input" name="nombre_apellidos" value="${p?.nombre_apellidos || ''}" required>
                            </div>
                            <div class="config-form-group">
                                <label>Cargo *</label>
                                <select class="config-form-input" name="cargo" required>${cargoOptions}</select>
                            </div>
                            <div class="config-form-group">
                                <label>Correo *</label>
                                <input type="email" class="config-form-input" name="correo" value="${p?.correo || ''}" required>
                            </div>
                            <div class="config-form-group">
                                <label>Celular</label>
                                <input type="text" class="config-form-input" name="celular" value="${p?.celular || ''}">
                            </div>
                            <div class="config-form-group">
                                <label>Supervisor</label>
                                <select class="config-form-input" name="supervisor_id">${supOptions}</select>
                            </div>
                            <div class="config-form-group" id="cajasPermitidasGroup" style="grid-column: span 2;">
                                <label>Cajas autorizadas</label>
                                <div style="max-height: 120px; overflow-y: auto; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary);">
                                    ${cajasCheckboxes || '<span style="color:var(--text-muted); font-size:0.85rem;">No hay cajas disponibles en esta sede</span>'}
                                </div>
                            </div>
                        </div>
                        <hr class="config-form-divider" style="margin: 1.25rem 0; border:0; border-top: var(--border-thin) solid var(--border-color);">
                        <div class="config-form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div class="config-form-group">
                                <label>Usuario de acceso</label>
                                <input type="text" class="config-form-input" name="username" value="${p?.username || ''}" autocomplete="off">
                            </div>
                            <div class="config-form-group">
                                <label>${p ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label>
                                <input type="password" class="config-form-input" name="password" autocomplete="new-password" ${p ? '' : 'required'}>
                            </div>
                            <div class="config-form-group" style="grid-column: span 2; margin-top: 0.25rem;">
                                <label class="config-check-inline" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; cursor:pointer;">
                                    <input type="checkbox" name="is_active" ${p?.is_active !== false ? 'checked' : ''}>
                                    <span>Usuario activo</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="org-modal-footer" style="padding: 1rem 1.5rem; border-top: var(--border-thin) solid var(--border-color); display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button type="button" class="btn-cancel" id="btnCancelPersonal" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancelar</button>
                        <button type="submit" class="btn-save" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Guardar</button>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(overlay);

        const closeForm = () => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 200);
            editingPersonalId = null;
        };
        closeFormGlobal = closeForm;

        document.getElementById('btnCancelPersonal')?.addEventListener('click', closeForm);
        document.getElementById('btnCancelPersonalClose')?.addEventListener('click', closeForm);
        document.getElementById('personalForm')?.addEventListener('submit', guardarPersonal);

        // Mostrar/ocultar cajas autorizadas según cargo (solo ATC y vendedores)
        const cargoSelect = document.querySelector('select[name="cargo"]');
        const cajasPermitidasGroup = document.getElementById('cajasPermitidasGroup');
        const updateCajasVisibility = () => {
            const cargo = cargoSelect.value;
            if (cargo === 'atc' || cargo === 'ventas') {
                cajasPermitidasGroup.style.display = 'block';
            } else {
                cajasPermitidasGroup.style.display = 'none';
            }
        };
        cargoSelect.addEventListener('change', updateCajasVisibility);
        updateCajasVisibility();
    };

    const guardarPersonal = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const cargo = fd.get('cargo');

        // Obtener cajas seleccionadas
        const cajasPermitidas = [];
        document.querySelectorAll('input[name="cajas_permitidas"]:checked').forEach(cb => {
            cajasPermitidas.push(parseInt(cb.value, 10));
        });

        const data = {
            sede_id: window.currentSedeId,
            personal_id: editingPersonalId,
            nombre_apellidos: fd.get('nombre_apellidos'),
            correo: fd.get('correo'),
            celular: fd.get('celular'),
            cargo: cargo,
            supervisor_id: fd.get('supervisor_id') || null,
            cajas_permitidas: (cargo === 'atc' || cargo === 'ventas') ? cajasPermitidas : [],
            username: fd.get('username'),
            password: fd.get('password'),
            is_active: fd.get('is_active') === 'on',
        };

        const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true;

        try {
            const resp = await fetch('/api/sede/config/personal/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify(data),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await window.openSedeConfig(window.currentSedeId, 'personal');
                SITAlert.show('Personal guardado correctamente.', 'success');
                if (typeof closeFormGlobal === 'function') closeFormGlobal();
            } else {
                SITAlert.show(`Error: ${res.message}`, 'error');
                btn.disabled = false;
            }
        } catch (err) {
            SITAlert.show('Error al guardar personal.', 'error');
            btn.disabled = false;
        }
    };

    const eliminarPersonal = async (personalId) => {
        if (!confirm('¿Desvincular este empleado de esta sede?')) return;
        try {
            const resp = await fetch('/api/sede/config/personal/eliminar/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify({ sede_id: window.currentSedeId, personal_id: personalId }),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await window.openSedeConfig(window.currentSedeId, 'personal');
                SITAlert.show('Personal desvinculado correctamente.', 'success');
            } else {
                SITAlert.show(`Error: ${res.message}`, 'error');
            }
        } catch (e) {
            SITAlert.show('Error al desvincular.', 'error');
        }
    };
});

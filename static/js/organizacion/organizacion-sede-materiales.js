/**
 * Materiales y precios de equipos (catálogo global)
 * Tipos: equipo, material
 */

document.addEventListener('DOMContentLoaded', () => {

    const TIPO_MATERIAL_LABELS = {
        equipo: 'Equipo',
        materiales: 'Materiales'
    };

    let editingMaterialId = null;
    let materialesCache = [];
    let closeFormGlobal = null;

    const fmtMoney = n => `S/ ${parseFloat(n || 0).toFixed(2)}`;

    window.initSedeMaterialesModule = () => {
        cargarMateriales();
    };

    const cargarMateriales = async () => {
        try {
            const resp = await fetch('/api/materiales/listar/');
            const res = await resp.json();
            if (res.status === 'success') {
                materialesCache = res.data;
                renderMaterialesTab();
            }
        } catch (err) {
            console.error('Error al cargar materiales:', err);
        }
    };
    const renderMaterialesTab = () => {
        const body = document.getElementById('sedeConfigBody');
        if (!body) return;

        body.innerHTML = `
            <div class="config-card sede-tab-panel">
                <div class="config-card-title config-card-header">
                    <span>Materiales y Equipos</span>
                    <button type="button" class="config-btn-add" id="btnNuevoMaterial" title="Agregar Material">${GLOBAL_ICONS.add(16)} Agregar Material</button>
                </div>
                <p class="config-panel-desc">
                    Catálogo general de materiales y equipos para la planta de red.
                </p>
                <div class="config-table-wrap">
                    <table class="config-table">
                        <thead>
                            <tr>
                                <th>Material / Equipo</th>
                                <th>Tipo</th>
                                <th>Requiere MAC</th>
                                <th>Requiere Serie</th>
                                <th>Descripción</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderMaterialRows(materialesCache)}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('btnNuevoMaterial')?.addEventListener('click', () => openMaterialForm());
        bindMaterialRowActions();
    };

    const renderMaterialRows = (lista) => {
        if (!lista.length) {
            return `<tr class="config-empty-row"><td colspan="5">Sin materiales configurados.</td></tr>`;
        }
        return lista.map(m => `
            <tr data-material-id="${m.id}">
                <td><strong>${m.nombre}</strong></td>
                <td><span class="config-badge material-badge-${m.tipo_material}">${TIPO_MATERIAL_LABELS[m.tipo_material] || m.tipo_material}</span></td>
                <td>${m.requiere_mac ? 'Sí' : 'No'}</td>
                <td>${m.requiere_serie ? 'Sí' : 'No'}</td>
                <td>${m.descripcion || ''}</td>
                <td class="config-cell-actions">
                    <button type="button" class="config-btn-icon" data-action="edit" data-id="${m.id}" title="Editar">${GLOBAL_ICONS.edit()}</button>
                    <button type="button" class="config-btn-icon config-btn-icon-danger" data-action="delete" data-id="${m.id}" title="Eliminar">${GLOBAL_ICONS.delete()}</button>
                </td>
            </tr>`).join('');
    };

    const bindMaterialRowActions = () => {
        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const material = materialesCache.find(m => m.id === parseInt(btn.dataset.id, 10));
                if (material) openMaterialForm(material);
            });
        });
        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => eliminarMaterial(parseInt(btn.dataset.id, 10)));
        });
    };

    const openMaterialForm = (material = null) => {
        editingMaterialId = material?.id || null;
        document.getElementById('materialFormModalOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'materialFormModalOverlay';
        overlay.className = 'org-modal-overlay open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = `
            <div class="org-modal" style="max-width: 500px;">
                <div class="org-modal-header">
                    <div class="org-modal-title">
                        <span class="org-modal-title-dot" style="background:var(--primary-color);"></span>
                        <span>${material ? 'Editar' : 'Nuevo'} material</span>
                    </div>
                    <button class="org-modal-close" id="btnCancelMaterialClose" aria-label="Cerrar" title="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="materialForm">
                    <div class="org-modal-body" style="padding: 1.25rem 1.5rem; max-height: 450px; overflow-y: auto;">
                        <div class="config-form-grid config-form-grid-2">
                            <div class="config-form-group" style="grid-column:1/-1;">
                                <label>Nombre del material o equipo *</label>
                                <input type="text" class="config-form-input" name="nombre" value="${material?.nombre || ''}" required placeholder="Ej: Cable drop, ONT, Repetidor WiFi">
                            </div>
                            <div class="config-form-group" style="grid-column:1/-1;">
                                <label>Tipo de material *</label>
                                <select class="config-form-input" name="tipo_material" id="tipoMaterial" required>
                                    <option value="">Seleccionar...</option>
                                    <option value="equipo" ${material?.tipo_material === 'equipo' ? 'selected' : ''}>Equipo</option>
                                    <option value="materiales" ${material?.tipo_material === 'materiales' ? 'selected' : ''}>Materiales</option>
                                </select>
                            </div>
                            <div class="config-form-group">
                                <label class="config-check-inline">
                                    <input type="checkbox" name="requiere_mac" ${material?.requiere_mac ? 'checked' : ''}>
                                    <span>Requiere MAC</span>
                                </label>
                            </div>
                            <div class="config-form-group">
                                <label class="config-check-inline">
                                    <input type="checkbox" name="requiere_serie" ${material?.requiere_serie ? 'checked' : ''}>
                                    <span>Requiere Número de Serie</span>
                                </label>
                            </div>
                            <div class="config-form-group" style="grid-column:1/-1;">
                                <label>Descripción</label>
                                <textarea class="config-form-input" name="descripcion" rows="2" placeholder="Opcional...">${material?.descripcion || ''}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="org-modal-footer" style="padding: 1rem 1.5rem; border-top: var(--border-thin) solid var(--border-color); display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button type="button" class="btn-cancel" id="btnCancelMaterial" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancelar</button>
                        <button type="submit" class="btn-save" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Guardar</button>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(overlay);

        const closeForm = () => {
            overlay.classList.remove('open');
            setTimeout(() => {
                overlay.remove();
            }, 200);
            editingMaterialId = null;
        };
        closeFormGlobal = closeForm;

        document.getElementById('btnCancelMaterial')?.addEventListener('click', closeForm);
        document.getElementById('btnCancelMaterialClose')?.addEventListener('click', closeForm);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeForm();
        });

        document.getElementById('materialForm')?.addEventListener('submit', guardarMaterial);
    };

    const guardarMaterial = async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            nombre: form.nombre.value.trim(),
            tipo_material: form.tipo_material.value || 'materiales',
            requiere_mac: form.requiere_mac.checked,
            requiere_serie: form.requiere_serie.checked,
            descripcion: form.descripcion.value.trim(),
            activo: true
        };
        
        if (!data.tipo_material) {
            alert('Por favor seleccione un tipo de material');
            return;
        }

        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = 'Guardando...';

        try {
            const url = editingMaterialId ? '/api/materiales/actualizar/' : '/api/materiales/crear/';
            if (editingMaterialId) {
                data.id = editingMaterialId;
            }

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify(data),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await cargarMateriales();
                if (typeof closeFormGlobal === 'function') closeFormGlobal();
                alert('Material guardado correctamente.');
            } else {
                alert(`Error: ${res.message}`);
                if (res.errors) {
                    console.error('Errores de validación:', res.errors);
                }
                btn.disabled = false;
                btn.innerHTML = `${GLOBAL_ICONS.save()} Guardar`;
            }
        } catch (err) {
            console.error('Error al guardar material:', err);
            alert('Error al guardar material.');
            btn.disabled = false;
            btn.innerHTML = `${GLOBAL_ICONS.save()} Guardar`;
        }
    };

    const eliminarMaterial = async (materialId) => {
        if (!confirm('¿Eliminar este material del catálogo?')) return;
        try {
            const resp = await fetch('/api/materiales/eliminar/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify({ id: materialId }),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await cargarMateriales();
            } else {
                alert(`Error: ${res.message}`);
            }
        } catch (e) {
            console.error('Error al eliminar:', e);
            alert('Error al eliminar.');
        }
    };
});

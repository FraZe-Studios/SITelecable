/**
 * edicion.js - Edición Inline de Datos de Cliente y Servicio en la Ficha
 * Cubre: btn-editar-cliente, btn-editar-servicio, btn-cobrar-servicio.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('fichaApp');
        if (!app) return;

        // ── Editar datos del Cliente ───────────────────────────────────────────
        document.querySelectorAll('.btn-editar-cliente').forEach(btn => {
            btn.addEventListener('click', async () => {
                const isEditing = btn.dataset.editing === 'true';

                if (isEditing) {
                    const nombresApellidos = document.getElementById('field-nombres-apellidos')?.querySelector('input')?.value;
                    const dni = document.getElementById('field-dni')?.querySelector('input')?.value;
                    const ruc = document.getElementById('field-ruc')?.querySelector('input')?.value;
                    const razonSocial = document.getElementById('field-razon-social')?.querySelector('input')?.value;
                    const fechaNacimiento = document.getElementById('field-fecha-nacimiento')?.querySelector('input')?.value;
                    const estadoCivil = document.getElementById('field-estado-civil')?.querySelector('input')?.value;
                    const celular1 = document.getElementById('field-celular1')?.querySelector('input')?.value;
                    const celular2 = document.getElementById('field-celular2')?.querySelector('input')?.value;
                    const correo = document.getElementById('field-correo')?.querySelector('input')?.value;
                    const direccionFiscal = document.getElementById('field-direccion-fiscal')?.querySelector('input')?.value;

                    try {
                        const res = await fetch('/api/abonados/actualizar-cliente/', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                cliente_id: btn.dataset.cliente,
                                nombres_apellidos: nombresApellidos,
                                dni, ruc,
                                razon_social: razonSocial,
                                fecha_nacimiento: fechaNacimiento,
                                estado_civil: estadoCivil,
                                celular_1: celular1,
                                celular_2: celular2,
                                correo,
                                direccion_fiscal: direccionFiscal,
                            }),
                        });
                        const json = await res.json();
                        if (json.status !== 'success') {
                            window.SITAlert.show(json.message, 'danger');
                            return;
                        }
                        window.location.reload();
                    } catch (err) {
                        window.SITAlert.show('Error al guardar los datos del cliente.', 'danger');
                    }
                } else {
                    // Activar modo edición
                    btn.dataset.editing = 'true';
                    btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';

                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'abonados-btn abonados-btn-ghost';
                    cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar';
                    cancelBtn.addEventListener('click', () => window.location.reload());
                    btn.parentElement.appendChild(cancelBtn);

                    const fields = [
                        { id: 'field-dni', type: 'text' },
                        { id: 'field-ruc', type: 'text', withSearch: true },
                        { id: 'field-nombres-apellidos', type: 'text' },
                        { id: 'field-razon-social', type: 'text' },
                        { id: 'field-fecha-nacimiento', type: 'date' },
                        { id: 'field-estado-civil', type: 'text' },
                        { id: 'field-celular1', type: 'text' },
                        { id: 'field-celular2', type: 'text' },
                        { id: 'field-correo', type: 'text' },
                        { id: 'field-direccion-fiscal', type: 'text' }
                    ];

                    fields.forEach(field => {
                        const el = document.getElementById(field.id);
                        if (!el) return;
                        let currentValue = el.textContent;
                        if (currentValue === '—') currentValue = '';

                        if (field.withSearch) {
                            el.innerHTML = `
                                <div style="display: flex; gap: 0.25rem; width: 100%;">
                                    <input type="${field.type}" value="${currentValue}" style="flex: 1; padding: 0.2rem; font-size: 0.6rem; border: 1px solid var(--border-color); border-radius: 4px;">
                                    <button type="button" class="btn-buscar-ruc abonados-btn abonados-btn-ghost" style="padding: 0.2rem 0.4rem; font-size: 0.6rem;">
                                        <i class="fa-solid fa-search"></i>
                                    </button>
                                </div>`;
                        } else {
                            el.innerHTML = `<input type="${field.type}" value="${currentValue}" style="width: 100%; padding: 0.2rem; font-size: 0.6rem; border: 1px solid var(--border-color); border-radius: 4px;">`;
                        }
                    });

                    // Búsqueda de RUC
                    document.querySelectorAll('.btn-buscar-ruc').forEach(searchBtn => {
                        searchBtn.addEventListener('click', async () => {
                            const rucInput = searchBtn.parentElement?.querySelector('input');
                            const ruc = rucInput?.value?.trim();
                            if (!ruc || ruc.length !== 11) {
                                window.SITAlert.show('Ingrese un RUC válido (11 dígitos)', 'warning');
                                return;
                            }
                            try {
                                const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(ruc)}`);
                                const json = await res.json();
                                if (json.status === 'success' && json.data) {
                                    document.getElementById('field-razon-social')?.querySelector('input') &&
                                        (document.getElementById('field-razon-social').querySelector('input').value = json.data.razon_social || '');
                                    document.getElementById('field-direccion-fiscal')?.querySelector('input') &&
                                        (document.getElementById('field-direccion-fiscal').querySelector('input').value = json.data.direccion_fiscal || '');
                                    window.SITAlert.show('Datos de RUC cargados correctamente', 'success');
                                } else {
                                    window.SITAlert.show('No se encontraron datos para este RUC', 'warning');
                                }
                            } catch (err) {
                                window.SITAlert.show('Error al consultar RUC: ' + err.message, 'danger');
                            }
                        });
                    });
                }
            });
        });

        // ── Editar datos del Servicio ──────────────────────────────────────────
        document.querySelectorAll('.btn-editar-servicio').forEach(btn => {
            btn.addEventListener('click', async () => {
                const isEditing = btn.dataset.editing === 'true';
                const suscripcionId = btn.dataset.suscripcion;

                if (isEditing) {
                    const planInput = document.getElementById(`svc-field-plan-${suscripcionId}`)?.querySelector('select')?.value;
                    const payload = {
                        suscripcion_id: suscripcionId,
                        direccion_servicio: document.getElementById(`svc-field-direccion-${suscripcionId}`)?.querySelector('input')?.value,
                        distrito: document.getElementById(`svc-field-distrito-${suscripcionId}`)?.querySelector('input')?.value,
                        provincia: document.getElementById(`svc-field-provincia-${suscripcionId}`)?.querySelector('input')?.value,
                        departamento: document.getElementById(`svc-field-departamento-${suscripcionId}`)?.querySelector('input')?.value,
                        deuda_acumulada: document.getElementById(`svc-field-deuda-acumulada-${suscripcionId}`)?.querySelector('input')?.value,
                        latitud: document.getElementById(`svc-field-latitud-${suscripcionId}`)?.querySelector('input')?.value,
                        longitud: document.getElementById(`svc-field-longitud-${suscripcionId}`)?.querySelector('input')?.value,
                        nap_id: document.getElementById(`svc-field-nap-${suscripcionId}`)?.querySelector('input')?.value,
                        puerto_nap: document.getElementById(`svc-field-puerto-nap-${suscripcionId}`)?.querySelector('input')?.value,
                        presinto_numero: document.getElementById(`svc-field-presinto-${suscripcionId}`)?.querySelector('input')?.value,
                        router_modelo: document.getElementById(`svc-field-router-modelo-${suscripcionId}`)?.querySelector('input')?.value,
                        router_serie: document.getElementById(`svc-field-router-serie-${suscripcionId}`)?.querySelector('input')?.value,
                        router_mac: document.getElementById(`svc-field-router-mac-${suscripcionId}`)?.querySelector('input')?.value,
                        fecha_instalacion: document.getElementById(`svc-field-fecha-instalacion-${suscripcionId}`)?.querySelector('input')?.value,
                        fecha_limite_corte: document.getElementById(`svc-field-fecha-limite-corte-${suscripcionId}`)?.querySelector('input')?.value,
                        observaciones: document.getElementById(`svc-field-observaciones-${suscripcionId}`)?.querySelector('textarea')?.value,
                    };
                    if (planInput) payload.plan_id = parseInt(planInput);

                    try {
                        const res = await fetch('/api/abonados/actualizar-servicio/', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });
                        const json = await res.json();
                        if (json.status !== 'success') {
                            window.SITAlert.show(json.message, 'danger');
                            return;
                        }
                        window.location.reload();
                    } catch (err) {
                        window.SITAlert.show('Error al guardar los datos del servicio.', 'danger');
                    }
                } else {
                    btn.dataset.editing = 'true';
                    btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';

                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'abonados-btn abonados-btn-ghost';
                    cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar';
                    cancelBtn.addEventListener('click', () => window.location.reload());
                    btn.parentElement.appendChild(cancelBtn);

                    // Plan (si permite cambio)
                    const planEl = document.getElementById(`svc-field-plan-${suscripcionId}`);
                    if (planEl && planEl.dataset.permiteCambio === 'true') {
                        const planesScript = document.getElementById(`catalog-planes-${suscripcionId}`);
                        if (planesScript) {
                            try {
                                const planes = JSON.parse(planesScript.textContent || '[]');
                                let selectHtml = `<select style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.72rem; color: var(--text-color); background: var(--bg-surface);">`;
                                const currentPlanId = planEl.dataset.planId;
                                planes.forEach(p => {
                                    const selected = String(p.id) === String(currentPlanId) ? 'selected' : '';
                                    selectHtml += `<option value="${p.id}" ${selected}>${p.nombre_plan} (S/ ${p.costo_plan.toFixed(2)})</option>`;
                                });
                                selectHtml += `</select>`;
                                planEl.innerHTML = selectHtml;
                            } catch (e) {
                                console.error('Error parsing planes catalog:', e);
                            }
                        }
                    }

                    // Convertir campos de texto a inputs
                    const textFields = [
                        { id: `svc-field-direccion-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-distrito-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-provincia-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-departamento-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-latitud-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-longitud-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-nap-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-presinto-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-router-modelo-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-router-serie-${suscripcionId}`, type: 'text' },
                        { id: `svc-field-router-mac-${suscripcionId}`, type: 'text' },
                    ];
                    textFields.forEach(field => {
                        const el = document.getElementById(field.id);
                        if (!el) return;
                        const currentValue = el.textContent === '—' ? '' : el.textContent;
                        el.innerHTML = `<input type="${field.type}" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                    });

                    // Puerto NAP (numérico)
                    const puertoEl = document.getElementById(`svc-field-puerto-nap-${suscripcionId}`);
                    if (puertoEl) {
                        const cv = puertoEl.textContent === '—' ? '' : puertoEl.textContent;
                        puertoEl.innerHTML = `<input type="number" value="${cv}" min="1" max="16" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                    }

                    // Deuda acumulada (numérica)
                    const deudaEl = document.getElementById(`svc-field-deuda-acumulada-${suscripcionId}`);
                    if (deudaEl) {
                        let cv = deudaEl.textContent.replace('S/ ', '').trim();
                        if (cv === '—') cv = '0.00';
                        deudaEl.innerHTML = `<input type="number" step="0.01" value="${cv}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                    }

                    // Fechas
                    [
                        `svc-field-fecha-instalacion-${suscripcionId}`,
                        `svc-field-fecha-limite-corte-${suscripcionId}`
                    ].forEach(fieldId => {
                        const el = document.getElementById(fieldId);
                        if (!el) return;
                        const cv = el.dataset.rawValue || '';
                        el.innerHTML = `<input type="date" value="${cv}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                    });

                    // Observaciones (textarea)
                    const obsEl = document.getElementById(`svc-field-observaciones-${suscripcionId}`);
                    if (obsEl) {
                        const cv = obsEl.textContent === '—' ? '' : obsEl.textContent;
                        obsEl.innerHTML = `<textarea rows="2" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">${cv}</textarea>`;
                    }
                }
            });
        });

        // ── Abrir modal de cobro ───────────────────────────────────────────────
        document.querySelectorAll('.btn-cobrar-servicio').forEach(btn => {
            btn.addEventListener('click', () => {
                const suscripcionId = btn.dataset.suscripcion;
                const modal = document.getElementById('modal-cobro');
                if (modal) {
                    modal.style.display = 'flex';
                    const inputSuscripcion = modal.querySelector('input[name="suscripcion_id"]');
                    if (inputSuscripcion) inputSuscripcion.value = suscripcionId;
                }
            });
        });
    });

})();

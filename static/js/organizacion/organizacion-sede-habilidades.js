/**
 * Habilidades de venta para personal ATC / TAC
 */

document.addEventListener('DOMContentLoaded', () => {

    const CARGOS_VENTA = ['atc', 'tac', 'supervisor_atc', 'jefe_tac'];

    window.initSedeHabilidadesModule = () => renderHabilidadesTab();

    const getVendedores = () =>
        (window.currentSedeConfigData?.personal || []).filter(p => CARGOS_VENTA.includes(p.cargo));

    const renderHabilidadesTab = () => {
        const body = document.getElementById('sedeConfigBody');
        if (!body) return;

        console.log('Datos de sede:', window.currentSedeConfigData);
        const vendedores = getVendedores();
        console.log('Vendedores filtrados:', vendedores);

        body.innerHTML = `
            <div class="config-card sede-tab-panel">
                <div class="config-card-title">Habilidades de Venta (ATC / TAC)</div>
                <p class="config-panel-desc">
                    Autorizaciones financieras y excepciones que puede aplicar cada asesor al registrar ventas o atenciones.
                </p>
                <div id="habilidadesList" style="display: flex; flex-direction: column; gap: 1rem;">
                    ${vendedores.length ? vendedores.map(renderVendedorCard).join('') :
                        '<p class="config-panel-desc">No hay personal ATC/TAC en esta sede. Agréguelos en la pestaña Personal.</p>'}
                </div>
            </div>`;

        body.querySelectorAll('.habilidades-form').forEach(form => {
            form.addEventListener('submit', guardarHabilidades);
        });
    };

    const renderVendedorCard = (p) => {
        const h = p.habilidades || {};
        console.log(`Renderizando vendedor ${p.nombre_apellidos}:`, h);
        const hg = h.habilidades_globales || {};
        const tickets = hg.tickets_cobro || {};
        const deudas = hg.deudas_antiguas || {};
        const planes = hg.planes_mensuales || {};
        
        console.log('Tickets:', tickets);
        console.log('Deudas:', deudas);
        console.log('Planes:', planes);
        
        return `
            <div class="config-card habilidades-empleado-card">
                <div class="config-card-title">${p.nombre_apellidos} <span class="config-badge">${p.cargo}</span></div>
                <form class="habilidades-form" data-personal-id="${p.id}">
                    <div class="config-form-grid config-form-grid-3">
                        <div class="habilidades-section">
                            <div class="habilidades-section-title">Tickets de Cobro (Instalación, Traslados, Equipos)</div>
                            <div class="config-form-group">
                                <label>% Máximo Descuento</label>
                                <input type="number" class="config-form-input" name="tickets_cobro_descuento_maximo_porcentaje" step="1" min="0" max="100" value="${tickets.descuento_maximo_porcentaje || 0}">
                            </div>
                            <div class="config-form-group">
                                <label>Cuotas Máximas</label>
                                <input type="number" class="config-form-input" name="tickets_cobro_cuotas_maximas" min="0" max="12" value="${tickets.cuotas_maximas || 0}">
                            </div>
                        </div>
                        
                        <div class="habilidades-section">
                            <div class="habilidades-section-title">Deudas Antiguas</div>
                            <div class="config-form-group">
                                <label>% Máximo Descuento (máx 90%)</label>
                                <input type="number" class="config-form-input" name="deudas_antiguas_descuento_maximo_porcentaje" step="1" min="0" max="90" value="${deudas.descuento_maximo_porcentaje || 0}">
                            </div>
                            <div class="config-form-group">
                                <label>Cuotas Máximas (máx 12)</label>
                                <input type="number" class="config-form-input" name="deudas_antiguas_cuotas_maximas" min="0" max="12" value="${deudas.cuotas_maximas || 0}">
                            </div>
                        </div>
                        
                        <div class="habilidades-section">
                            <div class="habilidades-section-title">Planes Mensuales</div>
                            <div class="config-form-group">
                                <label>% Máximo Descuento</label>
                                <input type="number" class="config-form-input" name="planes_mensuales_descuento_maximo_porcentaje" step="1" min="0" max="100" value="${planes.descuento_maximo_porcentaje || 100}">
                            </div>
                            <div class="config-form-group">
                                <label>Meses Máximos</label>
                                <input type="number" class="config-form-input" name="planes_mensuales_meses_maximos" min="0" max="12" value="${planes.meses_maximos || 0}">
                            </div>
                            <div class="config-form-group">
                                <label class="config-check-inline">
                                    <input type="checkbox" name="planes_mensuales_requiere_autorizacion_supervisor" ${planes.requiere_autorizacion_supervisor ? 'checked' : ''}>
                                    <span>Requiere autorización supervisor</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="config-form-actions">
                        <button type="submit" class="config-btn-save" title="Guardar habilidades">${GLOBAL_ICONS.save()}</button>
                    </div>
                </form>
            </div>`;
    };

    const guardarHabilidades = async (e) => {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        const data = {
            personal_id: parseInt(form.dataset.personalId, 10),
            tickets_cobro_descuento_maximo_porcentaje: fd.get('tickets_cobro_descuento_maximo_porcentaje'),
            tickets_cobro_cuotas_maximas: fd.get('tickets_cobro_cuotas_maximas'),
            deudas_antiguas_descuento_maximo_porcentaje: fd.get('deudas_antiguas_descuento_maximo_porcentaje'),
            deudas_antiguas_cuotas_maximas: fd.get('deudas_antiguas_cuotas_maximas'),
            planes_mensuales_descuento_maximo_porcentaje: fd.get('planes_mensuales_descuento_maximo_porcentaje'),
            planes_mensuales_meses_maximos: fd.get('planes_mensuales_meses_maximos'),
            planes_mensuales_requiere_autorizacion_supervisor: fd.get('planes_mensuales_requiere_autorizacion_supervisor') === 'on',
        };

        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;

        try {
            const resp = await fetch('/api/sede/config/habilidades/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify(data),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await window.openSedeConfig(window.currentSedeId, 'habilidades');
                alert('Habilidades guardadas.');
            } else {
                alert(`Error: ${res.message || res.error || 'Error desconocido'}`);
                btn.disabled = false;
            }
        } catch (err) {
            alert(`Error al guardar habilidades: ${err.message || err}`);
            btn.disabled = false;
        }
    };
});

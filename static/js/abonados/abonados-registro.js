/**
 * Wizard de registro de abonado:
 * Documento → Cliente → Suministro → Evaluación y Plan → Pagos → Confirmar
 */
(function () {
    const STEPS = ['Documento', 'Cliente', 'Suministro', 'Evaluación y Plan', 'Pagos', 'Confirmar'];
    let step = 0;
    let ctx = { vendedor: {}, sedes: [], planes: [], rucs_emision: [], estados_civiles: [], operadores: [] };
    let state = {};
    let evaluacion = null;
    let evidenciaFile = null;
    const imageCompressor = typeof ImageCompressor !== 'undefined'
        ? new ImageCompressor({ maxFileSizeKB: 500 })
        : null;

    const overlay = () => document.getElementById('modalRegistroAbonado');
    const body = () => document.getElementById('modalRegistroBody');
    const stepsEl = () => document.getElementById('wizardSteps');

    const getAppCtx = () => {
        const raw = document.getElementById('abonadosApp')?.dataset.ctxVendedor;
        try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
    };

    const fetchContexto = async (sedeId) => {
        const url = sedeId ? `/api/abonados/contexto/?sede_id=${sedeId}` : '/api/abonados/contexto/';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Error al cargar contexto de la sede');
        const json = await res.json();
        if (json.status === 'success') {
            ctx = json.data;
            if (!state.sede_id && ctx.vendedor?.sede_id) state.sede_id = ctx.vendedor.sede_id;
        } else {
            throw new Error(json.message || 'Error al cargar contexto');
        }
    };

    const fetchEvaluacion = async () => {
        const res = await fetch('/api/abonados/evaluar/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state),
        });
        if (!res.ok) {
            let msg = 'Error en el servidor al evaluar';
            try {
                const json = await res.json();
                msg = json.message || msg;
            } catch (_) {}
            throw new Error(msg);
        }
        const json = await res.json();
        if (json.status !== 'success') {
            throw new Error(json.message || 'Error al evaluar');
        }
        evaluacion = json.data;
        state.evaluacion = evaluacion;
        return evaluacion;
    };

    const renderSteps = () => {
        stepsEl().innerHTML = STEPS.map((label, i) => {
            const cls = i < step ? 'done' : (i === step ? 'active' : '');
            return `<span class="ab-step-pill ${cls}">${i + 1}. ${label}</span>`;
        }).join('');
        document.getElementById('btnWizardPrev').disabled = step === 0;
        document.getElementById('btnWizardNext').textContent = step === STEPS.length - 1 ? 'Registrar' : 'Siguiente';
    };

    const showAlert = (msg, type = 'info') => `<div class="ab-alert ab-alert-${type}">${msg}</div>`;
    const esc = (s) => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const money = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

    const calcEdad = (fecha) => {
        if (!fecha) return null;
        const n = new Date(fecha);
        if (Number.isNaN(n.getTime())) return null;
        const hoy = new Date();
        let edad = hoy.getFullYear() - n.getFullYear();
        const m = hoy.getMonth() - n.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad -= 1;
        return edad;
    };

    const habRow = (key, label, value, max = null) => {
        const hasAbility = value > 0;
        return `<label class="ab-check-row">
            <input type="number" id="hab_${key}" ${hasAbility ? '' : 'disabled'} min="0" ${max !== null ? `max="${max}"` : ''} value="${state[key] || 0}">
            <span>${label}${max !== null ? ` (máx ${max})` : ''}</span>
        </label>`;
    };

    const tieneDeudaCobrar = () =>
        !!(state.tiene_deuda_cliente || state.tiene_deuda_externa || state.tiene_deuda_sistema);
    
    const calcularFechaVigencia = (meses) => {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() + meses);
        return fecha.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    const renderDeudaPanel = () => {
        const deudasCobrar = [
            ...(state.deudas_cliente || []),
            ...(state.deudas_sistema || []),
            ...(state.deudas_externas || []),
        ];
        if (!deudasCobrar.length) {
            return showAlert('Sin deudas cobrables detectadas.', 'info');
        }
        const rows = deudasCobrar.map(d =>
            `<tr><td>${esc(d.concepto)}</td><td>${money(d.monto_actual)}</td><td>${esc(d.suministro_id || d.origen || '—')}</td></tr>`
        ).join('');
        return `<h4 style="margin:0.5rem 0 0.25rem;font-size:0.75rem;">Deudas a cobrar (SIT / Telecable)</h4>
            <table class="abonados-table" style="margin-top:0.25rem;">
            <thead><tr><th>Concepto</th><th>Monto</th><th>Ref.</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    };

    const renderStep = async () => {
        renderSteps();
        const b = body();

        if (step === 0) {
            b.innerHTML = `
                ${showAlert('Consulte DNI (8) o RUC (11). Orden: sistema local → Telecable → Net. Cliente nuevo entra sin deuda en SIT; la deuda Telecable se cobra al registrar.')}
                <div class="ab-form-grid">
                    <div class="ab-field full">
                        <label>Documento principal</label>
                        <input type="text" id="wDocumento" maxlength="11" value="${esc(state.documento)}" placeholder="DNI o RUC">
                    </div>
                    <div class="ab-field full">
                        <label>RUC</label>
                        <input type="text" id="wRucAdicional" maxlength="11" value="${esc(state.ruc || '')}" placeholder="Opcional — 11 dígitos">
                    </div>
                </div>
                <button type="button" class="abonados-btn abonados-btn-new" id="btnConsultarDoc" style="margin-top:0.5rem;">
                    <i class="fa-solid fa-magnifying-glass"></i> Consultar
                </button>
                <div id="wDocResult"></div>`;
            document.getElementById('btnConsultarDoc')?.addEventListener('click', consultarDocumento);
            return;
        }

        if (step === 1) {
            const ecOpts = (ctx.estados_civiles || []).map(e =>
                `<option value="${e.value}" ${state.estado_civil === e.value ? 'selected' : ''}>${e.label}</option>`
            ).join('');
            const opOpts = (ctx.operadores || ['MOVISTAR', 'CLARO', 'ENTEL', 'BITEL', 'OTRO']).map(o =>
                `<option value="${o}" ${state.operador === o ? 'selected' : ''}>${o}</option>`
            ).join('');
            b.innerHTML = `
                ${state.es_mayor_edad === false ? showAlert('El cliente debe ser mayor de edad. Verifique la fecha de nacimiento.', 'danger') : ''}
                <div class="ab-form-grid">
                    <div class="ab-field">
                        <label>DNI</label>
                        <div style="display:flex; gap:0.5rem; align-items:end;">
                            <input id="wDni" maxlength="8" value="${esc(state.dni)}" style="flex:1;">
                            <button type="button" class="abonados-btn abonados-btn-new" id="btnConsultarDni" style="padding:0.5rem;"><i class="fa-solid fa-magnifying-glass"></i></button>
                        </div>
                    </div>
                    <div class="ab-field">
                        <label>RUC</label>
                        <div style="display:flex; gap:0.5rem; align-items:end;">
                            <input id="wRuc" maxlength="11" value="${esc(state.ruc)}" style="flex:1;">
                            <button type="button" class="abonados-btn abonados-btn-new" id="btnConsultarRuc" style="padding:0.5rem;"><i class="fa-solid fa-magnifying-glass"></i></button>
                        </div>
                    </div>
                    <div class="ab-field full"><label>Nombres y apellidos</label>
                        <input id="wNombre" value="${esc(state.nombre_apellidos)}"></div>
                    <div class="ab-field full"><label>Razón social</label>
                        <input id="wRazonSocial" value="${esc(state.razon_social)}"></div>
                    <div class="ab-field"><label>Fecha nacimiento *</label><input type="date" id="wCumple" value="${esc(state.cumpleanos)}"></div>
                    <div class="ab-field"><label>Estado civil</label>
                        <select id="wEstadoCivil"><option value="">—</option>${ecOpts}</select></div>
                    <div class="ab-field"><label>Tipo de Cliente *</label>
                        <select id="wTipoCliente">
                            <option value="RESIDENCIAL" ${state.tipo_cliente === 'RESIDENCIAL' ? 'selected' : ''}>Residencial</option>
                            <option value="CORPORATIVO" ${state.tipo_cliente === 'CORPORATIVO' ? 'selected' : ''}>Corporativo</option>
                        </select>
                    </div>
                    <div class="ab-field"><label>Operador</label>
                        <select id="wOperador"><option value="">—</option>${opOpts}</select></div>
                    <div class="ab-field"><label>Celular 1 *</label><input id="wCelular" value="${esc(state.celular_1)}"></div>
                    <div class="ab-field"><label>Celular 2</label><input id="wCelular2" value="${esc(state.celular_2)}"></div>
                    <div class="ab-field full"><label>Correo</label><input id="wCorreo" type="email" value="${esc(state.correo)}"></div>
                    <div class="ab-field full"><label>Dirección fiscal</label>
                        <input id="wDirFiscal" value="${esc(state.direccion_fiscal)}"></div>
                </div>
                <div id="wEdadResult"></div>
                <div id="wDniResult"></div>
                <div id="wRucResult"></div>`;
            document.getElementById('wCumple')?.addEventListener('change', validarEdadEnPantalla);
            document.getElementById('btnConsultarDni')?.addEventListener('click', consultarDni);
            document.getElementById('btnConsultarRuc')?.addEventListener('click', consultarRuc);
            return;
        }

        if (step === 2) {
            b.innerHTML = `
                ${showAlert('Consulte suministro eléctrico (Distriluz) y cruce con Telecable por suministro/dirección. Se autocompletan datos y deuda Telecable cobrable.')}
                <div class="ab-form-grid">
                    <div class="ab-field"><label>Nº suministro *</label>
                        <input id="wSuministro" value="${esc(state.suministro)}"></div>
                    <div class="ab-field" style="align-self:end;">
                        <button type="button" class="abonados-btn abonados-btn-new" id="btnConsultarSum">Consultar</button>
                    </div>
                    <div class="ab-field full"><label>Dirección servicio</label>
                        <input id="wDirServicio" value="${esc(state.direccion_servicio)}"></div>
                    <div class="ab-field"><label>Distrito</label>
                        <input id="wDistrito" value="${esc(state.distrito)}"></div>
                    <div class="ab-field"><label>Provincia</label>
                        <input id="wProvincia" value="${esc(state.provincia)}"></div>
                    <div class="ab-field"><label>Departamento</label>
                        <input id="wDepartamento" value="${esc(state.departamento)}"></div>
                    <div class="ab-field"><label>Latitud</label><input id="wLat" value="${esc(state.latitud)}"></div>
                    <div class="ab-field"><label>Longitud</label><input id="wLng" value="${esc(state.longitud)}"></div>
                    <div class="ab-field full"><label>Referencia domicilio</label>
                        <input id="wReferencia" value="${esc(state.referencia_domicilio)}"></div>
                </div>
                <div id="wSumResult"></div>`;
            document.getElementById('btnConsultarSum')?.addEventListener('click', consultarSuministro);
            return;
        }

        if (step === 3) {
            const tieneDeuda = tieneDeudaCobrar();
            const sedeOpts = (ctx.sedes || []).map(s =>
                `<option value="${s.id}" ${String(state.sede_id) === String(s.id) ? 'selected' : ''}>${s.nombre}</option>`
            ).join('');
            // Filter plans by tipo_cliente
            const filteredPlanes = (ctx.planes || []).filter(p => 
                !state.tipo_cliente || p.tipo_cliente === state.tipo_cliente
            );
            const mainPlanes = filteredPlanes.filter(p => p.tipo_servicio !== 'APP');
            const appPlanes = filteredPlanes.filter(p => p.tipo_servicio === 'APP');
            
            const planOpts = mainPlanes.map(p =>
                `<option value="${p.id}" data-costo="${p.costo_plan}" data-tipo="${p.tipo_servicio}" ${String(state.plan_id) === String(p.id) ? 'selected' : ''}>${p.nombre_plan} — S/ ${p.costo_plan}</option>`
            ).join('');
            
            const appOpts = appPlanes.map(p =>
                `<option value="${p.id}" data-costo="${p.costo_plan}" ${(state.app_ids || []).includes(p.id) ? 'selected' : ''}>${p.nombre_plan} — S/ ${p.costo_plan}</option>`
            ).join('');

            const selectedPlan = mainPlanes.find(p => String(p.id) === String(state.plan_id));
            const isDuoOrTv = selectedPlan && (selectedPlan.tipo_servicio === 'DUO' || selectedPlan.tipo_servicio === 'TV');
            const numAnexos = state.num_anexos || 0;
            const hab = ctx.vendedor?.habilidades || {};
            const hg = hab.habilidades_globales || {};
            const maxDescuentoPlan = hg.planes_mensuales?.descuento_maximo_porcentaje || 0;
            const maxMesesGratis = hg.planes_mensuales?.meses_maximos || 0;
            const requiereAutorizacion = hg.planes_mensuales?.requiere_autorizacion_supervisor || false;
            
            // Calculate debt proration if debt exists
            const deudasCobrar = [
                ...(state.deudas_cliente || []),
                ...(state.deudas_sistema || []),
                ...(state.deudas_externas || []),
            ];
            const totalDeuda = deudasCobrar.reduce((sum, d) => sum + (d.monto_actual || 0), 0);
            const cuotasDeuda = state.cuotas_deuda || 1;
            const montoCuotaDeuda = cuotasDeuda > 1 ? (totalDeuda / cuotasDeuda).toFixed(2) : totalDeuda.toFixed(2);
            

            b.innerHTML = `
                ${tieneDeuda
                    ? showAlert(`Deuda total: ${money(totalDeuda)}. Prorrateo: ${cuotasDeuda} cuotas de S/ ${montoCuotaDeuda}. Aplique descuento en pagos.`, 'warn')
                    : showAlert('Sin deudas cobrables. Seleccione su plan.', 'info')}
                <h4 style="margin:0.5rem 0 0.25rem;font-size:0.75rem;">Deudas detectadas</h4>
                ${renderDeudaPanel()}
                ${tieneDeuda ? `
                <div class="ab-field full" style="margin-top:0.5rem;">
                    <label>Cuotas de Deuda</label>
                    <select id="wCuotasDeuda">
                        <option value="1" ${cuotasDeuda === 1 ? 'selected' : ''}>Pago único (S/ ${montoCuotaDeuda})</option>
                        <option value="3" ${cuotasDeuda === 3 ? 'selected' : ''}>3 cuotas de S/ ${(totalDeuda/3).toFixed(2)}</option>
                        <option value="6" ${cuotasDeuda === 6 ? 'selected' : ''}>6 cuotas de S/ ${(totalDeuda/6).toFixed(2)}</option>
                        <option value="12" ${cuotasDeuda === 12 ? 'selected' : ''}>12 cuotas de S/ ${(totalDeuda/12).toFixed(2)}</option>
                    </select>
                </div>
                <div class="ab-deuda-prorrateo" style="margin-top:0.25rem; padding:0.5rem; background:var(--bg-tertiary); border-radius:var(--radius-sm); font-size:0.75rem;">
                    <strong>Prorrateo actual:</strong> ${cuotasDeuda} cuotas de S/ ${montoCuotaDeuda} cada una
                </div>` : ''}
                <div class="ab-form-grid" style="margin-top:1rem;">
                    ${ctx.vendedor?.es_admin ? `
                    <div class="ab-field full"><label>Sede registro</label>
                        <select id="wSede">${sedeOpts}</select></div>` : ''}
                    <div class="ab-field full"><label>Plan *</label>
                        <select id="wPlan"><option value="">Seleccione...</option>${planOpts}</select></div>
                    <div class="ab-field"><label>Descuento Plan (%)</label>
                        <input type="number" id="wDescuentoPlan" min="0" max="${maxDescuentoPlan}" value="${state.descuento_plan || 0}" placeholder="0-${maxDescuentoPlan}">
                    </div>
                    <div class="ab-field"><label>Meses Gratis</label>
                        <input type="number" id="wMesesGratis" min="0" max="${maxMesesGratis}" value="${state.meses_gratis || 0}" placeholder="0-${maxMesesGratis}">
                    </div>
                    ${requiereAutorizacion && state.descuento_plan > 50 ? `
                    <div class="ab-field full" style="background:var(--bg-warning); padding:0.5rem; border-radius:var(--radius-sm); border-left:3px solid var(--warning-color);">
                        <label style="color:var(--warning-color); font-weight:bold;">⚠ Requiere Autorización Supervisor</label>
                        <input type="text" id="wAutorizacionSup" placeholder="Ingrese código de autorización" style="margin-top:0.25rem;">
                    </div>` : ''}
                    ${appPlanes.length > 0 ? `
                    <div class="ab-field full">
                        <label>Aplicaciones</label>
                        <select id="wApps"><option value="">Seleccione...</option>${appOpts}</select>
                        <label style="display:flex; align-items:center; gap:0.35rem; margin-top:0.5rem; cursor:pointer; font-size:0.85rem;"><input type="checkbox" id="wOmitirPagoApps" ${state.omitir_pago_apps ? 'checked' : ''}> Omitir pago inicial de aplicativos (Gratis por 1 año)</label>
                    </div>` : ''}
                    <div class="ab-field full" id="anexoContainer" style="display: ${isDuoOrTv ? 'block' : 'none'};">
                        <label>Número de Anexos (TV/Duo)</label>
                        <input type="number" id="wNumAnexos" min="0" max="10" value="${numAnexos}" placeholder="0">
                        <p class="ab-address" style="margin-top:0.25rem; font-size:0.75rem;">
                            <i class="fa-solid fa-info-circle"></i> El primer anexo es GRATIS al registro. Los adicionales se cobran mensualmente según el ticket de instalación.
                        </p>
                    </div>
                </div>
                <div class="ab-advisories" style="margin-top:1rem; padding:0.75rem; background:var(--bg-tertiary); border-radius:var(--radius-sm); border-left:3px solid var(--accent-color);">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                        <i class="fa-solid fa-circle-question" style="color:var(--accent-color); font-size:1rem;"></i>
                        <strong style="font-size:0.8rem; color:var(--text-primary);">Advertencias y Consejos</strong>
                    </div>
                    <ul style="margin:0; padding-left:1.25rem; font-size:0.75rem; color:var(--text-secondary); line-height:1.4;">
                        <li style="margin-bottom:0.25rem;">Si el cliente excede los 100 metros de fibra, pagará exceso de instalación.</li>
                        <li style="margin-bottom:0.25rem;">El anexo gratis solo aplica al momento del registro. Después se cobra el valor mensual.</li>
                        <li style="margin-bottom:0.25rem;">Los descuentos aplicados son permanentes para el cliente.</li>
                        <li>Se generarán automáticamente las órdenes: instalación campo, app a virtual, e instalación de anexos.</li>
                    </ul>
                </div>
                ${showAlert('El plan se filtra por la sede del vendedor y tipo de cliente. Contrato a nombre de: ' + esc(ctx.vendedor?.personal_nombre), 'info')}`;

            document.getElementById('wSede')?.addEventListener('change', async (e) => {
                state.sede_id = e.target.value;
                await fetchContexto(state.sede_id);
                renderStep();
            });

            document.getElementById('wPlan')?.addEventListener('change', (e) => {
                const opt = e.target.selectedOptions[0];
                state.costo_plan = opt?.dataset.costo || 0;
                state.tipo_servicio = opt?.dataset.tipo || '';
                // Show/hide anexo field based on plan type
                const anexoContainer = document.getElementById('anexoContainer');
                if (anexoContainer) {
                    anexoContainer.style.display = (opt?.dataset.tipo === 'DUO' || opt?.dataset.tipo === 'TV') ? 'block' : 'none';
                }
            });

            // Collect app selection from single select
            const appsEl = document.getElementById('wApps');
            if (appsEl) {
                appsEl.addEventListener('change', () => {
                    const selectedValue = appsEl.value;
                    state.app_ids = selectedValue ? [parseInt(selectedValue)] : [];
                    // Recalculate total plan cost
                    let total = state.costo_plan || 0;
                    state.app_ids.forEach(appId => {
                        const app = appPlanes.find(ap => ap.id === appId);
                        if (app) total += app.costo_plan;
                    });
                    state.costo_plan_total = total;
                });
            }

            const omitirAppsEl = document.getElementById('wOmitirPagoApps');
            if (omitirAppsEl) {
                omitirAppsEl.addEventListener('change', (e) => {
                    state.omitir_pago_apps = e.target.checked;
                });
            }

            const numAnexosEl = document.getElementById('wNumAnexos');
            if (numAnexosEl) {
                numAnexosEl.addEventListener('change', (e) => {
                    state.num_anexos = parseInt(e.target.value) || 0;
                });
            }

            const descuentoPlanEl = document.getElementById('wDescuentoPlan');
            if (descuentoPlanEl) {
                descuentoPlanEl.addEventListener('change', (e) => {
                    state.descuento_plan = parseFloat(e.target.value) || 0;
                });
            }

            const mesesGratisEl = document.getElementById('wMesesGratis');
            if (mesesGratisEl) {
                mesesGratisEl.addEventListener('change', (e) => {
                    state.meses_gratis = parseInt(e.target.value) || 0;
                    // Re-render to show/hide authorization field
                    renderStep();
                });
            }

            const autorizacionSupEl = document.getElementById('wAutorizacionSup');
            if (autorizacionSupEl) {
                autorizacionSupEl.addEventListener('change', (e) => {
                    state.autorizacion_supervisor = e.target.value?.trim() || '';
                });
            }

            const cuotasDeudaEl = document.getElementById('wCuotasDeuda');
            if (cuotasDeudaEl) {
                cuotasDeudaEl.addEventListener('change', (e) => {
                    state.cuotas_deuda = parseInt(e.target.value) || 1;
                    // Recalculate and update display
                    const newMontoCuota = (totalDeuda / state.cuotas_deuda).toFixed(2);
                    const prorrateoEl = document.querySelector('.ab-deuda-prorrateo');
                    if (prorrateoEl) {
                        prorrateoEl.innerHTML = `<strong>Prorrateo actual:</strong> ${state.cuotas_deuda} cuotas de S/ ${newMontoCuota} cada una`;
                    }
                    // Update alert
                    const alertEl = document.querySelector('.ab-alert-ab-alert-warn');
                    if (alertEl) {
                        alertEl.innerHTML = `Deuda total: ${money(totalDeuda)}. Prorrateo: ${state.cuotas_deuda} cuotas de S/ ${newMontoCuota}. Aplique descuento en pagos.`;
                    }
                });
            }

            return;
        }

        if (step === 5) {
            await fetchEvaluacion();
            const ev = evaluacion || {};
            const hab = ctx.vendedor?.habilidades || {};
            const hg = hab.habilidades_globales || {};
            const rucOpts = (ev.rucs_emision || ctx.rucs_emision || []).map(r =>
                `<option value="${r.id}" ${String(state.ruc_emisor_id) === String(r.id) ? 'selected' : ''}>${r.numero_ruc} — ${esc(r.razon_social)}</option>`
            ).join('');
            const tipoComp = state.tipo_comprobante || ev.tipo_comprobante_sugerido || 'BOLETA';
            const tieneDeuda = tieneDeudaCobrar();
            const deudasCobrar = [
                ...(state.deudas_cliente || []),
                ...(state.deudas_sistema || []),
                ...(state.deudas_externas || []),
            ];
            const totalDeuda = deudasCobrar.reduce((sum, d) => sum + (d.monto_actual || 0), 0);
            
            b.innerHTML = `
                ${showAlert(`Total a cobrar ahora: <strong>${money(ev.total_cobrar_ahora)}</strong> (deuda ${money(ev.deuda_a_pagar)} + plan ${money(ev.adelanto_plan)} + instalación ${money(ev.costo_instalacion)})`, 'info')}
                <div class="ab-form-grid">
                    <div class="ab-field"><label>Pago plan</label>
                        <select id="wModoPlan">
                            <option value="FIN_MES" ${state.modo_pago_plan !== 'CONTADO' ? 'selected' : ''}>Fin de mes</option>
                            <option value="CONTADO" ${state.modo_pago_plan === 'CONTADO' ? 'selected' : ''}>Contado (adelanto)</option>
                        </select></div>
                    ${tieneDeuda ? `
                    <div class="ab-field"><label>Descuento deuda (S/)</label>
                        <input type="number" id="wDescuentoDeuda" step="0.01" min="0" max="${totalDeuda}" value="${state.descuento_deuda || 0}" placeholder="Monto exacto a descontar">
                    </div>
                    <div class="ab-field"><label>Deuda en cuotas</label>
                        <select id="wDeudaCuotas">
                            <option value="0" ${!state.pagar_deuda_cuotas ? 'selected' : ''}>Pago único</option>
                            <option value="1" ${state.pagar_deuda_cuotas ? 'selected' : ''}>En cuotas (${ev.cuotas_liberacion || 1})</option>
                        </select></div>` : ''}
                    <div class="ab-field full"><label>RUC emisor comprobante</label>
                        <select id="wRucEmisor"><option value="">Seleccione...</option>${rucOpts}</select></div>
                    <div class="ab-field"><label>Tipo comprobante</label>
                        <select id="wTipoComp">
                            <option value="BOLETA" ${tipoComp === 'BOLETA' ? 'selected' : ''}>Boleta</option>
                            <option value="FACTURA" ${tipoComp === 'FACTURA' ? 'selected' : ''}>Factura</option>
                            <option value="NOTA_VENTA" ${tipoComp === 'NOTA_VENTA' ? 'selected' : ''}>Nota de venta</option>
                        </select></div>
                    <div class="ab-field"><label>Método pago</label>
                        <select id="wMetodoPago">
                            <option value="EFECTIVO">Efectivo</option>
                            <option value="YAPE">Yape</option>
                            <option value="TRANSFERENCIA">Transferencia</option>
                            <option value="MIXTO">Mixto (efectivo + digital)</option>
                        </select></div>
                    <div class="ab-field" id="wMixtoEf" style="display:none;"><label>Monto efectivo</label>
                        <input type="number" id="wMontoEf" step="0.01" min="0"></div>
                    <div class="ab-field" id="wMixtoDig" style="display:none;"><label>Monto Yape/transferencia</label>
                        <input type="number" id="wMontoDig" step="0.01" min="0"></div>
                    <div class="ab-field" id="wNumOp" style="display:none;"><label>N° operación</label>
                        <input type="text" id="wNumOp" placeholder="Requerido para pago digital"></div>
                    <div class="ab-field full" id="wEvidenciaWrap" style="display:none;">
                        <label>Evidencia pago (Yape / transferencia / mixto)</label>
                        <input type="file" id="wEvidencia" accept="image/*">
                        <p class="ab-address">La imagen se comprimirá al guardar en el sistema de archivos.</p>
                    </div>
                </div>`;
            const metodo = document.getElementById('wMetodoPago');
            const evidWrap = document.getElementById('wEvidenciaWrap');
            const toggleEvid = () => {
                const v = metodo.value;
                const digital = ['YAPE', 'TRANSFERENCIA', 'MIXTO'].includes(v);
                evidWrap.style.display = digital ? 'block' : 'none';
                document.getElementById('wMixtoEf').style.display = v === 'MIXTO' ? 'block' : 'none';
                document.getElementById('wMixtoDig').style.display = v === 'MIXTO' ? 'block' : 'none';
                document.getElementById('wNumOp').style.display = digital ? 'block' : 'none';
            };
            metodo?.addEventListener('change', toggleEvid);
            document.getElementById('wEvidencia')?.addEventListener('change', (e) => {
                evidenciaFile = e.target.files?.[0] || null;
            });
            toggleEvid();
            return;
        }

        if (step === 5) {
            if (!evaluacion) await fetchEvaluacion();
            const ev = evaluacion || {};
            b.innerHTML = `
                <dl class="ficha-dl">
                    <dt>Documento</dt><dd>${esc(state.dni || state.ruc || '—')}</dd>
                    <dt>Cliente</dt><dd>${esc(state.nombre_apellidos || state.razon_social)}</dd>
                    <dt>Cumpleaños</dt><dd>${esc(state.cumpleanos)} (${calcEdad(state.cumpleanos) ?? '—'} años)</dd>
                    <dt>Celular</dt><dd>${esc(state.celular_1)}</dd>
                    <dt>Suministro</dt><dd>${esc(state.suministro)}</dd>
                    <dt>Plan</dt><dd>${esc(state.plan_id)}</dd>
                    <dt>Vendedor contrato</dt><dd>${esc(ctx.vendedor?.personal_nombre)} (${esc(ctx.vendedor?.personal_id)})</dd>
                    <dt>Total cobrar</dt><dd>${money(ev.total_cobrar_ahora)}</dd>
                    <dt>Comprobante</dt><dd>${esc(state.tipo_comprobante || ev.tipo_comprobante_sugerido)}</dd>
                </dl>
                ${showAlert('Al confirmar se crea cliente, suscripción y orden de instalación.', 'info')}`;
        }
    };

    const validarEdadEnPantalla = () => {
        const fecha = document.getElementById('wCumple')?.value;
        const el = document.getElementById('wEdadResult');
        if (!el) return;
        const edad = calcEdad(fecha);
        if (edad === null) {
            el.innerHTML = showAlert('Ingrese fecha de nacimiento válida (mayor de edad).', 'warn');
            state.es_mayor_edad = null;
            return;
        }
        state.es_mayor_edad = edad >= 18;
        state.cumpleanos = fecha;
        el.innerHTML = state.es_mayor_edad
            ? showAlert(`Edad verificada: ${edad} años.`, 'info')
            : showAlert(`Menor de edad (${edad} años). No puede registrarse.`, 'danger');
    };

    const consultarDni = async () => {
        const dni = document.getElementById('wDni')?.value.trim();
        if (!dni || dni.length !== 8) {
            document.getElementById('wDniResult').innerHTML = showAlert('Ingrese DNI válido (8 dígitos)', 'danger');
            return;
        }
        const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(dni)}`);
        const json = await res.json();
        const el = document.getElementById('wDniResult');
        if (json.status !== 'success') {
            el.innerHTML = showAlert(json.message || 'Error', 'danger');
            return;
        }
        const d = json.data;
        const origen = json.origen || 'API';

        state.dni = dni;
        state.nombre_apellidos = d.nombre_apellidos || d.nombre_completo || state.nombre_apellidos;
        state.cumpleanos = (d.cumpleanos || d.fecha_nacimiento || '').toString().slice(0, 10) || state.cumpleanos;
        state.estado_civil = d.estado_civil || state.estado_civil;
        state.es_mayor_edad = json.es_mayor_edad;
        state.cliente_existente = json.cliente_existente || false;
        state.cliente_nuevo = json.cliente_nuevo ?? !state.cliente_existente;
        state.deudas_cliente = d.deudas || [];
        state.deudas_externas = d.deudas_externas || [];
        state.monto_deuda_externa = d.monto_deuda_externa || 0;
        state.tiene_deuda_cliente = json.tiene_deuda_sistema || d.tiene_deuda_activa || (state.deudas_cliente.length > 0);
        state.tiene_deuda_externa = json.tiene_deuda_telecable || (state.deudas_externas.length > 0) || Number(state.monto_deuda_externa) > 0;
        state.cliente_id = state.cliente_existente ? (d.cliente_id || null) : null;
        state.codigo_externo_telecable = !state.cliente_existente ? (d.codigo_externo || d.cliente_id || null) : null;
        state.servicios_existentes = d.servicios_existentes || [];

        document.getElementById('wNombre').value = state.nombre_apellidos;
        document.getElementById('wCumple').value = state.cumpleanos;
        document.getElementById('wEstadoCivil').value = state.estado_civil || '';

        if (json.cliente_existente) {
            el.innerHTML = showAlert(
                `Cliente en sistema (${d.cliente_id}). Deuda SIT: ${state.tiene_deuda_cliente ? 'Sí' : 'No'}`,
                state.tiene_deuda_cliente ? 'warn' : 'info'
            );
        } else if (origen === 'TELECABLE') {
            const deudaTel = state.tiene_deuda_externa ? ` Deuda Telecable: ${money(state.monto_deuda_externa)}.` : '';
            el.innerHTML = showAlert(`Cliente nuevo desde Telecable.${deudaTel}`, state.tiene_deuda_externa ? 'warn' : 'info');
        } else if (origen === 'MANUAL') {
            el.innerHTML = showAlert(json.message || 'Complete los datos manualmente.', 'warn');
        } else {
            el.innerHTML = showAlert(`Datos DNI obtenidos (${origen}). ${json.es_mayor_edad === false ? 'Verifique mayoría de edad.' : ''}`, 'info');
        }
    };

    const consultarRuc = async () => {
        const ruc = document.getElementById('wRuc')?.value.trim();
        if (!ruc || ruc.length !== 11) {
            document.getElementById('wRucResult').innerHTML = showAlert('Ingrese RUC válido (11 dígitos)', 'danger');
            return;
        }
        const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(ruc)}`);
        const json = await res.json();
        const el = document.getElementById('wRucResult');
        if (json.status !== 'success') {
            el.innerHTML = showAlert(json.message || 'Error', 'danger');
            return;
        }
        const d = json.data;
        const origen = json.origen || 'API';

        state.ruc = ruc;
        state.razon_social = d.razon_social || state.razon_social;
        state.direccion_fiscal = d.direccion_fiscal || state.direccion_fiscal;

        document.getElementById('wRazonSocial').value = state.razon_social;
        document.getElementById('wDirFiscal').value = state.direccion_fiscal;

        el.innerHTML = showAlert(`Datos RUC obtenidos (${origen}).`, 'info');
    };

    const consultarDocumento = async () => {
        const doc = document.getElementById('wDocumento')?.value.trim();
        const rucExtra = document.getElementById('wRucAdicional')?.value.trim();
        if (!doc) return;
        state.documento = doc;
        const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(doc)}`);
        const json = await res.json();
        const el = document.getElementById('wDocResult');
        if (json.status !== 'success') {
            el.innerHTML = showAlert(json.message || 'Error', 'danger');
            return;
        }
        const d = json.data;
        const origen = json.origen || 'API';

        state.cliente_existente = json.cliente_existente || false;
        state.cliente_nuevo = json.cliente_nuevo ?? !state.cliente_existente;
        state.dni = d.dni || (doc.length === 8 ? doc : state.dni);
        state.ruc = d.ruc || (doc.length === 11 ? doc : state.ruc);
        state.nombre_apellidos = d.nombre_apellidos || d.nombre_completo || state.nombre_apellidos;
        state.razon_social = d.razon_social || state.razon_social;
        state.celular_1 = d.celular_1 || state.celular_1;
        state.celular_2 = d.celular_2 || state.celular_2;
        state.correo = d.correo || state.correo;
        state.direccion_fiscal = d.direccion_fiscal || state.direccion_fiscal;
        state.estado_civil = d.estado_civil || state.estado_civil;
        state.operador = d.operador || state.operador;
        state.cumpleanos = (d.cumpleanos || d.fecha_nacimiento || '').toString().slice(0, 10) || state.cumpleanos;
        state.es_mayor_edad = json.es_mayor_edad;
        state.deudas_cliente = d.deudas || [];
        state.deudas_externas = d.deudas_externas || [];
        state.monto_deuda_externa = d.monto_deuda_externa || 0;
        state.tiene_deuda_cliente = json.tiene_deuda_sistema || d.tiene_deuda_activa || (state.deudas_cliente.length > 0);
        state.tiene_deuda_externa = json.tiene_deuda_telecable || (state.deudas_externas.length > 0) || Number(state.monto_deuda_externa) > 0;
        state.cliente_id = state.cliente_existente ? (d.cliente_id || null) : null;
        state.codigo_externo_telecable = !state.cliente_existente ? (d.codigo_externo || d.cliente_id || null) : null;
        state.servicios_existentes = d.servicios_existentes || [];

        let serviciosHtml = '';
        if (state.servicios_existentes && state.servicios_existentes.length > 0) {
            serviciosHtml = `<div style="margin-top: 1rem;">
                <p><strong>Servicios existentes:</strong></p>
                <ul style="list-style: disc; margin-left: 1.5rem;">
                    ${state.servicios_existentes.map(s => `<li>${s.plan_nombre} (${s.estado_suscripcion})</li>`).join('')}
                </ul>
            </div>`;
        }

        if (json.cliente_existente) {
            el.innerHTML = showAlert(
                `Cliente en sistema (${d.cliente_id}). Deuda SIT: ${state.tiene_deuda_cliente ? 'Sí' : 'No'}`,
                state.tiene_deuda_cliente ? 'warn' : 'info'
            ) + serviciosHtml;
        } else if (origen === 'TELECABLE') {
            const deudaTel = state.tiene_deuda_externa ? ` Deuda Telecable a cobrar: ${money(state.monto_deuda_externa)}.` : ' Sin deuda Telecable.';
            el.innerHTML = showAlert(
                `Cliente nuevo (no está en SIT). Datos desde Telecable.${deudaTel} Al registrar entra sin deuda en el sistema nuevo.`,
                state.tiene_deuda_externa ? 'warn' : 'info'
            );
        } else if (origen === 'MANUAL') {
            el.innerHTML = showAlert(json.message || 'Complete los datos manualmente.', 'warn');
        } else {
            el.innerHTML = showAlert(`Cliente nuevo. Datos obtenidos (${origen}). ${json.es_mayor_edad === false ? 'Verifique mayoría de edad.' : ''}`, 'info');
        }

        if (rucExtra && rucExtra.length === 11) {
            const rRes = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(rucExtra)}`);
            const rJson = await rRes.json();
            if (rJson.status === 'success') {
                const rd = rJson.data;
                state.ruc = rucExtra;
                state.razon_social = rd.razon_social || state.razon_social;
                state.direccion_fiscal = rd.direccion_fiscal || state.direccion_fiscal;
            }
        }
    };

    const aplicarDatosTelecable = (tel) => {
        if (!tel) return;
        if (tel.dni && !state.dni) state.dni = tel.dni;
        if (tel.ruc && !state.ruc) state.ruc = tel.ruc;
        if (tel.nombre_apellidos) state.nombre_apellidos = tel.nombre_apellidos;
        if (tel.razon_social) state.razon_social = tel.razon_social;
        if (tel.celular_1) state.celular_1 = tel.celular_1;
        if (tel.celular_2) state.celular_2 = tel.celular_2;
        if (tel.correo) state.correo = tel.correo;
        if (tel.direccion_fiscal && !state.direccion_fiscal) state.direccion_fiscal = tel.direccion_fiscal;
        if (tel.cumpleanos || tel.fecha_nacimiento) {
            state.cumpleanos = (tel.cumpleanos || tel.fecha_nacimiento || '').toString().slice(0, 10);
        }
        state.codigo_externo_telecable = tel.codigo_externo || tel.cliente_id || state.codigo_externo_telecable;
        state.deudas_externas = tel.deudas_externas || state.deudas_externas || [];
        state.monto_deuda_externa = tel.monto_deuda_externa || state.monto_deuda_externa || 0;
        state.tiene_deuda_externa = tel.tiene_deuda_externa || (state.deudas_externas.length > 0) || Number(state.monto_deuda_externa) > 0;
    };

    const consultarSuministro = async () => {
        const sum = document.getElementById('wSuministro')?.value.trim();
        if (!sum) return;
        state.suministro = sum;
        const docParam = state.dni || state.ruc || state.documento || '';
        const url = `/api/abonados/consultar-suministro/?suministro=${encodeURIComponent(sum)}${docParam ? `&documento=${encodeURIComponent(docParam)}` : ''}`;
        const res = await fetch(url);
        const json = await res.json();
        const el = document.getElementById('wSumResult');
        if (json.status !== 'success') {
            el.innerHTML = showAlert(json.message || 'Error', 'danger');
            return;
        }
        const d = json.data;
        state.direccion_servicio = d.direccion || d.direccion_registrada || '';
        state.latitud = d.latitud || d.gps_latitud || '';
        state.longitud = d.longitud || d.gps_longitud || '';
        state.distrito = d.distrito || '';
        state.titular_nombre = d.cliente || d.titular_nombre || '';
        state.titular_documento = d.documento_titular || d.documento || '';
        state.provincia = d.provincia || '';
        state.departamento = d.departamento || '';
        state.deuda_luz = d.deuda_luz != null ? d.deuda_luz : (d.deuda || '0.00');
        state.deudas_sistema = d.deudas_sistema || [];
        state.tiene_deuda_sistema = d.tiene_deuda_sistema || false;
        state.deuda_bloqueante = d.deuda_bloqueante || false;
        state.registrado_en_sistema = d.registrado_en_sistema || false;
        if (d.deudas_externas?.length || d.tiene_deuda_externa) {
            state.deudas_externas = d.deudas_externas || [];
            state.monto_deuda_externa = d.monto_deuda_externa || 0;
            state.tiene_deuda_externa = d.tiene_deuda_externa || false;
        }
        if (d.telecable) aplicarDatosTelecable(d.telecable);
        document.getElementById('wDirServicio').value = state.direccion_servicio;
        document.getElementById('wDistrito').value = state.distrito;
        document.getElementById('wProvincia').value = state.provincia;
        document.getElementById('wDepartamento').value = state.departamento;
        document.getElementById('wLat').value = state.latitud;
        document.getElementById('wLng').value = state.longitud;
        const partes = [];
        partes.push(`Suministro (${d.source || 'cache'})`);
        if (d.coincidencia_telecable_por) {
            partes.push(`Telecable: ${d.coincidencia_telecable_por}${d.similitud_direccion != null ? ` (${Math.round(d.similitud_direccion * 100)}% dir.)` : ''}`);
        }
        if (state.tiene_deuda_externa) partes.push(`Deuda Telecable: ${money(state.monto_deuda_externa)}`);
        if (state.tiene_deuda_sistema) partes.push(`Deuda SIT: ${money(d.monto_deuda_sistema)}`);
        el.innerHTML = showAlert(partes.join(' · '), (state.tiene_deuda_externa || state.tiene_deuda_sistema) ? 'warn' : 'info');
    };

    const collectStep = () => {
        if (step === 1) {
            state.nombre_apellidos = document.getElementById('wNombre')?.value.trim();
            state.razon_social = document.getElementById('wRazonSocial')?.value.trim() || null;
            state.dni = document.getElementById('wDni')?.value.trim() || null;
            state.ruc = document.getElementById('wRuc')?.value.trim() || null;
            state.cumpleanos = document.getElementById('wCumple')?.value.trim();
            state.estado_civil = document.getElementById('wEstadoCivil')?.value || 'SOLTERO';
            state.tipo_cliente = document.getElementById('wTipoCliente')?.value || 'RESIDENCIAL';
            state.operador = document.getElementById('wOperador')?.value || null;
            state.celular_1 = document.getElementById('wCelular')?.value.trim();
            state.celular_2 = document.getElementById('wCelular2')?.value.trim();
            state.correo = document.getElementById('wCorreo')?.value.trim();
            state.direccion_fiscal = document.getElementById('wDirFiscal')?.value.trim();
            if (!state.celular_1) throw new Error('Celular principal requerido');
            if (!state.cumpleanos) throw new Error('Fecha de nacimiento requerida');
            const edad = calcEdad(state.cumpleanos);
            if (edad === null || edad < 18) throw new Error('El cliente debe ser mayor de edad');
            state.es_mayor_edad = true;
        }
        if (step === 2) {
            state.suministro = document.getElementById('wSuministro')?.value.trim();
            state.direccion_servicio = document.getElementById('wDirServicio')?.value.trim();
            state.distrito = document.getElementById('wDistrito')?.value.trim();
            state.provincia = document.getElementById('wProvincia')?.value.trim();
            state.departamento = document.getElementById('wDepartamento')?.value.trim();
            state.latitud = document.getElementById('wLat')?.value.trim();
            state.longitud = document.getElementById('wLng')?.value.trim();
            state.referencia_domicilio = document.getElementById('wReferencia')?.value.trim();
            if (!state.suministro) throw new Error('Suministro requerido');
        }
        if (step === 3) {
            const sedeEl = document.getElementById('wSede');
            if (sedeEl) state.sede_id = sedeEl.value;
            state.plan_id = document.getElementById('wPlan')?.value;
            if (!state.plan_id) throw new Error('Seleccione un plan');
            state.num_anexos = parseInt(document.getElementById('wNumAnexos')?.value) || 0;
            state.descuento_plan = parseFloat(document.getElementById('wDescuentoPlan')?.value) || 0;
            state.meses_gratis = parseInt(document.getElementById('wMesesGratis')?.value) || 0;
            state.autorizacion_supervisor = document.getElementById('wAutorizacionSup')?.value?.trim() || '';
            state.cuotas_deuda = parseInt(document.getElementById('wCuotasDeuda')?.value) || 1;
            // Ensure app_ids is set
            state.app_ids = state.app_ids || [];
            
            // Consolidate billing data in structured object for billing system
            const selectedPlan = (ctx.planes || []).find(p => String(p.id) === String(state.plan_id));
            const deudasCobrar = [
                ...(state.deudas_cliente || []),
                ...(state.deudas_sistema || []),
                ...(state.deudas_externas || []),
            ];
            const totalDeuda = deudasCobrar.reduce((sum, d) => sum + (d.monto_actual || 0), 0);
            
            state.facturacion = {
                tarifa_base: {
                    plan_id: state.plan_id,
                    costo_plan: selectedPlan?.costo_plan || 0,
                    tipo_servicio: selectedPlan?.tipo_servicio || ''
                },
                descuentos_permanentes: {
                    porcentaje_plan: state.descuento_plan,
                    meses_gratis: state.meses_gratis,
                    requiere_autorizacion_supervisor: state.descuento_plan > 50 ? true : false,
                    codigo_autorizacion: state.autorizacion_supervisor || null
                },
                deuda: {
                    total: totalDeuda,
                    cuotas: state.cuotas_deuda,
                    monto_cuota: state.cuotas_deuda > 1 ? (totalDeuda / state.cuotas_deuda).toFixed(2) : totalDeuda.toFixed(2)
                },
                servicios_adicionales: {
                    aplicaciones: state.app_ids || [],
                    omitir_pago_apps: state.omitir_pago_apps || false,
                    anexos: {
                        cantidad: state.num_anexos,
                        gratis_primero: true,
                        cobrables: Math.max(0, state.num_anexos - 1)
                    }
                }
            };
        }
        if (step === 4) {
            state.modo_pago_plan = document.getElementById('wModoPlan')?.value || 'FIN_MES';
            state.descuento_deuda = document.getElementById('wDescuentoDeuda')?.value || 0;
            state.pagar_deuda_cuotas = document.getElementById('wDeudaCuotas')?.value === '1';
            state.ruc_emisor_id = document.getElementById('wRucEmisor')?.value;
            state.tipo_comprobante = document.getElementById('wTipoComp')?.value;
            state.metodo_pago = document.getElementById('wMetodoPago')?.value;
            state.monto_efectivo = document.getElementById('wMontoEf')?.value;
            state.monto_digital = document.getElementById('wMontoDig')?.value;
            state.numero_operacion = document.getElementById('wNumOp')?.value?.trim();
            if (['YAPE', 'TRANSFERENCIA', 'MIXTO'].includes(state.metodo_pago) && !evidenciaFile) {
                throw new Error('Adjunte evidencia fotográfica del pago digital');
            }
            if (['YAPE', 'TRANSFERENCIA', 'MIXTO'].includes(state.metodo_pago) && !state.numero_operacion) {
                throw new Error('Ingrese el número de operación del pago digital');
            }
            if (state.metodo_pago === 'MIXTO') {
                const ef = Number(state.monto_efectivo || 0);
                const dig = Number(state.monto_digital || 0);
                const total = Number(evaluacion?.total_cobrar_ahora || 0);
                if (Math.abs(ef + dig - total) > 0.01) {
                    throw new Error('Efectivo + digital debe igualar el total a cobrar');
                }
            }
            state.evidencia_pago = evidenciaFile ? evidenciaFile.name : null;
        }
    };

    const subirEvidenciaRegistro = async (clienteId, file) => {
        if (!file) return;
        let blob = file;
        if (imageCompressor && file.type.startsWith('image/')) {
            try {
                blob = await imageCompressor.compressImage(file);
            } catch (_) { /* subir original */ }
        }
        const fd = new FormData();
        fd.append('cliente_id', clienteId);
        fd.append('tipo', 'evidencia_pago');
        fd.append('archivo', blob, file.name);
        await fetch('/api/abonados/subir-documento/', { method: 'POST', body: fd });
    };

    const registrar = async () => {
        const payload = {
            ...state,
            generar_orden_instalacion: true,
            emitir_comprobante: true,
            cliente_id: state.cliente_existente ? state.cliente_id : null,
        };
        const res = await fetch('/api/abonados/registrar/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.status !== 'success') {
            body().insertAdjacentHTML('afterbegin', showAlert(json.message || 'Error al registrar', 'danger'));
            return;
        }
        if (evidenciaFile) {
            await subirEvidenciaRegistro(json.data.cliente_id, evidenciaFile);
        }
        close();
        const pagoOk = json.data.pago_ejecutado?.comprobante?.numero;
        const pagoErr = json.data.pago_error;
        if (pagoErr) {
            alert(`Cliente registrado. Pago pendiente: ${pagoErr}`);
        } else if (pagoOk) {
            alert(`Registro completo. Comprobante: ${pagoOk}`);
        }
        window.location.href = `/abonados/${json.data.cliente_id}/?tab=pagos`;
    };

    const open = async (initial = {}) => {
        step = 0;
        state = { ...initial };
        evaluacion = null;
        evidenciaFile = null;
        if (initial.documento) state.documento = initial.documento;
        if (initial.nombre) state.nombre_apellidos = initial.nombre;
        if (initial.direccion) state.direccion_fiscal = initial.direccion;
        if (initial.fecha_nacimiento) state.cumpleanos = initial.fecha_nacimiento;
        if (initial.estado_civil) state.estado_civil = initial.estado_civil;
        if (initial.ubigeo) state.ubigeo = initial.ubigeo;
        if (initial.restricciones) state.restricciones_notificacion = initial.restricciones;
        if (initial.source) state.api_source = initial.source;
        const baseCtx = getAppCtx();
        ctx.vendedor = baseCtx;
        await fetchContexto(baseCtx.sede_id);
        overlay().classList.add('open');
        overlay().setAttribute('aria-hidden', 'false');
        renderStep();
    };

    const close = () => {
        overlay().classList.remove('open');
        overlay().setAttribute('aria-hidden', 'true');
    };

    document.getElementById('btnCerrarModalRegistro')?.addEventListener('click', close);
    overlay()?.addEventListener('click', (e) => { if (e.target === overlay()) close(); });

    document.getElementById('btnWizardPrev')?.addEventListener('click', () => {
        if (step > 0) {
            step -= 1;
            renderStep();
        }
    });

    document.getElementById('btnWizardNext')?.addEventListener('click', async () => {
        try {
            collectStep();
            if (step === STEPS.length - 1) {
                await registrar();
                return;
            }
            step += 1;
            if (step === 4) await fetchContexto(state.sede_id || ctx.vendedor?.sede_id);
            if (step === 5) await fetchEvaluacion();
            await renderStep();
        } catch (err) {
            body().insertAdjacentHTML('afterbegin', showAlert(err.message, 'danger'));
        }
    });

    window.AbonadosRegistro = { open, close };
})();

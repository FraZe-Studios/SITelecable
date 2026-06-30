/**
 * Wizard de registro de abonado:
 * Documento → Cliente → Suministro → Evaluación y Plan (con Pagos en tiempo real) → Confirmar
 */
(function () {
    console.log('AbonadosRegistro: Inicializando...');
    const STEPS = ['Documento', 'Cliente', 'Suministro', 'Evaluación y Plan', 'Confirmar'];
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
            
            const planOpts = mainPlanes.map(p => {
                const tipoIcon = p.tipo_servicio === 'INTERNET' ? '🌐' : p.tipo_servicio === 'TV' ? '📺' : p.tipo_servicio === 'DUO' ? '📡' : p.tipo_servicio === 'APP' ? '📱' : '📦';
                const beneficios = p.caracteristicas_tecnicas_json?.beneficios || [];
                const beneficiosText = beneficios.length > 0 ? ` (${beneficios.slice(0, 2).join(', ')})` : '';
                return `<option value="${p.id}" data-costo="${p.costo_plan}" data-tipo="${p.tipo_servicio}" ${String(state.plan_id) === String(p.id) ? 'selected' : ''}>${tipoIcon} ${p.nombre_plan} [${p.tipo_servicio}] — S/ ${p.costo_plan}${beneficiosText}</option>`;
            }).join('');
            
            const appOpts = appPlanes.map(p =>
                `<option value="${p.id}" data-costo="${p.costo_plan}" ${(state.app_ids || []).includes(p.id) ? 'selected' : ''}>${p.nombre_plan} — S/ ${p.costo_plan}</option>`
            ).join('');

            const selectedPlan = mainPlanes.find(p => String(p.id) === String(state.plan_id));
            const isDuoOrTv = selectedPlan && (selectedPlan.tipo_servicio === 'DUO' || selectedPlan.tipo_servicio === 'TV');
            if (isDuoOrTv) {
                state.tiene_anexos = true;
            }
            const numAnexos = state.num_anexos || (state.tiene_anexos ? 1 : 0);
            const hab = ctx.vendedor?.habilidades || {};
            const hg = hab; // Correct flat capabilities bug
            const maxDescuentoPlan = hg.planes_mensuales?.descuento_maximo_porcentaje || 0;
            const maxMesesGratis = hg.planes_mensuales?.meses_maximos || 0;
            const requiereAutorizacion = hg.planes_mensuales?.requiere_autorizacion_supervisor || false;
            
            const maxDescuentoDeuda = hg.deudas_antiguas?.descuento_maximo_porcentaje || 0;
            const maxCuotasDeuda = hg.deudas_antiguas?.cuotas_maximas || 0;
            const pctDescuentoDeuda = state.pct_descuento || 0;

            const maxDescuentoInstalacion = hg.tickets_cobro?.descuento_maximo_porcentaje || 0;
            const maxCuotasInstalacion = hg.tickets_cobro?.cuotas_maximas || 0;
            const pctDescuentoInstalacion = state.pct_descuento_instalacion || 0;
            const cuotasInstalacion = state.cuotas_instalacion || 1;

            // Calculate debt proration if debt exists
            const deudasCobrar = [
                ...(state.deudas_cliente || []),
                ...(state.deudas_sistema || []),
                ...(state.deudas_externas || []),
            ];
            const totalDeuda = deudasCobrar.reduce((sum, d) => sum + (d.monto_actual || 0), 0);
            const cuotasDeuda = state.cuotas_deuda || 1;
            const montoCuotaDeuda = cuotasDeuda > 1 ? (totalDeuda / cuotasDeuda).toFixed(2) : totalDeuda.toFixed(2);
            
            // Build options for wCuotasDeuda
            let cuotasDeudaOpts = `<option value="1" ${cuotasDeuda === 1 ? 'selected' : ''}>Pago único (S/ ${montoCuotaDeuda})</option>`;
            if (maxCuotasDeuda >= 3) {
                cuotasDeudaOpts += `<option value="3" ${cuotasDeuda === 3 ? 'selected' : ''}>3 cuotas de S/ ${(totalDeuda/3).toFixed(2)}</option>`;
            }
            if (maxCuotasDeuda >= 6) {
                cuotasDeudaOpts += `<option value="6" ${cuotasDeuda === 6 ? 'selected' : ''}>6 cuotas de S/ ${(totalDeuda/6).toFixed(2)}</option>`;
            }
            if (maxCuotasDeuda >= 12) {
                cuotasDeudaOpts += `<option value="12" ${cuotasDeuda === 12 ? 'selected' : ''}>12 cuotas de S/ ${(totalDeuda/12).toFixed(2)}</option>`;
            }

            // Build options for wCuotasInstalacion
            let cuotasInstalacionOpts = `<option value="1" ${cuotasInstalacion === 1 ? 'selected' : ''}>Pago único</option>`;
            if (maxCuotasInstalacion >= 3) {
                cuotasInstalacionOpts += `<option value="3" ${cuotasInstalacion === 3 ? 'selected' : ''}>3 cuotas</option>`;
            }
            if (maxCuotasInstalacion >= 6) {
                cuotasInstalacionOpts += `<option value="6" ${cuotasInstalacion === 6 ? 'selected' : ''}>6 cuotas</option>`;
            }
            if (maxCuotasInstalacion >= 12) {
                cuotasInstalacionOpts += `<option value="12" ${cuotasInstalacion === 12 ? 'selected' : ''}>12 cuotas</option>`;
            }

            // Costo de instalación guardado del ticket del catálogo (viene del último eval)
            const costoInstalacionCatalogo = state._costo_instalacion_base || null;

            // Build plan details card (cuadradito completo)
            let planDetailsHtml = '';
            if (selectedPlan) {
                const cb = selectedPlan.caracteristicas_tecnicas_json?.caracteristicas_base || {};
                const af = selectedPlan.caracteristicas_tecnicas_json?.activacion_funciones || {};
                const normalPrice = selectedPlan.costo_plan || 0;
                const earlyPaymentDiscount = selectedPlan.monto_descuento_pago_anticipado || 0;
                const earlyPaymentPrice = normalPrice - earlyPaymentDiscount;
                const earlyPaymentDays = selectedPlan.dias_anticipacion_descuento || 0;
                
                planDetailsHtml = `
                    <div class="ab-plan-card" style="grid-column: 1 / -1; background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                            <strong style="color:var(--text-primary); font-size: 0.9rem;">📦 Detalle del Plan: ${selectedPlan.nombre_plan}</strong>
                            <span style="font-size:0.75rem; font-weight:bold; padding:0.2rem 0.5rem; background:var(--primary-color); color:white; border-radius:12px;">${selectedPlan.tipo_servicio}</span>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; font-size:0.8rem;">
                            <!-- Precios -->
                            <div style="background:var(--bg-surface); padding:0.5rem; border-radius:var(--radius-sm); border-left:3px solid var(--accent-color);">
                                <div style="font-size:0.7rem; color:var(--text-muted);">Precio Normal</div>
                                <div style="font-weight:bold; font-size: 1rem; color:var(--text-primary);">S/ ${Number(normalPrice).toFixed(2)}</div>
                            </div>
                            
                            ${earlyPaymentDiscount > 0 ? `
                            <div style="background:rgba(34,197,94,0.1); padding:0.5rem; border-radius:var(--radius-sm); border-left:3px solid #22c55e;">
                                <div style="font-size:0.7rem; color:#15803d; font-weight:bold;">Precio Pago Anticipado</div>
                                <div style="font-weight:bold; font-size: 1rem; color:#15803d;">S/ ${Number(earlyPaymentPrice).toFixed(2)}</div>
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.25rem;">(Si paga con ${earlyPaymentDays} días de anticipación)</div>
                            </div>` : ''}

                            <!-- Costo de Instalación del catálogo -->
                            <div style="background:rgba(234,179,8,0.08); padding:0.5rem; border-radius:var(--radius-sm); border-left:3px solid #eab308;">
                                <div style="font-size:0.7rem; color:#92400e; font-weight:bold;">🔧 Costo de Instalación</div>
                                ${costoInstalacionCatalogo !== null ? `
                                <div style="font-weight:bold; font-size: 1rem; color:#92400e;">S/ ${Number(costoInstalacionCatalogo).toFixed(2)}</div>
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">Precio del ticket de campo</div>
                                ` : `
                                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem; font-style:italic;">Consultando catálogo...</div>
                                `}
                            </div>
                            
                            <!-- Características Base -->
                            <div style="background:var(--bg-surface); padding:0.5rem; border-radius:var(--radius-sm);">
                                <div style="font-size:0.7rem; color:var(--text-muted);">Características Técnicas</div>
                                <div style="color:var(--text-primary); font-weight: 500; margin-top: 0.25rem;">
                                    ${cb.velocidad_mbps ? `<div>⚡ Velocidad: ${cb.velocidad_mbps} Mbps</div>` : ''}
                                    ${cb.cantidad_canales ? `<div>📺 Canales: ${cb.cantidad_canales}</div>` : ''}
                                    ${selectedPlan.dias_gracia ? `<div>📅 Días gracia: ${selectedPlan.dias_gracia}</div>` : ''}
                                </div>
                            </div>

                            <!-- Configuración -->
                            <div style="background:var(--bg-surface); padding:0.5rem; border-radius:var(--radius-sm);">
                                <div style="font-size:0.7rem; color:var(--text-muted);">Configuración y Reglas</div>
                                <div style="color:var(--text-primary); font-size: 0.72rem; margin-top: 0.25rem; line-height: 1.3;">
                                    <div>📆 Vencimiento: ${selectedPlan.configuracion_fecha_pago === 'FECHA_INSTALACION' ? 'Instalación' : 'Fin de mes'}</div>
                                    <div>🔄 Prórrogas: ${af.admite_prorrogas ? '✅ Sí' : '❌ No'}</div>
                                    <div>🧩 Prorrateo: ${af.admite_prorrateo_parcial ? '✅ Sí' : '❌ No'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            b.innerHTML = `
                <div style="display:flex; gap:1.25rem; align-items:flex-start;">

                  <!-- COLUMNA IZQUIERDA: Formulario -->
                  <div style="flex:1; min-width:0;">
                    ${tieneDeuda
                        ? showAlert(`Deuda total: ${money(totalDeuda)}. Prorrateo: ${cuotasDeuda} cuotas de S/ ${montoCuotaDeuda}. Aplique descuento en pagos.`, 'warn')
                        : showAlert('Sin deudas cobrables. Seleccione su plan.', 'info')}
                    <h4 style="margin:0.5rem 0 0.25rem;font-size:0.75rem;">Deudas detectadas</h4>
                    ${renderDeudaPanel()}
                    ${tieneDeuda ? `
                    <div class="ab-form-grid" style="margin-top:0.5rem;">
                        <div class="ab-field">
                            <label>Descuento Deuda (%)</label>
                            <input type="number" id="wDescuentoDeuda" min="0" max="${maxDescuentoDeuda}" value="${pctDescuentoDeuda}" placeholder="0-${maxDescuentoDeuda}" ${maxDescuentoDeuda === 0 ? 'disabled' : ''}>
                        </div>
                        <div class="ab-field">
                            <label>Cuotas de Deuda</label>
                            <select id="wCuotasDeuda" ${maxCuotasDeuda <= 1 ? 'disabled' : ''}>
                                ${cuotasDeudaOpts}
                            </select>
                        </div>
                    </div>
                    <div class="ab-deuda-prorrateo" style="margin-top:0.25rem; padding:0.5rem; background:var(--bg-tertiary); border-radius:var(--radius-sm); font-size:0.75rem;">
                        <strong>Prorrateo actual:</strong> ${cuotasDeuda} cuotas de S/ ${montoCuotaDeuda} cada una
                    </div>` : ''}

                    <div class="ab-form-grid" style="margin-top:1rem;">
                        ${ctx.vendedor?.es_admin ? `
                        <div class="ab-field full"><label>Sede registro</label>
                            <select id="wSede">${sedeOpts}</select></div>` : ''}
                        <div class="ab-field full" style="display:flex; gap:0.5rem; align-items:flex-end;">
                            <div style="flex:1;">
                                <label>Plan *</label>
                                <select id="wPlan"><option value="">Seleccione...</option>${planOpts}</select>
                            </div>
                            <button type="button" id="btnAddPlan" style="padding:0.5rem 1rem; background:var(--primary-color); color:white; border:none; border-radius:var(--radius-sm); cursor:pointer; margin-bottom:0.25rem;">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>

                        ${planDetailsHtml}

                        ${state.planes_adicionales && state.planes_adicionales.length > 0 ? `
                        <div class="ab-field full" style="background:var(--bg-surface-active); padding:0.75rem; border-radius:var(--radius-sm); margin-top:0.5rem;">
                            <label style="font-size:0.7rem; font-weight:bold; margin-bottom:0.5rem;">Planes Adicionales:</label>
                            ${state.planes_adicionales.map((p, idx) => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.35rem; background:var(--bg-surface); border-radius:var(--radius-sm); margin-bottom:0.25rem;">
                                    <span style="font-size:0.75rem;">${p.nombre} — S/ ${p.costo}</span>
                                    <button type="button" class="btn-remove-plan" data-idx="${idx}" style="background:none; border:none; color:var(--error-color); cursor:pointer; font-size:0.9rem;">
                                        <i class="fa-solid fa-times"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>` : ''}

                        <div class="ab-field"><label>Descuento Plan (%)</label>
                            <input type="number" id="wDescuentoPlan" min="0" max="${maxDescuentoPlan}" value="${state.descuento_plan || 0}" placeholder="0-${maxDescuentoPlan}">
                        </div>
                        <div class="ab-field"><label>Meses de Descuento</label>
                            <input type="number" id="wMesesDescuento" min="0" max="${maxMesesGratis}" value="${state.meses_descuento || 0}" placeholder="0-${maxMesesGratis}">
                        </div>
                        ${requiereAutorizacion && state.descuento_plan > 50 ? `
                        <div class="ab-field full" style="background:var(--bg-warning); padding:0.5rem; border-radius:var(--radius-sm); border-left:3px solid var(--warning-color);">
                            <label style="color:var(--warning-color); font-weight:bold;">⚠ Requiere Autorización Supervisor</label>
                            <input type="text" id="wAutorizacionSup" placeholder="Ingrese código de autorización" style="margin-top:0.25rem;">
                        </div>` : ''}

                        <div class="ab-field"><label>Descuento Instalación (%)</label>
                            <input type="number" id="wDescuentoInstalacion" min="0" max="${maxDescuentoInstalacion}" value="${pctDescuentoInstalacion}" placeholder="0-${maxDescuentoInstalacion}" ${maxDescuentoInstalacion === 0 ? 'disabled' : ''}>
                        </div>
                        <div class="ab-field"><label>Cuotas Instalación</label>
                            <select id="wCuotasInstalacion" ${maxCuotasInstalacion <= 1 ? 'disabled' : ''}>
                                ${cuotasInstalacionOpts}
                            </select>
                        </div>

                        ${appPlanes.length > 0 ? `
                        <div class="ab-field full">
                            <label>Aplicaciones</label>
                            <select id="wApps"><option value="">Seleccione...</option>${appOpts}</select>
                        </div>
                        <div class="ab-field"><label>Descuento Apps (%)</label>
                            <input type="number" id="wDescuentoApps" min="0" max="${maxDescuentoPlan}" value="${state.pct_descuento_apps || 0}" placeholder="0-${maxDescuentoPlan}">
                        </div>
                        <div class="ab-field"><label>Meses de Descuento Apps</label>
                            <input type="number" id="wMesesDescuentoApps" min="0" max="${maxMesesGratis}" value="${state.meses_descuento_apps || 0}" placeholder="0-${maxMesesGratis}">
                        </div>` : ''}

                        <div class="ab-field">
                            <label>¿Tendrá anexos de TV?</label>
                            <select id="wTieneAnexos" ${isDuoOrTv ? 'disabled' : ''}>
                                <option value="no" ${!state.tiene_anexos ? 'selected' : ''}>No</option>
                                <option value="si" ${state.tiene_anexos ? 'selected' : ''}>Sí</option>
                            </select>
                        </div>

                        <div class="ab-field full" id="anexoContainer" style="display: ${state.tiene_anexos ? 'block' : 'none'};">
                            <label>Número de Anexos (TV/Duo)</label>
                            <input type="number" id="wNumAnexos" min="1" max="10" value="${numAnexos || 1}" placeholder="1">
                            <p class="ab-address" style="margin-top:0.25rem; font-size:0.75rem;">
                                <i class="fa-solid fa-info-circle"></i> El primer anexo es GRATIS al registro. Los adicionales se cobran mensualmente.
                            </p>
                        </div>

                        <div class="ab-field full" style="margin-top:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">
                                <i class="fa-solid fa-gift" style="color:var(--accent-color);"></i>
                                <label style="margin:0; font-weight:bold; font-size:0.8rem;">Beneficios y Notas</label>
                            </div>
                            <textarea id="wNotasBeneficios" rows="2"
                                style="width:100%; resize:vertical; font-size:0.8rem; box-sizing:border-box; padding:0.4rem; border:1px solid var(--border-color); border-radius:var(--radius-sm); background:var(--bg-surface); color:var(--text-primary);"
                                placeholder="Ej: Descuento por llamada de retención, cliente especial, acuerdo verbal...">${esc(state.notas_beneficios || '')}</textarea>
                            <p class="ab-address" style="margin-top:0.15rem; font-size:0.7rem;">
                                <i class="fa-solid fa-info-circle"></i> Esta nota queda registrada en la ficha del cliente. El descuento se aplica según el porcentaje configurado.
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
                            <li style="margin-bottom:0.25rem;">Los descuentos aplican por el tiempo indicado y luego vuelven al precio normal del plan.</li>
                            <li>Los tickets se distribuyen automáticamente a sus servicios correspondientes.</li>
                        </ul>
                    </div>
                    ${showAlert('El plan se filtra por la sede del vendedor y tipo de cliente. Contrato a nombre de: ' + esc(ctx.vendedor?.personal_nombre), 'info')}
                  </div>

                  <!-- COLUMNA DERECHA: Calculadora en tiempo real -->
                  <div style="width:285px; flex-shrink:0;">
                    <div class="ab-payment-preview" style="padding:1rem; background:var(--bg-surface-active); border-radius:var(--radius-md); border:1px solid var(--border-color); position:sticky; top:0.5rem;">
                        <h4 style="margin:0 0 0.75rem 0; font-size:0.85rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                            <i class="fa-solid fa-calculator" style="color:var(--accent-color);"></i>
                            Resumen de Pagos
                        </h4>
                        <div id="paymentPreviewContent" style="font-size:0.8rem;">
                            <p style="color:var(--text-muted); font-size:0.75rem;">Seleccione un plan para ver el resumen de pagos...</p>
                        </div>
                    </div>
                  </div>

                </div>`;

            document.getElementById('wSede')?.addEventListener('change', async (e) => {
                state.sede_id = e.target.value;
                await fetchContexto(state.sede_id);
                renderStep();
            });

            document.getElementById('wPlan')?.addEventListener('change', (e) => {
                const opt = e.target.selectedOptions[0];
                state.plan_id = e.target.value;
                state.costo_plan = opt?.dataset.costo || 0;
                state.tipo_servicio = opt?.dataset.tipo || '';
                
                const isDuoOrTv = state.tipo_servicio === 'DUO' || state.tipo_servicio === 'TV';
                state.tiene_anexos = isDuoOrTv;
                if (!state.tiene_anexos) {
                    state.num_anexos = 0;
                } else if (!state.num_anexos) {
                    state.num_anexos = 1;
                }
                renderStep();
            });

            document.getElementById('wTieneAnexos')?.addEventListener('change', (e) => {
                state.tiene_anexos = e.target.value === 'si';
                if (!state.tiene_anexos) {
                    state.num_anexos = 0;
                } else if (!state.num_anexos) {
                    state.num_anexos = 1;
                }
                renderStep();
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
                    // Actualizar calculadora (para mostrar orden de instalación de app)
                    updatePaymentPreview();
                });
            }

            const numAnexosEl = document.getElementById('wNumAnexos');
            if (numAnexosEl) {
                numAnexosEl.addEventListener('change', (e) => {
                    state.num_anexos = parseInt(e.target.value) || 0;
                    // Calculate anexos cost (first is free, rest are charged)
                    const plan = mainPlanes.find(p => String(p.id) === String(state.plan_id));
                    if (plan && (plan.tipo_servicio === 'DUO' || plan.tipo_servicio === 'TV')) {
                        const anexosCobrables = Math.max(0, state.num_anexos - 1);
                        // Assuming each additional anexo costs S/ 15 (this should come from plan config)
                        const costoPorAnexo = 15;
                        state.costo_anexos = anexosCobrables * costoPorAnexo;
                    } else {
                        state.costo_anexos = 0;
                    }
                });
            }

            const descuentoPlanEl = document.getElementById('wDescuentoPlan');
            if (descuentoPlanEl) {
                descuentoPlanEl.addEventListener('change', (e) => {
                    state.descuento_plan = parseFloat(e.target.value) || 0;
                });
            }

            const mesesDescuentoEl = document.getElementById('wMesesDescuento');
            if (mesesDescuentoEl) {
                mesesDescuentoEl.addEventListener('change', (e) => {
                    state.meses_descuento = parseInt(e.target.value) || 0;
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

            // Add plan button handler
            const btnAddPlan = document.getElementById('btnAddPlan');
            if (btnAddPlan) {
                btnAddPlan.addEventListener('click', () => {
                    const planSelect = document.getElementById('wPlan');
                    const selectedOption = planSelect.options[planSelect.selectedIndex];
                    if (!selectedOption || !selectedOption.value) {
                        alert('Seleccione un plan primero');
                        return;
                    }
                    
                    const planId = selectedOption.value;
                    const planName = selectedOption.text;
                    const planCost = selectedOption.dataset.costo;
                    const planTipo = selectedOption.dataset.tipo;
                    
                    // Check if plan is already in additional plans
                    if (!state.planes_adicionales) state.planes_adicionales = [];
                    if (state.planes_adicionales.some(p => p.id === planId)) {
                        alert('Este plan ya está agregado');
                        return;
                    }
                    
                    // Add to additional plans
                    state.planes_adicionales.push({
                        id: planId,
                        nombre: planName,
                        costo: planCost,
                        tipo: planTipo
                    });
                    
                    // Clear the selection
                    planSelect.value = '';
                    
                    // Re-render to show additional plans
                    renderStep();
                });
            }

            // Remove plan button handlers
            document.querySelectorAll('.btn-remove-plan').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.dataset.idx);
                    if (!isNaN(idx) && state.planes_adicionales) {
                        state.planes_adicionales.splice(idx, 1);
                        renderStep();
                    }
                });
            });

            // Function to update payment preview in real-time
            const updatePaymentPreview = async () => {
                const previewContent = document.getElementById('paymentPreviewContent');
                if (!previewContent) return;

                try {
                    // Recopilar datos actuales del formulario
                    state.plan_id = document.getElementById('wPlan')?.value;
                    state.tiene_anexos = document.getElementById('wTieneAnexos')?.value === 'si';
                    state.num_anexos = state.tiene_anexos ? (parseInt(document.getElementById('wNumAnexos')?.value) || 1) : 0;
                    state.descuento_plan = parseFloat(document.getElementById('wDescuentoPlan')?.value) || 0;
                    // Fix: evaluacion.py usa 'pct_descuento_plan' como nombre canónico
                    state.pct_descuento_plan = state.descuento_plan;
                    state.meses_descuento = parseInt(document.getElementById('wMesesDescuento')?.value) || 0;
                    state.pct_descuento_instalacion = parseFloat(document.getElementById('wDescuentoInstalacion')?.value) || 0;
                    state.cuotas_instalacion = parseInt(document.getElementById('wCuotasInstalacion')?.value) || 1;
                    state.pct_descuento = parseFloat(document.getElementById('wDescuentoDeuda')?.value) || 0;
                    state.cuotas = parseInt(document.getElementById('wCuotasDeuda')?.value) || 1;
                    state.cuotas_deuda = state.cuotas;
                    state.pct_descuento_apps = parseFloat(document.getElementById('wDescuentoApps')?.value) || 0;
                    state.meses_descuento_apps = parseInt(document.getElementById('wMesesDescuentoApps')?.value) || 0;
                    state.notas_beneficios = document.getElementById('wNotasBeneficios')?.value || '';

                    if (!state.plan_id) {
                        previewContent.innerHTML = '<p style="color:var(--text-muted); font-size:0.75rem;">Seleccione un plan para ver el resumen de pagos...</p>';
                        return;
                    }

                    // Llamar evaluación con los datos actuales
                    const ev = await fetchEvaluacion();
                    
                    const selectedPlan = mainPlanes.find(p => String(p.id) === String(state.plan_id));
                    const planCost = ev.costo_plan_mensual || 0;
                    const planCostWithDiscount = ev.costo_plan_con_descuento || 0;
                    const discountAmount = planCost - planCostWithDiscount;
                    const anexosCost = ev.costo_anexos || 0;
                    const appsCost = ev.costo_apps_mensual || 0;
                    const appsCostWithDiscount = ev.costo_apps_con_descuento || 0;
                    const discountAppsAmount = appsCost - appsCostWithDiscount;
                    const totalCobrar = ev.total_cobrar_ahora || 0;

                    // Guardar costo de instalación en state para mostrar en el plan details card
                    const costoInstalacionBase = ev.costo_instalacion_base || 0;
                    if (state._costo_instalacion_base !== costoInstalacionBase) {
                        state._costo_instalacion_base = costoInstalacionBase;
                        // Actualizar el cuadrito de costo de instalación del plan card si ya está visible
                        const instCardEl = document.querySelector('[data-inst-costo]');
                        if (instCardEl) {
                            instCardEl.textContent = `S/ ${costoInstalacionBase.toFixed(2)}`;
                        }
                    }

                    // Debt calculations
                    const db = ev.deuda_bruta || 0;
                    const dd = ev.descuento_monto || 0;
                    const dp = ev.deuda_a_pagar || 0;
                    const dca = ev.deuda_cobrar_ahora || 0;
                    const dcu = ev.cuotas_liberacion || 1;

                    // Installation calculations
                    const ib = ev.costo_instalacion_base || 0;
                    const ic = ev.costo_instalacion || 0;
                    const id = ib - ic;
                    const ica = ev.instalacion_cobrar_ahora || 0;
                    const icu = ev.cuotas_instalacion || 1;

                    const normalPlanApps = planCost + appsCost;
                    const discountPlanApps = discountAmount + discountAppsAmount;
                    const finalPlanApps = planCostWithDiscount + appsCostWithDiscount;

                    let html = `<div style="display:flex; flex-direction:column; gap:0.75rem;">`;

                    // --- PLAN Y APLICATIVOS ---
                    const esGratisPlan = (state.descuento_plan || 0) >= 100 && (state.meses_descuento || 0) > 0;
                    const esGratisApps = (state.pct_descuento_apps || 0) >= 100 && (state.meses_descuento_apps || 0) > 0;
                    html += `
                        <div style="background:var(--bg-surface); padding:0.65rem; border-radius:var(--radius-sm); border-left:3px solid var(--accent-color);">
                            <div style="font-weight:bold; font-size:0.75rem; margin-bottom:0.35rem; color:var(--text-primary);">Plan y Aplicativos</div>
                            <div style="display:grid; grid-template-columns: 1fr auto; gap:0.25rem 1rem; font-size:0.72rem; color:var(--text-muted);">
                                <span>Precio Normal:</span>
                                <span style="font-weight:500; color:var(--text-primary);">${money(normalPlanApps)}</span>
                                ${discountPlanApps > 0 ? `
                                <span style="color:#15803d; font-weight:bold;">Descuento (${state.descuento_plan}%):</span>
                                <span style="font-weight:bold; color:#15803d;">-${money(discountPlanApps)}</span>
                                ` : ''}
                                ${(esGratisPlan || esGratisApps) ? `
                                <span style="grid-column:span 2; text-align:center; padding:0.4rem 0.5rem; background:rgba(34,197,94,0.15); border-radius:6px; color:#15803d; font-weight:bold; font-size:0.78rem; margin-top:0.25rem; letter-spacing:0.02em;">
                                    🎉 ${esGratisPlan ? `GRATIS por ${state.meses_descuento} mes${state.meses_descuento > 1 ? 'es' : ''}` : ''}
                                    ${esGratisApps && !esGratisPlan ? `Apps GRATIS por ${state.meses_descuento_apps} mes${state.meses_descuento_apps > 1 ? 'es' : ''}` : ''}
                                </span>
                                ` : `
                                <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">Subtotal Plan & Apps:</span>
                                <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">${money(finalPlanApps)}</span>
                                `}
                            </div>
                        </div>
                    `;

                    // --- INSTALACIÓN (siempre visible cuando hay plan) ---
                    const esGratisInstalacion = ic === 0 && ib > 0;
                    html += `
                        <div style="background:var(--bg-surface); padding:0.65rem; border-radius:var(--radius-sm); border-left:3px solid #eab308;">
                            <div style="font-weight:bold; font-size:0.75rem; margin-bottom:0.35rem; color:var(--text-primary);">
                                <i class="fa-solid fa-wrench" style="color:#eab308; margin-right:4px;"></i>
                                Ticket de Instalación
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr auto; gap:0.25rem 1rem; font-size:0.72rem; color:var(--text-muted);">
                                <span>Precio Normal:</span>
                                <span style="font-weight:500; color:var(--text-primary);">${money(ib)}</span>
                                ${id > 0 ? `
                                <span style="color:#15803d; font-weight:bold;">Descuento (${state.pct_descuento_instalacion || 0}%):</span>
                                <span style="font-weight:bold; color:#15803d;">-${money(id)}</span>
                                ` : ''}
                                ${esGratisInstalacion ? `
                                <span style="grid-column:span 2; text-align:center; padding:0.35rem 0.5rem; background:rgba(34,197,94,0.15); border-radius:6px; color:#15803d; font-weight:bold; font-size:0.78rem; margin-top:0.2rem;">
                                    🎉 INSTALACIÓN GRATIS
                                </span>
                                ` : `
                                <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">Instalación a Cobrar:</span>
                                <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">${money(ic)}</span>
                                `}
                                ${icu > 1 ? `
                                <span style="font-style:italic; font-size:0.65rem; grid-column:span 2; margin-top:0.25rem; color:var(--accent-color);">
                                    * Prorrateado en ${icu} cuotas de ${money(ica)} c/u (Cobrar ahora: ${money(ica)}).
                                </span>
                                ` : ''}
                            </div>
                        </div>
                    `;

                    // --- ORDEN DE INSTALACIÓN DE APPS (siempre se genera si hay apps, costo S/0) ---
                    const appsSeleccionadas = ev.apps_nombres || [];
                    if (appsSeleccionadas.length > 0) {
                        html += `
                        <div style="background:var(--bg-surface); padding:0.65rem; border-radius:var(--radius-sm); border-left:3px solid #8b5cf6;">
                            <div style="font-weight:bold; font-size:0.75rem; margin-bottom:0.35rem; color:var(--text-primary);">
                                <i class="fa-solid fa-mobile-screen" style="color:#8b5cf6; margin-right:4px;"></i>
                                Orden de Instalación de Aplicativos
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr auto; gap:0.25rem 1rem; font-size:0.72rem; color:var(--text-muted);">
                                <span>Aplicativos:</span>
                                <span style="font-weight:500; color:var(--text-primary); text-align:right; font-size:0.68rem;">${appsSeleccionadas.join(', ')}</span>
                                <span>Costo de Instalación:</span>
                                <span style="font-weight:bold; color:#15803d;">GRATIS</span>
                                <span style="font-style:italic; font-size:0.65rem; grid-column:span 2; color:var(--text-muted); margin-top:0.1rem;">
                                    Se generará una orden de activación automáticamente al registrar.
                                </span>
                            </div>
                        </div>
                        `;
                    }

                    // --- ANEXOS ---
                    if (state.tiene_anexos && state.num_anexos > 0) {
                        const baseAnexoCosto = ev.costo_anexo_base || 15.00;
                        const cobrables = Math.max(0, state.num_anexos - 1);
                        const anexosBaseTotal = cobrables * baseAnexoCosto;
                        const anexosDiscount = ev.descuento_anexos || 0;
                        const anexosDiscountPct = ev.pct_descuento_anexos_aplicado || 0;
                        html += `
                            <div style="background:var(--bg-surface); padding:0.65rem; border-radius:var(--radius-sm); border-left:3px solid #3b82f6;">
                                <div style="font-weight:bold; font-size:0.75rem; margin-bottom:0.35rem; color:var(--text-primary);">Anexos de TV</div>
                                <div style="display:grid; grid-template-columns: 1fr auto; gap:0.25rem 1rem; font-size:0.72rem; color:var(--text-muted);">
                                    <span>Cantidad de Anexos:</span>
                                    <span style="font-weight:500; color:var(--text-primary);">${state.num_anexos}</span>
                                    <span>Precio Unitario:</span>
                                    <span style="font-weight:500; color:var(--text-primary);">${money(baseAnexoCosto)}</span>
                                    <span>Costo Base (${cobrables} cobrados):</span>
                                    <span style="font-weight:500; color:var(--text-primary);">${money(anexosBaseTotal)}</span>
                                    ${anexosDiscount > 0 ? `
                                    <span style="color:#15803d; font-weight:bold;">Descuento (${anexosDiscountPct}%):</span>
                                    <span style="font-weight:bold; color:#15803d;">-${money(anexosDiscount)}</span>
                                    ` : ''}
                                    <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">Costo Mensual Adicional:</span>
                                    <span style="font-weight:bold; color:#1d4ed8; border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">${money(anexosCost)}</span>
                                    <span style="font-style:italic; font-size:0.65rem; grid-column:span 2; margin-top:0.15rem; color:var(--text-muted);">
                                        (El primer anexo es gratis; ${cobrables} cobrados).
                                    </span>
                                </div>
                            </div>
                        `;
                    }

                    // --- DEUDAS ---
                    if (db > 0) {
                        html += `
                            <div style="background:rgba(239,68,68,0.03); padding:0.65rem; border-radius:var(--radius-sm); border-left:3px solid #ef4444; border:1px dashed rgba(239,68,68,0.2);">
                                <div style="font-weight:bold; font-size:0.75rem; margin-bottom:0.35rem; color:#b91c1c;">Deudas Anteriores</div>
                                <div style="display:grid; grid-template-columns: 1fr auto; gap:0.25rem 1rem; font-size:0.72rem; color:var(--text-muted);">
                                    <span>Monto Deuda Bruta:</span>
                                    <span style="font-weight:500; color:var(--text-primary);">${money(db)}</span>
                                    ${dd > 0 ? `
                                    <span style="color:#15803d; font-weight:bold;">Descuento:</span>
                                    <span style="font-weight:bold; color:#15803d;">-${money(dd)}</span>
                                    ` : ''}
                                    <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid rgba(239,68,68,0.1); padding-top:0.25rem; margin-top:0.25rem;">Deuda a Cobrar:</span>
                                    <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid rgba(239,68,68,0.1); padding-top:0.25rem; margin-top:0.25rem;">${money(dp)}</span>
                                    ${dcu > 1 ? `
                                    <span style="font-style:italic; font-size:0.65rem; grid-column:span 2; margin-top:0.15rem; color:#b91c1c;">
                                        * Prorrateado en ${dcu} cuotas (Cobrar ahora: ${money(dca)}).
                                    </span>
                                    ` : ''}
                                </div>
                            </div>
                        `;

                        // Sync dynamic info text on step 3 if elements exist
                        const prorrateoEl = document.querySelector('.ab-deuda-prorrateo');
                        if (prorrateoEl) {
                            prorrateoEl.innerHTML = `<strong>Prorrateo actual:</strong> ${dcu} cuotas de ${money(dcu > 1 ? ev.deuda_cuota_mensual : dp)} cada una`;
                        }
                        const alertEl = document.querySelector('.ab-alert-warn');
                        if (alertEl) {
                            alertEl.innerHTML = `Deuda total: ${money(db)}. Descuento: ${money(dd)}. Prorrateo: ${dcu} cuotas de ${money(dcu > 1 ? ev.deuda_cuota_mensual : dp)}.`;
                        }
                    }

                    html += `</div>`; // Close column flex

                    // Total to Collect Now
                    html += `
                        <div style="margin-top:0.75rem; padding:0.75rem; background:var(--primary-color); color:white; border-radius:var(--radius-sm); text-align:center;">
                            <div style="font-size:0.7rem; opacity:0.9;">Total a Cobrar Ahora</div>
                            <div style="font-size:1.1rem; font-weight:bold;">${money(totalCobrar)}</div>
                        </div>
                    `;

                    // Payment mode info
                    const modoPago = state.modo_pago_plan || 'FIN_MES';
                    html += `
                        <div style="margin-top:0.5rem; padding:0.5rem; background:var(--bg-surface); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;">Modo de Pago del Plan</div>
                            <div style="font-weight:bold; color:var(--text-primary); font-size:0.8rem;">
                                ${modoPago === 'CONTADO' ? '💵 Contado (Pago Adelantado)' : '📅 Fin de Mes'}
                            </div>
                            <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.15rem;">
                                ${modoPago === 'CONTADO' ? 'El plan se paga ahora al registrarse' : 'El primer pago del plan será al fin del mes'}
                            </div>
                        </div>
                    `;

                    if (state.meses_descuento > 0) {
                        html += `
                            <div style="margin-top:0.5rem; font-size:0.7rem; color:var(--text-muted); text-align:center;">
                                <i class="fa-solid fa-info-circle"></i> Descuento de plan aplicado por ${state.meses_descuento} mes${state.meses_descuento > 1 ? 'es' : ''}
                            </div>
                        `;
                    }
                    if (state.meses_descuento_apps > 0) {
                        html += `
                            <div style="margin-top:0.25rem; font-size:0.7rem; color:var(--text-muted); text-align:center;">
                                <i class="fa-solid fa-info-circle"></i> Descuento de apps aplicado por ${state.meses_descuento_apps} mes${state.meses_descuento_apps > 1 ? 'es' : ''}
                            </div>
                        `;
                    }

                    previewContent.innerHTML = html;
                } catch (error) {
                    previewContent.innerHTML = `<p style="color:var(--error-color);">Error al calcular: ${error.message}</p>`;
                }
            };

            // Eventos para actualización en tiempo real (change + input para números)
            ['wTieneAnexos', 'wDescuentoPlan', 'wMesesDescuento', 'wNumAnexos', 'wApps', 'wOmitirPagoApps', 'wDescuentoInstalacion', 'wCuotasInstalacion', 'wDescuentoDeuda', 'wCuotasDeuda', 'wDescuentoApps', 'wMesesDescuentoApps'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', updatePaymentPreview);
                    // También escuchar 'input' para actualización mientras se escribe
                    if (el.type === 'number' || el.tagName === 'SELECT') {
                        el.addEventListener('input', updatePaymentPreview);
                    }
                }
            });

            // Recopilar notas_beneficios cuando el usuario escribe
            const notasEl = document.getElementById('wNotasBeneficios');
            if (notasEl) {
                notasEl.addEventListener('input', (e) => {
                    state.notas_beneficios = e.target.value || '';
                });
            }

            // Vista previa inicial si ya hay un plan seleccionado
            if (state.plan_id) {
                updatePaymentPreview();
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
            state.tiene_anexos = document.getElementById('wTieneAnexos')?.value === 'si';
            state.num_anexos = state.tiene_anexos ? (parseInt(document.getElementById('wNumAnexos')?.value) || 1) : 0;
            state.descuento_plan = parseFloat(document.getElementById('wDescuentoPlan')?.value) || 0;
            // Fix: alias para el backend que usa 'pct_descuento_plan'
            state.pct_descuento_plan = state.descuento_plan;
            state.meses_descuento = parseInt(document.getElementById('wMesesDescuento')?.value) || 0;
            state.pct_descuento_instalacion = parseFloat(document.getElementById('wDescuentoInstalacion')?.value) || 0;
            state.cuotas_instalacion = parseInt(document.getElementById('wCuotasInstalacion')?.value) || 1;
            state.pct_descuento = parseFloat(document.getElementById('wDescuentoDeuda')?.value) || 0;
            state.cuotas = parseInt(document.getElementById('wCuotasDeuda')?.value) || 1;
            state.cuotas_deuda = state.cuotas;
            state.pct_descuento_apps = parseFloat(document.getElementById('wDescuentoApps')?.value) || 0;
            state.meses_descuento_apps = parseInt(document.getElementById('wMesesDescuentoApps')?.value) || 0;
            state.autorizacion_supervisor = document.getElementById('wAutorizacionSup')?.value?.trim() || '';
            state.notas_beneficios = document.getElementById('wNotasBeneficios')?.value || state.notas_beneficios || '';

            // Ensure app_ids and planes_adicionales are set
            state.app_ids = state.app_ids || [];
            state.planes_adicionales = state.planes_adicionales || [];
            
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
                    meses_descuento: state.meses_descuento,
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

            // Copy evaluated totals to root payload for backend compatibility
            if (state.evaluacion) {
                state.costo_instalacion = state.evaluacion.costo_instalacion;
                state.costo_plan_con_descuento = state.evaluacion.costo_plan_con_descuento;
                state.total_cobrar_ahora = state.evaluacion.total_cobrar_ahora;
            }
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
    console.log('AbonadosRegistro: Module loaded and window.AbonadosRegistro set');
})();

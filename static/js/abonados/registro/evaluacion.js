/**
 * evaluacion.js - Asistente de Registro: Paso 3 (Evaluación de Plan)
 */
(function() {
    'use strict';
    
    const stepIndex = 3;
    
    const renderDeudaPanel = () => {
        const state = window.AbonadosRegistro.state;
        const esc = window.AbonadosRegistro.esc;
        const money = window.AbonadosRegistro.money;
        const showAlert = window.AbonadosRegistro.showAlert;
        
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
    
    const render = async (bodyEl) => {
        const state = window.AbonadosRegistro.state;
        const ctx = window.AbonadosRegistro.ctx;
        const esc = window.AbonadosRegistro.esc;
        const money = window.AbonadosRegistro.money;
        const showAlert = window.AbonadosRegistro.showAlert;
        const tieneDeudaCobrar = window.AbonadosRegistro.tieneDeudaCobrar;
        const fetchContexto = window.AbonadosRegistro.fetchContexto;
        const renderStep = window.AbonadosRegistro.renderStep;
        const fetchEvaluacion = window.AbonadosRegistro.fetchEvaluacion;
        
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
                            <div style="font-weight:bold; font-size: 1rem; color:#92400e;" data-inst-costo>S/ ${Number(costoInstalacionCatalogo).toFixed(2)}</div>
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

        bodyEl.innerHTML = `
            <div style="display:flex; gap:1.25rem; align-items:flex-start;">

              <!-- COLUMNA IZQUIERDA: Formulario -->
              <div style="flex:1; min-width:0;">
                ${tieneDeuda
                    ? showAlert(`Deuda total: ${money(totalDeuda)}. Prorrateo: ${cuotasDeuda} cuotas de S/ ${montoCuotaDeuda}. Aplique descuento en pagos.`, 'warn')
                    : showAlert('Sin deudas cobrables. Seleccione su plan.', 'info')}
                <div class="deuda-panel-container">
                    ${renderDeudaPanel()}
                </div>
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
                                <div style="display:flex; gap:0.5rem; align-items:center;">
                                    <button type="button" class="btn-info-plan" data-idx="${idx}" style="background:none; border:none; color:var(--accent-color); cursor:pointer; font-size:0.9rem;" title="Ver información">
                                        <i class="fa-solid fa-circle-question"></i>
                                    </button>
                                    <button type="button" class="btn-remove-plan" data-idx="${idx}" style="background:none; border:none; color:var(--error-color); cursor:pointer; font-size:0.9rem;">
                                        <i class="fa-solid fa-times"></i>
                                    </button>
                                </div>
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
                        <input type="text" id="wAutorizacionSup" placeholder="Ingrese código de autorización" value="${esc(state.autorizacion_supervisor || '')}" style="margin-top:0.25rem;">
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
                    </div>

                </div>

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

        // Event listeners
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

        const appsEl = document.getElementById('wApps');
        if (appsEl) {
            appsEl.addEventListener('change', () => {
                const selectedValue = appsEl.value;
                state.app_ids = selectedValue ? [parseInt(selectedValue)] : [];
                let total = Number(state.costo_plan) || 0;
                state.app_ids.forEach(appId => {
                    const app = appPlanes.find(ap => ap.id === appId);
                    if (app) total += Number(app.costo_plan);
                });
                state.costo_plan_total = total;
                updatePaymentPreview();
            });
        }

        const numAnexosEl = document.getElementById('wNumAnexos');
        if (numAnexosEl) {
            numAnexosEl.addEventListener('change', (e) => {
                state.num_anexos = parseInt(e.target.value) || 0;
                const plan = mainPlanes.find(p => String(p.id) === String(state.plan_id));
                if (plan && (plan.tipo_servicio === 'DUO' || plan.tipo_servicio === 'TV')) {
                    const anexosCobrables = Math.max(0, state.num_anexos - 1);
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
                renderStep();
            });
        }

        const autorizacionSupEl = document.getElementById('wAutorizacionSup');
        if (autorizacionSupEl) {
            autorizacionSupEl.addEventListener('change', (e) => {
                state.autorizacion_supervisor = e.target.value?.trim() || '';
            });
        }

        const btnAddPlan = document.getElementById('btnAddPlan');
        if (btnAddPlan) {
            btnAddPlan.addEventListener('click', () => {
                const planSelect = document.getElementById('wPlan');
                const selectedOption = planSelect.options[planSelect.selectedIndex];
                if (!selectedOption || !selectedOption.value) {
                    SITAlert.show('Seleccione un plan primero.', 'warning');
                    return;
                }
                
                const planId = selectedOption.value;
                const planName = selectedOption.text;
                const planCost = selectedOption.dataset.costo;
                const planTipo = selectedOption.dataset.tipo;
                
                if (!state.planes_adicionales) state.planes_adicionales = [];
                if (state.planes_adicionales.some(p => p.id === planId)) {
                    SITAlert.show('Este plan ya está agregado.', 'warning');
                    return;
                }
                
                state.planes_adicionales.push({
                    id: planId,
                    nombre: planName,
                    costo: planCost,
                    tipo: planTipo
                });
                
                planSelect.value = '';
                renderStep();
            });
        }

        document.querySelectorAll('.btn-remove-plan').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.idx);
                if (!isNaN(idx) && state.planes_adicionales) {
                    state.planes_adicionales.splice(idx, 1);
                    renderStep();
                }
            });
        });

        document.querySelectorAll('.btn-info-plan').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ctx = window.AbonadosRegistro.ctx;
                const mensaje = `Esta nota queda registrada en la ficha del cliente. El descuento se aplica según el porcentaje configurado.<br><br>
<strong>Advertencias y Consejos</strong><br>
• Si el cliente excede los 100 metros de fibra, pagará exceso de instalación.<br>
• El anexo gratis solo aplica al momento del registro. Después se cobra el valor mensual.<br>
• Los descuentos aplican por el tiempo indicado y luego vuelven al precio normal del plan.<br>
• Los tickets se distribuyen automáticamente a sus servicios correspondientes.<br>
• El plan se filtra por la sede del vendedor y tipo de cliente. Contrato a nombre de: ${ctx.vendedor?.personal_nombre || 'Administrador Principal del Sistema'}`;
                SITAlert.show(mensaje, 'info', 0);
            });
        });

        const updatePaymentPreview = async () => {
            const previewContent = document.getElementById('paymentPreviewContent');
            if (!previewContent) return;

            try {
                state.plan_id = document.getElementById('wPlan')?.value;
                state.tiene_anexos = document.getElementById('wTieneAnexos')?.value === 'si';
                state.num_anexos = state.tiene_anexos ? (parseInt(document.getElementById('wNumAnexos')?.value) || 1) : 0;
                state.descuento_plan = parseFloat(document.getElementById('wDescuentoPlan')?.value) || 0;
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

                const ev = await fetchEvaluacion();
                const planCost = ev.costo_plan_mensual || 0;
                const planCostWithDiscount = ev.costo_plan_con_descuento || 0;
                const discountAmount = planCost - planCostWithDiscount;
                const anexosCost = ev.costo_anexos || 0;
                const appsCost = ev.costo_apps_mensual || 0;
                const appsCostWithDiscount = ev.costo_apps_con_descuento || 0;
                const discountAppsAmount = appsCost - appsCostWithDiscount;
                const totalCobrar = ev.total_cobrar_ahora || 0;

                const costoInstalacionBase = ev.costo_instalacion_base || 0;
                if (state._costo_instalacion_base !== costoInstalacionBase) {
                    state._costo_instalacion_base = costoInstalacionBase;
                    const instCardEl = document.querySelector('[data-inst-costo]');
                    if (instCardEl) {
                        instCardEl.textContent = `S/ ${costoInstalacionBase.toFixed(2)}`;
                    }
                }

                const db = ev.deuda_bruta || 0;
                const dd = ev.descuento_monto || 0;
                const dp = ev.deuda_a_pagar || 0;
                const dca = ev.deuda_cobrar_ahora || 0;
                const dcu = ev.cuotas_liberacion || 1;

                const ib = ev.costo_instalacion_base || 0;
                const ic = ev.costo_instalacion || 0;
                const id = ib - ic;
                const ica = ev.instalacion_cobrar_ahora || 0;
                const icu = ev.cuotas_instalacion || 1;

                const normalPlanApps = planCost + appsCost;
                const discountPlanApps = discountAmount + discountAppsAmount;
                const finalPlanApps = planCostWithDiscount + appsCostWithDiscount;

                let html = `<div style="display:flex; flex-direction:column; gap:0.75rem;">`;

                // --- PLAN ---
                const esGratisPlan = (state.descuento_plan || 0) >= 100 && (state.meses_descuento || 0) > 0;
                html += `
                    <div style="background:var(--bg-surface); padding:0.65rem; border-radius:var(--radius-sm); border-left:3px solid var(--accent-color);">
                        <div style="font-weight:bold; font-size:0.75rem; margin-bottom:0.35rem; color:var(--text-primary);">Plan</div>
                        <div style="display:grid; grid-template-columns: 1fr auto; gap:0.25rem 1rem; font-size:0.72rem; color:var(--text-muted);">
                            <span>Precio Normal:</span>
                            <span style="font-weight:500; color:var(--text-primary);">${money(planCost)}</span>
                            ${discountAmount > 0 ? `
                            <span style="color:#15803d; font-weight:bold;">Descuento (${state.descuento_plan}%):</span>
                            <span style="font-weight:bold; color:#15803d;">-${money(discountAmount)}</span>
                            ` : ''}
                            ${esGratisPlan ? `
                            <span style="grid-column:span 2; text-align:center; padding:0.4rem 0.5rem; background:rgba(34,197,94,0.15); border-radius:6px; color:#15803d; font-weight:bold; font-size:0.78rem; margin-top:0.25rem; letter-spacing:0.02em;">
                                🎉 GRATIS por ${state.meses_descuento} mes${state.meses_descuento > 1 ? 'es' : ''}
                            </span>
                            ` : `
                            <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">Subtotal Plan:</span>
                            <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">${money(planCostWithDiscount)}</span>
                            `}
                        </div>
                    </div>
                `;

                // --- APLICATIVOS ---
                const esGratisApps = (state.pct_descuento_apps || 0) >= 100 && (state.meses_descuento_apps || 0) > 0;
                if (appsCost > 0 || state.app_ids?.length > 0) {
                    html += `
                        <div style="background:var(--bg-surface); padding:0.65rem; border-radius:var(--radius-sm); border-left:3px solid #8b5cf6;">
                            <div style="font-weight:bold; font-size:0.75rem; margin-bottom:0.35rem; color:var(--text-primary);">
                                <i class="fa-solid fa-mobile-screen" style="color:#8b5cf6; margin-right:4px;"></i>
                                Aplicativos
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr auto; gap:0.25rem 1rem; font-size:0.72rem; color:var(--text-muted);">
                                <span>Precio Normal:</span>
                                <span style="font-weight:500; color:var(--text-primary);">${money(appsCost)}</span>
                                ${discountAppsAmount > 0 ? `
                                <span style="color:#15803d; font-weight:bold;">Descuento (${state.pct_descuento_apps}%):</span>
                                <span style="font-weight:bold; color:#15803d;">-${money(discountAppsAmount)}</span>
                                ` : ''}
                                ${esGratisApps ? `
                                <span style="grid-column:span 2; text-align:center; padding:0.4rem 0.5rem; background:rgba(34,197,94,0.15); border-radius:6px; color:#15803d; font-weight:bold; font-size:0.78rem; margin-top:0.25rem; letter-spacing:0.02em;">
                                    🎉 GRATIS por ${state.meses_descuento_apps} mes${state.meses_descuento_apps > 1 ? 'es' : ''}
                                </span>
                                ` : `
                                <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">Subtotal Apps:</span>
                                <span style="font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.25rem; margin-top:0.25rem;">${money(appsCostWithDiscount)}</span>
                                `}
                            </div>
                        </div>
                    `;
                }

                // --- INSTALACIÓN ---
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
                            <span style="grid-column:span 2; text-align:center; padding:0.35rem 0.5rem; background:rgba(34,197,94,0.15); border-radius:6px; color:#15803d; font-weight:bold; font-size:0.78rem; margin-top:0.2;em">
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

        // Bind events for live calculation updates
        ['wTieneAnexos', 'wDescuentoPlan', 'wMesesDescuento', 'wNumAnexos', 'wApps', 'wDescuentoInstalacion', 'wCuotasInstalacion', 'wDescuentoDeuda', 'wCuotasDeuda', 'wDescuentoApps', 'wMesesDescuentoApps'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', updatePaymentPreview);
                if (el.type === 'number' || el.tagName === 'SELECT') {
                    el.addEventListener('input', updatePaymentPreview);
                }
            }
        });

        const notasEl = document.getElementById('wNotasBeneficios');
        if (notasEl) {
            notasEl.addEventListener('input', (e) => {
                state.notes_beneficios = e.target.value || ''; // Map notes
                state.notas_beneficios = e.target.value || '';
            });
        }

        if (state.plan_id) {
            updatePaymentPreview();
        }
    };
    
    const collect = () => {
        const state = window.AbonadosRegistro.state;
        
        const sedeEl = document.getElementById('wSede');
        if (sedeEl) state.sede_id = sedeEl.value;
        state.plan_id = document.getElementById('wPlan')?.value;
        if (!state.plan_id) throw new Error('Seleccione un plan');
        
        state.tiene_anexos = document.getElementById('wTieneAnexos')?.value === 'si';
        state.num_anexos = state.tiene_anexos ? (parseInt(document.getElementById('wNumAnexos')?.value) || 1) : 0;
        state.descuento_plan = parseFloat(document.getElementById('wDescuentoPlan')?.value) || 0;
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
        
        state.app_ids = state.app_ids || [];
        state.planes_adicionales = state.planes_adicionales || [];
    };
    
    window.AbonadosRegistro.steps[stepIndex] = { render, collect };
})();

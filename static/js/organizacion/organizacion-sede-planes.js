/**
 * Gestión de Planes comerciales por sede
 * Tipos: internet, tv, duo, app, servicio — campos dinámicos según servicio
 * Soporta características técnicas JSONB y validaciones transaccionales
 */

document.addEventListener('DOMContentLoaded', () => {

    const TIPO_LABELS = {
        internet: 'Internet',
        tv: 'TV Cable',
        duo: 'Dúo (Internet + TV)',
        app: 'App / Digital',
        servicio: 'Servicio',
    };

    const FECHA_PAGO_LABELS = {
        fin_mes: 'Fin de mes',
        fecha_instalacion: 'Día de instalación',
    };

    const APLICACIONES_DIGITALES = [
        { value: 'netflix', label: 'Netflix' },
        { value: 'max', label: 'Max (HBO)' },
        { value: 'disney_plus', label: 'Disney+' },
        { value: 'amazon_prime', label: 'Amazon Prime' },
        { value: 'spotify', label: 'Spotify' },
        { value: 'youtube_premium', label: 'YouTube Premium' }
    ];

    const fmtMoney = n => `S/ ${parseFloat(n || 0).toFixed(2)}`;

    let editingPlanId = null;
    let filterTipo = 'TODOS';

    window.initSedePlanesModule = () => {
        renderPlanesTab();
    };

    const getPlanes = () => window.currentSedeConfigData?.planes || [];

    const renderPlanesTab = () => {
        const body = document.getElementById('sedeConfigBody');
        if (!body) return;

        const uniqueCategories = ['TODOS', 'internet', 'tv', 'duo', 'app', 'servicio'];
        getPlanes().forEach(p => {
            const custom = p.caracteristicas_tecnicas_json?.custom_tipo_servicio;
            if (custom && !uniqueCategories.includes(custom.toLowerCase())) {
                uniqueCategories.push(custom.toLowerCase());
            }
        });

        const getLabel = (t) => {
            if (t === 'TODOS') return 'Todos';
            if (TIPO_LABELS[t]) return TIPO_LABELS[t];
            return t.charAt(0).toUpperCase() + t.slice(1);
        };

        const planes = getPlanes().filter(p => {
            if (filterTipo === 'TODOS') return true;
            const custom = p.caracteristicas_tecnicas_json?.custom_tipo_servicio;
            if (custom) {
                return custom.toLowerCase() === filterTipo;
            }
            return p.tipo_servicio.toLowerCase() === filterTipo;
        });

        body.innerHTML = `
            <div class="config-card sede-tab-panel">
                <div class="config-card-title config-card-header">
                    <span>Planes Comerciales de la Sede</span>
                    <button type="button" class="config-btn-save" id="btnNuevoPlan" title="Nuevo Plan">${GLOBAL_ICONS.add(16)} Nuevo Plan</button>
                </div>
                <p class="config-panel-desc">
                    Cada plan define reglas de cobro, descuentos y características según el tipo de servicio (Internet, TV, Dúo, App o Servicio).
                </p>
                <div class="plan-filter-bar config-filter-bar" style="display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:1rem;">
                    ${uniqueCategories.map(t => `
                        <button type="button" class="plan-filter-btn ${filterTipo === t ? 'active' : ''}" data-filter="${t}">
                            ${getLabel(t)}
                        </button>
                    `).join('')}
                </div>
                <div id="planFormContainer" style="display:none;"></div>
                <div class="config-table-wrap" style="margin-top:1rem;">
                    <table class="config-table plan-table">
                        <thead>
                            <tr>
                                <th>Servicio</th>
                                <th>Plan</th>
                                <th>Cliente</th>
                                <th>Costo</th>
                                <th>Detalle</th>
                                <th>Día pago</th>
                                <th>Reglas</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="planesTableBody">
                            ${renderPlanRows(planes)}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('btnNuevoPlan')?.addEventListener('click', () => openPlanForm());
        body.querySelectorAll('.plan-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                filterTipo = btn.dataset.filter;
                renderPlanesTab();
            });
        });
        bindPlanRowActions();
    };

    const renderPlanRows = (planes) => {
        if (!planes.length) {
            return `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">No hay planes. Cree uno con las reglas de su sede.</td></tr>`;
        }
        return planes.map(p => {
            // Obtener características técnicas del JSONB
            const caracteristicas = p.caracteristicas_tecnicas_json || {};
            const caracteristicas_base = caracteristicas.caracteristicas_base || {};
            const velocidad = caracteristicas_base.velocidad_mbps || p.velocidad_mbps;
            const canales = caracteristicas_base.cantidad_canales || p.canales;
            const aplicaciones = caracteristicas.aplicaciones_digitales || [];
            const custom = caracteristicas.custom_tipo_servicio;
            
            const categoryLabel = custom ? (custom.charAt(0).toUpperCase() + custom.slice(1).toLowerCase()) : (TIPO_LABELS[p.tipo_servicio.toLowerCase()] || p.tipo_servicio);
            const badgeClass = custom ? 'APP' : p.tipo_servicio;
            
            let detalle = '';
            const tLower = p.tipo_servicio.toLowerCase();
            if (tLower === 'internet' || tLower === 'duo' || tLower === 'servicio') {
                detalle += `${velocidad || 0} Mbps`;
            }
            if (tLower === 'tv' || tLower === 'duo' || tLower === 'servicio') {
                detalle += (detalle ? ' · ' : '') + `${canales || 0} canales`;
            }
            if (tLower === 'app' && !custom) detalle = 'Servicio digital';
            if (aplicaciones && aplicaciones.length > 0) {
                detalle += (detalle ? ' · ' : '') + aplicaciones.map(app => {
                    const appInfo = APLICACIONES_DIGITALES.find(a => a.value === app);
                    return appInfo ? appInfo.label : app;
                }).join(', ');
            }
            
            const diasGracia = p.dias_amnistia !== undefined && p.dias_amnistia !== null ? p.dias_amnistia : p.dias_gracia;
            const reglas = [
                diasGracia > 0 ? `${diasGracia}d gracia` : null,
                p.admite_prorrogas ? 'Prórroga' : null,
                p.descuento_pago_anticipado_monto > 0 ? `Desc. ${fmtMoney(p.descuento_pago_anticipado_monto)}` : null,
            ].filter(Boolean).join(' · ') || '—';

            return `<tr data-plan-id="${p.id}">
                <td><span class="config-badge plan-badge-${badgeClass}">${categoryLabel}</span></td>
                <td><strong>${p.nombre}</strong></td>
                <td>${p.tipo_cliente}</td>
                <td>${fmtMoney(p.costo_mensual)}</td>
                <td style="font-size:0.8rem;">${detalle || '—'}</td>
                <td style="font-size:0.8rem;">${FECHA_PAGO_LABELS[p.dia_vencimiento] || p.dia_vencimiento}</td>
                <td style="font-size:0.75rem;color:var(--text-secondary);">${reglas}</td>
                <td style="text-align:right;white-space:nowrap;">
                    <button type="button" class="config-btn-icon plan-btn-sm" data-action="edit" data-id="${p.id}" title="Editar">${GLOBAL_ICONS.edit()}</button>
                    <button type="button" class="config-btn-icon config-btn-icon-danger plan-btn-sm" data-action="delete" data-id="${p.id}" title="Eliminar">${GLOBAL_ICONS.delete()}</button>
                </td>
            </tr>`;
        }).join('');
    };

    const bindPlanRowActions = () => {
        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const plan = getPlanes().find(p => p.id === parseInt(btn.dataset.id, 10));
                if (plan) openPlanForm(plan);
            });
        });
        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => eliminarPlan(parseInt(btn.dataset.id, 10)));
        });
    };

    let closeFormGlobal = null;

    const openPlanForm = (plan = null) => {
        editingPlanId = plan?.id || null;
        document.getElementById('planFormModalOverlay')?.remove();

        const existingPlans = getPlanes();
        const customCategories = [];
        existingPlans.forEach(p => {
            const custom = p.caracteristicas_tecnicas_json?.custom_tipo_servicio;
            if (custom && !customCategories.includes(custom.toLowerCase())) {
                customCategories.push(custom.toLowerCase());
            }
        });

        const overlay = document.createElement('div');
        overlay.id = 'planFormModalOverlay';
        overlay.className = 'org-modal-overlay open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = `
            <div class="org-modal" style="max-width: 600px;">
                <div class="org-modal-header">
                    <div class="org-modal-title">
                        <span class="org-modal-title-dot" style="background:var(--primary);"></span>
                        <span>${plan ? 'Editar Plan' : 'Nuevo Plan'}</span>
                    </div>
                    <button class="org-modal-close" id="btnCancelPlanClose" aria-label="Cerrar" title="Cerrar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <form id="sedePlanForm">
                    <div class="org-modal-body" style="padding: 1.25rem 1.5rem; max-height: 440px; overflow-y: auto;">
                        
                        <div class="plan-form-section" style="margin-top:0;">
                            <div class="plan-form-section-title">Datos generales</div>
                            <div class="plan-form-grid">
                                <div class="config-form-group">
                                    <label>Tipo de servicio *</label>
                                     <select class="config-form-input" name="tipo_servicio_select" id="planTipoServicioSelect" required>
                                         <option value="internet">Internet</option>
                                         <option value="tv">TV Cable</option>
                                         <option value="duo">Dúo (Internet + TV)</option>
                                         <option value="app">App / Servicios digitales</option>
                                         <option value="servicio">Servicio</option>
                                         ${customCategories.map(cat => `
                                             <option value="custom:${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                         `).join('')}
                                         <option value="NEW_CUSTOM">+ Agregar nueva categoría...</option>
                                     </select>
                                     <div id="newCustomCategoryContainer" style="display:none; margin-top:0.5rem;">
                                         <input type="text" class="config-form-input" name="new_custom_category" placeholder="Nombre de la nueva categoría (Ej. Cámaras)">
                                     </div>
                                </div>
                                <div class="config-form-group">
                                    <label>Tipo de cliente *</label>
                                    <select class="config-form-input" name="tipo_cliente" required>
                                        <option value="residencial">Residencial</option>
                                        <option value="corporativo">Corporativo</option>
                                    </select>
                                </div>
                                <div class="config-form-group">
                                    <label>Nombre del plan *</label>
                                    <input type="text" class="config-form-input" name="nombre" required placeholder="Ej: PLAN 100M HOGAR">
                                </div>
                                <div class="config-form-group">
                                    <label>Costo mensual (S/) *</label>
                                    <input type="number" class="config-form-input" name="costo_mensual" id="costoMensual" step="0.01" min="0" required>
                                </div>
                            </div>
                        </div>

                        <div class="plan-form-section" id="sectionInternet" style="display:none;">
                            <div class="plan-form-section-title">Internet</div>
                            <div class="plan-form-grid">
                                <div class="config-form-group">
                                    <label>Velocidad (Mbps) *</label>
                                    <input type="number" class="config-form-input" name="velocidad_mbps" id="velocidadMbps" min="0" value="0">
                                </div>
                            </div>
                        </div>

                        <div class="plan-form-section" id="sectionTV" style="display:none;">
                            <div class="plan-form-section-title">Televisión</div>
                            <div class="plan-form-grid">
                                <div class="config-form-group">
                                    <label>Canales incluidos *</label>
                                    <input type="number" class="config-form-input" name="cantidad_canales" id="cantidadCanales" min="0" value="0">
                                </div>
                            </div>
                        </div>

                        <div class="plan-form-section">
                            <div class="plan-form-section-title">Reglas de cobro y pago</div>
                            <div class="plan-form-grid">
                                <div class="config-form-group">
                                    <label>Día de vencimiento del mes</label>
                                    <select class="config-form-input" name="dia_vencimiento">
                                        <option value="fin_mes">Cada fin de mes</option>
                                        <option value="fecha_instalacion">Día de la instalación del servicio</option>
                                    </select>
                                </div>
                                <div class="config-form-group">
                                    <label>Días de gracia</label>
                                    <input type="number" class="config-form-input" name="dias_gracia" min="0" value="0" title="Días después del vencimiento antes de acciones de cobro/corte">
                                </div>
                            </div>
                            <div class="plan-checks" style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.5rem;">
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; cursor:pointer;"><input type="checkbox" name="admite_prorrogas" checked> Admite prórroga de pago</label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; cursor:pointer;"><input type="checkbox" name="admite_prorrateo_parcial" checked> Admite prorrateo (mes parcial)</label>
                            </div>
                        </div>

                        <div class="plan-form-section">
                            <div class="plan-form-section-title">Descuento por pago anticipado</div>
                            <div class="plan-form-grid">
                                <div class="config-form-group">
                                    <label>Días antes del vencimiento</label>
                                    <input type="number" class="config-form-input" name="descuento_pago_anticipado_dias" min="0" value="0" placeholder="Ej: 3">
                                </div>
                                <div class="config-form-group">
                                    <label>Monto descuento (S/)</label>
                                    <input type="number" class="config-form-input" name="descuento_pago_anticipado_monto" id="descuentoMonto" step="0.01" min="0" value="0">
                                </div>
                            </div>
                            <p style="font-size:0.72rem;color:var(--text-muted);margin-top:0.4rem;">Si el cliente paga X días antes de su fecha de vencimiento, se aplica el descuento indicado. El descuento debe ser menor al costo mensual.</p>
                        </div>

                    </div>
                    <div class="org-modal-footer" style="padding: 1rem 1.5rem; border-top: var(--border-thin) solid var(--border-color); display:flex; justify-content:flex-end; gap:0.5rem;">
                        <button type="button" class="btn-cancel" id="btnCancelPlan" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancelar</button>
                        <button type="submit" class="btn-save" style="display:flex; align-items:center; gap:4px; padding: 0.5rem 1.0rem; border-radius:6px; font-size:0.85rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Guardar Plan</button>
                    </div>
                </form>
            </div>`;

        document.body.appendChild(overlay);

        const form = document.getElementById('sedePlanForm');
        const tipoSelect = document.getElementById('planTipoServicioSelect');
        const costoMensual = document.getElementById('costoMensual');
        const descuentoMonto = document.getElementById('descuentoMonto');

        const updateSections = () => {
            const rawVal = tipoSelect.value;
            let t = rawVal;
            if (rawVal.startsWith('custom:')) {
                t = 'custom';
            } else if (rawVal === 'NEW_CUSTOM') {
                t = 'custom';
            }
            
            document.getElementById('sectionInternet').style.display = (t === 'internet' || t === 'duo' || t === 'servicio') ? 'block' : 'none';
            document.getElementById('sectionTV').style.display = (t === 'tv' || t === 'duo' || t === 'servicio') ? 'block' : 'none';
            
            const newCatContainer = document.getElementById('newCustomCategoryContainer');
            if (newCatContainer) {
                const isNew = rawVal === 'NEW_CUSTOM';
                newCatContainer.style.display = isNew ? 'block' : 'none';
                const input = newCatContainer.querySelector('input');
                if (input) input.required = isNew;
            }
            
            const velocidadInput = document.getElementById('velocidadMbps');
            const canalesInput = document.getElementById('cantidadCanales');
            
            if (velocidadInput) {
                const isRequired = (t === 'internet' || t === 'duo' || t === 'servicio');
                velocidadInput.required = isRequired;
                velocidadInput.min = isRequired ? 1 : 0;
            }
            if (canalesInput) {
                const isRequired = (t === 'tv' || t === 'duo' || t === 'servicio');
                canalesInput.required = isRequired;
                canalesInput.min = isRequired ? 1 : 0;
            }
        };

        tipoSelect.addEventListener('change', updateSections);

        descuentoMonto?.addEventListener('input', () => {
            const costo = parseFloat(costoMensual?.value) || 0;
            const descuento = parseFloat(descuentoMonto.value) || 0;
            if (descuento >= costo && costo > 0) {
                descuentoMonto.setCustomValidity('El descuento debe ser menor al costo mensual');
            } else {
                descuentoMonto.setCustomValidity('');
            }
        });

        costoMensual?.addEventListener('input', () => {
            const costo = parseFloat(costoMensual.value) || 0;
            const descuento = parseFloat(descuentoMonto?.value) || 0;
            if (descuento >= costo && costo > 0) {
                descuentoMonto?.setCustomValidity('El descuento debe ser menor al costo mensual');
            } else {
                descuentoMonto?.setCustomValidity('');
            }
        });

        if (plan) {
            const caracteristicas = plan.caracteristicas_tecnicas_json || {};
            const caracteristicas_base = caracteristicas.caracteristicas_base || {};
            const activacion_funciones = caracteristicas.activacion_funciones || {};
            
            const velocidad = caracteristicas_base.velocidad_mbps || plan.velocidad_mbps;
            const canales = caracteristicas_base.cantidad_canales || plan.canales;
            const custom = caracteristicas.custom_tipo_servicio;

            if (custom) {
                form.tipo_servicio_select.value = `custom:${custom.toLowerCase()}`;
            } else {
                form.tipo_servicio_select.value = plan.tipo_servicio.toLowerCase();
            }

            form.tipo_cliente.value = plan.tipo_cliente;
            form.nombre.value = plan.nombre_plan || plan.nombre;
            form.costo_mensual.value = plan.costo_plan || plan.costo_mensual;
            
            const velocidadInput = document.getElementById('velocidadMbps');
            const canalesInput = document.getElementById('cantidadCanales');
            
            if (velocidadInput) velocidadInput.value = velocidad || 0;
            if (canalesInput) canalesInput.value = canales || 0;
            
            form.dia_vencimiento.value = plan.configuracion_fecha_pago === 'FECHA_INSTALACION' ? 'fecha_instalacion' : (plan.dia_vencimiento || 'fin_mes');
            form.dias_gracia.value = plan.dias_amnistia !== undefined && plan.dias_amnistia !== null ? plan.dias_amnistia : (plan.dias_gracia !== undefined && plan.dias_gracia !== null ? plan.dias_gracia : 0);
            form.descuento_pago_anticipado_dias.value = plan.dias_anticipacion_descuento !== undefined && plan.dias_anticipacion_descuento !== null ? plan.dias_anticipacion_descuento : (plan.descuento_pago_anticipado_dias !== undefined && plan.descuento_pago_anticipado_dias !== null ? plan.descuento_pago_anticipado_dias : 0);
            form.descuento_pago_anticipado_monto.value = plan.monto_descuento_pago_anticipado !== undefined && plan.monto_descuento_pago_anticipado !== null ? plan.monto_descuento_pago_anticipado : (plan.descuento_pago_anticipado_monto !== undefined && plan.descuento_pago_anticipado_monto !== null ? plan.descuento_pago_anticipado_monto : 0);
            form.admite_prorrogas.checked = activacion_funciones.admite_prorrogas !== false && plan.admite_prorroga !== false;
            form.admite_prorrateo_parcial.checked = plan.admite_prorrateo !== false;
        }

        updateSections();
        
        // Asegurar que los valores sean al menos 1 si el campo es requerido después de updateSections
        if (plan) {
            if (form.velocidad_mbps && form.velocidad_mbps.required && form.velocidad_mbps.value == 0) {
                form.velocidad_mbps.value = 1;
            }
            if (form.cantidad_canales && form.cantidad_canales.required && form.cantidad_canales.value == 0) {
                form.cantidad_canales.value = 1;
            }
        }

        const closeForm = () => {
            overlay.classList.remove('open');
            setTimeout(() => overlay.remove(), 200);
            editingPlanId = null;
        };
        closeFormGlobal = closeForm;

        document.getElementById('btnCancelPlan')?.addEventListener('click', closeForm);
        document.getElementById('btnCancelPlanClose')?.addEventListener('click', closeForm);
        
        // Remover event listener anterior si existe para evitar duplicados
        form.removeEventListener('submit', guardarPlan);
        form.addEventListener('submit', guardarPlan);
    };

    const guardarPlan = async (e) => {
        e.preventDefault();
        const form = e.target;
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const rawTipo = form.tipo_servicio_select.value;
        let tipoDb = rawTipo;
        let customTipo = null;
        
        if (rawTipo === 'NEW_CUSTOM') {
            customTipo = form.new_custom_category.value.trim().toLowerCase();
            tipoDb = 'app';
        } else if (rawTipo.startsWith('custom:')) {
            customTipo = rawTipo.split(':')[1];
            tipoDb = 'app';
        }

        // Construir características técnicas JSONB modular
        const caracteristicasTecnicas = {
            caracteristicas_base: {},
            activacion_funciones: {},
            permisos_formularios: {},
            custom_tipo_servicio: customTipo
        };
        
        // caracteristicas_base
        if (tipoDb === 'internet' || tipoDb === 'duo' || tipoDb === 'servicio') {
            const velocidadInput = document.getElementById('velocidadMbps');
            caracteristicasTecnicas.caracteristicas_base.velocidad_mbps = parseInt(velocidadInput?.value) || 0;
        }
        
        if (tipoDb === 'tv' || tipoDb === 'duo' || tipoDb === 'servicio') {
            const canalesInput = document.getElementById('cantidadCanales');
            caracteristicasTecnicas.caracteristicas_base.cantidad_canales = parseInt(canalesInput?.value) || 0;
        }
        
        // activacion_funciones
        caracteristicasTecnicas.activacion_funciones.admite_prorrogas = form.admite_prorrogas.checked;
        caracteristicasTecnicas.activacion_funciones.compromisos_pago_flexibles = false;
        caracteristicasTecnicas.activacion_funciones.bloqueo_automatico_mora = false;
        caracteristicasTecnicas.activacion_funciones.prioridad_soporte_critica = false;
        
        // permisos_formularios
        caracteristicasTecnicas.permisos_formularios.requiere_api_externa_olt = false;
        caracteristicasTecnicas.permisos_formularios.permite_cambio_mufa_campo = false;

        // Validación final del descuento vs costo mensual
        const costoMensual = parseFloat(form.costo_mensual.value) || 0;
        const descuentoMonto = parseFloat(form.descuento_pago_anticipado_monto.value) || 0;
        
        if (descuentoMonto >= costoMensual && costoMensual > 0) {
            SITAlert.show('El descuento por pago anticipado debe ser menor al costo mensual del plan.', 'error');
            return;
        }

        const data = {
            sede_id: window.currentSedeId,
            plan_id: editingPlanId,
            tipo_servicio: tipoDb,
            custom_tipo_servicio: customTipo,
            tipo_cliente: form.tipo_cliente.value,
            nombre_plan: form.nombre.value.trim(),
            costo_plan: costoMensual,
            caracteristicas_tecnicas_json: caracteristicasTecnicas,
            configuracion_fecha_pago: form.dia_vencimiento.value,
            dias_amnistia: parseInt(form.dias_gracia.value),
            dias_anticipacion_descuento: parseInt(form.descuento_pago_anticipado_dias.value),
            monto_descuento_pago_anticipado: descuentoMonto,
            admite_prorroga: form.admite_prorrogas.checked,
            admite_prorrateo: form.admite_prorrateo_parcial.checked,
            admite_compromiso_pago: false,
            cantidad_canales_tv: parseInt(form.cantidad_canales?.value || document.getElementById('cantidadCanales')?.value) || 0,
            velocidad_mbps: parseInt(form.velocidad_mbps?.value || document.getElementById('velocidadMbps')?.value) || 0,
            bloqueo_automatico_mora: false,
            prioridad_soporte_critica: false,
            requiere_api_externa_olt: false,
            permite_cambio_mufa_campo: false,
        };

        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = `<svg class="svg-loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:4px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Guardando...`;

        try {
            const resp = await fetch('/api/sede/config/plan/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify(data),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                if (typeof closeFormGlobal === 'function') closeFormGlobal();
                await window.openSedeConfig(window.currentSedeId, 'planes');
                SITAlert.show('Plan guardado correctamente.', 'success');
            } else {
                SITAlert.show(`Error: ${res.message}`, 'error');
                btn.disabled = false;
                btn.innerHTML = `${GLOBAL_ICONS.save()} Guardar Plan`;
            }
        } catch (err) {
            SITAlert.show('Error al guardar el plan.', 'error');
            btn.disabled = false;
            btn.innerHTML = `${GLOBAL_ICONS.save()} Guardar Plan`;
        }
    };

    const eliminarPlan = async (planId) => {
        if (!confirm('¿Eliminar este plan? No se puede si tiene clientes suscritos.')) return;
        try {
            const resp = await fetch('/api/sede/config/plan/eliminar/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify({ sede_id: window.currentSedeId, plan_id: planId }),
            });
            const res = await resp.json();
            if (res.status === 'success') {
                await window.openSedeConfig(window.currentSedeId, 'planes');
            } else alert(`Error: ${res.message}`);
        } catch (e) { alert('Error al eliminar plan.'); }
    };
});

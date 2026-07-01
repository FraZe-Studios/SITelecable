/**
 * pago.js - Asistente de Registro: Pasos 4 y 5 (Pago y Confirmación)
 */
(function() {
    'use strict';
    
    const stepPagoIndex = 4;
    const stepConfirmarIndex = 5;
    
    // --- STEP 4: PAGO ---
    
    const renderPago = async (bodyEl) => {
        const state = window.AbonadosRegistro.state;
        const ctx = window.AbonadosRegistro.ctx;
        const esc = window.AbonadosRegistro.esc;
        const money = window.AbonadosRegistro.money;
        const showAlert = window.AbonadosRegistro.showAlert;
        const tieneDeudaCobrar = window.AbonadosRegistro.tieneDeudaCobrar;
        const fetchEvaluacion = window.AbonadosRegistro.fetchEvaluacion;
        
        await fetchEvaluacion();
        const ev = window.AbonadosRegistro.evaluacion || {};
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
        
        bodyEl.innerHTML = `
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
                <div class="ab-field"><label>Método pago *</label>
                    <select id="wMetodoPago">
                        <option value="EFECTIVO" ${state.metodo_pago === 'EFECTIVO' ? 'selected' : ''}>Efectivo</option>
                        <option value="YAPE" ${state.metodo_pago === 'YAPE' ? 'selected' : ''}>Yape</option>
                        <option value="TRANSFERENCIA" ${state.metodo_pago === 'TRANSFERENCIA' ? 'selected' : ''}>Transferencia</option>
                        <option value="MIXTO" ${state.metodo_pago === 'MIXTO' ? 'selected' : ''}>Mixto (efectivo + digital)</option>
                    </select></div>
                <div class="ab-field" id="wMixtoEf" style="display:none;"><label>Monto efectivo *</label>
                    <input type="number" id="wMontoEf" step="0.01" min="0" value="${state.monto_efectivo || ''}"></div>
                <div class="ab-field" id="wMixtoDig" style="display:none;"><label>Monto Yape/transferencia *</label>
                    <input type="number" id="wMontoDig" step="0.01" min="0" value="${state.monto_digital || ''}"></div>
                <div class="ab-field" id="wNumOp" style="display:none;"><label>N° operación *</label>
                    <input type="text" id="wNumOpInput" placeholder="Requerido para pago digital" value="${esc(state.numero_operacion || '')}"></div>
                <div class="ab-field full" id="wEvidenciaWrap" style="display:none;">
                    <label>Evidencia pago * (Yape / transferencia / mixto)</label>
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
            window.AbonadosRegistro.evidenciaFile = e.target.files?.[0] || null;
        });
        
        toggleEvid();
    };
    
    const collectPago = () => {
        const state = window.AbonadosRegistro.state;
        const evaluacion = window.AbonadosRegistro.evaluacion;
        const evidenciaFile = window.AbonadosRegistro.evidenciaFile;
        
        state.modo_pago_plan = document.getElementById('wModoPlan')?.value || 'FIN_MES';
        state.descuento_deuda = parseFloat(document.getElementById('wDescuentoDeuda')?.value) || 0;
        state.pagar_deuda_cuotas = document.getElementById('wDeudaCuotas')?.value === '1';
        state.ruc_emisor_id = document.getElementById('wRucEmisor')?.value;
        state.tipo_comprobante = document.getElementById('wTipoComp')?.value;
        state.metodo_pago = document.getElementById('wMetodoPago')?.value;
        state.monto_efectivo = document.getElementById('wMontoEf')?.value;
        state.monto_digital = document.getElementById('wMontoDig')?.value;
        state.numero_operacion = document.getElementById('wNumOpInput')?.value?.trim();
        
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
    };
    
    const subirEvidencia = async (clienteId, file) => {
        if (!file) return;
        let blob = file;
        const comp = window.imageCompressor;
        if (comp && file.type.startsWith('image/')) {
            try {
                blob = await comp.compressImage(file);
            } catch (_) { /* subir original */ }
        }
        const fd = new FormData();
        fd.append('cliente_id', clienteId);
        fd.append('tipo', 'evidencia_pago');
        fd.append('archivo', blob, file.name);
        await fetch('/api/abonados/subir-documento/', { method: 'POST', body: fd });
    };
    
    // --- STEP 5: CONFIRMACIÓN ---
    
    const renderConfirmar = async (bodyEl) => {
        const state = window.AbonadosRegistro.state;
        const esc = window.AbonadosRegistro.esc;
        const money = window.AbonadosRegistro.money;
        const showAlert = window.AbonadosRegistro.showAlert;
        const calcEdad = window.AbonadosRegistro.calcEdad;
        const fetchEvaluacion = window.AbonadosRegistro.fetchEvaluacion;
        
        if (!window.AbonadosRegistro.evaluacion) {
            await fetchEvaluacion();
        }
        const ev = window.AbonadosRegistro.evaluacion || {};
        
        bodyEl.innerHTML = `
            <dl class="ficha-dl">
                <dt>Documento</dt><dd>${esc(state.dni || state.ruc || '—')}</dd>
                <dt>Cliente</dt><dd>${esc(state.nombre_apellidos || state.razon_social || '—')}</dd>
                <dt>Cumpleaños</dt><dd>${esc(state.cumpleanos || '—')} (${calcEdad(state.cumpleanos) ?? '—'} años)</dd>
                <dt>Celular</dt><dd>${esc(state.celular_1 || '—')}</dd>
                <dt>Suministro</dt><dd>${esc(state.suministro || '—')}</dd>
                <dt>Plan</dt><dd>${esc(state.plan_id || '—')}</dd>
                <dt>Vendedor contrato</dt><dd>${esc(window.AbonadosRegistro.ctx.vendedor?.personal_nombre || '—')} (${esc(window.AbonadosRegistro.ctx.vendedor?.personal_id || '—')})</dd>
                <dt>Total cobrar</dt><dd>${money(ev.total_cobrar_ahora)}</dd>
                <dt>Comprobante</dt><dd>${esc(state.tipo_comprobante || ev.tipo_comprobante_sugerido || '—')}</dd>
            </dl>
            ${showAlert('Al confirmar se creará el cliente, la suscripción y la orden de instalación.', 'info')}`;
    };
    
    const collectConfirmar = () => {
        // En este paso solo se confirma y se envía, no hay campos a recolectar
    };
    
    window.AbonadosRegistro.steps[stepPagoIndex] = { render: renderPago, collect: collectPago, subirEvidencia };
    window.AbonadosRegistro.steps[stepConfirmarIndex] = { render: renderConfirmar, collect: collectConfirmar };
})();

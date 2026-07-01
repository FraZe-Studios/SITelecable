/**
 * documento.js - Asistente de Registro: Paso 0 (Documento)
 */
(function() {
    'use strict';
    
    const stepIndex = 0;
    
    const render = (bodyEl) => {
        const state = window.AbonadosRegistro.state;
        const esc = window.AbonadosRegistro.esc;
        const showAlert = window.AbonadosRegistro.showAlert;
        
        bodyEl.innerHTML = `
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
    };
    
    const collect = () => {
        const doc = document.getElementById('wDocumento')?.value.trim();
        const rucExtra = document.getElementById('wRucAdicional')?.value.trim();
        if (!doc) throw new Error('Documento principal es requerido');
        if (doc.length !== 8 && doc.length !== 11) throw new Error('El documento principal debe tener 8 o 11 dígitos');
        
        window.AbonadosRegistro.state.documento = doc;
        if (doc.length === 8) {
            window.AbonadosRegistro.state.dni = doc;
            if (rucExtra && rucExtra.length === 11) {
                window.AbonadosRegistro.state.ruc = rucExtra;
            }
        } else {
            window.AbonadosRegistro.state.ruc = doc;
        }
    };
    
    const consultarDocumento = async () => {
        const btn = document.getElementById('btnConsultarDoc');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Consultando...';
        
        const doc = document.getElementById('wDocumento')?.value.trim();
        const rucExtra = document.getElementById('wRucAdicional')?.value.trim();
        const el = document.getElementById('wDocResult');
        const state = window.AbonadosRegistro.state;
        const showAlert = window.AbonadosRegistro.showAlert;
        const money = window.AbonadosRegistro.money;
        
        if (!doc) {
            el.innerHTML = showAlert('Ingrese documento principal', 'danger');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
        }
        
        try {
            state.documento = doc;
            const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(doc)}`);
            if (!res.ok) throw new Error('Error al conectar con la API');
            const json = await res.json();
            
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
                    <ul style="list-style: disc; margin-left: 1.5rem; text-align: left;">
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
        } catch (error) {
            console.error(error);
            el.innerHTML = showAlert('Error consultando el documento: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };
    
    window.AbonadosRegistro.steps[stepIndex] = { render, collect };
})();

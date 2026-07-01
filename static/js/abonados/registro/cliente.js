/**
 * cliente.js - Asistente de Registro: Paso 1 (Cliente)
 */
(function() {
    'use strict';
    
    const stepIndex = 1;
    
    const render = (bodyEl) => {
        const state = window.AbonadosRegistro.state;
        const ctx = window.AbonadosRegistro.ctx;
        const esc = window.AbonadosRegistro.esc;
        const showAlert = window.AbonadosRegistro.showAlert;
        
        const ecOpts = (ctx.estados_civiles || []).map(e =>
            `<option value="${e.value}" ${state.estado_civil === e.value ? 'selected' : ''}>${e.label}</option>`
        ).join('');
        
        const opOpts = (ctx.operadores || ['MOVISTAR', 'CLARO', 'ENTEL', 'BITEL', 'OTRO']).map(o =>
            `<option value="${o}" ${state.operador === o ? 'selected' : ''}>${o}</option>`
        ).join('');
        
        bodyEl.innerHTML = `
            ${state.es_mayor_edad === false ? showAlert('El cliente debe ser mayor de edad. Verifique la fecha de nacimiento.', 'danger') : ''}
            <div class="ab-form-grid">
                <div class="ab-field">
                    <label>DNI</label>
                    <div style="display:flex; gap:0.5rem; align-items:end;">
                        <input id="wDni" maxlength="8" value="${esc(state.dni || '')}" style="flex:1;">
                        <button type="button" class="abonados-btn abonados-btn-new" id="btnConsultarDni" style="padding:0.5rem;"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                </div>
                <div class="ab-field">
                    <label>RUC</label>
                    <div style="display:flex; gap:0.5rem; align-items:end;">
                        <input id="wRuc" maxlength="11" value="${esc(state.ruc || '')}" style="flex:1;">
                        <button type="button" class="abonados-btn abonados-btn-new" id="btnConsultarRuc" style="padding:0.5rem;"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                </div>
                <div class="ab-field full"><label>Nombres y apellidos</label>
                    <input id="wNombre" value="${esc(state.nombre_apellidos || '')}"></div>
                <div class="ab-field full"><label>Razón social</label>
                    <input id="wRazonSocial" value="${esc(state.razon_social || '')}"></div>
                <div class="ab-field"><label>Fecha nacimiento *</label><input type="date" id="wCumple" value="${esc(state.cumpleanos || '')}"></div>
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
                <div class="ab-field"><label>Celular 1 *</label><input id="wCelular" value="${esc(state.celular_1 || '')}"></div>
                <div class="ab-field"><label>Celular 2</label><input id="wCelular2" value="${esc(state.celular_2 || '')}"></div>
                <div class="ab-field full"><label>Correo</label><input id="wCorreo" type="email" value="${esc(state.correo || '')}"></div>
                <div class="ab-field full"><label>Dirección fiscal</label>
                    <input id="wDirFiscal" value="${esc(state.direccion_fiscal || '')}"></div>
            </div>
            <div id="wEdadResult"></div>
            <div id="wDniResult"></div>
            <div id="wRucResult"></div>`;
            
        document.getElementById('wCumple')?.addEventListener('change', validarEdadEnPantalla);
        document.getElementById('btnConsultarDni')?.addEventListener('click', consultarDni);
        document.getElementById('btnConsultarRuc')?.addEventListener('click', consultarRuc);
        
        if (state.cumpleanos) {
            validarEdadEnPantalla();
        }
    };
    
    const collect = () => {
        const state = window.AbonadosRegistro.state;
        const calcEdad = window.AbonadosRegistro.calcEdad;
        
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
        
        if (!state.nombre_apellidos) throw new Error('Nombre y apellidos requerido');
        if (!state.celular_1) throw new Error('Celular principal requerido');
        if (!state.cumpleanos) throw new Error('Fecha de nacimiento requerida');
        
        const edad = calcEdad(state.cumpleanos);
        if (edad === null || edad < 18) throw new Error('El cliente debe ser mayor de edad');
        state.es_mayor_edad = true;
    };
    
    const validarEdadEnPantalla = () => {
        const fecha = document.getElementById('wCumple')?.value;
        const el = document.getElementById('wEdadResult');
        if (!el) return;
        const edad = window.AbonadosRegistro.calcEdad(fecha);
        const showAlert = window.AbonadosRegistro.showAlert;
        const state = window.AbonadosRegistro.state;
        
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
        const btn = document.getElementById('btnConsultarDni');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        const dni = document.getElementById('wDni')?.value.trim();
        const el = document.getElementById('wDniResult');
        const state = window.AbonadosRegistro.state;
        const showAlert = window.AbonadosRegistro.showAlert;
        
        if (!dni || dni.length !== 8) {
            el.innerHTML = showAlert('Ingrese DNI válido (8 dígitos)', 'danger');
            btn.disabled = false;
            btn.innerHTML = originalContent;
            return;
        }
        
        try {
            const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(dni)}`);
            if (!res.ok) throw new Error('Error al conectar con la API');
            const json = await res.json();
            
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
            
            document.getElementById('wNombre').value = state.nombre_apellidos || '';
            document.getElementById('wCumple').value = state.cumpleanos || '';
            document.getElementById('wEstadoCivil').value = state.estado_civil || '';
            
            validarEdadEnPantalla();
            
            if (json.cliente_existente) {
                el.innerHTML = showAlert(
                    `Cliente en sistema (${d.cliente_id}). Deuda SIT: ${state.tiene_deuda_cliente ? 'Sí' : 'No'}`,
                    state.tiene_deuda_cliente ? 'warn' : 'info'
                );
            } else if (origen === 'TELECABLE') {
                const deudaTel = state.tiene_deuda_externa ? ` Deuda Telecable: ${window.AbonadosRegistro.money(state.monto_deuda_externa)}.` : '';
                el.innerHTML = showAlert(`Cliente nuevo desde Telecable.${deudaTel}`, state.tiene_deuda_externa ? 'warn' : 'info');
            } else if (origen === 'MANUAL') {
                el.innerHTML = showAlert(json.message || 'Complete los datos manualmente.', 'warn');
            } else {
                el.innerHTML = showAlert(`Datos DNI obtenidos (${origen}).`, 'info');
            }
        } catch (error) {
            console.error(error);
            el.innerHTML = showAlert('Error al consultar DNI: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    };
    
    const consultarRuc = async () => {
        const btn = document.getElementById('btnConsultarRuc');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        const ruc = document.getElementById('wRuc')?.value.trim();
        const el = document.getElementById('wRucResult');
        const state = window.AbonadosRegistro.state;
        const showAlert = window.AbonadosRegistro.showAlert;
        
        if (!ruc || ruc.length !== 11) {
            el.innerHTML = showAlert('Ingrese RUC válido (11 dígitos)', 'danger');
            btn.disabled = false;
            btn.innerHTML = originalContent;
            return;
        }
        
        try {
            const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(ruc)}`);
            if (!res.ok) throw new Error('Error al conectar con la API');
            const json = await res.json();
            
            if (json.status !== 'success') {
                el.innerHTML = showAlert(json.message || 'Error', 'danger');
                return;
            }
            
            const d = json.data;
            const origen = json.origen || 'API';
            
            state.ruc = ruc;
            state.razon_social = d.razon_social || state.razon_social;
            state.direccion_fiscal = d.direccion_fiscal || state.direccion_fiscal;
            
            document.getElementById('wRazonSocial').value = state.razon_social || '';
            document.getElementById('wDirFiscal').value = state.direccion_fiscal || '';
            
            el.innerHTML = showAlert(`Datos RUC obtenidos (${origen}).`, 'info');
        } catch (error) {
            console.error(error);
            el.innerHTML = showAlert('Error al consultar RUC: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    };
    
    window.AbonadosRegistro.steps[stepIndex] = { render, collect };
})();

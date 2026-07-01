/**
 * suministro.js - Asistente de Registro: Paso 2 (Suministro)
 */
(function() {
    'use strict';
    
    const stepIndex = 2;
    
    const render = (bodyEl) => {
        const state = window.AbonadosRegistro.state;
        const esc = window.AbonadosRegistro.esc;
        const showAlert = window.AbonadosRegistro.showAlert;
        
        bodyEl.innerHTML = `
            <div class="ab-form-grid">
                <div class="ab-field">
                    <label>N° Suministro Luz *</label>
                    <div style="display:flex; gap:0.5rem; align-items:end;">
                        <input type="text" id="wSuministro" value="${esc(state.suministro || '')}" style="flex:1;">
                        <button type="button" class="abonados-btn abonados-btn-new" id="btnConsultarSum" style="padding:0.5rem;"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                </div>
                <div class="ab-field"><label>Dirección del Servicio *</label>
                    <input id="wDirServicio" value="${esc(state.direccion_servicio || '')}"></div>
                <div class="ab-field"><label>Distrito *</label>
                    <input id="wDistrito" value="${esc(state.distrito || '')}"></div>
                <div class="ab-field"><label>Provincia *</label>
                    <input id="wProvincia" value="${esc(state.provincia || '')}"></div>
                <div class="ab-field"><label>Departamento *</label>
                    <input id="wDepartamento" value="${esc(state.departamento || '')}"></div>
                <div class="ab-field"><label>GPS Latitud</label>
                    <input id="wLat" value="${esc(state.latitud || '')}"></div>
                <div class="ab-field"><label>GPS Longitud</label>
                    <input id="wLng" value="${esc(state.longitud || '')}"></div>
                <div class="ab-field full"><label>Referencia domicilio</label>
                    <input id="wReferencia" value="${esc(state.referencia_domicilio || '')}"></div>
            </div>
            <div id="wSumResult"></div>`;
            
        document.getElementById('btnConsultarSum')?.addEventListener('click', consultarSuministro);
    };
    
    const collect = () => {
        const state = window.AbonadosRegistro.state;
        
        state.suministro = document.getElementById('wSuministro')?.value.trim();
        state.direccion_servicio = document.getElementById('wDirServicio')?.value.trim();
        state.distrito = document.getElementById('wDistrito')?.value.trim();
        state.provincia = document.getElementById('wProvincia')?.value.trim();
        state.departamento = document.getElementById('wDepartamento')?.value.trim();
        state.latitud = document.getElementById('wLat')?.value.trim();
        state.longitud = document.getElementById('wLng')?.value.trim();
        state.referencia_domicilio = document.getElementById('wReferencia')?.value.trim();
        
        if (!state.suministro) throw new Error('Suministro requerido');
        if (!state.direccion_servicio) throw new Error('Dirección de servicio requerida');
        if (!state.distrito) throw new Error('Distrito es requerido');
    };
    
    const aplicarDatosTelecable = (tel) => {
        if (!tel) return;
        const state = window.AbonadosRegistro.state;
        
        if (tel.dni && !state.dni) state.dni = tel.dni;
        if (tel.ruc && !state.ruc) state.ruc = tel.ruc;
        if (tel.nombre_apellidos && !state.nombre_apellidos) state.nombre_apellidos = tel.nombre_apellidos;
        if (tel.razon_social && !state.razon_social) state.razon_social = tel.razon_social;
        if (tel.celular_1 && !state.celular_1) state.celular_1 = tel.celular_1;
        if (tel.celular_2 && !state.celular_2) state.celular_2 = tel.celular_2;
        if (tel.correo && !state.correo) state.correo = tel.correo;
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
        const btn = document.getElementById('btnConsultarSum');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        const sum = document.getElementById('wSuministro')?.value.trim();
        const el = document.getElementById('wSumResult');
        const state = window.AbonadosRegistro.state;
        const showAlert = window.AbonadosRegistro.showAlert;
        const money = window.AbonadosRegistro.money;
        
        if (!sum) {
            el.innerHTML = showAlert('Ingrese número de suministro', 'danger');
            btn.disabled = false;
            btn.innerHTML = originalContent;
            return;
        }
        
        try {
            state.suministro = sum;
            const docParam = state.dni || state.ruc || state.documento || '';
            const url = `/api/abonados/consultar-suministro/?suministro=${encodeURIComponent(sum)}${docParam ? `&documento=${encodeURIComponent(docParam)}` : ''}`;
            
            const res = await fetch(url);
            if (!res.ok) throw new Error('Error al conectar con la API');
            const json = await res.json();
            
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
            
            document.getElementById('wDirServicio').value = state.direccion_servicio || '';
            document.getElementById('wDistrito').value = state.distrito || '';
            document.getElementById('wProvincia').value = state.provincia || '';
            document.getElementById('wDepartamento').value = state.departamento || '';
            document.getElementById('wLat').value = state.latitud || '';
            document.getElementById('wLng').value = state.longitud || '';
            
            const partes = [];
            partes.push(`Suministro (${d.source || 'cache'})`);
            if (d.coincidencia_telecable_por) {
                partes.push(`Telecable: ${d.coincidencia_telecable_por}${d.similitud_direccion != null ? ` (${Math.round(d.similitud_direccion * 100)}% dir.)` : ''}`);
            }
            if (state.tiene_deuda_externa) partes.push(`Deuda Telecable: ${money(state.monto_deuda_externa)}`);
            if (state.tiene_deuda_sistema) partes.push(`Deuda SIT: ${money(d.monto_deuda_sistema)}`);
            
            el.innerHTML = showAlert(partes.join(' · '), (state.tiene_deuda_externa || state.tiene_deuda_sistema) ? 'warn' : 'info');
        } catch (error) {
            console.error(error);
            el.innerHTML = showAlert('Error al consultar suministro: ' + error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    };
    
    window.AbonadosRegistro.steps[stepIndex] = { render, collect };
})();

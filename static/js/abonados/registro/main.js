/**
 * main.js - Orquestación del wizard de registro de abonados.
 * Cumple con la regla de Nomenclatura Monopalabra.
 */
(function() {
    'use strict';
    
    const STEPS = ['Documento', 'Cliente', 'Suministro', 'Evaluación', 'Pago', 'Confirmar'];
    
    window.AbonadosRegistro = {
        step: 0,
        state: {},
        ctx: { vendedor: {}, sedes: [], planes: [], rucs_emision: [], estados_civiles: [], operadores: [] },
        evaluacion: null,
        evidenciaFile: null,
        steps: {}, // Cada paso registrará sus funciones: { render: function(body), collect: function() }
        
        // DOM Elements
        overlay: () => document.getElementById('modalRegistroAbonado'),
        body: () => document.getElementById('modalRegistroBody'),
        stepsEl: () => document.getElementById('wizardSteps'),
        
        // Common Utilities
        showAlert: (msg, type = 'info') => `<div class="ab-alert ab-alert-${type}">${msg}</div>`,
        esc: (s) => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
        money: (n) => `S/ ${Number(n || 0).toFixed(2)}`,
        
        calcEdad: (fecha) => {
            if (!fecha) return null;
            const n = new Date(fecha);
            if (Number.isNaN(n.getTime())) return null;
            const hoy = new Date();
            let edad = hoy.getFullYear() - n.getFullYear();
            const m = hoy.getMonth() - n.getMonth();
            if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad -= 1;
            return edad;
        },
        
        tieneDeudaCobrar: () => {
            const state = window.AbonadosRegistro.state;
            return !!(state.tiene_deuda_cliente || state.tiene_deuda_externa || state.tiene_deuda_sistema);
        },
        
        calcularFechaVigencia: (meses) => {
            const fecha = new Date();
            fecha.setMonth(fecha.getMonth() + meses);
            return fecha.toISOString().split('T')[0];
        },
        
        getAppCtx: () => {
            const raw = document.getElementById('abonadosApp')?.dataset.ctxVendedor;
            try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
        },
        
        fetchContexto: async (sedeId) => {
            const url = sedeId ? `/api/abonados/contexto/?sede_id=${sedeId}` : '/api/abonados/contexto/';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Error al cargar contexto de la sede');
            const json = await res.json();
            if (json.status === 'success') {
                window.AbonadosRegistro.ctx = json.data;
                const state = window.AbonadosRegistro.state;
                if (!state.sede_id && window.AbonadosRegistro.ctx.vendedor?.sede_id) {
                    state.sede_id = window.AbonadosRegistro.ctx.vendedor.sede_id;
                }
            } else {
                throw new Error(json.message || 'Error al cargar contexto');
            }
        },
        
        fetchEvaluacion: async () => {
            const res = await fetch('/api/abonados/evaluar/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(window.AbonadosRegistro.state),
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
            window.AbonadosRegistro.evaluacion = json.data;
            window.AbonadosRegistro.state.evaluacion = json.data;
            return json.data;
        },
        
        renderSteps: () => {
            const step = window.AbonadosRegistro.step;
            window.AbonadosRegistro.stepsEl().innerHTML = STEPS.map((label, i) => {
                const cls = i < step ? 'done' : (i === step ? 'active' : '');
                return `<span class="ab-step-pill ${cls}">${i + 1}. ${label}</span>`;
            }).join('');
            document.getElementById('btnWizardPrev').disabled = step === 0;
            document.getElementById('btnWizardNext').textContent = step === STEPS.length - 1 ? 'Registrar' : 'Siguiente';
        },
        
        renderStep: async () => {
            window.AbonadosRegistro.renderSteps();
            const step = window.AbonadosRegistro.step;
            const handler = window.AbonadosRegistro.steps[step];
            if (handler && typeof handler.render === 'function') {
                await handler.render(window.AbonadosRegistro.body());
            }
        },
        
        collectStep: () => {
            const step = window.AbonadosRegistro.step;
            const handler = window.AbonadosRegistro.steps[step];
            if (handler && typeof handler.collect === 'function') {
                handler.collect();
            }
        },
        
        registrar: async () => {
            const state = window.AbonadosRegistro.state;
            const payload = { ...state };
            
            // Clean payload
            delete payload.evaluacion;
            
            const btn = document.getElementById('btnWizardNext');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Procesando...';
            
            try {
                const res = await fetch('/api/abonados/registrar/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                
                if (!res.ok) {
                    let msg = 'Error en el servidor al registrar';
                    try {
                        const json = await res.json();
                        msg = json.message || msg;
                    } catch (_) {}
                    throw new Error(msg);
                }
                
                const json = await res.json();
                if (json.status === 'success') {
                    const clienteId = json.data.cliente_id_codigo || json.data.cliente_id;
                    const resData = json.data;
                    
                    // Upload payment evidence if digital payment
                    if (window.AbonadosRegistro.evidenciaFile && window.AbonadosRegistro.steps[4]?.subirEvidencia) {
                        try {
                            btn.textContent = 'Subiendo evidencia...';
                            await window.AbonadosRegistro.steps[4].subirEvidencia(clienteId, window.AbonadosRegistro.evidenciaFile);
                        } catch (uploadErr) {
                            console.error('Evidencia falló, pero cliente registrado:', uploadErr);
                            SITAlert.show('Cliente registrado, pero falló la carga de evidencia: ' + uploadErr.message, 'warning');
                        }
                    }
                    
                    if (resData.pago_estado === 'error' || resData.error_pago) {
                        const pagoErr = resData.pago_mensaje || resData.error_pago || 'Error desconocido';
                        SITAlert.show('Cliente registrado. Pago pendiente: ' + pagoErr, 'warning');
                    } else {
                        const pagoOk = resData.comprobante_numero || 'Registrado correctamente';
                        SITAlert.show('Registro completo. Comprobante: ' + pagoOk, 'success');
                    }
                    
                    window.AbonadosRegistro.close();
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    throw new Error(json.message || 'Error en el registro');
                }
            } catch (err) {
                console.error(err);
                btn.disabled = false;
                btn.textContent = originalText;
                throw err;
            }
        },
        
        open: async (initial = {}) => {
            window.AbonadosRegistro.step = 0;
            window.AbonadosRegistro.state = { ...initial, app_ids: [], planes_adicionales: [] };
            window.AbonadosRegistro.evaluacion = null;
            window.AbonadosRegistro.evidenciaFile = null;
            
            const vendedor = window.AbonadosRegistro.getAppCtx();
            window.AbonadosRegistro.ctx.vendedor = vendedor;
            
            const b = window.AbonadosRegistro.body();
            if (b) b.innerHTML = '';
            
            window.AbonadosRegistro.overlay().classList.add('active');
            window.AbonadosRegistro.overlay().style.display = 'flex';
            
            try {
                await window.AbonadosRegistro.fetchContexto(vendedor.sede_id);
                await window.AbonadosRegistro.renderStep();
            } catch (err) {
                if (b) b.innerHTML = window.AbonadosRegistro.showAlert(err.message, 'danger');
            }
        },
        
        close: () => {
            window.AbonadosRegistro.overlay().classList.remove('active');
            window.AbonadosRegistro.overlay().style.display = 'none';
        }
    };
    
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btnCerrarModalRegistro')?.addEventListener('click', () => {
            window.AbonadosRegistro.close();
        });
        
        document.getElementById('btnWizardPrev')?.addEventListener('click', async () => {
            if (window.AbonadosRegistro.step > 0) {
                window.AbonadosRegistro.step -= 1;
                await window.AbonadosRegistro.renderStep();
            }
        });
        
        document.getElementById('btnWizardNext')?.addEventListener('click', async () => {
            try {
                window.AbonadosRegistro.collectStep();
                const step = window.AbonadosRegistro.step;
                if (step === STEPS.length - 1) {
                    await window.AbonadosRegistro.registrar();
                    return;
                }
                window.AbonadosRegistro.step += 1;
                const nextStep = window.AbonadosRegistro.step;
                if (nextStep === 4) {
                    await window.AbonadosRegistro.fetchContexto(window.AbonadosRegistro.state.sede_id || window.AbonadosRegistro.ctx.vendedor?.sede_id);
                    await window.AbonadosRegistro.fetchEvaluacion();
                }
                if (nextStep === 5) {
                    await window.AbonadosRegistro.fetchEvaluacion();
                }
                await window.AbonadosRegistro.renderStep();
            } catch (err) {
                window.AbonadosRegistro.body().insertAdjacentHTML('afterbegin', window.AbonadosRegistro.showAlert(err.message, 'danger'));
            }
        });
    });
})();

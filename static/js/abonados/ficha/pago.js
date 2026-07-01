/**
 * pago.js - Gestión de Pagos, Multipagos y Caja del Abonado
 */
(function() {
    'use strict';

    const togglePagoCampos = (form) => {
        const metodo = form.querySelector('[name="metodo_pago"]')?.value || 'EFECTIVO';
        const evid = form.querySelector('.evidencia-wrap');
        const mixto = form.querySelectorAll('.mixto-wrap');
        const op = form.querySelector('.op-wrap');
        const needDigital = ['YAPE', 'TRANSFERENCIA', 'MIXTO'].includes(metodo);
        if (evid) evid.style.display = needDigital ? 'block' : 'none';
        mixto.forEach(el => { el.style.display = metodo === 'MIXTO' ? 'block' : 'none'; });
        if (op) op.style.display = ['YAPE', 'TRANSFERENCIA', 'MIXTO'].includes(metodo) ? 'block' : 'none';
    };

    document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('fichaApp');
        if (!app) return;

        // Multipago and free payment toggle and calculation logic
        document.querySelectorAll('.ficha-pago-form').forEach(form => {
            form.querySelector('.metodo-pago-select')?.addEventListener('change', () => togglePagoCampos(form));
            togglePagoCampos(form);

            const listContainer = form.querySelector('.multipago-debts-list');
            const chkPagoLibre = form.querySelector('#chk-pago-libre');
            const pagoLibreFields = form.querySelector('#pago-libre-fields');
            const pagoLibreMonto = form.querySelector('#pago-libre-monto');
            const pagoLibreConcepto = form.querySelector('#pago-libre-concepto');
            const totalDisplay = form.querySelector('#multipago-total-display');

            const calculateTotal = () => {
                let total = 0.0;
                // Sum checked debts
                form.querySelectorAll('.multipago-checkbox:checked').forEach(chk => {
                    const item = chk.closest('.multipago-item');
                    if (item) {
                        total += parseFloat(item.dataset.monto || 0);
                    }
                });
                // Sum free payment if active
                if (chkPagoLibre && chkPagoLibre.checked && pagoLibreMonto) {
                    total += parseFloat(pagoLibreMonto.value || 0);
                }
                if (totalDisplay) {
                    totalDisplay.textContent = `S/ ${total.toFixed(2)}`;
                }
            };

            const togglePagoLibreInputs = () => {
                const isChecked = !!(chkPagoLibre && chkPagoLibre.checked);
                if (pagoLibreFields) {
                    pagoLibreFields.style.display = isChecked ? 'flex' : 'none';
                }
                if (pagoLibreMonto) pagoLibreMonto.disabled = !isChecked;
                if (pagoLibreConcepto) pagoLibreConcepto.disabled = !isChecked;
                if (pagoLibreMeses) pagoLibreMeses.disabled = !isChecked;
                if (pagoLibreMesesDetalle) pagoLibreMesesDetalle.disabled = !isChecked;
                const pagoLibreComprobante = form.querySelector('#pago-libre-comprobante');
                if (pagoLibreComprobante) pagoLibreComprobante.disabled = !isChecked;
            };

            if (chkPagoLibre) {
                chkPagoLibre.addEventListener('change', () => {
                    togglePagoLibreInputs();
                    calculateTotal();
                });
            }

            if (pagoLibreMonto) {
                pagoLibreMonto.addEventListener('input', calculateTotal);
            }

            const pagoLibreMeses = form.querySelector('#pago-libre-meses');
            const pagoLibreMesesDetalle = form.querySelector('#pago-libre-meses-detalle');
            const costoPlan = parseFloat(form.dataset.costoPlan || 0);
            togglePagoLibreInputs();

            // Get current paid period from the UI
            const getPagadoHasta = () => {
                const periodoInfo = form.querySelector('[style*="rgba(59,130,246,0.1)"]');
                if (periodoInfo) {
                    const texto = periodoInfo.textContent;
                    const match = texto.match(/Pagado hasta: (\d{2}\/\d{2}\/\d{4})/);
                    if (match) {
                        const [dia, mes, anio] = match[1].split('/');
                        return new Date(anio, mes - 1, dia);
                    }
                }
                return new Date(); // Default to today if no payment found
            };

            // Calculate month names based on number of months
            const calcularNombresMeses = (numMeses, fechaInicio) => {
                const meses = [];
                const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const fecha = new Date(fechaInicio);
                
                for (let i = 0; i < numMeses; i++) {
                    fecha.setMonth(fecha.getMonth() + 1);
                    meses.push(nombresMeses[fecha.getMonth()]);
                }
                return meses.join(', ');
            };

            // Calculate date range (from - to)
            const calcularRangoFechas = (numMeses, fechaInicio) => {
                const fechaDesde = new Date(fechaInicio);
                fechaDesde.setDate(fechaDesde.getDate() + 1); // Start from next day
                
                const fechaHasta = new Date(fechaDesde);
                fechaHasta.setMonth(fechaHasta.getMonth() + numMeses);
                fechaHasta.setDate(fechaHasta.getDate() - 1); // End at last day of last month
                
                const formatDate = (d) => d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return { desde: formatDate(fechaDesde), hasta: formatDate(fechaHasta) };
            };

            const updateConcepto = () => {
                const meses = parseInt(pagoLibreMeses?.value) || 0;
                const detalleMeses = pagoLibreMesesDetalle?.value.trim();
                let concepto = '';
                if (meses > 0) {
                    concepto = `Pago adelanto ${meses} mes${meses > 1 ? 'es' : ''}`;
                    if (detalleMeses) {
                        concepto += ` (${detalleMeses})`;
                    }
                }
                if (pagoLibreConcepto) {
                    pagoLibreConcepto.value = concepto;
                }
                calculateTotal();
            };

            const updateMesesYFechas = () => {
                const meses = parseInt(pagoLibreMeses?.value) || 0;
                const fechaInicio = getPagadoHasta();
                
                // Auto-fill month names
                if (meses > 0 && pagoLibreMesesDetalle) {
                    const nombres = calcularNombresMeses(meses, fechaInicio);
                    pagoLibreMesesDetalle.value = nombres;
                }
                
                // Calculate and display date range
                if (meses > 0) {
                    const rango = calcularRangoFechas(meses, fechaInicio);
                    const fechaDesdeEl = form.querySelector('#pago-fecha-desde');
                    const fechaHastaEl = form.querySelector('#pago-fecha-hasta');
                    if (fechaDesdeEl) fechaDesdeEl.textContent = rango.desde;
                    if (fechaHastaEl) fechaHastaEl.textContent = rango.hasta;
                }
                
                updateConcepto();
            };

            const calcularCostoTotalMeses = (numMeses, fechaInicio) => {
                const base = parseFloat(form.dataset.costoBase || 0);
                const anexos = parseFloat(form.dataset.costoAnexos || 0);
                const subtotalMensual = base + anexos;
                
                const mesInicioDesc = form.dataset.mesInicio;
                const mesFinDesc = form.dataset.mesFin;
                const descPlan = parseFloat(form.dataset.descuentoPlan || 0);
                const estadoOferta = form.dataset.estadoOferta;

                let total = 0.0;
                const fecha = new Date(fechaInicio);

                for (let i = 0; i < numMeses; i++) {
                    fecha.setMonth(fecha.getMonth() + 1);
                    const yyyy = fecha.getFullYear();
                    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
                    const mesStr = `${yyyy}-${mm}`;

                    let aplicaDescuento = false;
                    if (estadoOferta === 'aprobada' && descPlan > 0 && mesInicioDesc && mesFinDesc) {
                        if (mesStr >= mesInicioDesc && mesStr <= mesFinDesc) {
                            aplicaDescuento = true;
                        }
                    }

                    if (aplicaDescuento) {
                        const descMonto = subtotalMensual * (descPlan / 100.0);
                        total += (subtotalMensual - descMonto);
                    } else {
                        total += subtotalMensual;
                    }
                }
                return total;
            };

            if (pagoLibreMeses) {
                pagoLibreMeses.addEventListener('input', () => {
                    const meses = parseInt(pagoLibreMeses.value) || 0;
                    const fechaInicio = getPagadoHasta();
                    if (meses > 0) {
                        const totalCalculado = calcularCostoTotalMeses(meses, fechaInicio);
                        if (pagoLibreMonto) {
                            pagoLibreMonto.value = totalCalculado.toFixed(2);
                        }
                    }
                    updateMesesYFechas();
                });
            }

            if (pagoLibreMesesDetalle) {
                pagoLibreMesesDetalle.addEventListener('input', updateConcepto);
            }

            // Integración rápida "Financiar deudas" dentro del modal de cobro
            form.querySelectorAll('.btn-financiar-deuda-rapido').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Cerrar modal de cobro
                    const modalCobro = document.getElementById('modal-cobro');
                    if (modalCobro) modalCobro.style.display = 'none';

                    // Abrir modal de financiar deuda
                    const modalFinanciar = document.getElementById('modal-financiar-deuda');
                    if (modalFinanciar) {
                        document.getElementById('financiar-cliente-id').value = btn.dataset.cliente || '';
                        document.getElementById('financiar-suministro-id').value = btn.dataset.suministro || '';
                        const resumen = document.getElementById('financiar-resumen');
                        if (resumen) resumen.textContent = 'Selecciona el número de cuotas y confirma.';
                        modalFinanciar.style.display = 'flex';
                    }
                });
            });

            // Recalculate total at startup
            calculateTotal();

            // Submit handler
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                // Check if service is installed before allowing payment
                const fechaInstalacionEl = document.querySelector('[id^="svc-field-fecha-instalacion-"]');
                const fechaInstalacionRaw = fechaInstalacionEl?.dataset?.rawValue;

                // Check for pending installation tickets
                const servicioId = form.dataset.suscripcion;
                const ticketsDataScript = document.getElementById(`tickets-data-${servicioId}`);
                let tieneTicketInstalacionPendiente = false;
                
                if (ticketsDataScript) {
                    try {
                        const tickets = JSON.parse(ticketsDataScript.textContent);
                        tieneTicketInstalacionPendiente = tickets.some(t => 
                            (t.categoria === 'INSTALACION' || t.area === 'planta_externa') &&
                            t.estado_ticket !== 'LIQUIDADO' && 
                            t.estado_ticket !== 'COMPLETADO' &&
                            t.estado_ticket !== 'CANCELADO'
                        );
                    } catch (err) {
                        console.error('Error parsing tickets data:', err);
                    }
                }

                // If service not installed and has pending installation ticket, require liquidation first
                if ((!fechaInstalacionRaw || fechaInstalacionRaw === '') && tieneTicketInstalacionPendiente) {
                    const confirmed = await window.SITAlert.confirm(
                        'El servicio aún no está instalado. Debe liquidar la orden de instalación antes de realizar el pago.\n\n' +
                        '¿Desea ir a liquidar la orden de instalación ahora?'
                    );
                    if (confirmed) {
                        // Switch to campo tab
                        const tabBtn = document.querySelector(`[data-tab-target="svc-campo-${servicioId}"]`);
                        if (tabBtn) tabBtn.click();
                    }
                    return;
                }

                // Collect selected payments
                const pagos = [];
                form.querySelectorAll('.multipago-checkbox:checked').forEach(chk => {
                    const item = chk.closest('.multipago-item');
                    const compSelect = item.querySelector('.multipago-comprobante-select');
                    pagos.push({
                        deuda_id: parseInt(chk.value),
                        monto: parseFloat(item.dataset.monto || 0),
                        tipo_comprobante: compSelect ? compSelect.value : 'NOTA_VENTA'
                    });
                });

                // Add free payment if enabled
                if (chkPagoLibre && chkPagoLibre.checked) {
                    const montoLibre = parseFloat(pagoLibreMonto.value || 0);
                    const conceptoLibre = pagoLibreConcepto.value.trim() || 'Pago de deuda general';
                    const compLibre = form.querySelector('#pago-libre-comprobante')?.value || 'NOTA_VENTA';

                    if (montoLibre <= 0) {
                        window.SITAlert.show('El monto del pago libre debe ser mayor a 0', 'warning');
                        return;
                    }

                    pagos.push({
                        deuda_id: 0,
                        monto: montoLibre,
                        concepto: conceptoLibre,
                        tipo_comprobante: compLibre
                    });
                }

                if (pagos.length === 0) {
                    window.SITAlert.show('Debe seleccionar al menos un cargo a pagar o agregar un pago libre.', 'warning');
                    return;
                }

                const rucEmisorId = form.querySelector('[name="ruc_emisor_id"]')?.value;
                if (!rucEmisorId) {
                    window.SITAlert.show('Debe seleccionar un RUC emisor.', 'warning');
                    return;
                }

                // Handle evidence file upload
                let evidencia_url = null;
                const evid = form.querySelector('.ficha-evidencia-input')?.files?.[0];
                if (evid) {
                    try {
                        const uploadResult = await window.FichaCliente.subirArchivo(evid, 'evidencia_pago', form.dataset.suscripcion);
                        evidencia_url = uploadResult.url;
                    } catch (err) {
                        window.SITAlert.show('Error al subir la evidencia de pago: ' + err.message, 'danger');
                        return;
                    }
                }

                // Prepare payload
                const payload = {
                    cliente_id: form.dataset.cliente,
                    suministro_id: form.dataset.suministro,
                    suscripcion_id: form.dataset.suscripcion,
                    metodo_pago: form.querySelector('[name="metodo_pago"]')?.value || 'EFECTIVO',
                    ruc_emisor_id: form.querySelector('[name="ruc_emisor_id"]')?.value,
                    numero_operacion: form.querySelector('[name="numero_operacion"]')?.value || null,
                    evidencia_url: evidencia_url,
                    pagos: pagos
                };

                // Call multipago API
                try {
                    const res = await fetch('/api/abonados/registrar-multipago/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const json = await res.json();
                    if (json.status !== 'success') {
                        window.SITAlert.show(json.message || 'Error al registrar multipago', 'danger');
                        return;
                    }
                    const comps = json.data.comprobantes || [];
                    const nums = comps.map(c => c.numero || c.tipo).join(', ');
                    window.SITAlert.show(`Pagos registrados exitosamente. Comprobantes emitidos: ${nums || 'Ninguno'}`, 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    console.error(err);
                    window.SITAlert.show('Error de red al registrar el multipago.', 'danger');
                }
            });
        });

        // Abrir Turno Caja
        document.querySelectorAll('.btn-abrir-turno').forEach(btn => {
            btn.addEventListener('click', async () => {
                const monto = await window.SITAlert.prompt('Monto apertura en efectivo (S/):', '0');
                if (monto === null) return;
                
                try {
                    const res = await fetch('/api/abonados/turno-caja/abrir/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ monto_apertura: monto }),
                    });
                    const json = await res.json();
                    if (json.status !== 'success') { 
                        window.SITAlert.show(json.message, 'danger'); 
                        return; 
                    }
                    window.SITAlert.show('Turno de caja abierto correctamente.', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } catch (err) {
                    window.SITAlert.show('Error al abrir el turno de caja.', 'danger');
                }
            });
        });
    });
})();

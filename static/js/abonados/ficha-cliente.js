/**
 * Ficha del abonado: servicio, pagos, liquidación y edición.
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('fichaApp');
    if (!app) return;

    const clienteId = app.dataset.clienteId;
    const compressor = typeof ImageCompressor !== 'undefined' ? new ImageCompressor({ maxFileSizeKB: 500 }) : null;

    // Llenar campos desde client_data_json
    try {
        const cliScript = document.getElementById('client-data');
        if (cliScript) {
            const cli = JSON.parse(cliScript.textContent || '{}');
            if (cli.tipo_cliente) document.getElementById('field-tipo-cliente').textContent = cli.tipo_cliente || '—';
            if (cli.nombres_apellidos) document.getElementById('field-nombres-apellidos').textContent = cli.nombres_apellidos || '—';
        }
    } catch (err) {
        console.error('Error al cargar datos del cliente:', err);
    }

    document.querySelectorAll('.ficha-service-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const url = new URL(window.location.href);
            url.searchParams.set('suscripcion', pill.dataset.suscripcion);
            window.location.href = url.toString();
        });
    });

    document.querySelectorAll('.ficha-service-panel').forEach(panel => {
        panel.querySelectorAll('.ficha-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tabTarget;
                panel.querySelectorAll('.ficha-tab-btn').forEach(b => b.classList.remove('active'));
                panel.querySelectorAll('.ficha-internal-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(target)?.classList.add('active');
            });
        });
    });

    const tabGlobal = new URLSearchParams(window.location.search).get('tab');
    const tabMap = { datos: 'svc-datos', servicio: 'svc-datos', remoto: 'svc-remoto', campo: 'svc-campo', pagos: 'svc-pagos', materiales: 'svc-materiales', contrato: 'svc-contrato' };
    if (tabGlobal && tabMap[tabGlobal]) {
        document.querySelectorAll('.ficha-service-panel.active .ficha-tab-btn').forEach(btn => {
            if (btn.dataset.tabTarget?.startsWith(tabMap[tabGlobal])) btn.click();
        });
    }

    // Manejar botón de aprobación de oferta
    document.querySelectorAll('.btn-aprobar-oferta').forEach(btn => {
        btn.addEventListener('click', async () => {
            const suscripcionId = btn.dataset.suscripcion;
            if (!suscripcionId) return;
            
            if (!confirm('¿Está seguro de aprobar esta oferta? Esto activará el servicio del cliente.')) {
                return;
            }
            
            try {
                const response = await fetch('/api/abonados/aprobar-oferta/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        suscripcion_id: suscripcionId
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert('Oferta aprobada exitosamente');
                    window.location.reload();
                } else {
                    alert('Error al aprobar oferta: ' + (data.message || 'Error desconocido'));
                }
            } catch (error) {
                console.error('Error al aprobar oferta:', error);
                alert('Error al aprobar oferta');
            }
        });
    });

    // Manejar botón de ver oferta
    document.querySelectorAll('.btn-ver-oferta').forEach(btn => {
        btn.addEventListener('click', async () => {
            const suscripcionId = btn.dataset.suscripcion;
            if (!suscripcionId) return;
            
            const modal = document.getElementById(`modal-oferta-${suscripcionId}`);
            if (!modal) return;
            
            modal.style.display = 'flex';
            
            // Load offer details
            try {
                const response = await fetch(`/api/abonados/obtener-oferta/?suscripcion_id=${suscripcionId}`);
                const data = await response.json();
                
                if (data.status === 'success') {
                    const oferta = data.data.oferta;
                    const detallesDiv = document.getElementById(`oferta-detalles-${suscripcionId}`);
                    
                    if (oferta && detallesDiv) {
                        detallesDiv.innerHTML = `
                            <div style="background:var(--bg-surface-active); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
                                <h4 style="margin:0 0 0.5rem 0; color:var(--text-primary);">Información del Plan</h4>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Plan:</strong> ${oferta.plan_nombre || 'N/A'}</p>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Descuento:</strong> ${oferta.descuento_plan || 0}%</p>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Meses de Descuento:</strong> ${oferta.meses_descuento || 0}</p>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Monto Instalación:</strong> S/ ${oferta.monto_instalacion || 0}</p>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Descuento Instalación:</strong> ${oferta.descuento_instalacion || 0}%</p>
                            </div>
                            <div style="background:var(--bg-surface-active); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
                                <h4 style="margin:0 0 0.5rem 0; color:var(--text-primary);">Información del Vendedor</h4>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>ID Vendedor:</strong> ${oferta.vendedor_id || 'N/A'}</p>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Fecha Registro:</strong> ${oferta.fecha_registro || 'N/A'}</p>
                            </div>
                            <div style="background:var(--bg-surface-active); padding:1rem; border-radius:var(--radius-sm);">
                                <h4 style="margin:0 0 0.5rem 0; color:var(--text-primary);">Estado</h4>
                                <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Estado:</strong> <span style="color:${oferta.estado === 'pendiente_aprobacion' ? '#f59e0b' : '#22c55e'}; font-weight:bold;">${oferta.estado || 'N/A'}</span></p>
                                ${oferta.aprobado_por_nombre ? `<p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Aprobado por:</strong> ${oferta.aprobado_por_nombre}</p>` : ''}
                                ${oferta.fecha_aprobacion ? `<p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Fecha Aprobación:</strong> ${oferta.fecha_aprobacion}</p>` : ''}
                            </div>
                        `;
                    }
                } else {
                    document.getElementById(`oferta-detalles-${suscripcionId}`).innerHTML = 
                        `<p style="color:var(--error-color);">Error al cargar detalles: ${data.message || 'Error desconocido'}</p>`;
                }
            } catch (error) {
                console.error('Error al cargar oferta:', error);
                document.getElementById(`oferta-detalles-${suscripcionId}`).innerHTML = 
                    '<p style="color:var(--error-color);">Error de conexión al cargar detalles</p>';
            }
        });
    });

    // Manejar botón de aprobar oferta desde modal
    document.querySelectorAll('.btn-aprobar-oferta-modal').forEach(btn => {
        btn.addEventListener('click', async () => {
            const suscripcionId = btn.dataset.suscripcion;
            if (!suscripcionId) return;
            
            if (!confirm('¿Está seguro de aprobar esta oferta? Esto activará el servicio del cliente.')) {
                return;
            }
            
            try {
                const response = await fetch('/api/abonados/aprobar-oferta/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        suscripcion_id: suscripcionId
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert('Oferta aprobada exitosamente');
                    window.location.reload();
                } else {
                    alert('Error al aprobar oferta: ' + (data.message || 'Error desconocido'));
                }
            } catch (error) {
                console.error('Error al aprobar oferta:', error);
                alert('Error al aprobar oferta');
            }
        });
    });

    // Desplazamiento y resaltado del ticket objetivo si está presente en la URL
    const jump = new URLSearchParams(window.location.search).get('jump') || window.location.hash;
    if (jump) {
        const targetId = jump.startsWith('#') ? jump.substring(1) : jump;
        setTimeout(() => {
            const element = document.getElementById(targetId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Resaltado visual premium
                element.style.transition = 'background-color 0.5s ease';
                element.style.backgroundColor = 'rgba(245, 158, 11, 0.25)'; // Naranja suave/Advertencia
                setTimeout(() => {
                    element.style.backgroundColor = '';
                }, 3000);
            }
        }, 400);
    }


    const subirArchivo = async (file, tipo, suscripcionId) => {
        let blob = file;
        if (compressor && file.type.startsWith('image/')) {
            try { blob = await compressor.compressImage(file); } catch (_) { /* original */ }
        }
        const fd = new FormData();
        fd.append('cliente_id', clienteId);
        fd.append('suscripcion_id', suscripcionId || '');
        fd.append('tipo', tipo);
        fd.append('archivo', blob, file.name);
        const res = await fetch('/api/abonados/subir-documento/', { method: 'POST', body: fd });
        const json = await res.json();
        if (json.status !== 'success') throw new Error(json.message || 'Error al subir');
        return json.data;
    };

    document.querySelectorAll('.ficha-upload-input').forEach(input => {
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                await subirArchivo(file, input.dataset.tipo, input.dataset.suscripcion);
                alert('Archivo guardado.');
                window.location.reload();
            } catch (err) { alert(err.message); }
        });
    });

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

        // Listeners for total recalculation
        if (listContainer) {
            listContainer.addEventListener('change', (e) => {
                if (e.target.classList.contains('multipago-checkbox')) {
                    calculateTotal();
                }
            });
        }

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
            } else {
                concepto = '';
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

        pagoLibreMeses.addEventListener('input', () => {
            const meses = parseInt(pagoLibreMeses.value) || 0;
            if (meses > 0 && costoPlan > 0) {
                const totalMonto = (costoPlan * meses).toFixed(2);
                if (pagoLibreMonto) {
                    pagoLibreMonto.value = totalMonto;
                }
            }
            updateMesesYFechas();
        });

        if (pagoLibreMesesDetalle) {
            pagoLibreMesesDetalle.addEventListener('input', updateConcepto);
        }

        // Initial calculation
        calculateTotal();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Check if service is installed before allowing payment
            const fechaInstalacionEl = document.querySelector('[id^="svc-field-fecha-instalacion-"]');
            const fechaInstalacionRaw = fechaInstalacionEl?.dataset?.rawValue;
            const estadoServicioEl = document.querySelector('.ab-status');
            const estadoServicio = estadoServicioEl?.textContent?.trim().toLowerCase();

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
                const confirmar = confirm(
                    'El servicio aún no está instalado. Debe liquidar la orden de instalación antes de realizar el pago.\n\n' +
                    '¿Desea ir a liquidar la orden de instalación ahora?'
                );
                if (confirmar) {
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
                    alert('El monto del pago libre debe ser mayor a 0');
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
                alert('Debe seleccionar al menos un cargo a pagar o agregar un pago libre.');
                return;
            }

            const rucEmisorId = form.querySelector('[name="ruc_emisor_id"]')?.value;
            if (!rucEmisorId) {
                alert('Debe seleccionar un RUC emisor.');
                return;
            }

            // Handle evidence file upload
            let evidencia_url = null;
            const evid = form.querySelector('.ficha-evidencia-input')?.files?.[0];
            if (evid) {
                try {
                    const uploadResult = await subirArchivo(evid, 'evidencia_pago', form.dataset.suscripcion);
                    evidencia_url = uploadResult.url;
                } catch (err) {
                    alert('Error al subir la evidencia de pago: ' + err.message);
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
                    alert(json.message || 'Error al registrar multipago');
                    return;
                }
                const comps = json.data.comprobantes || [];
                const nums = comps.map(c => c.numero || c.tipo).join(', ');
                alert(`Pagos registrados exitosamente. Comprobantes emitidos: ${nums || 'Ninguno'}`);
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert('Error de red al registrar el multipago.');
            }
        });
    });

    document.querySelectorAll('.btn-abrir-turno').forEach(btn => {
        btn.addEventListener('click', async () => {
            const monto = prompt('Monto apertura en efectivo (S/):', '0');
            if (monto === null) return;
            const res = await fetch('/api/abonados/turno-caja/abrir/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monto_apertura: monto }),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            window.location.reload();
        });
    });

    document.querySelectorAll('.modal-ticket-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const modal = form.closest('.modal');

            // Gather extra fields
            const nuevoSuministroInput = modal ? modal.querySelector('#nuevo-suministro-input') : null;
            const nuevoPlanSelect = modal ? modal.querySelector('#nuevo-plan-select') : null;
            const chkCambioEquipo = modal ? modal.querySelector('#chk-cambio-equipo') : null;

            const payload = {
                suscripcion_id: fd.get('suscripcion_id'),
                catalogo_ticket_id: fd.get('catalogo_ticket_id') || null,
                derivar_campo: fd.get('derivar_campo') === 'on',
                motivo: fd.get('motivo') || '',
                cargo_materiales: fd.get('cargo_materiales') || 'empresa',
            };

            if (nuevoSuministroInput && nuevoSuministroInput.value.trim()) {
                payload.nuevo_suministro = nuevoSuministroInput.value.trim();
            }
            if (nuevoPlanSelect && nuevoPlanSelect.value) {
                payload.nuevo_plan_id = parseInt(nuevoPlanSelect.value, 10);
            }
            if (chkCambioEquipo && chkCambioEquipo.checked) {
                payload.cambio_equipo = true;
            }

            const res = await fetch('/api/abonados/generar-ticket/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            alert(`Ticket T${json.data.ticket_id} generado.`);
            window.location.reload();
        });
    });

    // ── Ver / imprimir ticket ──────────────────────────────────────────────
    document.querySelectorAll('.btn-ver-ticket').forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof window.imprimirTicket !== 'function') {
                alert('El módulo de ticket no está disponible.');
                return;
            }

            // Datos del ticket desde data-attributes del botón
            const ticketNum = btn.dataset.ticketNum || btn.dataset.ticketId || '—';
            const categoria = btn.dataset.ticketCat || 'INCIDENCIA';
            const ticketNombre = btn.dataset.ticketNombre || '';

            // Datos del servicio y cliente desde el JSON incrustado en la página
            const suscripcionId = btn.dataset.suscripcion;
            let servicioData = {};
            let clienteData = {};
            let logoUrl = null;
            let telefono = '064466080';
            let sedeNombre = 'LA OROYA';

            // Buscar ticket en el JSON de tickets para obtener datos completos (incluido liquidacion)
            let ticketObj = null;
            try {
                const ticketsScript = document.getElementById(`tickets-data-${suscripcionId}`);
                if (ticketsScript) {
                    const ticketsArray = JSON.parse(ticketsScript.textContent || '[]');
                    ticketObj = ticketsArray.find(t => String(t.id) === String(btn.dataset.ticketId || btn.dataset.ticketNum));
                }
            } catch (err) {
                console.error('Error al parsear tickets-data:', err);
            }

            const ticketData = {
                motivo: btn.dataset.ticketMotivo || '—',
                detalle: btn.dataset.ticketDetalle || '—',
                fecha_emision: btn.dataset.ticketFechaEmision || '—',
                hora_emision: btn.dataset.ticketHoraEmision || '—',
                fecha_atencion: '—',
                hora_atencion: '—',
                materiales_usados: '—',
                materiales_retirados: '—',
                observacion: btn.dataset.ticketObservacion || '—',
            };

            if (ticketObj) {
                if (ticketObj.notas) {
                    ticketData.detalle = ticketObj.notas;
                }
                if (ticketObj.motivo) {
                    ticketData.motivo = ticketObj.motivo;
                }

                // Si está liquidado
                if (ticketObj.fecha_liquidacion && ticketObj.fecha_liquidacion !== 'None') {
                    const parts = ticketObj.fecha_liquidacion.split(' ');
                    if (parts.length >= 2) {
                        ticketData.fecha_atencion = parts[0];
                        ticketData.hora_atencion = parts[1];
                    } else {
                        ticketData.fecha_atencion = ticketObj.fecha_liquidacion;
                    }
                }

                if (ticketObj.liquidacion && typeof ticketObj.liquidacion === 'object') {
                    const liq = ticketObj.liquidacion;

                    // Motivo/ObservaciÃ³n de liquidación
                    if (liq.solucion) {
                        ticketData.observacion = liq.solucion;
                    } else if (liq.observaciones) {
                        ticketData.observacion = liq.observaciones;
                    }

                    // Materiales usados y retirados
                    if (Array.isArray(liq.materiales) && liq.materiales.length > 0) {
                        const usados = [];
                        const retirados = [];
                        liq.materiales.forEach(m => {
                            if (m.descripcion.toUpperCase().includes('[RETIRO]')) {
                                const descLimpia = m.descripcion.replace(/\[RETIRO\]\s*/i, '');
                                retirados.push(`${descLimpia} (Cant: ${m.cantidad})`);
                            } else {
                                usados.push(`${m.descripcion} (Cant: ${m.cantidad})`);
                            }
                        });
                        if (usados.length > 0) {
                            ticketData.materiales_usados = usados.join('<br>');
                        }
                        if (retirados.length > 0) {
                            ticketData.materiales_retirados = retirados.join('<br>');
                        }
                    }
                }
            }

            try {
                const svcScript = document.getElementById(`service-data-${suscripcionId}`);
                if (svcScript) {
                    const svc = JSON.parse(svcScript.textContent || '{}');
                    servicioData = {
                        suministro: svc.suministro || '—',
                        plan: svc.plan || '—',
                        codigo: svcScript.id.replace('service-data-', ''),
                        velocidad: svc.velocidad || '—',
                        estado: svc.estado || '—',
                        anexos: svc.numero_anexos || '—',
                        nap: svc.nap_id || '—',
                        puerto: svc.puerto_nap || '—',
                        precinto: svc.presinto_numero || '—',
                        serie_equipo: svc.serie_equipo || '—',
                        mac_equipo: svc.mac_equipo || '—',
                        sector: svc.sector || '—',
                    };
                    logoUrl = svc.logo_url || svc.sede_logo || null;
                    telefono = svc.sede_telefono || '064466080';
                    sedeNombre = svc.sede_nombre || 'LA OROYA';
                }
            } catch (err) { /* usa valores por defecto */ }

            try {
                const cliScript = document.getElementById('client-data');
                if (cliScript) {
                    const cli = JSON.parse(cliScript.textContent || '{}');
                    clienteData = {
                        nombre: cli.nombres_apellidos || cli.razon_social || '—',
                        dni: cli.dni || '—',
                        codigo: cli.id_cliente_codigo || '—',
                        contrato: suscripcionId || '—',
                        celular1: cli.celular_1 || '—',
                        celular2: cli.celular_2 || '—',
                        direccion: cli.direccion_fiscal || '—',
                        sector: servicioData.sector || '—',
                    };
                }
            } catch (err) { /* usa valores por defecto */ }

            window.imprimirTicket(
                logoUrl, `T${ticketNum}`, categoria,
                telefono, sedeNombre,
                clienteData, servicioData, ticketData, ticketNombre
            );
        });
    });


    document.querySelectorAll('.btn-liquidar-desc').forEach(btn => {
        btn.addEventListener('click', () => {
            const sus = btn.closest('.ficha-service-panel')?.dataset.suscripcion;
            const modal = document.getElementById(`modal-liquidar-remoto-${sus}`);
            if (modal) {
                const form = modal.querySelector('form');
                if (form) form.reset();
                const hidden = modal.querySelector('input[name="ticket_id"]');
                if (hidden) hidden.value = btn.dataset.ticket;
                modal.style.display = 'flex';
            }
        });
    });

    document.querySelectorAll('.ficha-liq-desc-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const res = await fetch('/api/abonados/liquidar-ticket/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: fd.get('ticket_id'),
                    tipo: 'DESCRIPTIVA',
                    titulo_solucion: fd.get('titulo_solucion'),
                    solucion: fd.get('solucion'),
                }),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            alert('Ticket liquidado.');
            window.location.reload();
        });
    });

    // Caches and helpers for Materials and NAPs autocompletes
    let materialsCache = null;
    const napsCache = {};

    const fetchMaterials = async () => {
        if (materialsCache) return materialsCache;
        try {
            const resp = await fetch('/api/materiales/listar/');
            const json = await resp.json();
            if (json.status === 'success') {
                materialsCache = json.data;
                return materialsCache;
            }
        } catch (err) {
            console.error('Error al listar materiales:', err);
        }
        return [];
    };

    const fetchNaps = async (sedeId) => {
        const url = sedeId ? `/api/abonados/infraestructura-red/?sede_id=${sedeId}` : '/api/abonados/infraestructura-red/';
        const cacheKey = sedeId || 'all';
        if (napsCache[cacheKey]) return napsCache[cacheKey];
        try {
            const resp = await fetch(url);
            const json = await resp.json();
            if (json.status === 'success') {
                napsCache[cacheKey] = json.naps || json.data?.naps || [];
                return napsCache[cacheKey];
            }
        } catch (err) {
            console.error('Error al listar NAPs:', err);
        }
        return [];
    };

    // Initialize NAP autocomplete on forms
    document.querySelectorAll('.ficha-liq-mat-form').forEach(form => {
        const sedeId = form.dataset.sedeId;
        const searchInput = form.querySelector('.nap-search-input');
        const hiddenInput = form.querySelector('.nap-id-hidden');
        const suggestionsBox = form.querySelector('.autocomplete-suggestions');

        if (!searchInput || !hiddenInput || !suggestionsBox) return;

        let activeIndex = -1;
        let localNaps = [];

        const ensureNapsLoaded = async () => {
            if (localNaps.length === 0) {
                localNaps = await fetchNaps(null);
            }
        };

        const updateSuggestions = () => {
            if (searchInput.readOnly) return;
            const val = searchInput.value.trim().toLowerCase();
            suggestionsBox.innerHTML = '';

            // Show suggestions matching, or show all if empty
            const filtered = val ? localNaps.filter(nap => nap.codigo.toLowerCase().includes(val)) : localNaps;
            if (filtered.length === 0) {
                suggestionsBox.style.display = 'none';
                return;
            }

            filtered.forEach((nap, idx) => {
                const div = document.createElement('div');
                div.textContent = nap.codigo;
                div.style = 'padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border-color); color: var(--text-color); font-size: 0.85rem;';

                div.addEventListener('click', () => {
                    searchInput.value = nap.codigo;
                    hiddenInput.value = nap.id;
                    suggestionsBox.style.display = 'none';
                });

                div.addEventListener('mouseenter', () => {
                    div.style.background = 'var(--bg-surface-hover)';
                    activeIndex = idx;
                });
                div.addEventListener('mouseleave', () => {
                    div.style.background = 'transparent';
                });

                suggestionsBox.appendChild(div);
            });

            suggestionsBox.style.display = 'block';
            activeIndex = -1;
        };

        searchInput.addEventListener('focus', async () => {
            if (searchInput.readOnly) return;
            await ensureNapsLoaded();
            updateSuggestions();
        });

        searchInput.addEventListener('click', async () => {
            if (searchInput.readOnly) return;
            await ensureNapsLoaded();
            updateSuggestions();
        });

        searchInput.addEventListener('input', async () => {
            if (searchInput.readOnly) return;
            await ensureNapsLoaded();
            updateSuggestions();
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        });

        searchInput.addEventListener('keydown', (e) => {
            const items = suggestionsBox.querySelectorAll('div');
            if (suggestionsBox.style.display === 'block' && items.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    activeIndex = (activeIndex + 1) % items.length;
                    items.forEach((item, idx) => {
                        item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent';
                    });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    activeIndex = (activeIndex - 1 + items.length) % items.length;
                    items.forEach((item, idx) => {
                        item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent';
                    });
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (activeIndex >= 0 && activeIndex < items.length) {
                        items[activeIndex].click();
                    } else if (items.length > 0) {
                        items[0].click();
                    }
                } else if (e.key === 'Escape') {
                    suggestionsBox.style.display = 'none';
                }
            }
        });

        // Initialize Router Model autocomplete
        const modelInput = form.querySelector('.router-modelo-input');
        const modelSuggestions = form.querySelector('.router-suggestions-box');

        if (modelInput && modelSuggestions) {
            let activeModelIndex = -1;

            const updateModelSuggestions = async () => {
                const val = modelInput.value.trim().toLowerCase();
                modelSuggestions.innerHTML = '';

                const materials = await fetchMaterials();
                // Filter where tipo_material is equipo (main equipment / router)
                const routers = materials.filter(m => m.tipo_material === 'equipo');
                const filtered = val ? routers.filter(m => m.nombre.toLowerCase().includes(val)) : routers;

                if (filtered.length === 0) {
                    modelSuggestions.style.display = 'none';
                    return;
                }

                filtered.forEach((m, idx) => {
                    const div = document.createElement('div');
                    div.textContent = m.nombre;
                    div.style = 'padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border-color); color: var(--text-color); font-size: 0.85rem;';

                    div.addEventListener('click', () => {
                        modelInput.value = m.nombre;
                        modelSuggestions.style.display = 'none';
                    });

                    div.addEventListener('mouseenter', () => {
                        div.style.background = 'var(--bg-surface-hover)';
                        activeModelIndex = idx;
                    });
                    div.addEventListener('mouseleave', () => {
                        div.style.background = 'transparent';
                    });

                    modelSuggestions.appendChild(div);
                });

                modelSuggestions.style.display = 'block';
                activeModelIndex = -1;
            };

            modelInput.addEventListener('focus', updateModelSuggestions);
            modelInput.addEventListener('click', updateModelSuggestions);
            modelInput.addEventListener('input', updateModelSuggestions);

            modelInput.addEventListener('keydown', (e) => {
                const items = modelSuggestions.querySelectorAll('div');
                if (modelSuggestions.style.display === 'block' && items.length > 0) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeModelIndex = (activeModelIndex + 1) % items.length;
                        items.forEach((item, idx) => {
                            item.style.background = idx === activeModelIndex ? 'var(--bg-surface-hover)' : 'transparent';
                        });
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeModelIndex = (activeModelIndex - 1 + items.length) % items.length;
                        items.forEach((item, idx) => {
                            item.style.background = idx === activeModelIndex ? 'var(--bg-surface-hover)' : 'transparent';
                        });
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (activeModelIndex >= 0 && activeModelIndex < items.length) {
                            items[activeModelIndex].click();
                        } else if (items.length > 0) {
                            items[0].click();
                        }
                    } else if (e.key === 'Escape') {
                        modelSuggestions.style.display = 'none';
                    }
                }
            });

            document.addEventListener('click', (e) => {
                if (!modelInput.contains(e.target) && !modelSuggestions.contains(e.target)) {
                    modelSuggestions.style.display = 'none';
                }
            });
        }
    });

    function calcularFechaLimiteCorte(fechaInstStr, diaVencimiento, diasGracia) {
        if (!fechaInstStr) return '';
        const dateParts = fechaInstStr.split('-');
        if (dateParts.length !== 3) return '';
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
        const day = parseInt(dateParts[2], 10);

        const installDate = new Date(year, month, day);
        let dueDate;

        if (diaVencimiento === 'fin_mes') {
            // Last day of the current month of installation
            dueDate = new Date(year, month + 1, 0);
        } else { // 'fecha_instalacion'
            // Same day next month
            dueDate = new Date(year, month + 1, day);
            // Handle if next month has fewer days (e.g. March 31 -> April 30)
            if (dueDate.getMonth() !== (month + 1) % 12) {
                dueDate = new Date(year, month + 2, 0); // Last day of target month
            }
        }

        // Cut-off date is due date + grace days
        const cutoffDate = new Date(dueDate.getTime());
        cutoffDate.setDate(cutoffDate.getDate() + parseInt(diasGracia || 5, 10));

        // Format as YYYY-MM-DD
        const y = cutoffDate.getFullYear();
        const m = String(cutoffDate.getMonth() + 1).padStart(2, '0');
        const d = String(cutoffDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    document.querySelectorAll('.btn-liquidar-mat').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = 'liq-mat-modal-' + btn.closest('.ficha-service-panel').dataset.suscripcion;
            const modal = document.getElementById(modalId);
            const tid = modal.querySelector('.liq-mat-ticket-id');
            if (tid) tid.value = btn.dataset.ticket;

            // Auto-calculate dates
            const form = modal.querySelector('.ficha-liq-mat-form');
            if (form) {
                const diaVencimiento = form.dataset.diaVencimiento || 'fin_mes';
                const diasGracia = parseInt(form.dataset.diasGracia || '5', 10);
                const instInput = form.querySelector('[name="fecha_instalacion"]');
                const corteInput = form.querySelector('[name="fecha_limite_corte"]');

                // Save isInstalacion state on form
                const isInstTicket = btn.dataset.categoria && btn.dataset.categoria.toLowerCase().includes('instal');
                form.dataset.isInstalacion = isInstTicket ? 'true' : 'false';

                // Clear dynamic lists
                const usadosList = form.querySelector('.ficha-materiales-usados-list');
                if (usadosList) usadosList.innerHTML = '';
                
                const retiradosList = form.querySelector('.ficha-materiales-retirados-list');
                if (retiradosList) {
                    retiradosList.innerHTML = '';
                    const aviso = document.createElement('p');
                    aviso.className = 'mat-retirados-aviso-vacio';
                    aviso.style = 'font-size:0.8rem; color:var(--text-muted); text-align:center; padding:0.5rem 0; margin:0;';
                    aviso.innerHTML = '<i class="fa-solid fa-box-open"></i> Sin materiales registrados.';
                    retiradosList.appendChild(aviso);
                }

                // Restore Router Card style if exists
                const routerCard = form.querySelector('.installed-router-card');
                if (routerCard) {
                    routerCard.style.opacity = '1';
                    routerCard.style.pointerEvents = 'auto';
                    routerCard.style.borderStyle = 'dashed';
                    routerCard.style.borderColor = 'var(--primary-color)';
                    const btnRet = routerCard.querySelector('.btn-retire-router-shortcut');
                    if (btnRet) {
                        btnRet.innerHTML = '<i class="fa-solid fa-arrow-right-long"></i> Retirar';
                        btnRet.style.color = 'var(--primary-color)';
                    }
                }

                const suscripcionId = form.dataset.suscripcion;

                // Load existing customer materials as draggable badges
                const clientMaterialsList = form.querySelector('.client-materials-list');
                if (clientMaterialsList) {
                    clientMaterialsList.innerHTML = '';
                    const scriptTag = document.getElementById(`materiales-cliente-${suscripcionId}`);
                    if (scriptTag) {
                        try {
                            const rawList = JSON.parse(scriptTag.textContent || '[]');
                            if (rawList.length > 0) {
                                rawList.forEach(item => {
                                    if (item.cantidad_disponible > 0) {
                                        const badge = document.createElement('div');
                                        badge.className = 'client-mat-badge';
                                        badge.draggable = true;
                                        badge.dataset.nombre = item.nombre;
                                        badge.dataset.disponible = item.cantidad_disponible;
                                        badge.innerHTML = `
                                            <i class="fa-solid fa-grip-vertical"></i>
                                            <span>${item.nombre} (${item.cantidad_disponible})</span>
                                            <button type="button" class="btn-retire-badge-shortcut" style="background:none; border:none; color:var(--primary-color); cursor:pointer; padding:0 0 0 0.25rem; font-size:0.75rem;" title="Retirar"><i class="fa-solid fa-arrow-right"></i></button>`;
                                        clientMaterialsList.appendChild(badge);
                                    }
                                });
                            } else {
                                clientMaterialsList.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">No hay materiales previos registrados.</span>';
                            }
                        } catch (e) {
                            console.error('Error al cargar materiales actuales del cliente:', e);
                        }
                    }
                }

                // Setup Drag & Drop & Shortcut handlers
                setupDragAndDrop(form, suscripcionId);

                const tecnicosList = form.querySelector('.ficha-tecnicos-list');
                if (tecnicosList) tecnicosList.innerHTML = '';

                // Add an initial technician row by default
                const addTecBtn = form.querySelector('.btn-add-tecnico');
                if (addTecBtn) addTecBtn.click();

                if (instInput) {
                    const hasNoOrigValue = !instInput.getAttribute('value');

                    if (isInstTicket || hasNoOrigValue || !instInput.value) {
                        const today = new Date();
                        const y = today.getFullYear();
                        const m = String(today.getMonth() + 1).padStart(2, '0');
                        const d = String(today.getDate()).padStart(2, '0');
                        instInput.value = `${y}-${m}-${d}`;
                    }

                    if (isInstTicket || hasNoOrigValue || !corteInput.value) {
                        corteInput.value = calcularFechaLimiteCorte(instInput.value, diaVencimiento, diasGracia);
                    }
                }
            }

            if (modal) modal.style.display = 'flex';
        });
    });

    // ─── HELPER: crear fila de material "Utilizado" con autocomplete del catálogo ───
    function crearFilaMaterialUsado(list) {
        const row = document.createElement('div');
        row.className = 'ficha-material-row ficha-material-usado-row';
        row.innerHTML = `
            <div class="mat-desc-container">
                <input type="text" placeholder="Buscar material del catálogo..." class="abonados-select mat-desc" autocomplete="off" required>
                <div class="mat-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface-active); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 180px; overflow-y: auto; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
            </div>
            <input type="number" placeholder="Cant." min="1" value="1" step="1" class="abonados-select mat-cant" required>
            <input type="number" placeholder="Precio" min="0" value="0.00" step="0.01" class="abonados-select mat-precio" required>
            <button type="button" class="abonados-btn abonados-btn-ghost btn-rm-material" title="Eliminar"><i class="fa-solid fa-trash"></i></button>`;

        row.querySelector('.btn-rm-material')?.addEventListener('click', () => row.remove());
        list.appendChild(row);

        const matDescInput = row.querySelector('.mat-desc');
        const suggestionsBox = row.querySelector('.mat-suggestions');
        const matPrecio = row.querySelector('.mat-precio');
        const matCant = row.querySelector('.mat-cant');
        let activeIndex = -1;

        const updateSuggestions = async () => {
            const val = matDescInput.value.trim().toLowerCase();
            suggestionsBox.innerHTML = '';
            const materials = await fetchMaterials();
            const filtered = val ? materials.filter(m => m.nombre.toLowerCase().includes(val)) : materials;
            if (filtered.length === 0) { suggestionsBox.style.display = 'none'; return; }

            filtered.forEach((m, idx) => {
                const div = document.createElement('div');
                div.textContent = m.nombre;
                div.style = 'padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border-color); color: var(--text-color); font-size: 0.85rem;';
                div.addEventListener('click', () => {
                    matDescInput.value = m.nombre;
                    const precio = m.tipo_material === 'equipo' ? (m.precio_venta_equipo || m.precio_unitario || 0) : (m.precio_unitario || 0);
                    row.dataset.materialPrice = precio;
                    matPrecio.value = parseFloat(precio).toFixed(2);
                    matCant.removeAttribute('max');
                    suggestionsBox.style.display = 'none';
                    matCant.focus();
                });
                div.addEventListener('mouseenter', () => { div.style.background = 'var(--bg-surface-hover)'; activeIndex = idx; });
                div.addEventListener('mouseleave', () => { div.style.background = 'transparent'; });
                suggestionsBox.appendChild(div);
            });
            suggestionsBox.style.display = 'block';
            activeIndex = -1;
        };

        matDescInput.addEventListener('input', updateSuggestions);
        matDescInput.addEventListener('focus', updateSuggestions);
        matDescInput.addEventListener('click', updateSuggestions);

        matDescInput.addEventListener('keydown', (e) => {
            const items = suggestionsBox.querySelectorAll('div');
            if (suggestionsBox.style.display === 'block' && items.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    activeIndex = (activeIndex + 1) % items.length;
                    items.forEach((item, idx) => { item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent'; });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    activeIndex = (activeIndex - 1 + items.length) % items.length;
                    items.forEach((item, idx) => { item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent'; });
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (activeIndex >= 0 && activeIndex < items.length) items[activeIndex].click();
                    else if (items.length > 0) items[0].click();
                } else if (e.key === 'Escape') {
                    suggestionsBox.style.display = 'none';
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (!matDescInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        });
    }

    // ─── HELPER: crear fila de material "Retirado" con autocomplete de materiales del cliente ───
    function crearFilaMaterialRetirado(list, suscripcionId, nombre = '', cantDisp = null, cantVal = 1) {
        const row = document.createElement('div');
        row.className = 'ficha-material-row ficha-material-retirado-row';
        row.dataset.esRetiro = 'true';

        const isPreloaded = nombre !== '';
        row.innerHTML = `
            <div class="mat-desc-container">
                <input type="text" placeholder="Buscar material del cliente..." class="abonados-select mat-desc" ${isPreloaded ? 'style="background: var(--bg-surface-active); color: var(--text-color);"' : ''} autocomplete="off" value="${nombre}" required>
                <div class="mat-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface-active); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 180px; overflow-y: auto; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
            </div>
            ${cantDisp !== null ? `<span class="mat-disp-badge">Disp: ${cantDisp}</span>` : ''}
            <input type="number" placeholder="Cant." min="1" value="${cantVal}" step="1" class="abonados-select mat-cant" ${cantDisp !== null ? `max="${cantDisp}"` : ''} required>
            <input type="hidden" class="mat-precio" value="0.00">
            <button type="button" class="abonados-btn abonados-btn-ghost btn-rm-material" title="Eliminar"><i class="fa-solid fa-trash"></i></button>`;

        row.querySelector('.btn-rm-material')?.addEventListener('click', () => {
            row.remove();
            
            // Si el nombre representa al router, restauramos el router card y los inputs del formulario
            if (nombre.startsWith('EQUIPO:')) {
                const routerCard = list.closest('form').querySelector('.installed-router-card');
                if (routerCard) {
                    routerCard.style.opacity = '1';
                    routerCard.style.pointerEvents = 'auto';
                    routerCard.style.borderStyle = 'dashed';
                    routerCard.style.borderColor = 'var(--primary-color)';
                    const btnRet = routerCard.querySelector('.btn-retire-router-shortcut');
                    if (btnRet) {
                        btnRet.innerHTML = '<i class="fa-solid fa-arrow-right-long"></i> Retirar';
                        btnRet.style.color = 'var(--primary-color)';
                    }
                    
                    // Restaurar los valores originales en los inputs
                    const modeloInput = list.closest('form').querySelector('[name="router_modelo"]');
                    const serieInput = list.closest('form').querySelector('[name="router_serie"]');
                    const macInput = list.closest('form').querySelector('[name="router_mac"]');
                    if (modeloInput) modeloInput.value = routerCard.dataset.modelo;
                    if (serieInput) serieInput.value = routerCard.dataset.serie;
                    if (macInput) macInput.value = routerCard.dataset.mac;
                }
            }
            
            // Si la lista queda vacía, volvemos a mostrar el aviso de vacío
            if (list.querySelectorAll('.ficha-material-retirado-row').length === 0) {
                const emptyNotice = list.querySelector('.mat-retirados-aviso-vacio');
                if (!emptyNotice) {
                    const aviso = document.createElement('p');
                    aviso.className = 'mat-retirados-aviso-vacio';
                    aviso.style = 'font-size:0.8rem; color:var(--text-muted); text-align:center; padding:0.5rem 0; margin:0;';
                    aviso.innerHTML = '<i class="fa-solid fa-box-open"></i> Sin materiales registrados.';
                    list.appendChild(aviso);
                }
            }
        });

        list.appendChild(row);

        const matDescInput = row.querySelector('.mat-desc');
        const suggestionsBox = row.querySelector('.mat-suggestions');
        const matCant = row.querySelector('.mat-cant');
        let activeIndex = -1;

        const getClientMaterials = () => {
            const scriptTag = document.getElementById(`materiales-cliente-${suscripcionId}`);
            if (!scriptTag) return [];
            try {
                const rawList = JSON.parse(scriptTag.textContent || '[]');
                return rawList.map(item => ({ nombre: item.nombre, cantidad_disponible: item.cantidad_disponible }));
            } catch (e) { return []; }
        };

        const updateSuggestions = () => {
            const val = matDescInput.value.trim().toLowerCase();
            suggestionsBox.innerHTML = '';
            const materials = getClientMaterials();
            const filtered = val ? materials.filter(m => m.nombre.toLowerCase().includes(val)) : materials;
            if (filtered.length === 0) { suggestionsBox.style.display = 'none'; return; }

            filtered.forEach((m, idx) => {
                const div = document.createElement('div');
                div.textContent = `${m.nombre} (Disp: ${m.cantidad_disponible})`;
                div.style = 'padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border-color); color: var(--text-color); font-size: 0.85rem;';
                div.addEventListener('click', () => {
                    matDescInput.value = m.nombre;
                    matCant.max = m.cantidad_disponible;
                    matCant.value = Math.min(parseInt(matCant.value) || 1, m.cantidad_disponible);
                    const badge = row.querySelector('.mat-disp-badge');
                    if (badge) badge.textContent = `Disp: ${m.cantidad_disponible}`;
                    suggestionsBox.style.display = 'none';
                    matCant.focus();
                });
                div.addEventListener('mouseenter', () => { div.style.background = 'var(--bg-surface-hover)'; activeIndex = idx; });
                div.addEventListener('mouseleave', () => { div.style.background = 'transparent'; });
                suggestionsBox.appendChild(div);
            });
            suggestionsBox.style.display = 'block';
            activeIndex = -1;
        };

        if (!isPreloaded) {
            matDescInput.addEventListener('input', updateSuggestions);
            matDescInput.addEventListener('focus', updateSuggestions);
            matDescInput.addEventListener('click', updateSuggestions);

            matDescInput.addEventListener('keydown', (e) => {
                const items = suggestionsBox.querySelectorAll('div');
                if (suggestionsBox.style.display === 'block' && items.length > 0) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeIndex = (activeIndex + 1) % items.length;
                        items.forEach((item, idx) => { item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent'; });
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeIndex = (activeIndex - 1 + items.length) % items.length;
                        items.forEach((item, idx) => { item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent'; });
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (activeIndex >= 0 && activeIndex < items.length) items[activeIndex].click();
                        else if (items.length > 0) items[0].click();
                    } else if (e.key === 'Escape') {
                        suggestionsBox.style.display = 'none';
                    }
                }
            });

            document.addEventListener('click', (e) => {
                if (!matDescInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                    suggestionsBox.style.display = 'none';
                }
            });
        }
    }

    // ─── HELPER: setupDragAndDrop logic ───
    function setupDragAndDrop(form, suscripcionId) {
        const dropzone = form.querySelector('.materials-dropzone');
        const retiradosList = form.querySelector('.ficha-materiales-retirados-list');
        const routerCard = form.querySelector('.installed-router-card');
        const badgeContainer = form.querySelector('.client-materials-list');

        if (!dropzone || !retiradosList) return;

        // Función para retirar material (evita duplicidad y remueve aviso de vacío)
        const retireMaterial = (nombre, disponible) => {
            let exists = false;
            retiradosList.querySelectorAll('.ficha-material-retirado-row').forEach(row => {
                const descInput = row.querySelector('.mat-desc');
                if (descInput && descInput.value.trim() === nombre.trim()) {
                    exists = true;
                    const cantInput = row.querySelector('.mat-cant');
                    if (cantInput) {
                        cantInput.value = Math.min((parseInt(cantInput.value) || 0) + 1, disponible);
                        cantInput.focus();
                    }
                }
            });

            if (!exists) {
                const emptyNotice = retiradosList.querySelector('.mat-retirados-aviso-vacio');
                if (emptyNotice) emptyNotice.remove();
                crearFilaMaterialRetirado(retiradosList, suscripcionId, nombre, disponible, 1);
            }
        };

        // Función para retirar router actual
        const retireRouter = () => {
            if (!routerCard) return;
            const modelo = routerCard.dataset.modelo;
            const serie = routerCard.dataset.serie;
            const mac = routerCard.dataset.mac;

            const routerDesc = `EQUIPO: ${modelo} (Serie: ${serie}, MAC: ${mac})`;
            retireMaterial(routerDesc, 1);

            // Limpiar inputs de nuevos datos del router
            const modeloInput = form.querySelector('[name="router_modelo"]');
            const serieInput = form.querySelector('[name="router_serie"]');
            const macInput = form.querySelector('[name="router_mac"]');
            if (modeloInput) modeloInput.value = '';
            if (serieInput) serieInput.value = '';
            if (macInput) macInput.value = '';

            // Visual de tarjeta deshabilitada/retirada
            routerCard.style.opacity = '0.5';
            routerCard.style.pointerEvents = 'none';
            routerCard.style.borderStyle = 'solid';
            routerCard.style.borderColor = 'var(--text-muted)';
            const btnRet = routerCard.querySelector('.btn-retire-router-shortcut');
            if (btnRet) {
                btnRet.innerHTML = '<i class="fa-solid fa-check"></i> Retirado';
                btnRet.style.color = 'var(--text-muted)';
            }
        };

        // Drag router logic
        if (routerCard) {
            routerCard.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'router' }));
                e.dataTransfer.effectAllowed = 'move';
                dropzone.style.borderColor = 'var(--primary-color)';
                dropzone.style.background = 'var(--bg-surface-hover)';
            });

            routerCard.addEventListener('dragend', () => {
                dropzone.style.borderColor = 'var(--border-color)';
                dropzone.style.background = 'var(--bg-surface)';
            });

            const btnRet = routerCard.querySelector('.btn-retire-router-shortcut');
            if (btnRet) {
                btnRet.addEventListener('click', (e) => {
                    e.preventDefault();
                    retireRouter();
                });
            }
        }

        // Drag client material badges logic
        if (badgeContainer) {
            badgeContainer.querySelectorAll('.client-mat-badge').forEach(badge => {
                badge.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'material',
                        nombre: badge.dataset.nombre,
                        disponible: parseInt(badge.dataset.disponible || '1', 10)
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                    dropzone.style.borderColor = 'var(--primary-color)';
                    dropzone.style.background = 'var(--bg-surface-hover)';
                });

                badge.addEventListener('dragend', () => {
                    dropzone.style.borderColor = 'var(--border-color)';
                    dropzone.style.background = 'var(--bg-surface)';
                });

                const btnRetBadge = badge.querySelector('.btn-retire-badge-shortcut');
                if (btnRetBadge) {
                    btnRetBadge.addEventListener('click', (e) => {
                        e.preventDefault();
                        retireMaterial(badge.dataset.nombre, parseInt(badge.dataset.disponible || '1', 10));
                    });
                }
            });
        }

        // Dropzone drag over & drop events
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        dropzone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--primary-color)';
            dropzone.style.background = 'var(--bg-surface-hover)';
            dropzone.style.transform = 'scale(1.02)';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.background = 'var(--bg-surface)';
            dropzone.style.transform = 'scale(1)';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.background = 'var(--bg-surface)';
            dropzone.style.transform = 'scale(1)';

            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.type === 'material') {
                    retireMaterial(data.nombre, data.disponible);
                } else if (data.type === 'router') {
                    retireRouter();
                }
            } catch (err) {
                console.error('Error al procesar drop de materiales:', err);
            }
        });
    }

    // ─── BTN: Agregar Material Utilizado (del catÃ¡logo) ───
    document.querySelectorAll('.btn-add-material-usado').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = btn.closest('form');
            const list = form?.querySelector('.ficha-materiales-usados-list');
            if (!list) return;
            crearFilaMaterialUsado(list);
        });
    });

    // ─── BTN: Agregar Retiro Manual (adicional) ───
    document.querySelectorAll('.btn-add-material-retirado').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = btn.closest('form');
            const suscripcionId = form?.dataset.suscripcion;
            const list = form?.querySelector('.ficha-materiales-retirados-list');
            if (!list || !suscripcionId) return;
            crearFilaMaterialRetirado(list, suscripcionId);
        });
    });

    document.querySelectorAll('.btn-add-tecnico').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = btn.closest('form');
            const suscripcionId = form ? form.dataset.suscripcion : null;
            const list = form?.querySelector('.ficha-tecnicos-list');
            if (!list || !suscripcionId) return;

            const row = document.createElement('div');
            row.className = 'ficha-tecnico-row';
            row.style = 'display: flex; gap: 0.5rem; margin-top: 0.5rem; align-items: center; position: relative;';
            row.innerHTML = `
                <div style="position: relative; flex: 1; display: flex; flex-direction: column;">
                    <input type="text" placeholder="Escriba nombre del técnico..." class="abonados-select tec-nombre" style="width: 100%;" autocomplete="off" required>
                    <input type="hidden" class="tec-id">
                    <div class="tec-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface-active); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 180px; overflow-y: auto; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
                </div>
                <button type="button" class="abonados-btn abonados-btn-ghost btn-rm-tecnico" style="padding: 0.35rem;"><i class="fa-solid fa-trash"></i></button>`;

            row.querySelector('.btn-rm-tecnico')?.addEventListener('click', () => row.remove());
            list.appendChild(row);

            const nameInput = row.querySelector('.tec-nombre');
            const suggestionsBox = row.querySelector('.tec-suggestions');
            const idInput = row.querySelector('.tec-id');

            let activeIndex = -1;

            const updateSuggestions = () => {
                const val = nameInput.value.trim().toLowerCase();
                suggestionsBox.innerHTML = '';

                // Get technicians list from script
                let tecnicos = [];
                const scriptTag = document.getElementById(`personal-list-${suscripcionId}`);
                if (scriptTag) {
                    try {
                        const rawList = JSON.parse(scriptTag.textContent || '[]');
                        tecnicos = rawList.filter(p => p.rol === 'tec');
                    } catch (e) {
                        console.error('Error parsing personal list:', e);
                    }
                }

                const filtered = val ? tecnicos.filter(p => p.nombre.toLowerCase().includes(val)) : tecnicos;
                if (filtered.length === 0) {
                    suggestionsBox.style.display = 'none';
                    return;
                }

                filtered.forEach((tec, idx) => {
                    const div = document.createElement('div');
                    div.textContent = tec.nombre;
                    div.style = 'padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border-color); color: var(--text-color); font-size: 0.85rem;';

                    div.addEventListener('click', () => {
                        nameInput.value = tec.nombre;
                        idInput.value = tec.id;
                        suggestionsBox.style.display = 'none';
                    });

                    div.addEventListener('mouseenter', () => {
                        div.style.background = 'var(--bg-surface-hover)';
                        activeIndex = idx;
                    });
                    div.addEventListener('mouseleave', () => {
                        div.style.background = 'transparent';
                    });

                    suggestionsBox.appendChild(div);
                });

                suggestionsBox.style.display = 'block';
                activeIndex = -1;
            };

            nameInput.addEventListener('input', updateSuggestions);
            nameInput.addEventListener('focus', updateSuggestions);
            nameInput.addEventListener('click', updateSuggestions);

            nameInput.addEventListener('keydown', (e) => {
                const items = suggestionsBox.querySelectorAll('div');
                if (suggestionsBox.style.display === 'block' && items.length > 0) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeIndex = (activeIndex + 1) % items.length;
                        items.forEach((item, idx) => {
                            item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent';
                        });
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeIndex = (activeIndex - 1 + items.length) % items.length;
                        items.forEach((item, idx) => {
                            item.style.background = idx === activeIndex ? 'var(--bg-surface-hover)' : 'transparent';
                        });
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (activeIndex >= 0 && activeIndex < items.length) {
                            items[activeIndex].click();
                        } else if (items.length > 0) {
                            items[0].click();
                        }
                    } else if (e.key === 'Escape') {
                        suggestionsBox.style.display = 'none';
                    }
                }
            });

            document.addEventListener('click', (e) => {
                if (!nameInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                    suggestionsBox.style.display = 'none';
                }
            });
        });
    });

    document.querySelectorAll('.ficha-liq-mat-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const materiales = [];

            // Recoger materiales UTILIZADOS
            form.querySelectorAll('.ficha-material-usado-row').forEach(row => {
                const desc = row.querySelector('.mat-desc')?.value?.trim();
                if (!desc) return;
                materiales.push({
                    descripcion: desc,
                    cantidad: row.querySelector('.mat-cant')?.value || 1,
                    precio_unitario: row.querySelector('.mat-precio')?.value || 0,
                });
            });

            // Recoger materiales RETIRADOS (solo los que tienen nombre y cantidad > 0)
            form.querySelectorAll('.ficha-material-retirado-row').forEach(row => {
                const descRaw = row.querySelector('.mat-desc')?.value?.trim();
                const cant = parseFloat(row.querySelector('.mat-cant')?.value || 0);
                if (!descRaw || cant <= 0) return;
                materiales.push({
                    descripcion: `[RETIRO] ${descRaw}`,
                    cantidad: cant,
                    precio_unitario: 0,
                });
            });

            if (materiales.length === 0) {
                alert('Debe registrar al menos un material utilizado o retirado.');
                return;
            }

            const evidencias = [];
            const files = form.querySelector('.ficha-liq-evidencia')?.files || [];
            for (let i = 0; i < files.length; i++) {
                try {
                    const data = await subirArchivo(files[i], 'liquidacion', form.dataset.suscripcion);
                    if (data && data.url) {
                        evidencias.push(data.url);
                    }
                } catch (err) {
                    console.error('Error al subir la evidencia:', err);
                }
            }
            const evidencia_url = evidencias.length > 0 ? evidencias[0] : null;

            // Collect selected technicians from dynamic rows
            const tecnicos_asignados = [];
            let hasInvalidTecnico = false;
            form.querySelectorAll('.ficha-tecnico-row').forEach(row => {
                const tecId = row.querySelector('.tec-id')?.value;
                const tecNombre = row.querySelector('.tec-nombre')?.value.trim();
                if (tecId) {
                    tecnicos_asignados.push(parseInt(tecId, 10));
                } else if (tecNombre) {
                    hasInvalidTecnico = true;
                }
            });

            if (tecnicos_asignados.length === 0) {
                alert('Debe asignar al menos un técnico de la lista.');
                return;
            }

            if (hasInvalidTecnico) {
                alert('Por favor, seleccione un técnico válido de la lista de sugerencias para cada fila.');
                return;
            }

            // Validate that a NAP is selected
            const napId = form.querySelector('.nap-id-hidden')?.value;
            if (!napId) {
                alert('Debe seleccionar una NAP válida de la lista de sugerencias.');
                return;
            }

            const res = await fetch('/api/abonados/liquidar-ticket/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: fd.get('ticket_id'),
                    tipo: 'MATERIALES',
                    titulo_solucion: fd.get('titulo_solucion'),
                    solucion: fd.get('solucion'),
                    materiales,
                    generar_deuda_materiales: fd.get('generar_deuda_materiales') === 'on',
                    omitir_pago_ticket: fd.get('omitir_pago_ticket') === 'on',
                    motivo_omision_ticket: fd.get('motivo_omision_ticket') || '',
                    omitir_pago_materiales: fd.get('omitir_pago_materiales') === 'on',
                    motivo_omision_materiales: fd.get('motivo_omision_materiales') || '',
                    evidencia_url,
                    evidencias,
                    tecnicos_asignados,
                    router_modelo: fd.get('router_modelo'),
                    router_serie: fd.get('router_serie'),
                    router_mac: fd.get('router_mac'),
                    // Service fields to update
                    direccion_servicio: fd.get('direccion_servicio'),
                    gps_latitud: fd.get('gps_latitud'),
                    gps_longitud: fd.get('gps_longitud'),
                    nap_id: fd.get('nap_id'),
                    puerto_nap: fd.get('puerto_nap'),
                    presinto_numero: fd.get('presinto_numero'),
                    hub_borne_referencia: fd.get('hub_borne_referencia'),
                    numero_anexos: fd.get('numero_anexos'),
                    fecha_instalacion: fd.get('fecha_instalacion'),
                    fecha_limite_corte: fd.get('fecha_limite_corte'),
                    observaciones: fd.get('observaciones'),
                }),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            alert('Liquidación en campo registrada.');
            window.location.reload();
        });
    });

    document.querySelectorAll('.btn-generar-deuda').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('modal-generar-deuda');
            if (modal) {
                modal.querySelector('#deuda-cliente-id').value = btn.dataset.cliente || '';
                modal.querySelector('#deuda-suministro-id').value = btn.dataset.suministro || '';
                modal.style.display = 'flex';
            }
        });
    });

    document.querySelectorAll('.modal-generar-deuda-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const res = await fetch('/api/abonados/generar-deuda/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: fd.get('cliente_id'),
                    suministro_id: fd.get('suministro_id'),
                    monto: fd.get('monto'),
                    concepto: fd.get('concepto'),
                }),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            alert('Deuda generada y servicio cortado por morosidad.');
            window.location.reload();
        });
    });

    // Hook up Editar Deuda
    document.querySelectorAll('.btn-editar-deuda').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('modal-editar-deuda');
            if (modal) {
                modal.querySelector('#edit-deuda-id').value = btn.dataset.deudaId || '';
                modal.querySelector('#edit-deuda-monto').value = btn.dataset.deudaMonto || '';
                modal.querySelector('#edit-deuda-concepto').value = btn.dataset.deudaConcepto || '';
                modal.style.display = 'flex';
            }
        });
    });

    document.querySelectorAll('.modal-editar-deuda-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const res = await fetch('/api/abonados/editar-deuda/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deuda_id: fd.get('deuda_id'),
                    monto: fd.get('monto'),
                    concepto: fd.get('concepto'),
                }),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            alert('Deuda actualizada correctamente.');
            window.location.reload();
        });
    });

    // Hook up Eliminar Deuda
    document.querySelectorAll('.btn-eliminar-deuda').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Â¿EstÃ¡ seguro de que desea eliminar esta deuda? Esta acciÃ³n no se puede deshacer y restarÃ¡ el monto de la deuda acumulada del servicio.')) {
                return;
            }
            const res = await fetch('/api/abonados/eliminar-deuda/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deuda_id: btn.dataset.deudaId
                }),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            alert('Deuda eliminada correctamente.');
            window.location.reload();
        });
    });

    document.querySelectorAll('.btn-compromiso').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fecha = prompt('Fecha compromiso (AAAA-MM-DD):');
            if (!fecha) return;
            const res = await fetch('/api/abonados/compromiso-pago/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deuda_id: btn.dataset.deuda,
                    fecha_compromiso: fecha,
                    suscripcion_id: btn.dataset.suscripcion
                }),
            });
            const json = await res.json();
            if (json.status !== 'success') { alert(json.message); return; }
            window.location.reload();
        });
    });

    document.querySelectorAll('.btn-editar-cliente').forEach(btn => {
        btn.addEventListener('click', async () => {
            const isEditing = btn.dataset.editing === 'true';
            const container = btn.closest('.ficha-card');

            if (isEditing) {
                // Guardar cambios
                const nombresApellidos = document.getElementById('field-nombres-apellidos').querySelector('input')?.value;
                const dni = document.getElementById('field-dni').querySelector('input')?.value;
                const ruc = document.getElementById('field-ruc').querySelector('input')?.value;
                const razonSocial = document.getElementById('field-razon-social').querySelector('input')?.value;
                const fechaNacimiento = document.getElementById('field-fecha-nacimiento').querySelector('input')?.value;
                const estadoCivil = document.getElementById('field-estado-civil').querySelector('input')?.value;
                const celular1 = document.getElementById('field-celular1').querySelector('input')?.value;
                const celular2 = document.getElementById('field-celular2').querySelector('input')?.value;
                const correo = document.getElementById('field-correo').querySelector('input')?.value;
                const direccionFiscal = document.getElementById('field-direccion-fiscal').querySelector('input')?.value;

                const res = await fetch('/api/abonados/actualizar-cliente/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cliente_id: btn.dataset.cliente,
                        nombres_apellidos: nombresApellidos,
                        dni,
                        ruc,
                        razon_social: razonSocial,
                        fecha_nacimiento: fechaNacimiento,
                        estado_civil: estadoCivil,
                        celular_1: celular1,
                        celular_2: celular2,
                        correo,
                        direccion_fiscal: direccionFiscal,
                    }),
                });
                const json = await res.json();
                if (json.status !== 'success') { alert(json.message); return; }
                window.location.reload();
            } else {
                // Modo edición: convertir campos a inputs
                btn.dataset.editing = 'true';
                btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';

                // Agregar botón cancelar
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'abonados-btn abonados-btn-ghost';
                cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar';
                cancelBtn.addEventListener('click', () => {
                    btn.dataset.editing = 'false';
                    btn.innerHTML = '<i class="fa-solid fa-pen"></i> Editar';
                    cancelBtn.remove();
                    // Restaurar valores originales
                    window.location.reload();
                });
                btn.parentElement.appendChild(cancelBtn);

                // Convertir campos a inputs
                const fields = [
                    { id: 'field-dni', type: 'text' },
                    { id: 'field-ruc', type: 'text', withSearch: true },
                    { id: 'field-nombres-apellidos', type: 'text' },
                    { id: 'field-razon-social', type: 'text' },
                    { id: 'field-fecha-nacimiento', type: 'date' },
                    { id: 'field-estado-civil', type: 'text' },
                    { id: 'field-celular1', type: 'text' },
                    { id: 'field-celular2', type: 'text' },
                    { id: 'field-correo', type: 'text' },
                    { id: 'field-direccion-fiscal', type: 'text' }
                ];

                fields.forEach(field => {
                    const el = document.getElementById(field.id);
                    if (el) {
                        let currentValue = el.textContent;
                        if (currentValue === '—') currentValue = '';

                        let inputHtml = `<input type="${field.type}" value="${currentValue}" style="width: 100%; padding: 0.2rem; font-size: 0.6rem; border: 1px solid var(--border-color); border-radius: 4px;">`;

                        if (field.withSearch) {
                            inputHtml = `
                                <div style="display: flex; gap: 0.25rem; width: 100%;">
                                    <input type="${field.type}" value="${currentValue}" style="flex: 1; padding: 0.2rem; font-size: 0.6rem; border: 1px solid var(--border-color); border-radius: 4px;">
                                    <button type="button" class="btn-buscar-ruc abonados-btn abonados-btn-ghost" style="padding: 0.2rem 0.4rem; font-size: 0.6rem;">
                                        <i class="fa-solid fa-search"></i>
                                    </button>
                                </div>
                            `;
                        }

                        el.innerHTML = inputHtml;
                    }
                });

                // Agregar funcionalidad de búsqueda de RUC
                document.querySelectorAll('.btn-buscar-ruc').forEach(searchBtn => {
                    searchBtn.addEventListener('click', async () => {
                        const rucInput = searchBtn.parentElement.querySelector('input');
                        const ruc = rucInput?.value?.trim();
                        if (!ruc || ruc.length !== 11) {
                            alert('Ingrese un RUC valido (11 digitos)');
                            return;
                        }

                        try {
                            const res = await fetch(`/api/abonados/consultar-documento/?numero=${encodeURIComponent(ruc)}`);
                            const json = await res.json();
                            if (json.status === 'success' && json.data) {
                                const data = json.data;
                                document.getElementById('field-razon-social').querySelector('input').value = data.razon_social || '';
                                document.getElementById('field-direccion-fiscal').querySelector('input').value = data.direccion_fiscal || '';
                                alert('Datos de RUC cargados correctamente');
                            } else {
                                alert('No se encontraron datos para este RUC');
                            }
                        } catch (err) {
                            alert('Error al consultar RUC: ' + err.message);
                        }
                    });
                });
            }
        });
    });

    document.querySelectorAll('.btn-editar-servicio').forEach(btn => {
        btn.addEventListener('click', async () => {
            const isEditing = btn.dataset.editing === 'true';
            const suscripcionId = btn.dataset.suscripcion;

            if (isEditing) {
                const planInput = document.getElementById(`svc-field-plan-${suscripcionId}`)?.querySelector('select')?.value;
                const direccion = document.getElementById(`svc-field-direccion-${suscripcionId}`)?.querySelector('input')?.value;
                const distrito = document.getElementById(`svc-field-distrito-${suscripcionId}`)?.querySelector('input')?.value;
                const provincia = document.getElementById(`svc-field-provincia-${suscripcionId}`)?.querySelector('input')?.value;
                const departamento = document.getElementById(`svc-field-departamento-${suscripcionId}`)?.querySelector('input')?.value;
                const deudaAcumulada = document.getElementById(`svc-field-deuda-acumulada-${suscripcionId}`)?.querySelector('input')?.value;
                const latitud = document.getElementById(`svc-field-latitud-${suscripcionId}`)?.querySelector('input')?.value;
                const longitud = document.getElementById(`svc-field-longitud-${suscripcionId}`)?.querySelector('input')?.value;
                const nap = document.getElementById(`svc-field-nap-${suscripcionId}`)?.querySelector('input')?.value;
                const puertoNap = document.getElementById(`svc-field-puerto-nap-${suscripcionId}`)?.querySelector('input')?.value;
                const presinto = document.getElementById(`svc-field-presinto-${suscripcionId}`)?.querySelector('input')?.value;
                const routerModelo = document.getElementById(`svc-field-router-modelo-${suscripcionId}`)?.querySelector('input')?.value;
                const routerSerie = document.getElementById(`svc-field-router-serie-${suscripcionId}`)?.querySelector('input')?.value;
                const routerMac = document.getElementById(`svc-field-router-mac-${suscripcionId}`)?.querySelector('input')?.value;
                const fechaInstalacion = document.getElementById(`svc-field-fecha-instalacion-${suscripcionId}`)?.querySelector('input')?.value;
                const fechaLimiteCorte = document.getElementById(`svc-field-fecha-limite-corte-${suscripcionId}`)?.querySelector('input')?.value;
                const observaciones = document.getElementById(`svc-field-observaciones-${suscripcionId}`)?.querySelector('textarea')?.value;

                const payload = {
                    suscripcion_id: suscripcionId,
                    direccion_servicio: direccion,
                    distrito: distrito,
                    provincia: provincia,
                    departamento: departamento,
                    deuda_acumulada: deudaAcumulada,
                    latitud: latitud,
                    longitud: longitud,
                    nap_id: nap,
                    puerto_nap: puertoNap,
                    presinto_numero: presinto,
                    router_modelo: routerModelo,
                    router_serie: routerSerie,
                    router_mac: routerMac,
                    fecha_instalacion: fechaInstalacion,
                    fecha_limite_corte: fechaLimiteCorte,
                    observaciones: observaciones,
                };
                if (planInput) {
                    payload.plan_id = parseInt(planInput);
                }

                const res = await fetch('/api/abonados/actualizar-servicio/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                if (json.status !== 'success') { alert(json.message); return; }
                window.location.reload();
            } else {
                btn.dataset.editing = 'true';
                btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar';

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'abonados-btn abonados-btn-ghost';
                cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar';
                btn.parentElement.appendChild(cancelBtn);

                const planEl = document.getElementById(`svc-field-plan-${suscripcionId}`);
                if (planEl && planEl.dataset.permiteCambio === 'true') {
                    const planesScript = document.getElementById(`catalog-planes-${suscripcionId}`);
                    if (planesScript) {
                        try {
                            const planes = JSON.parse(planesScript.textContent || '[]');
                            let selectHtml = `<select style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.72rem; color: var(--text-color); background: var(--bg-surface);">`;
                            const currentPlanId = planEl.dataset.planId;
                            planes.forEach(p => {
                                const selected = String(p.id) === String(currentPlanId) ? 'selected' : '';
                                selectHtml += `<option value="${p.id}" ${selected}>${p.nombre_plan} (S/ ${p.costo_plan.toFixed(2)})</option>`;
                            });
                            selectHtml += `</select>`;
                            planEl.innerHTML = selectHtml;
                        } catch (e) {
                            console.error('Error parsing planes catalog:', e);
                        }
                    }
                }

                const direccionEl = document.getElementById(`svc-field-direccion-${suscripcionId}`);
                if (direccionEl) {
                    const currentValue = direccionEl.textContent;
                    direccionEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const distritoEl = document.getElementById(`svc-field-distrito-${suscripcionId}`);
                if (distritoEl) {
                    const currentValue = distritoEl.textContent === '—' ? '' : distritoEl.textContent;
                    distritoEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const provinciaEl = document.getElementById(`svc-field-provincia-${suscripcionId}`);
                if (provinciaEl) {
                    const currentValue = provinciaEl.textContent === '—' ? '' : provinciaEl.textContent;
                    provinciaEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const departamentoEl = document.getElementById(`svc-field-departamento-${suscripcionId}`);
                if (departamentoEl) {
                    const currentValue = departamentoEl.textContent === '—' ? '' : departamentoEl.textContent;
                    departamentoEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const deudaAcumuladaEl = document.getElementById(`svc-field-deuda-acumulada-${suscripcionId}`);
                if (deudaAcumuladaEl) {
                    let currentValue = deudaAcumuladaEl.textContent.replace('S/ ', '').trim();
                    if (currentValue === '—') currentValue = '0.00';
                    deudaAcumuladaEl.innerHTML = `<input type="number" step="0.01" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const latitudEl = document.getElementById(`svc-field-latitud-${suscripcionId}`);
                if (latitudEl) {
                    const currentValue = latitudEl.textContent === '—' ? '' : latitudEl.textContent;
                    latitudEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const longitudEl = document.getElementById(`svc-field-longitud-${suscripcionId}`);
                if (longitudEl) {
                    const currentValue = longitudEl.textContent === '—' ? '' : longitudEl.textContent;
                    longitudEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const napEl = document.getElementById(`svc-field-nap-${suscripcionId}`);
                if (napEl) {
                    const currentValue = napEl.textContent === '—' ? '' : napEl.textContent;
                    napEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const puertoNapEl = document.getElementById(`svc-field-puerto-nap-${suscripcionId}`);
                if (puertoNapEl) {
                    const currentValue = puertoNapEl.textContent === '—' ? '' : puertoNapEl.textContent;
                    puertoNapEl.innerHTML = `<input type="number" value="${currentValue}" min="1" max="16" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const presintoEl = document.getElementById(`svc-field-presinto-${suscripcionId}`);
                if (presintoEl) {
                    const currentValue = presintoEl.textContent === '—' || presintoEl.textContent === '—' ? '' : presintoEl.textContent;
                    presintoEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const routerModeloEl = document.getElementById(`svc-field-router-modelo-${suscripcionId}`);
                if (routerModeloEl) {
                    const currentValue = routerModeloEl.textContent === '—' || routerModeloEl.textContent === '—' ? '' : routerModeloEl.textContent;
                    routerModeloEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const routerSerieEl = document.getElementById(`svc-field-router-serie-${suscripcionId}`);
                if (routerSerieEl) {
                    const currentValue = routerSerieEl.textContent === '—' || routerSerieEl.textContent === '—' ? '' : routerSerieEl.textContent;
                    routerSerieEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const routerMacEl = document.getElementById(`svc-field-router-mac-${suscripcionId}`);
                if (routerMacEl) {
                    const currentValue = routerMacEl.textContent === '—' || routerMacEl.textContent === '—' ? '' : routerMacEl.textContent;
                    routerMacEl.innerHTML = `<input type="text" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const fechaInstalacionEl = document.getElementById(`svc-field-fecha-instalacion-${suscripcionId}`);
                if (fechaInstalacionEl) {
                    const currentValue = fechaInstalacionEl.dataset.rawValue || '';
                    fechaInstalacionEl.innerHTML = `<input type="date" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const fechaLimiteCorteEl = document.getElementById(`svc-field-fecha-limite-corte-${suscripcionId}`);
                if (fechaLimiteCorteEl) {
                    const currentValue = fechaLimiteCorteEl.dataset.rawValue || '';
                    fechaLimiteCorteEl.innerHTML = `<input type="date" value="${currentValue}" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">`;
                }

                const observacionesEl = document.getElementById(`svc-field-observaciones-${suscripcionId}`);
                if (observacionesEl) {
                    const currentValue = observacionesEl.textContent === '—' ? '' : observacionesEl.textContent;
                    observacionesEl.innerHTML = `<textarea rows="2" style="width: 100%; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">${currentValue}</textarea>`;
                }

                // Event listener para cancelar
                cancelBtn.addEventListener('click', () => {
                    window.location.reload();
                });
            }
        });
    });

    // BotÃ³n Cobrar
    document.querySelectorAll('.btn-cobrar-servicio').forEach(btn => {
        btn.addEventListener('click', () => {
            const suscripcionId = btn.dataset.suscripcion;
            // Abrir modal de cobro
            const modal = document.getElementById('modal-cobro');
            if (modal) {
                modal.style.display = 'flex';
                const inputSuscripcion = modal.querySelector('input[name="suscripcion_id"]');
                if (inputSuscripcion) inputSuscripcion.value = suscripcionId;
            }
        });
    });

    // Helper to normalize strings (remove accents/diacritics and trim/uppercase)
    function cleanString(str) {
        if (!str) return '';
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
    }

    // Helper to get a friendly label for modalities
    function getFriendlyModalidad(mod) {
        const m = cleanString(mod);
        if (m === 'REMOTO') return 'Virtual / Remoto';
        if (m === 'CAMPO' || m === 'PRESENCIAL') return 'Campo (Técnico)';
        return mod;
    }

    // Helper to get a friendly label for categories
    function getFriendlyCategoria(cat) {
        const c = cleanString(cat);
        if (c === 'INCIDENCIA') return 'Incidencia';
        if (c === 'REQUERIMIENTO') return 'Requerimiento';
        if (c === 'AVERIA' || c === 'AVERIA') return 'Avería';
        if (c === 'PIRATERIA' || c === 'PIRATERIA') return 'Piratería';
        if (c === 'OTROS') return 'Otros';
        // Title Case
        return c.charAt(0) + c.slice(1).toLowerCase();
    }

    // Helper to set ticket options based on selected catalog ticket
    function updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId) {
        const selectedId = catalogSelect.value;
        const selectedTicket = catalogTickets.find(t => String(t.id) === selectedId);

        const chkDerivarCampo = modal.querySelector('input[name="derivar_campo"]');
        const materialesSection = modal.querySelector('#materiales-section');
        const detailsCard = modal.querySelector('#catalog-ticket-details-card');
        const nuevoSuministroSection = modal.querySelector('#nuevo-suministro-section');
        const migracionPlanSection = modal.querySelector('#migracion-plan-section');
        const nuevoSuministroInput = modal.querySelector('#nuevo-suministro-input');
        const nuevoPlanSelect = modal.querySelector('#nuevo-plan-select');

        if (selectedTicket) {
            // Set checkboxes based on ticket
            if (chkDerivarCampo) {
                const cleanTicketArea = cleanString(selectedTicket.area);
                const isCampo = cleanTicketArea === 'PLANTA EXTERNA' ||
                    cleanTicketArea === 'PLANTA_EXTERNA' ||
                    cleanString(selectedTicket.modalidad) === 'CAMPO' ||
                    cleanString(selectedTicket.modalidad) === 'PRESENCIAL';
                chkDerivarCampo.checked = isCampo;
            }

            // Show/hide materials section
            if (materialesSection) {
                materialesSection.style.display = selectedTicket.cobra_materiales_liquidar ? 'block' : 'none';
                if (selectedTicket.cobra_materiales_liquidar) {
                    const rAbonado = materialesSection.querySelector('input[value="abonado"]');
                    if (rAbonado) rAbonado.checked = true;
                } else {
                    const rEmpresa = materialesSection.querySelector('input[value="empresa"]');
                    if (rEmpresa) rEmpresa.checked = true;
                }
            }

            // Show/hide nuevo suministro section
            if (nuevoSuministroSection) {
                const mostrar = !!selectedTicket.requiere_nuevo_suministro;
                nuevoSuministroSection.style.display = mostrar ? 'block' : 'none';
                if (nuevoSuministroInput) {
                    nuevoSuministroInput.required = mostrar;
                    if (!mostrar) nuevoSuministroInput.value = '';
                }
                // Clear preview on change
                const preview = nuevoSuministroSection.querySelector('#suministro-preview');
                if (preview) preview.style.display = 'none';
            }

            // Show/hide migración de plan section and populate plans
            if (migracionPlanSection) {
                const mostrarMig = !!selectedTicket.migracion_plan;
                migracionPlanSection.style.display = mostrarMig ? 'block' : 'none';
                if (nuevoPlanSelect) {
                    nuevoPlanSelect.required = mostrarMig;
                    if (!mostrarMig) nuevoPlanSelect.value = '';
                    if (mostrarMig) {
                        // Load planes from script tag
                        const scriptTag = suscripcionId ? document.getElementById(`catalog-planes-${suscripcionId}`) : null;
                        if (scriptTag) {
                            try {
                                const planesData = JSON.parse(scriptTag.textContent || '[]');
                                nuevoPlanSelect.innerHTML = '<option value="">— Seleccione nuevo plan —</option>';
                                planesData.forEach(p => {
                                    const opt = document.createElement('option');
                                    opt.value = p.id;
                                    opt.textContent = `${p.nombre_plan} (${p.tipo_servicio} | S/ ${parseFloat(p.costo_plan).toFixed(2)})`;
                                    nuevoPlanSelect.appendChild(opt);
                                });
                            } catch (err) {
                                console.error('Error parsing planes JSON:', err);
                            }
                        }
                    }
                }
            }

            // Populate details card
            if (detailsCard) {
                detailsCard.style.display = 'block';
                const areaEl = modal.querySelector('#cat-det-area');
                const modEl = modal.querySelector('#cat-det-modalidad');
                const precioEl = modal.querySelector('#cat-det-precio');
                const univEl = modal.querySelector('#cat-det-universal');
                const behaviorsDiv = modal.querySelector('#cat-det-behaviors');

                if (areaEl) areaEl.textContent = selectedTicket.area || '—';
                if (modEl) modEl.textContent = getFriendlyModalidad(selectedTicket.modalidad) || '—';
                if (precioEl) precioEl.textContent = selectedTicket.precio_base ? `S/ ${parseFloat(selectedTicket.precio_base).toFixed(2)}` : 'S/ 0.00';
                if (univEl) univEl.textContent = selectedTicket.es_universal ? 'Sí' : 'No';

                if (behaviorsDiv) {
                    behaviorsDiv.innerHTML = '';
                    const tags = [];
                    if (selectedTicket.editar_mapa) tags.push({ text: 'Edita mapa', icon: 'fa-map' });
                    if (selectedTicket.mantiene_equipo_anterior) tags.push({ text: 'Mantiene equipo', icon: 'fa-microchip' });
                    if (selectedTicket.cobra_materiales_liquidar) tags.push({ text: 'Cobra materiales', icon: 'fa-screwdriver-wrench' });
                    if (selectedTicket.requiere_nuevo_suministro) tags.push({ text: 'Nuevo suministro', icon: 'fa-plug' });
                    if (selectedTicket.migracion_plan) tags.push({ text: 'Migración de Plan', icon: 'fa-arrow-up-right-dots' });
                    if (selectedTicket.cambio_equipo) tags.push({ text: 'Cambio de Equipo', icon: 'fa-rotate' });
                    if (selectedTicket.es_instalacion) tags.push({ text: 'Instalación', icon: 'fa-wrench' });
                    if (selectedTicket.genera_merma) tags.push({ text: 'Genera merma', icon: 'fa-trash-can' });

                    if (tags.length > 0) {
                        tags.forEach(tag => {
                            const span = document.createElement('span');
                            span.style.cssText = 'display:inline-flex; align-items:center; gap:0.25rem; padding:0.15rem 0.4rem; background:rgba(99, 102, 241, 0.1); color:#6366f1; border:1px solid rgba(99, 102, 241, 0.2); border-radius:4px; font-size:0.72rem; font-weight:600;';
                            span.innerHTML = `<i class="fa-solid ${tag.icon}"></i> ${tag.text}`;
                            behaviorsDiv.appendChild(span);
                        });
                    } else {
                        behaviorsDiv.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Sin funciones especiales</span>';
                    }
                }
            }
        } else {
            // Reset to defaults
            if (chkDerivarCampo) chkDerivarCampo.checked = false;
            if (materialesSection) materialesSection.style.display = 'none';
            if (detailsCard) detailsCard.style.display = 'none';
            if (nuevoSuministroSection) nuevoSuministroSection.style.display = 'none';
            if (migracionPlanSection) migracionPlanSection.style.display = 'none';
        }
    }

    // Helper to check if a value is wildcard (Todos/Todas)
    function isWildcard(val) {
        if (!val) return false;
        const v = cleanString(val);
        return v === 'TODOS' || v === 'TODAS';
    }

    // Helper to compare strings case-insensitively and accent-insensitively
    function equalsIgnoreCase(str1, str2) {
        return cleanString(str1) === cleanString(str2);
    }

    // Helper to refresh all filters and ticket options based on current selections
    function refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio) {
        console.log('refreshAllTicketFilters called with:', {
            catalogTickets,
            planTipoServicio,
            currentArea: filterSelects.area.value,
            currentModalidad: filterSelects.modalidad.value,
            currentCategoria: filterSelects.categoria.value
        });

        // Save current user selection before clearing/repopulating options
        const savedArea = filterSelects.area.value || '';
        const savedModality = filterSelects.modalidad.value || '';
        const savedCategory = filterSelects.categoria.value || '';

        // First, filter tickets by plan's technology (or technology wildcard)
        let filteredByPlan = catalogTickets.filter(ticket =>
            isWildcard(ticket.tecnologia) || equalsIgnoreCase(ticket.tecnologia, planTipoServicio)
        );

        // Filter by selected Area (if selected)
        if (savedArea) {
            filteredByPlan = filteredByPlan.filter(ticket => {
                const cleanTicketArea = cleanString(ticket.area);
                return cleanTicketArea === cleanString(savedArea);
            });
        }
        console.log('Filtered by plan & area:', filteredByPlan);

        // 1. Get and set available modalidades (excluding wildcards)
        const availableModalidades = [...new Set(
            filteredByPlan
                .map(t => (t.modalidad || '').trim().toUpperCase())
                .filter(m => m && !isWildcard(m))
        )].sort();
        console.log('Available modalidades:', availableModalidades);

        filterSelects.modalidad.innerHTML = '<option value="">— Seleccione —</option>';
        availableModalidades.forEach(mod => {
            const option = document.createElement('option');
            option.value = mod;
            option.textContent = getFriendlyModalidad(mod);
            filterSelects.modalidad.appendChild(option);
        });

        // Restore selected modality if it's still valid
        if (availableModalidades.includes(savedModality)) {
            filterSelects.modalidad.value = savedModality;
        } else {
            filterSelects.modalidad.value = '';
        }

        // Get active modality after restoration
        const activeModality = filterSelects.modalidad.value;

        // 2. Filter by selected modality (matching either exact or wildcard) to get available categories
        const filteredByModalidad = filteredByPlan.filter(t => {
            if (!activeModality) return true;
            return isWildcard(t.modalidad) || equalsIgnoreCase(t.modalidad, activeModality);
        });

        const availableCategorias = [...new Set(
            filteredByModalidad
                .map(t => (t.categoria || '').trim().toUpperCase())
                .filter(c => c && !isWildcard(c))
        )].sort();
        console.log('Available categorias:', availableCategorias);

        filterSelects.categoria.innerHTML = '<option value="">— Seleccione —</option>';
        availableCategorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = getFriendlyCategoria(cat);
            filterSelects.categoria.appendChild(option);
        });

        // Restore selected category if it's still valid
        if (availableCategorias.includes(savedCategory)) {
            filterSelects.categoria.value = savedCategory;
        } else {
            filterSelects.categoria.value = '';
        }

        // Get active category after restoration
        const activeCategory = filterSelects.categoria.value;

        // 3. Filter by selected category (matching either exact or wildcard) to get available tickets
        const filteredByCategoria = filteredByModalidad.filter(t => {
            if (!activeCategory) return true;
            return isWildcard(t.categoria) || equalsIgnoreCase(t.categoria, activeCategory);
        });
        console.log('Filtered tickets:', filteredByCategoria);

        // 4. Set ticket options
        catalogSelect.innerHTML = '<option value="">— Seleccione —</option>';
        filteredByCategoria.forEach(ticket => {
            const option = document.createElement('option');
            option.value = ticket.id;
            option.textContent = ticket.nombre;
            // Store all ticket data for later use
            option.dataset.ticketData = JSON.stringify(ticket);
            catalogSelect.appendChild(option);
        });
    }

    // Botón Ticket
    document.querySelectorAll('.btn-ticket-servicio').forEach(btn => {
        btn.addEventListener('click', () => {
            const suscripcionId = btn.dataset.suscripcion;
            console.log('Ticket button clicked for suscripcion:', suscripcionId);

            const servicePanel = btn.closest('.ficha-service-panel');
            const planTipoServicio = servicePanel.dataset.planTipoServicio;
            console.log('Plan tipo servicio:', planTipoServicio);

            // Abrir modal de ticket
            const modal = document.getElementById('modal-ticket');
            if (modal) {
                modal.style.display = 'flex';

                // Reset form first to avoid cached description/checkboxes
                const form = modal.querySelector('.modal-ticket-form');
                if (form) {
                    form.reset();
                    // Reset details card and materials section explicitly
                    const detailsCard = modal.querySelector('#catalog-ticket-details-card');
                    if (detailsCard) detailsCard.style.display = 'none';
                    const materialesSection = modal.querySelector('#materiales-section');
                    if (materialesSection) materialesSection.style.display = 'none';
                    const listMateriales = modal.querySelector('#materiales-list');
                    if (listMateriales) listMateriales.innerHTML = '';
                    const nuevoSumSection = modal.querySelector('#nuevo-suministro-section');
                    if (nuevoSumSection) nuevoSumSection.style.display = 'none';
                    const migPlanSection = modal.querySelector('#migracion-plan-section');
                    if (migPlanSection) migPlanSection.style.display = 'none';
                    const sumPreview = modal.querySelector('#suministro-preview');
                    if (sumPreview) sumPreview.style.display = 'none';
                }

                const inputSuscripcion = modal.querySelector('input[name="suscripcion_id"]');
                if (inputSuscripcion) inputSuscripcion.value = suscripcionId;

                // Populate filters and catalog select
                const scriptTag = document.getElementById(`catalog-tickets-${suscripcionId}`);
                const catalogTicketsJson = scriptTag?.textContent;

                const oldCatalogSelect = modal.querySelector('select[name="catalogo_ticket_id"]');
                const oldModalidad = modal.querySelector('#ticket-filter-modalidad');
                const oldCategoria = modal.querySelector('#ticket-filter-categoria');
                const oldArea = modal.querySelector('#ticket-filter-area');

                // Clone and replace to strip previously attached event listeners
                const newCatalogSelect = oldCatalogSelect.cloneNode(true);
                oldCatalogSelect.replaceWith(newCatalogSelect);

                const newModalidad = oldModalidad.cloneNode(true);
                oldModalidad.replaceWith(newModalidad);

                const newCategoria = oldCategoria.cloneNode(true);
                oldCategoria.replaceWith(newCategoria);

                const newArea = oldArea.cloneNode(true);
                oldArea.replaceWith(newArea);

                const catalogSelect = newCatalogSelect;
                const filterSelects = {
                    area: newArea,
                    modalidad: newModalidad,
                    categoria: newCategoria,
                };

                if (catalogSelect && catalogTicketsJson) {
                    try {
                        const catalogTickets = JSON.parse(catalogTicketsJson);
                        console.log('Parsed catalog tickets:', catalogTickets);

                        // Reset all filters
                        filterSelects.area.value = 'PLANTA_INTERNA';
                        filterSelects.modalidad.value = '';
                        filterSelects.categoria.value = '';
                        catalogSelect.value = '';

                        // Initial filter population
                        refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);

                        // Add filter change listeners
                        filterSelects.area.addEventListener('change', () => {
                            console.log('Area changed to:', filterSelects.area.value);
                            // Reset modality and category when area changes
                            filterSelects.modalidad.value = '';
                            filterSelects.categoria.value = '';
                            catalogSelect.value = '';
                            refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                        filterSelects.modalidad.addEventListener('change', () => {
                            console.log('Modalidad changed to:', filterSelects.modalidad.value);
                            // Reset category and ticket select when modality changes
                            filterSelects.categoria.value = '';
                            catalogSelect.value = '';
                            refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                        filterSelects.categoria.addEventListener('change', () => {
                            console.log('Categoria changed to:', filterSelects.categoria.value);
                            // Reset ticket select when category changes
                            catalogSelect.value = '';
                            refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                        // Add catalog select listener to update checkboxes
                        catalogSelect.addEventListener('change', () => {
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                    } catch (e) {
                        console.error('Error parsing catalog tickets JSON', e);
                    }
                } else {
                    console.error('Missing catalogSelect or catalogTicketsJson');
                }
            }
        });
    });

    // Cerrar modales
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    // Cerrar modal al hacer clic fuera del contenido
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });

    // Checkbox de nueva instalación - activar liquidación de materiales
    document.getElementById('chk-nueva-instalacion')?.addEventListener('change', function () {
        const chkCobraMateriales = document.getElementById('chk-cobra-materiales');
        if (this.checked) {
            chkCobraMateriales.checked = true;
            chkCobraMateriales.dispatchEvent(new Event('change'));
        }
    });

    // Checkbox de liquidar con materiales - mostrar/ocultar secciÃ³n
    document.getElementById('chk-cobra-materiales')?.addEventListener('change', function () {
        const materialesSection = document.getElementById('materiales-section');
        if (this.checked) {
            materialesSection.style.display = 'block';
        } else {
            materialesSection.style.display = 'none';
        }
    });

    // Agregar fila de material
    document.querySelectorAll('.btn-add-material-row').forEach(btn => {
        btn.addEventListener('click', () => {
            const materialesList = document.getElementById('materiales-list');
            const newRow = document.createElement('div');
            newRow.className = 'material-row';
            newRow.style.cssText = 'display:flex; gap:0.5rem; margin-bottom:0.5rem;';
            newRow.innerHTML = `
                <input type="text" name="material_nombre[]" placeholder="Nombre del material" style="flex:2; padding:0.35rem; border:1px solid var(--border-color); border-radius:var(--radius-sm);" required>
                <input type="number" name="material_cantidad[]" placeholder="Cantidad" min="1" style="flex:1; padding:0.35rem; border:1px solid var(--border-color); border-radius:var(--radius-sm);" required>
                <input type="number" name="material_precio[]" placeholder="Precio" step="0.01" min="0" style="flex:1; padding:0.35rem; border:1px solid var(--border-color); border-radius:var(--radius-sm);" required>
                <button type="button" class="btn-remove-material abonados-btn abonados-btn-ghost" style="padding:0.35rem 0.5rem; color:var(--danger);"><i class="fa-solid fa-times"></i></button>
            `;
            materialesList.appendChild(newRow);

            // Eliminar fila de material
            newRow.querySelector('.btn-remove-material').addEventListener('click', () => {
                newRow.remove();
            });
        });
    });

    // Close modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    // ── Filtros y paginaciÃ³n interactiva de tablas de la ficha ───────────────
    function initializeFichaTablePagination(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const filterInput = panel.querySelector('.table-filter');
        const pageSizeSelect = panel.querySelector('.table-page-size');
        const stateSelect = panel.querySelector('.table-filter-estado');
        const categorySelect = panel.querySelector('.table-filter-categoria');
        const table = panel.querySelector('.abonados-table');
        const paginationContainer = panel.querySelector('.ficha-pagination');

        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        const originalRows = Array.from(tbody.querySelectorAll('tr'));
        const dataRows = originalRows.filter(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 1 && cells[0].textContent.includes('No hay')) {
                return false;
            }
            return true;
        });

        // Detect column indexes dynamically from headers
        const headers = Array.from(table.querySelectorAll('thead th'));
        const estadoColIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'ESTADO');
        const categoriaColIndex = headers.findIndex(th => th.textContent.trim().toUpperCase() === 'TIPO DE TICKET');

        let filteredRows = [...dataRows];
        let currentPage = 1;
        let pageSize = pageSizeSelect ? parseInt(pageSizeSelect.value) : 10;

        function applyFilters() {
            const query = filterInput ? filterInput.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : '';
            const stateVal = stateSelect ? stateSelect.value.trim().toUpperCase() : '';
            const catVal = categorySelect ? categorySelect.value.trim().toUpperCase() : '';

            filteredRows = dataRows.filter(row => {
                const cells = row.querySelectorAll('td');

                // 1. Text search
                if (query) {
                    const text = row.textContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (!text.includes(query)) return false;
                }

                // 2. Estado filter
                if (stateSelect && stateVal && estadoColIndex !== -1) {
                    const cell = cells[estadoColIndex];
                    const rowState = cell ? cell.textContent.trim().toUpperCase() : '';
                    if (stateVal === 'LIQUIDADO' || stateVal === 'COMPLETADO') {
                        if (rowState !== 'LIQUIDADO' && rowState !== 'COMPLETADO') return false;
                    } else if (rowState !== stateVal) {
                        return false;
                    }
                }

                // 3. Categoría/Tipo ticket filter
                if (categorySelect && catVal && categoriaColIndex !== -1) {
                    const cell = cells[categoriaColIndex];
                    const rowCat = cell ? cell.textContent.trim().toUpperCase() : '';
                    const normalizedRowCat = rowCat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ").replace(/\s+/g, " ");
                    const normalizedCatVal = catVal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ").replace(/\s+/g, " ");
                    if (!normalizedRowCat.includes(normalizedCatVal)) return false;
                }

                return true;
            });

            currentPage = 1;
            renderTable();
        }

        function renderTable() {
            const totalRows = filteredRows.length;
            if (totalRows === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="${table.querySelectorAll('thead th').length}" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">
                            No se encontraron resultados.
                        </td>
                    </tr>
                `;
                if (paginationContainer) paginationContainer.style.display = 'none';
                return;
            }

            if (paginationContainer) paginationContainer.style.display = 'flex';

            const totalPages = Math.ceil(totalRows / pageSize);
            if (currentPage > totalPages) currentPage = totalPages || 1;

            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, totalRows);

            originalRows.forEach(row => row.style.display = 'none');
            tbody.innerHTML = '';

            filteredRows.slice(startIndex, endIndex).forEach(row => {
                row.style.display = '';
                tbody.appendChild(row);
            });

            updatePaginationUI(totalPages);
        }

        function updatePaginationUI(totalPages) {
            if (!paginationContainer) return;

            const prevBtn = paginationContainer.querySelector('[data-page="prev"]');
            const nextBtn = paginationContainer.querySelector('[data-page="next"]');
            const pagesContainer = paginationContainer.querySelector('.pagination-pages');

            if (prevBtn) {
                if (currentPage === 1) {
                    prevBtn.style.opacity = '0.5';
                    prevBtn.style.pointerEvents = 'none';
                } else {
                    prevBtn.style.opacity = '1';
                    prevBtn.style.pointerEvents = 'auto';
                }
            }
            if (nextBtn) {
                if (currentPage === totalPages || totalPages === 0) {
                    nextBtn.style.opacity = '0.5';
                    nextBtn.style.pointerEvents = 'none';
                } else {
                    nextBtn.style.opacity = '1';
                    nextBtn.style.pointerEvents = 'auto';
                }
            }

            if (pagesContainer) {
                pagesContainer.innerHTML = '';
                for (let i = 1; i <= totalPages; i++) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `pagination-btn abonados-btn abonados-btn-ghost ${i === currentPage ? 'active' : ''}`;
                    if (i === currentPage) {
                        btn.style.cssText = 'background:var(--primary); color:var(--text-on-primary); border-color:var(--primary); pointer-events:none;';
                    }
                    btn.textContent = i;
                    btn.addEventListener('click', () => {
                        currentPage = i;
                        renderTable();
                    });
                    pagesContainer.appendChild(btn);
                }
            }
        }

        if (filterInput) {
            filterInput.addEventListener('input', applyFilters);
        }

        if (stateSelect) {
            stateSelect.addEventListener('change', applyFilters);
        }

        if (categorySelect) {
            categorySelect.addEventListener('change', applyFilters);
        }

        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', () => {
                pageSize = parseInt(pageSizeSelect.value);
                currentPage = 1;
                renderTable();
            });
        }

        if (paginationContainer) {
            const prevBtn = paginationContainer.querySelector('[data-page="prev"]');
            const nextBtn = paginationContainer.querySelector('[data-page="next"]');

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        renderTable();
                    }
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const totalPages = Math.ceil(filteredRows.length / pageSize);
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderTable();
                    }
                });
            }
        }

        renderTable();
    }

    // Inicializar tablas en cada panel de servicio
    document.querySelectorAll('.ficha-service-panel').forEach(panel => {
        const svcId = panel.dataset.suscripcion;
        initializeFichaTablePagination(`svc-remoto-${svcId}`);
        initializeFichaTablePagination(`svc-campo-${svcId}`);
        initializeFichaTablePagination(`svc-pagos-${svcId}`);
        initializeFichaTablePagination(`svc-materiales-${svcId}`);
    });

    // Derivar Ticket Modal trigger
    document.querySelectorAll('.btn-derivar-ticket-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const ticketId = btn.dataset.ticket;
            const currentModalidad = btn.dataset.modalidad;
            const targetModalidad = currentModalidad === 'campo' ? 'remoto' : 'campo';

            const modal = document.getElementById('modal-derivar-ticket');
            if (!modal) return;

            const titleEl = modal.querySelector('#derivar-modal-title');
            const textEl = modal.querySelector('#derivar-modal-text');
            const ticketIdInput = modal.querySelector('#derivar-ticket-id');
            const targetModInput = modal.querySelector('#derivar-ticket-modalidad');
            const motivoInput = modal.querySelector('#derivar-motivo');

            if (ticketIdInput) ticketIdInput.value = ticketId;
            if (targetModInput) targetModInput.value = targetModalidad;
            if (motivoInput) motivoInput.value = '';

            if (titleEl) {
                titleEl.textContent = `Derivar Ticket T${ticketId} a ${targetModalidad === 'campo' ? 'Campo' : 'Remoto'}`;
            }
            if (textEl) {
                textEl.textContent = `Este ticket se encuentra actualmente asignado a la modalidad de ${currentModalidad.toUpperCase()}. Al derivarlo, pasarÃ¡ al Ã¡rea de ${targetModalidad === 'campo' ? 'PLANTA EXTERNA (Campo)' : 'PLANTA INTERNA (Remoto (TAC))'}.`;
            }

            modal.style.display = 'flex';
        });
    });

    // Form Derivar Ticket submission
    const formDerivar = document.getElementById('form-derivar-ticket');
    if (formDerivar) {
        formDerivar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ticketId = document.getElementById('derivar-ticket-id')?.value;
            const targetModalidad = document.getElementById('derivar-ticket-modalidad')?.value;
            const motivo = document.getElementById('derivar-motivo')?.value;

            if (!ticketId || !targetModalidad) {
                alert('InformaciÃ³n de ticket inválida.');
                return;
            }

            try {
                const res = await fetch('/api/abonados/derivar-ticket/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticket_id: ticketId,
                        modalidad: targetModalidad,
                        motivo: motivo
                    })
                });
                const json = await res.json();
                if (json.status !== 'success') {
                    alert(json.message || 'Error al derivar ticket.');
                    return;
                }
                alert('Ticket derivado exitosamente.');
                window.location.reload();
            } catch (err) {
                console.error(err);
                alert('Error de red al derivar el ticket.');
            }
        });
    }

    // Toggle reasons for exoneration on ticket liquidation
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('chk-omitir-pago-ticket')) {
            const form = e.target.closest('form');
            if (form) {
                const wrap = form.querySelector('.wrap-motivo-omision-ticket');
                const input = wrap?.querySelector('input[name="motivo_omision_ticket"]');
                if (wrap && input) {
                    if (e.target.checked) {
                        wrap.style.display = 'block';
                        input.required = true;
                        input.focus();
                    } else {
                        wrap.style.display = 'none';
                        input.required = false;
                        input.value = '';
                    }
                }
            }
        }
        if (e.target.classList.contains('chk-omitir-pago-materiales')) {
            const form = e.target.closest('form');
            if (form) {
                const wrap = form.querySelector('.wrap-motivo-omision-materiales');
                const input = wrap?.querySelector('input[name="motivo_omision_materiales"]');
                if (wrap && input) {
                    if (e.target.checked) {
                        wrap.style.display = 'block';
                        input.required = true;
                        input.focus();
                    } else {
                        wrap.style.display = 'none';
                        input.required = false;
                        input.value = '';
                    }
                }
            }
        }
    });

    // --- Modal Comparar Liquidación y Fotos ---
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-ver-liquidacion');
        if (btn) {
            const ticketId = btn.dataset.ticketId;
            const suscripcionId = btn.dataset.suscripcion;
            
            // Buscar el ticket en el JSON de tickets
            let ticketObj = null;
            try {
                const ticketsScript = document.getElementById(`tickets-data-${suscripcionId}`);
                if (ticketsScript) {
                    const ticketsArray = JSON.parse(ticketsScript.textContent || '[]');
                    ticketObj = ticketsArray.find(t => String(t.id) === String(ticketId));
                }
            } catch (err) {
                console.error('Error al parsear tickets-data:', err);
            }
            
            if (ticketObj) {
                const modal = document.getElementById('modal-comparar-liquidacion');
                if (modal) {
                    modal.querySelector('#comp-title').innerHTML = `<i class="fa-solid fa-code-compare" style="color:var(--primary-color);"></i> Comparar Liquidación — Ticket T${ticketObj.id}`;
                    
                    let fechaLiq = '—';
                    if (ticketObj.fecha_liquidacion && ticketObj.fecha_liquidacion !== 'None') {
                        // Si viene formato completo ISO o texto, mostrar limpio
                        fechaLiq = String(ticketObj.fecha_liquidacion).replace('T', ' ').substring(0, 19);
                    }
                    const fechaFooterEl = modal.querySelector('#comp-fecha-footer');
                    if (fechaFooterEl) fechaFooterEl.textContent = fechaLiq;
                    
                    const tecnicos = ticketObj.tecnicos && ticketObj.tecnicos.length > 0 ? ticketObj.tecnicos.join(', ') : 'Ninguno asignado';
                    const tecnicosFooterEl = modal.querySelector('#comp-tecnicos-footer');
                    if (tecnicosFooterEl) tecnicosFooterEl.textContent = tecnicos;
                    
                    let usuarioLiq = '—';
                    let materialesUsados = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem; text-align:center;">Ninguno registrado</div>';
                    let materialesRetirados = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem; text-align:center;">Ninguno registrado</div>';
                    let evidencias = [];
                    
                    if (ticketObj.liquidacion && typeof ticketObj.liquidacion === 'object') {
                        const liq = ticketObj.liquidacion;
                        if (liq.usuario_liquidacion && liq.usuario_liquidacion.nombre_apellidos) {
                            usuarioLiq = liq.usuario_liquidacion.nombre_apellidos;
                        } else if (liq.personal_id) {
                            usuarioLiq = `Usuario #${liq.personal_id}`;
                        }
                        
                        if (Array.isArray(liq.evidencias) && liq.evidencias.length > 0) {
                            evidencias = liq.evidencias;
                        } else if (liq.evidencia_url) {
                            evidencias = [liq.evidencia_url];
                        }
                        
                        if (Array.isArray(liq.materiales) && liq.materiales.length > 0) {
                            const usados = [];
                            const retirados = [];
                            liq.materiales.forEach(m => {
                                const isRetiro = m.descripcion.toUpperCase().includes('[RETIRO]');
                                const descLimpia = m.descripcion.replace(/\[RETIRO\]\s*/i, '').trim();
                                
                                // Determine icon
                                let icon = '<i class="fa-solid fa-box" style="color:var(--text-muted);"></i>';
                                const descUpper = descLimpia.toUpperCase();
                                if (descUpper.includes('ROUTER') || descUpper.includes('ONU') || descUpper.includes('HUAWEI')) {
                                    icon = '<i class="fa-solid fa-wifi" style="color:var(--primary-color);"></i>';
                                } else if (descUpper.includes('COAXIAL') || descUpper.includes('CABLE')) {
                                    icon = '<i class="fa-solid fa-cable-car" style="color:#ef4444;"></i>';
                                } else if (descUpper.includes('CONECTOR')) {
                                    icon = '<i class="fa-solid fa-circle-nodes" style="color:#3b82f6;"></i>';
                                } else if (descUpper.includes('FIBRA')) {
                                    icon = '<i class="fa-solid fa-circle-dot" style="color:#10b981;"></i>';
                                }
                                
                                const htmlRow = `
                                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface); border:1px solid var(--border-color); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.05); transition:transform 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='none'">
                                        <div style="display:flex; align-items:center; gap:0.65rem;">
                                            ${icon}
                                            <span style="font-weight:600; color:var(--text-color); font-size:0.88rem;">${descLimpia}</span>
                                        </div>
                                        <div style="background:var(--bg-surface-active); color:var(--text-color); font-weight:700; font-size:0.8rem; padding:0.2rem 0.6rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                                            Cant: ${m.cantidad}
                                        </div>
                                    </div>
                                `;
                                if (isRetiro) {
                                    retirados.push(htmlRow);
                                } else {
                                    usados.push(htmlRow);
                                }
                            });
                            if (usados.length > 0) materialesUsados = usados.join('');
                            if (retirados.length > 0) materialesRetirados = retirados.join('');
                        }
                    }
                    
                    const usuarioFooterEl = modal.querySelector('#comp-usuario-liq');
                    if (usuarioFooterEl) usuarioFooterEl.textContent = usuarioLiq;
                    
                    modal.querySelector('#comp-materiales-usados').innerHTML = materialesUsados;
                    modal.querySelector('#comp-materiales-retirados').innerHTML = materialesRetirados;
                    
                    const imgContainer = modal.querySelector('#comp-img-container');
                    const thumbnailsBox = modal.querySelector('#comp-thumbnails-box');
                    const thumbnailsContainer = modal.querySelector('#comp-thumbnails-container');
                    
                    let currentImageIndex = 0;

                    function setMainImage(url) {
                        if (url) {
                            currentImageIndex = evidencias.indexOf(url);
                            if (currentImageIndex === -1) currentImageIndex = 0;

                            imgContainer.innerHTML = `
                                <a href="${url}" target="_blank" title="Click para abrir en pestaña completa">
                                    <img src="${url}" alt="Evidencia de Liquidación" style="max-width:100%; max-height:380px; object-fit:contain; border-radius:var(--radius-sm); border:1px solid var(--border-color); cursor:zoom-in; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                </a>`;
                        } else {
                            imgContainer.innerHTML = `
                                <div style="color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:0.5rem; justify-content:center;">
                                    <i class="fa-solid fa-image-slash" style="font-size:2.5rem; opacity:0.5;"></i>
                                    <span>No se subió evidencia fotográfica para este ticket.</span>
                                </div>`;
                        }
                        
                        // Highlight active thumbnail
                        thumbnailsContainer.querySelectorAll('.comp-thumb-btn').forEach(btn => {
                            if (btn.dataset.url === url) {
                                btn.style.border = '2px solid var(--primary-color)';
                                btn.style.opacity = '1';
                            } else {
                                btn.style.border = '1px solid var(--border-color)';
                                btn.style.opacity = '0.6';
                            }
                        });
                    }

                    // Navigation buttons logic
                    const prevBtn = modal.querySelector('#comp-prev-btn');
                    const nextBtn = modal.querySelector('#comp-next-btn');

                    if (evidencias.length > 1) {
                        prevBtn.style.display = 'flex';
                        nextBtn.style.display = 'flex';
                        
                        // Recreate buttons to clean event listeners
                        const newPrevBtn = prevBtn.cloneNode(true);
                        const newNextBtn = nextBtn.cloneNode(true);
                        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
                        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
                        
                        newPrevBtn.addEventListener('click', () => {
                            currentImageIndex = (currentImageIndex - 1 + evidencias.length) % evidencias.length;
                            setMainImage(evidencias[currentImageIndex]);
                        });

                        newNextBtn.addEventListener('click', () => {
                            currentImageIndex = (currentImageIndex + 1) % evidencias.length;
                            setMainImage(evidencias[currentImageIndex]);
                        });
                    } else {
                        prevBtn.style.display = 'none';
                        nextBtn.style.display = 'none';
                    }

                    if (evidencias.length > 0) {
                        setMainImage(evidencias[0]);
                        
                        if (evidencias.length > 1) {
                            const countSpan = modal.querySelector('#comp-thumbnail-count');
                            if (countSpan) countSpan.textContent = evidencias.length;
                            
                            thumbnailsBox.style.display = 'flex';
                            thumbnailsContainer.innerHTML = evidencias.map(url => `
                                <button type="button" class="comp-thumb-btn" data-url="${url}" style="flex-shrink:0; width:50px; height:50px; padding:0; border:1px solid var(--border-color); border-radius:var(--radius-sm); overflow:hidden; cursor:pointer; opacity:0.6; transition: opacity 0.2s; background: var(--bg-surface);">
                                    <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                                </button>
                            `).join('');
                            
                            // Add event listeners to thumbnails
                            thumbnailsContainer.querySelectorAll('.comp-thumb-btn').forEach(btn => {
                                btn.addEventListener('click', () => {
                                    setMainImage(btn.dataset.url);
                                });
                            });
                        } else {
                            thumbnailsBox.style.display = 'none';
                            thumbnailsContainer.innerHTML = '';
                        }
                    } else {
                        setMainImage(null);
                        thumbnailsBox.style.display = 'none';
                        thumbnailsContainer.innerHTML = '';
                    }
                    
                    modal.style.display = 'flex';
                }
            }
        }
    });

    // Cerrar modal al hacer click en los botones de cerrar o fuera del modal
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-close-btn') || e.target.closest('.modal-close-btn') || e.target === document.getElementById('modal-comparar-liquidacion')) {
            const modal = document.getElementById('modal-comparar-liquidacion');
            if (modal) modal.style.display = 'none';
        }
    });

});

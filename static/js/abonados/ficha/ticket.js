/**
 * ticket.js - Gestión de Tickets de Soporte en la Ficha de Cliente
 * Cubre: generación, impresión, liquidación descriptiva, derivación y filtros de catálogo.
 */
(function () {
    'use strict';

    // ── Helpers de normalización ──────────────────────────────────────────────

    function cleanString(str) {
        if (!str) return '';
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    }

    function getFriendlyModalidad(mod) {
        const m = cleanString(mod);
        if (m === 'REMOTO') return 'Virtual / Remoto';
        if (m === 'CAMPO' || m === 'PRESENCIAL') return 'Campo (Técnico)';
        return mod;
    }

    function getFriendlyCategoria(cat) {
        const c = cleanString(cat);
        if (c === 'INCIDENCIA') return 'Incidencia';
        if (c === 'REQUERIMIENTO') return 'Requerimiento';
        if (c === 'AVERIA') return 'Avería';
        if (c === 'PIRATERIA') return 'Piratería';
        if (c === 'OTROS') return 'Otros';
        return c.charAt(0) + c.slice(1).toLowerCase();
    }

    function isWildcard(val) {
        if (!val) return false;
        const v = cleanString(val);
        return v === 'TODOS' || v === 'TODAS';
    }

    function equalsIgnoreCase(str1, str2) {
        return cleanString(str1) === cleanString(str2);
    }

    // ── Lógica de filtros del catálogo de tickets ─────────────────────────────

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
            if (chkDerivarCampo) {
                const cleanArea = cleanString(selectedTicket.area);
                const isCampo = cleanArea === 'PLANTA EXTERNA' || cleanArea === 'PLANTA_EXTERNA' ||
                    cleanString(selectedTicket.modalidad) === 'CAMPO' ||
                    cleanString(selectedTicket.modalidad) === 'PRESENCIAL';
                chkDerivarCampo.checked = isCampo;
            }

            if (materialesSection) {
                materialesSection.style.display = selectedTicket.cobra_materiales_liquidar ? 'block' : 'none';
                const rAbonado = materialesSection.querySelector('input[value="abonado"]');
                const rEmpresa = materialesSection.querySelector('input[value="empresa"]');
                if (selectedTicket.cobra_materiales_liquidar) {
                    if (rAbonado) rAbonado.checked = true;
                } else {
                    if (rEmpresa) rEmpresa.checked = true;
                }
            }

            if (nuevoSuministroSection) {
                const mostrar = !!selectedTicket.requiere_nuevo_suministro;
                nuevoSuministroSection.style.display = mostrar ? 'block' : 'none';
                if (nuevoSuministroInput) {
                    nuevoSuministroInput.required = mostrar;
                    if (!mostrar) nuevoSuministroInput.value = '';
                }
                const preview = nuevoSuministroSection.querySelector('#suministro-preview');
                if (preview) preview.style.display = 'none';
            }

            if (migracionPlanSection) {
                const mostrarMig = !!selectedTicket.migracion_plan;
                migracionPlanSection.style.display = mostrarMig ? 'block' : 'none';
                if (nuevoPlanSelect) {
                    nuevoPlanSelect.required = mostrarMig;
                    if (!mostrarMig) nuevoPlanSelect.value = '';
                    if (mostrarMig) {
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
            if (chkDerivarCampo) chkDerivarCampo.checked = false;
            if (materialesSection) materialesSection.style.display = 'none';
            if (detailsCard) detailsCard.style.display = 'none';
            if (nuevoSuministroSection) nuevoSuministroSection.style.display = 'none';
            if (migracionPlanSection) migracionPlanSection.style.display = 'none';
        }
    }

    function refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio) {
        const savedArea = filterSelects.area.value || '';
        const savedModality = filterSelects.modalidad.value || '';
        const savedCategory = filterSelects.categoria.value || '';

        let filteredByPlan = catalogTickets.filter(ticket =>
            isWildcard(ticket.tecnologia) || equalsIgnoreCase(ticket.tecnologia, planTipoServicio)
        );

        if (savedArea) {
            filteredByPlan = filteredByPlan.filter(ticket =>
                cleanString(ticket.area) === cleanString(savedArea)
            );
        }

        const availableModalidades = [...new Set(
            filteredByPlan
                .map(t => (t.modalidad || '').trim().toUpperCase())
                .filter(m => m && !isWildcard(m))
        )].sort();

        filterSelects.modalidad.innerHTML = '<option value="">— Seleccione —</option>';
        availableModalidades.forEach(mod => {
            const option = document.createElement('option');
            option.value = mod;
            option.textContent = getFriendlyModalidad(mod);
            filterSelects.modalidad.appendChild(option);
        });

        if (availableModalidades.includes(savedModality)) {
            filterSelects.modalidad.value = savedModality;
        } else {
            filterSelects.modalidad.value = '';
        }

        const activeModality = filterSelects.modalidad.value;

        const filteredByModalidad = filteredByPlan.filter(t => {
            if (!activeModality) return true;
            return isWildcard(t.modalidad) || equalsIgnoreCase(t.modalidad, activeModality);
        });

        const availableCategorias = [...new Set(
            filteredByModalidad
                .map(t => (t.categoria || '').trim().toUpperCase())
                .filter(c => c && !isWildcard(c))
        )].sort();

        filterSelects.categoria.innerHTML = '<option value="">— Seleccione —</option>';
        availableCategorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = getFriendlyCategoria(cat);
            filterSelects.categoria.appendChild(option);
        });

        if (availableCategorias.includes(savedCategory)) {
            filterSelects.categoria.value = savedCategory;
        } else {
            filterSelects.categoria.value = '';
        }

        const activeCategory = filterSelects.categoria.value;

        const filteredByCategoria = filteredByModalidad.filter(t => {
            if (!activeCategory) return true;
            return isWildcard(t.categoria) || equalsIgnoreCase(t.categoria, activeCategory);
        });

        catalogSelect.innerHTML = '<option value="">— Seleccione —</option>';
        filteredByCategoria.forEach(ticket => {
            const option = document.createElement('option');
            option.value = ticket.id;
            option.textContent = ticket.nombre;
            option.dataset.ticketData = JSON.stringify(ticket);
            catalogSelect.appendChild(option);
        });
    }

    // ── DOMContentLoaded ──────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('fichaApp');
        if (!app) return;

        // ── Abrir modal de nuevo ticket ────────────────────────────────────────
        document.querySelectorAll('.btn-ticket-servicio').forEach(btn => {
            btn.addEventListener('click', () => {
                const suscripcionId = btn.dataset.suscripcion;
                const servicePanel = btn.closest('.ficha-service-panel');
                const planTipoServicio = servicePanel?.dataset.planTipoServicio;

                const modal = document.getElementById('modal-ticket');
                if (!modal) return;

                modal.style.display = 'flex';

                const form = modal.querySelector('.modal-ticket-form');
                if (form) {
                    form.reset();
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

                const scriptTag = document.getElementById(`catalog-tickets-${suscripcionId}`);
                const catalogTicketsJson = scriptTag?.textContent;

                const oldCatalogSelect = modal.querySelector('select[name="catalogo_ticket_id"]');
                const oldModalidad = modal.querySelector('#ticket-filter-modalidad');
                const oldCategoria = modal.querySelector('#ticket-filter-categoria');
                const oldArea = modal.querySelector('#ticket-filter-area');

                const newCatalogSelect = oldCatalogSelect.cloneNode(true);
                oldCatalogSelect.replaceWith(newCatalogSelect);
                const newModalidad = oldModalidad.cloneNode(true);
                oldModalidad.replaceWith(newModalidad);
                const newCategoria = oldCategoria.cloneNode(true);
                oldCategoria.replaceWith(newCategoria);
                const newArea = oldArea.cloneNode(true);
                oldArea.replaceWith(newArea);

                const catalogSelect = newCatalogSelect;
                const filterSelects = { area: newArea, modalidad: newModalidad, categoria: newCategoria };

                if (catalogSelect && catalogTicketsJson) {
                    try {
                        const catalogTickets = JSON.parse(catalogTicketsJson);

                        filterSelects.area.value = 'PLANTA_INTERNA';
                        filterSelects.modalidad.value = '';
                        filterSelects.categoria.value = '';
                        catalogSelect.value = '';

                        refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);

                        filterSelects.area.addEventListener('change', () => {
                            filterSelects.modalidad.value = '';
                            filterSelects.categoria.value = '';
                            catalogSelect.value = '';
                            refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                        filterSelects.modalidad.addEventListener('change', () => {
                            filterSelects.categoria.value = '';
                            catalogSelect.value = '';
                            refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                        filterSelects.categoria.addEventListener('change', () => {
                            catalogSelect.value = '';
                            refreshAllTicketFilters(catalogTickets, filterSelects, catalogSelect, modal, planTipoServicio);
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                        catalogSelect.addEventListener('change', () => {
                            updateTicketOptionsBySelected(catalogTickets, catalogSelect, modal, suscripcionId);
                        });

                    } catch (e) {
                        console.error('Error parsing catalog tickets JSON', e);
                    }
                }
            });
        });

        // ── Submit formulario de nuevo ticket ─────────────────────────────────
        document.querySelectorAll('.modal-ticket-form').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const modal = form.closest('.modal');

                const nuevoSuministroInput = modal?.querySelector('#nuevo-suministro-input');
                const nuevoPlanSelect = modal?.querySelector('#nuevo-plan-select');
                const chkCambioEquipo = modal?.querySelector('#chk-cambio-equipo');

                const payload = {
                    suscripcion_id: fd.get('suscripcion_id'),
                    catalogo_ticket_id: fd.get('catalogo_ticket_id') || null,
                    derivar_campo: fd.get('derivar_campo') === 'on',
                    motivo: fd.get('motivo') || '',
                    cargo_materiales: fd.get('cargo_materiales') || 'empresa',
                };

                if (nuevoSuministroInput?.value?.trim()) payload.nuevo_suministro = nuevoSuministroInput.value.trim();
                if (nuevoPlanSelect?.value) payload.nuevo_plan_id = parseInt(nuevoPlanSelect.value, 10);
                if (chkCambioEquipo?.checked) payload.cambio_equipo = true;

                try {
                    const res = await fetch('/api/abonados/generar-ticket/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    if (json.status !== 'success') {
                        window.SITAlert.show(json.message, 'danger');
                        return;
                    }
                    window.SITAlert.show(`Ticket T${json.data.ticket_id} generado correctamente.`, 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    window.SITAlert.show('Error de red al generar el ticket.', 'danger');
                }
            });
        });

        // ── Imprimir ticket ────────────────────────────────────────────────────
        document.querySelectorAll('.btn-ver-ticket').forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof window.imprimirTicket !== 'function') {
                    window.SITAlert.show('El módulo de impresión no está disponible.', 'warning');
                    return;
                }

                const ticketNum = btn.dataset.ticketNum || btn.dataset.ticketId || '—';
                const categoria = btn.dataset.ticketCat || 'INCIDENCIA';
                const ticketNombre = btn.dataset.ticketNombre || '';
                const suscripcionId = btn.dataset.suscripcion;

                let servicioData = {};
                let clienteData = {};
                let logoUrl = null;
                let telefono = '064466080';
                let sedeNombre = 'LA OROYA';

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
                    if (ticketObj.notas) ticketData.detalle = ticketObj.notas;
                    if (ticketObj.motivo) ticketData.motivo = ticketObj.motivo;

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
                        if (liq.solucion) ticketData.observacion = liq.solucion;
                        else if (liq.observaciones) ticketData.observacion = liq.observaciones;

                        if (Array.isArray(liq.materiales) && liq.materiales.length > 0) {
                            const usados = [];
                            const retirados = [];
                            liq.materiales.forEach(m => {
                                if (m.descripcion.toUpperCase().includes('[RETIRO]')) {
                                    retirados.push(`${m.descripcion.replace(/\[RETIRO\]\s*/i, '')} (Cant: ${m.cantidad})`);
                                } else {
                                    usados.push(`${m.descripcion} (Cant: ${m.cantidad})`);
                                }
                            });
                            if (usados.length > 0) ticketData.materiales_usados = usados.join('<br>');
                            if (retirados.length > 0) ticketData.materiales_retirados = retirados.join('<br>');
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

        // ── Abrir modal de liquidación descriptiva (remoto) ────────────────────
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

        // ── Submit liquidación descriptiva ─────────────────────────────────────
        document.querySelectorAll('.ficha-liq-desc-form').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                try {
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
                    if (json.status !== 'success') {
                        if (window.SITAlert && window.SITAlert.show) {
                            window.SITAlert.show(json.message, 'danger');
                        } else {
                            alert(json.message);
                        }
                        return;
                    }
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Ticket liquidado correctamente.', 'success');
                    } else {
                        alert('Ticket liquidado correctamente.');
                    }
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Error al liquidar el ticket.', 'danger');
                    } else {
                        alert('Error al liquidar el ticket.');
                    }
                }
            });
        });

        // ── Abrir modal liquidación de campo (materiales) ──────────────────────
        document.querySelectorAll('.btn-liquidar-mat').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelSus = btn.closest('.ficha-service-panel')?.dataset.suscripcion;
                const modalId = `liq-mat-modal-${panelSus}`;
                const modal = document.getElementById(modalId);
                if (!modal) return;

                const tid = modal.querySelector('.liq-mat-ticket-id');
                if (tid) tid.value = btn.dataset.ticket;

                // Mostrar título del ticket en el modal
                const titleEl = modal.querySelector(`#liq-ticket-title-${panelSus}`);
                if (titleEl) {
                    const ticketNombre = btn.dataset.nombre || btn.dataset.ticketNombre || 'Ticket';
                    const ticketId = btn.dataset.ticket || '';
                    titleEl.textContent = `Ticket #${ticketId} - ${ticketNombre}`;
                }

                const form = modal.querySelector('.ficha-liq-mat-form');
                if (form) {
                    const diaVencimiento = form.dataset.diaVencimiento || 'fin_mes';
                    const diasGracia = parseInt(form.dataset.diasGracia || '5', 10);
                    const instInput = form.querySelector('[name="fecha_instalacion"]');
                    const corteInput = form.querySelector('[name="fecha_limite_corte"]');

                    const isInstTicket = btn.dataset.categoria && btn.dataset.categoria.toLowerCase().includes('instal');
                    form.dataset.isInstalacion = isInstTicket ? 'true' : 'false';

                    // Limpiar listas dinámicas
                    const usadosList = form.querySelector('.ficha-materiales-usados-list');
                    if (usadosList) usadosList.innerHTML = '';

                    const retiradosList = form.querySelector('.ficha-materiales-retirados-list');
                    if (retiradosList) {
                        retiradosList.innerHTML = '';
                        const aviso = document.createElement('p');
                        aviso.className = 'mat-retirados-aviso-vacio';
                        aviso.style.cssText = 'font-size:0.8rem; color:var(--text-muted); text-align:center; padding:0.5rem 0; margin:0;';
                        aviso.innerHTML = '<i class="fa-solid fa-box-open"></i> Sin materiales registrados.';
                        retiradosList.appendChild(aviso);
                    }

                    // Restaurar router card
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

                    // Cargar datos actualizados del servicio en los campos del modal
                    const routerModeloInput = form.querySelector('[name="router_modelo"]');
                    const routerSerieInput = form.querySelector('[name="router_serie"]');
                    const routerMacInput = form.querySelector('[name="router_mac"]');
                    
                    // Cargar datos del router desde el panel de servicio
                    const svcRouterModelo = document.getElementById(`svc-field-router-modelo-${panelSus}`);
                    const svcRouterSerie = document.getElementById(`svc-field-router-serie-${panelSus}`);
                    const svcRouterMac = document.getElementById(`svc-field-router-mac-${panelSus}`);
                    
                    if (routerModeloInput && svcRouterModelo) routerModeloInput.value = svcRouterModelo.textContent.trim() === '—' ? '' : svcRouterModelo.textContent.trim();
                    if (routerSerieInput && svcRouterSerie) routerSerieInput.value = svcRouterSerie.textContent.trim() === '—' ? '' : svcRouterSerie.textContent.trim();
                    if (routerMacInput && svcRouterMac) routerMacInput.value = svcRouterMac.textContent.trim() === '—' ? '' : svcRouterMac.textContent.trim();
                    
                    // Cargar campos técnicos desde el panel de servicio
                    const napSearchInput = form.querySelector('.nap-search-input');
                    const napIdInput = form.querySelector('.nap-id-hidden');
                    const puertoNapInput = form.querySelector('[name="puerto_nap"]');
                    const presintoInput = form.querySelector('[name="presinto_numero"]');
                    const hubBorneInput = form.querySelector('[name="hub_borne_referencia"]');
                    const numAnexosInput = form.querySelector('[name="numero_anexos"]');
                    
                    const svcNap = document.getElementById(`svc-field-nap-${panelSus}`);
                    const svcPuertoNap = document.getElementById(`svc-field-puerto-nap-${panelSus}`);
                    const svcPresinto = document.getElementById(`svc-field-presinto-${panelSus}`);
                    
                    if (napSearchInput && svcNap) napSearchInput.value = svcNap.textContent.trim() === '—' ? '' : svcNap.textContent.trim();
                    if (napIdInput && svcNap) {
                        // Intentar obtener el ID del NAP desde el servicio
                        const napId = svcNap.dataset.napId || '';
                        napIdInput.value = napId;
                    }
                    if (puertoNapInput && svcPuertoNap) puertoNapInput.value = svcPuertoNap.textContent.trim() === '—' ? '' : svcPuertoNap.textContent.trim();
                    if (presintoInput && svcPresinto) presintoInput.value = svcPresinto.textContent.trim() === '—' ? '' : svcPresinto.textContent.trim();
                    if (hubBorneInput) hubBorneInput.value = '';
                    
                    // Cargar número de anexos
                    const svcAnexos = document.querySelector(`.ficha-datos-servicio-grid .ficha-dd-value:nth-child(6)`);
                    if (numAnexosInput && svcAnexos) {
                        const anexosText = svcAnexos.textContent.trim();
                        if (anexosText && anexosText !== '—') {
                            numAnexosInput.value = parseInt(anexosText, 10) || 0;
                        }
                    }
                    
                    // Cargar fechas
                    const fechaInstInput = form.querySelector('[name="fecha_instalacion"]');
                    const fechaCorteInput = form.querySelector('[name="fecha_limite_corte"]');
                    const svcFechaInst = document.getElementById(`svc-field-fecha-instalacion-${panelSus}`);
                    const svcFechaCorte = document.getElementById(`svc-field-fecha-limite-corte-${panelSus}`);
                    
                    if (fechaInstInput && svcFechaInst) {
                        const rawValue = svcFechaInst.dataset.rawValue || '';
                        if (rawValue) fechaInstInput.value = rawValue;
                    }
                    if (fechaCorteInput && svcFechaCorte) {
                        const rawValue = svcFechaCorte.dataset.rawValue || '';
                        if (rawValue) fechaCorteInput.value = rawValue;
                    }

                    const suscripcionId = form.dataset.suscripcion;

                    // Cargar historial de materiales de liquidaciones anteriores
                    const historialContainer = form.querySelector('.historial-materiales-list');
                    if (historialContainer) {
                        historialContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">Cargando historial...</span>';
                        
                        // Obtener tickets liquidados del servicio
                        fetch(`/api/abonados/servicio/${suscripcionId}/tickets-liquidados/`)
                            .then(res => res.json())
                            .then(data => {
                                if (data.status === 'success' && data.data && data.data.length > 0) {
                                    historialContainer.innerHTML = '';
                                    data.data.forEach(ticket => {
                                        const ticketDiv = document.createElement('div');
                                        ticketDiv.style.cssText = 'background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:0.5rem; margin-bottom:0.5rem;';
                                        
                                        const fecha = ticket.fecha_liquidacion ? new Date(ticket.fecha_liquidacion).toLocaleString('es-ES') : '—';
                                        const materiales = ticket.materiales || [];
                                        
                                        let materialesHtml = '';
                                        if (materiales.length > 0) {
                                            materiales.forEach(mat => {
                                                const tipo = mat.descripcion && mat.descripcion.startsWith('[RETIRO]') ? 'Retirado' : 'Utilizado';
                                                const color = tipo === 'Retirado' ? 'var(--danger-color)' : 'var(--success-color)';
                                                materialesHtml += `
                                                    <div style="font-size:0.7rem; margin:0.25rem 0; padding:0.25rem; background:var(--bg-surface-hover); border-radius:var(--radius-sm);">
                                                        <span style="color:${color}; font-weight:600;">[${tipo}]</span> ${mat.descripcion} x${mat.cantidad}
                                                    </div>
                                                `;
                                            });
                                        } else {
                                            materialesHtml = '<span style="font-size:0.7rem; color:var(--text-muted);">Sin materiales registrados</span>';
                                        }
                                        
                                        ticketDiv.innerHTML = `
                                            <div style="font-size:0.75rem; font-weight:600; margin-bottom:0.25rem;">
                                                <i class="fa-solid fa-ticket"></i> Ticket #${ticket.id} - ${ticket.nombre_ticket}
                                            </div>
                                            <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:0.25rem;">
                                                <i class="fa-solid fa-calendar"></i> Liquidado: ${fecha}
                                            </div>
                                            <div style="margin-top:0.25rem;">
                                                ${materialesHtml}
                                            </div>
                                        `;
                                        historialContainer.appendChild(ticketDiv);
                                    });
                                } else {
                                    historialContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">No hay liquidaciones anteriores registradas.</span>';
                                }
                            })
                            .catch(err => {
                                console.error('Error al cargar historial de materiales:', err);
                                historialContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--danger-color);">Error al cargar historial.</span>';
                            });
                    }

                    // Cargar materiales existentes del cliente como badges arrastrables
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
                                            
                                            // Asignar evento dragstart al badge
                                            badge.addEventListener('dragstart', (e) => {
                                                e.dataTransfer.setData('application/json', JSON.stringify({
                                                    type: 'material',
                                                    nombre: badge.dataset.nombre,
                                                    disponible: parseInt(badge.dataset.disponible || '1', 10)
                                                }));
                                                e.dataTransfer.effectAllowed = 'move';
                                                const dropzone = form.querySelector('.materials-dropzone');
                                                if (dropzone) {
                                                    dropzone.style.borderColor = 'var(--primary-color)';
                                                    dropzone.style.background = 'var(--bg-surface-hover)';
                                                }
                                            });
                                            
                                            badge.addEventListener('dragend', () => {
                                                const dropzone = form.querySelector('.materials-dropzone');
                                                if (dropzone) {
                                                    dropzone.style.borderColor = 'var(--border-color)';
                                                    dropzone.style.background = 'var(--bg-surface)';
                                                }
                                            });
                                            
                                            const btnRetBadge = badge.querySelector('.btn-retire-badge-shortcut');
                                            if (btnRetBadge) {
                                                btnRetBadge.addEventListener('click', (e) => {
                                                    e.preventDefault();
                                                    // Marcar el badge como retirado visualmente
                                                    badge.style.opacity = '0.4';
                                                    badge.style.textDecoration = 'line-through';
                                                    badge.style.cursor = 'not-allowed';
                                                    badge.draggable = false;
                                                    badge.title = 'Material retirado - no disponible';
                                                    btnRetBadge.style.display = 'none';
                                                    
                                                    // Agregar a la lista de retirados
                                                    const retiradosList = form.querySelector('.ficha-materiales-retirados-list');
                                                    if (retiradosList) {
                                                        const emptyNotice = retiradosList.querySelector('.mat-retirados-aviso-vacio');
                                                        if (emptyNotice) emptyNotice.remove();
                                                        // Crear fila de material retirado
                                                        const row = document.createElement('div');
                                                        row.className = 'ficha-material-retirado-row';
                                                        row.style.cssText = 'display:flex; gap:0.5rem; align-items:center; margin-bottom:0.5rem;';
                                                        row.innerHTML = `
                                                            <input type="text" class="abonados-select mat-desc" value="${badge.dataset.nombre}" style="flex:1;" readonly>
                                                            <input type="number" placeholder="Cant." min="1" value="1" class="abonados-select mat-cant" style="width:80px;">
                                                            <button type="button" class="abonados-btn abonados-btn-ghost btn-rm-material" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                                                        `;
                                                        retiradosList.appendChild(row);
                                                        
                                                        // Agregar evento para eliminar la fila
                                                        row.querySelector('.btn-rm-material').addEventListener('click', () => {
                                                            row.remove();
                                                            // Restaurar el badge si se elimina de retirados
                                                            badge.style.opacity = '1';
                                                            badge.style.textDecoration = 'none';
                                                            badge.style.cursor = 'grab';
                                                            badge.draggable = true;
                                                            badge.title = '';
                                                            btnRetBadge.style.display = 'inline-block';
                                                            
                                                            if (retiradosList.querySelectorAll('.ficha-material-retirado-row').length === 0) {
                                                                const aviso = document.createElement('p');
                                                                aviso.className = 'mat-retirados-aviso-vacio';
                                                                aviso.style.cssText = 'font-size:0.8rem; color:var(--text-muted); text-align:center; padding:0.5rem 0; margin:0;';
                                                                aviso.innerHTML = '<i class="fa-solid fa-box-open"></i> Sin materiales registrados.';
                                                                retiradosList.appendChild(aviso);
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                            
                                            clientMaterialsList.appendChild(badge);
                                        }
                                    });
                                } else {
                                    clientMaterialsList.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">No hay materiales previos registrados.</span>';
                                }
                            } catch (e) {
                                console.error('Error al cargar materiales del cliente:', e);
                            }
                        }
                    }

                    // Resetear técnicos y agregar uno inicial
                    const tecnicosList = form.querySelector('.ficha-tecnicos-list');
                    if (tecnicosList) tecnicosList.innerHTML = '';
                    const addTecBtn = form.querySelector('.btn-add-tecnico');
                    if (addTecBtn) addTecBtn.click();

                    // Auto-calcular fechas
                    if (instInput) {
                        const hasNoOrigValue = !instInput.getAttribute('value');
                        if (isInstTicket || hasNoOrigValue || !instInput.value) {
                            const today = new Date();
                            const y = today.getFullYear();
                            const m = String(today.getMonth() + 1).padStart(2, '0');
                            const d = String(today.getDate()).padStart(2, '0');
                            instInput.value = `${y}-${m}-${d}`;
                        }
                        if (corteInput && (isInstTicket || hasNoOrigValue || !corteInput.value)) {
                            corteInput.value = calcularFechaLimiteCorte(instInput.value, diaVencimiento, diasGracia);
                        }
                    }
                }

                // Agregar evento para limpiar estado al cerrar modal sin liquidar
                const closeModal = () => {
                    console.log('Cerrando modal de liquidación - limpiando estado');
                    
                    // Restaurar badges de materiales a su estado original
                    const clientMaterialsList = form.querySelector('.client-materials-list');
                    if (clientMaterialsList) {
                        clientMaterialsList.querySelectorAll('.client-mat-badge').forEach(badge => {
                            badge.style.opacity = '1';
                            badge.style.textDecoration = 'none';
                            badge.style.cursor = 'grab';
                            badge.draggable = true;
                            badge.title = '';
                            const btnRetBadge = badge.querySelector('.btn-retire-badge-shortcut');
                            if (btnRetBadge) btnRetBadge.style.display = 'inline-block';
                        });
                    }
                    
                    // Restaurar tarjeta de router
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
                    
                    // Limpiar lista de retirados
                    const retiradosList = form.querySelector('.ficha-materiales-retirados-list');
                    if (retiradosList) {
                        retiradosList.innerHTML = '';
                        const aviso = document.createElement('p');
                        aviso.className = 'mat-retirados-aviso-vacio';
                        aviso.style.cssText = 'font-size:0.8rem; color:var(--text-muted); text-align:center; padding:0.5rem 0; margin:0;';
                        aviso.innerHTML = '<i class="fa-solid fa-box-open"></i> Sin materiales registrados.';
                        retiradosList.appendChild(aviso);
                    }
                    
                    // Limpiar lista de utilizados
                    const usadosList = form.querySelector('.ficha-materiales-usados-list');
                    if (usadosList) usadosList.innerHTML = '';
                    
                    // Limpiar campos técnicos
                    const napSearchInput = form.querySelector('.nap-search-input');
                    const napIdInput = form.querySelector('.nap-id-hidden');
                    const puertoNapInput = form.querySelector('[name="puerto_nap"]');
                    const presintoInput = form.querySelector('[name="presinto_numero"]');
                    const hubBorneInput = form.querySelector('[name="hub_borne_referencia"]');
                    
                    if (napSearchInput) napSearchInput.value = '';
                    if (napIdInput) napIdInput.value = '';
                    if (puertoNapInput) puertoNapInput.value = '';
                    if (presintoInput) presintoInput.value = '';
                    if (hubBorneInput) hubBorneInput.value = '';
                    
                    // Limpiar campos de router
                    const routerModeloInput = form.querySelector('[name="router_modelo"]');
                    const routerSerieInput = form.querySelector('[name="router_serie"]');
                    const routerMacInput = form.querySelector('[name="router_mac"]');
                    
                    if (routerModeloInput) routerModeloInput.value = '';
                    if (routerSerieInput) routerSerieInput.value = '';
                    if (routerMacInput) routerMacInput.value = '';
                    
                    // Limpiar notas
                    const tituloSolucion = form.querySelector('[name="titulo_solucion"]');
                    const solucion = form.querySelector('[name="solucion"]');
                    
                    if (tituloSolucion) tituloSolucion.value = '';
                    if (solucion) solucion.value = '';
                    
                    // Limpiar técnicos
                    const tecnicosList = form.querySelector('.ficha-tecnicos-list');
                    if (tecnicosList) tecnicosList.innerHTML = '';

                    // Ocultar modal
                    modal.style.display = 'none';
                };

                modal.closeModalCallback = closeModal;
                
                // Evento para botón de cerrar modal
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    // Remover event listeners anteriores
                    const newCloseBtn = closeBtn.cloneNode(true);
                    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                    newCloseBtn.addEventListener('click', closeModal);
                }
                
                // Evento para botón de cancelar
                const cancelBtns = modal.querySelectorAll('.modal-close');
                cancelBtns.forEach(btn => {
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);
                    newBtn.addEventListener('click', closeModal);
                });

                modal.style.display = 'flex';
            });
        });

        // ── Derivar ticket: abrir modal ────────────────────────────────────────
        document.querySelectorAll('.btn-derivar-ticket-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = document.getElementById('modal-derivar-ticket');
                if (!modal) return;

                const ticketId = btn.dataset.ticketId;
                const fromMod = btn.dataset.modalidadActual || 'REMOTO';
                const toMod = fromMod.toUpperCase() === 'REMOTO' ? 'CAMPO' : 'REMOTO';

                const ticketIdInput = modal.querySelector('#derivar-ticket-id');
                const targetModInput = modal.querySelector('#derivar-ticket-modalidad');

                if (ticketIdInput) ticketIdInput.value = ticketId || '';
                if (targetModInput) targetModInput.value = toMod;

                const description = modal.querySelector('#derivar-target-description');
                if (description) {
                    description.textContent = toMod === 'CAMPO' ? 'Campo (Técnico Presencial)' : 'Virtual / Remoto';
                }

                modal.style.display = 'flex';
            });
        });

        // ── Derivar ticket: submit ─────────────────────────────────────────────
        const formDerivar = document.getElementById('form-derivar-ticket');
        if (formDerivar) {
            formDerivar.addEventListener('submit', async (e) => {
                e.preventDefault();
                const ticketId = document.getElementById('derivar-ticket-id')?.value;
                const targetModalidad = document.getElementById('derivar-ticket-modalidad')?.value;
                const motivo = document.getElementById('derivar-motivo')?.value;

                if (!ticketId || !targetModalidad) {
                    window.SITAlert.show('Información de ticket inválida.', 'warning');
                    return;
                }

                try {
                    const res = await fetch('/api/abonados/derivar-ticket/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ticket_id: ticketId, modalidad: targetModalidad, motivo })
                    });
                    const json = await res.json();
                    if (json.status !== 'success') {
                        window.SITAlert.show(json.message || 'Error al derivar ticket.', 'danger');
                        return;
                    }
                    window.SITAlert.show('Ticket derivado exitosamente.', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    window.SITAlert.show('Error de red al derivar el ticket.', 'danger');
                }
            });
        }

        // ── Toggle motivos de exoneración ──────────────────────────────────────
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('chk-omitir-pago-ticket')) {
                const form = e.target.closest('form');
                const wrap = form?.querySelector('.wrap-motivo-omision-ticket');
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
            if (e.target.classList.contains('chk-omitir-pago-materiales')) {
                const form = e.target.closest('form');
                const wrap = form?.querySelector('.wrap-motivo-omision-materiales');
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
        });

        // ── Checkbox nueva instalación activa cobra materiales ─────────────────
        document.getElementById('chk-nueva-instalacion')?.addEventListener('change', function () {
            const chkCobraMateriales = document.getElementById('chk-cobra-materiales');
            if (this.checked && chkCobraMateriales) {
                chkCobraMateriales.checked = true;
                chkCobraMateriales.dispatchEvent(new Event('change'));
            }
        });

        document.getElementById('chk-cobra-materiales')?.addEventListener('change', function () {
            const materialesSection = document.getElementById('materiales-section');
            if (materialesSection) {
                materialesSection.style.display = this.checked ? 'block' : 'none';
            }
        });

        // ── Agregar fila de material en modal de ticket ────────────────────────
        document.querySelectorAll('.btn-add-material-row').forEach(btn => {
            btn.addEventListener('click', () => {
                const materialesList = document.getElementById('materiales-list');
                if (!materialesList) return;
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
                newRow.querySelector('.btn-remove-material').addEventListener('click', () => newRow.remove());
            });
        });

        // ── Cerrar modales (botón X y clic fuera) ─────────────────────────────
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    if (typeof modal.closeModalCallback === 'function') {
                        modal.closeModalCallback();
                    } else {
                        modal.style.display = 'none';
                    }
                }
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (typeof modal.closeModalCallback === 'function') {
                        modal.closeModalCallback();
                    } else {
                        modal.style.display = 'none';
                    }
                }
            });
        });
    });

    // ── Helper: calcular fecha límite de corte ─────────────────────────────────
    function calcularFechaLimiteCorte(fechaInstStr, diaVencimiento, diasGracia) {
        if (!fechaInstStr) return '';
        const dateParts = fechaInstStr.split('-');
        if (dateParts.length !== 3) return '';
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const installDate = new Date(year, month, day);
        let dueDate;
        if (diaVencimiento === 'fin_mes') {
            dueDate = new Date(year, month + 1, 0);
        } else {
            dueDate = new Date(year, month + 1, day);
            if (dueDate.getMonth() !== (month + 1) % 12) {
                dueDate = new Date(year, month + 2, 0);
            }
        }
        const cutoffDate = new Date(dueDate.getTime());
        cutoffDate.setDate(cutoffDate.getDate() + parseInt(diasGracia || 5, 10));
        const y = cutoffDate.getFullYear();
        const m = String(cutoffDate.getMonth() + 1).padStart(2, '0');
        const d = String(cutoffDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

})();

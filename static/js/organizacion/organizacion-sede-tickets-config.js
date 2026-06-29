/**
 * organizacion-sede-tickets-config.js
 * Módulo de gestión de catálogo de tickets de la sede.
 * Usa los datos de window.currentSedeConfigData.catalogo_tickets (cargados
 * previamente por /api/sede/config/) y llama a los endpoints reales:
 *   SAVE → POST /api/sede/config/catalogo-ticket/
 *   DEL  → POST /api/sede/config/catalogo-ticket/eliminar/
 * Usa window.generateSimpleTicketHTML / window.imprimirTicket (ticket-simple.js)
 * para la vista previa del ticket A5.
 */

window.initSedeTicketsModule = async () => {
    const sedeId = window.currentSedeId;
    const res = window.currentSedeConfigData || {};
    const sedeData = res.datos_sede || {};
    const body = document.getElementById('sedeConfigBody');
    if (!body) return;

    // -- Datos del catalogo ya disponibles en memoria
    let todosLosTickets = (res.catalogo_tickets || []).slice();

    // -- Extraer valores únicos de los tickets registrados (solo lo que existe en BD)
    const categoriasUnicas  = [...new Set(todosLosTickets.map(t => (t.categoria || '').trim()).filter(Boolean))].sort();
    const areasUnicas       = [...new Set(todosLosTickets.map(t => (t.area || '').trim()).filter(Boolean))].sort();
    const tecnologiasUnicas = [...new Set(todosLosTickets.map(t => (t.tecnologia || '').trim()).filter(Boolean))].sort();
    const modalidadesUnicas = [...new Set(todosLosTickets.map(t => (t.modalidad || '').trim()).filter(Boolean))].sort();

    // -- Estructura del panel
    body.innerHTML = `
        <div class="config-card sede-tab-panel">
            <div class="config-card-title">
                ${GLOBAL_ICONS.settings()} Catálogo de Tickets de la Sede
            </div>
            <p class="config-panel-desc">
                Configure los tipos de tickets disponibles para esta sede.
                Filtre la informacion por categoria, area, tecnologia y modalidad para visualizar los tickets correspondientes.
            </p>

            <!-- Barra de Filtros Dinamicos -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem; margin-bottom:1.25rem; background:var(--bg-surface-hover); padding:1rem; border-radius:8px; border:1px solid var(--border-color);">
                <div class="config-form-group" style="margin:0;">
                    <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.25rem; display:block;">Categoría</label>
                    <select id="filterCategoria" class="config-form-input" style="font-size:0.8rem;"></select>
                </div>
                <div class="config-form-group" style="margin:0;">
                    <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.25rem; display:block;">Área</label>
                    <select id="filterArea" class="config-form-input" style="font-size:0.8rem;"></select>
                </div>
                <div class="config-form-group" style="margin:0;">
                    <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.25rem; display:block;">Tecnología</label>
                    <select id="filterTecnologia" class="config-form-input" style="font-size:0.8rem;"></select>
                </div>
                <div class="config-form-group" style="margin:0;">
                    <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.25rem; display:block;">Modalidad</label>
                    <select id="filterModalidad" class="config-form-input" style="font-size:0.8rem;"></select>
                </div>
            </div>

            <!-- Barra de herramientas (Buscador y Agregar) -->
            <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1.25rem;">
                <input type="text" id="ticketSearchInput" class="config-form-input"
                       placeholder="Buscar por nombre del ticket…"
                       style="flex:1;min-width:200px;">
                <button type="button" class="config-btn-save" id="btnAgregarTicket">
                    ${GLOBAL_ICONS.add()} Agregar Ticket
                </button>
            </div>

            <!-- Tabla de Listado -->
            <div id="ticketsTableWrapper" class="config-table-wrap" style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: var(--bg-surface);">
                <table class="config-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background: var(--bg-surface-hover);">
                            <th style="padding:10px 12px; text-align:left; font-weight:600; font-size:0.78rem; color:var(--text-muted);">Nombre</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600; font-size:0.78rem; color:var(--text-muted);">Categoría</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600; font-size:0.78rem; color:var(--text-muted);">Modalidad</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600; font-size:0.78rem; color:var(--text-muted);">Tecnología / Área</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600; font-size:0.78rem; color:var(--text-muted);">Funciones Especiales</th>
                            <th style="padding:10px 12px; text-align:left; font-weight:600; font-size:0.78rem; color:var(--text-muted); width:80px;">Estado</th>
                            <th style="padding:10px 12px; text-align:right; font-weight:600; font-size:0.78rem; color:var(--text-muted); width:130px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="ticketsTableBody"></tbody>
                </table>
            </div>

            <!-- Vista previa -->
            <div style="margin-top:1.5rem;border-top:1px solid var(--border-color);padding-top:1.25rem;">
                <div class="config-card-title" style="margin-bottom:0.75rem; font-size: 0.9rem;">
                    ${GLOBAL_ICONS.view()} Vista previa del ticket
                </div>
                <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">
                    Previsualice el ticket con los datos de esta sede usando datos de ejemplo.
                    El número se asigna automáticamente en producción.
                </p>
                <button type="button" class="config-btn-secondary" id="btnPreviewTicket">
                    ${GLOBAL_ICONS.view()} Abrir vista previa
                </button>
            </div>
        </div>
    `;

    // -- Poblar filtros dinamicos (solo valores de base de datos, tal como están)
    const poblarSelect = (elementId, opciones, valorPorDefecto) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        // Eliminar duplicados y ordenar, sin cambiar mayúsculas/minúsculas
        const opts = [...new Set(opciones)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        // Agregar opción vacía al inicio para "todos"
        const finalOpts = ['', ...opts];
        const defaultVal = opts.includes(valorPorDefecto) ? valorPorDefecto : '';
        el.innerHTML = finalOpts.map(o => `<option value="${o}" ${o === defaultVal ? 'selected' : ''}>${o || 'TODOS'}</option>`).join('');
    };

    poblarSelect('filterCategoria', categoriasUnicas, '');
    poblarSelect('filterArea', areasUnicas, '');
    poblarSelect('filterTecnologia', tecnologiasUnicas, '');
    poblarSelect('filterModalidad', modalidadesUnicas, '');

    // -- Event Listeners de Filtros y Busqueda
    document.getElementById('filterCategoria')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filterArea')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filterTecnologia')?.addEventListener('change', aplicarFiltros);
    document.getElementById('filterModalidad')?.addEventListener('change', aplicarFiltros);
    document.getElementById('ticketSearchInput')?.addEventListener('input', aplicarFiltros);

    // Inicializar tabla
    aplicarFiltros();

    // ── Agregar ───────────────────────────────────────────────────────────
    document.getElementById('btnAgregarTicket')?.addEventListener('click', () => {
        abrirModal(null);
    });

    // ── Vista previa general ──────────────────────────────────────────────
    document.getElementById('btnPreviewTicket')?.addEventListener('click', () => {
        abrirVistaPrevia(null);
    });

    // -- Funcion para aplicar filtros
    function aplicarFiltros() {
        const catVal = document.getElementById('filterCategoria')?.value || '';
        const areaVal = document.getElementById('filterArea')?.value || '';
        const techVal = document.getElementById('filterTecnologia')?.value || '';
        const modVal = document.getElementById('filterModalidad')?.value || '';
        const searchVal = (document.getElementById('ticketSearchInput')?.value || '').trim().toLowerCase();

        const filtrados = todosLosTickets.filter(t => {
            const tCat = (t.categoria || '').trim();
            const tArea = (t.area || '').trim();
            const tTech = (t.tecnologia || '').trim();
            const tMod = (t.modalidad || '').trim();
            const tName = (t.nombre || '').toLowerCase();

            // Match exacto (sin comodín TODOS, usar valor vacío para "todos")
            const matchCat = !catVal || tCat === catVal;
            const matchArea = !areaVal || tArea === areaVal;
            const matchTech = !techVal || tTech === techVal;
            const matchMod = !modVal || tMod === modVal;

            const matchSearch = !searchVal || tName.includes(searchVal);

            return matchCat && matchArea && matchTech && matchMod && matchSearch;
        });

        renderizarTickets(filtrados);
    }

    // -- Función para actualizar filtros con nuevos valores
    function actualizarFiltros() {
        // Extraer valores únicos actualizados
        const nuevasCategorias = [...new Set(todosLosTickets.map(t => (t.categoria || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const nuevasAreas = [...new Set(todosLosTickets.map(t => (t.area || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const nuevasTecnologias = [...new Set(todosLosTickets.map(t => (t.tecnologia || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const nuevasModalidades = [...new Set(todosLosTickets.map(t => (t.modalidad || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        // Guardar valores seleccionados actuales
        const catSeleccionado = document.getElementById('filterCategoria')?.value || '';
        const areaSeleccionado = document.getElementById('filterArea')?.value || '';
        const techSeleccionado = document.getElementById('filterTecnologia')?.value || '';
        const modSeleccionado = document.getElementById('filterModalidad')?.value || '';

        // Repoblar filtros
        poblarSelect('filterCategoria', nuevasCategorias, catSeleccionado);
        poblarSelect('filterArea', nuevasAreas, areaSeleccionado);
        poblarSelect('filterTecnologia', nuevasTecnologias, techSeleccionado);
        poblarSelect('filterModalidad', nuevasModalidades, modSeleccionado);

        // Aplicar filtros
        aplicarFiltros();
    }

    // ─────────────────────────────────────────────────────────────────────
    // FUNCIONES INTERNAS
    // ─────────────────────────────────────────────────────────────────────

    function renderizarTickets(lista) {
        const tbody = document.getElementById('ticketsTableBody');
        if (!tbody) return;

        if (!lista.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
                        <p style="margin-bottom:0.5rem; font-weight: 500;">No hay tickets en el catálogo para esta sede.</p>
                        <p style="font-size:0.8rem; opacity: 0.8;">Haga clic en "Agregar Ticket" para crear el primer tipo de ticket.</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = lista.map(t => {
            // Generar badges de funciones especiales activadas
            const badgesFunciones = [];
            if (t.cobra_materiales_liquidar) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">Materiales</span>');
            }
            if (t.es_instalacion) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">Instalación</span>');
            }
            if (t.editar_mapa) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);">Mapa</span>');
            }
            if (t.mantiene_equipo_anterior) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.2);">Mantiene Eq.</span>');
            }
            if (t.requiere_nuevo_suministro) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);">Suministro</span>');
            }
            if (t.migracion_plan) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(6, 182, 212, 0.1); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.2);">Migración</span>');
            }
            if (t.cambio_equipo) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; border: 1px solid rgba(14, 165, 233, 0.2);">Cambio Eq.</span>');
            }
            if (t.genera_merma) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(236, 72, 153, 0.1); color: #ec4899; border: 1px solid rgba(236, 72, 153, 0.2);">Merma</span>');
            }
            if (t.corte_temporal) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(249, 115, 22, 0.1); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.2);">Corte Temp.</span>');
            }
            if (t.morosidad) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(220, 38, 38, 0.1); color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.2);">Morosidad</span>');
            }
            if (t.corte_definitivo) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(124, 58, 237, 0.1); color: #7c3aed; border: 1px solid rgba(124, 58, 237, 0.2);">Corte Def.</span>');
            }
            if (t.instalacion_anexo) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(20, 184, 166, 0.1); color: #14b8a6; border: 1px solid rgba(20, 184, 166, 0.2);">Anexo +</span>');
            }
            if (t.corte_anexo) {
                badgesFunciones.push('<span class="config-badge" style="background: rgba(168, 85, 247, 0.1); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.2);">Anexo -</span>');
            }

            const funcionesHtml = badgesFunciones.length > 0
                ? `<div style="display:flex;gap:4px;flex-wrap:wrap;">${badgesFunciones.join('')}</div>`
                : '<span style="color:var(--text-muted);font-style:italic;font-size:0.75rem;">Ninguna</span>';

            const statusBadge = t.activo !== false
                ? '<span class="config-badge config-badge-success">Activo</span>'
                : '<span class="config-badge config-badge-danger">Inactivo</span>';

            const techAreaText = `${t.tecnologia || 'Todos'} &bull; ${t.area || 'REMOTO'}`;

            return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s;">
                    <td style="padding:10px 12px; font-weight:600; color:var(--text-primary);">
                        ${t.nombre || '—'}
                        ${t.es_universal ? '<span style="font-size:0.7rem; color:var(--text-muted); font-style:italic; margin-left:6px;">(Universal)</span>' : ''}
                    </td>
                    <td style="padding:10px 12px; font-size:0.8rem; color:var(--text-secondary); text-transform:uppercase;">
                        ${t.categoria || '—'}
                    </td>
                    <td style="padding:10px 12px; font-size:0.8rem; color:var(--text-secondary);">
                        ${t.modalidad || '—'}
                    </td>
                    <td style="padding:10px 12px; font-size:0.8rem; color:var(--text-secondary);">
                        ${techAreaText}
                    </td>
                    <td style="padding:10px 12px;">
                        ${funcionesHtml}
                    </td>
                    <td style="padding:10px 12px; vertical-align: middle;">
                        ${statusBadge}
                    </td>
                    <td style="padding:10px 12px; text-align:right; white-space:nowrap;">
                        <button type="button" class="ruc-action-btn btn-view"
                                style="padding:0.35rem 0.5rem; margin-right:2px;"
                                onclick="window._ticketPreview(${t.id})"
                                title="Vista previa">
                            ${GLOBAL_ICONS.view()}
                        </button>
                        <button type="button" class="ruc-action-btn btn-edit"
                                style="padding:0.35rem 0.5rem; margin-right:2px;"
                                onclick="window._ticketEditar(${t.id})"
                                title="Editar">
                            ${GLOBAL_ICONS.edit()}
                        </button>
                        <button type="button" class="ruc-action-btn btn-delete"
                                style="padding:0.35rem 0.5rem;"
                                onclick="window._ticketEliminar(${t.id})"
                                title="Eliminar">
                            ${GLOBAL_ICONS.delete()}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ── Vista previa ──────────────────────────────────────────────────────
    function abrirVistaPrevia(ticket) {
        if (typeof window.imprimirTicket !== 'function') {
            alert('El módulo de ticket no está cargado (ticket-simple.js).');
            return;
        }
        const logoUrl = sedeData.logo_url || null;
        const telefono = sedeData.telefono || '064466080';
        const sedNombre = sedeData.nombre_base || sedeData.nombre || 'LA OROYA';
        const categoria = ticket?.categoria || 'INCIDENCIA';
        const tickNombre = ticket?.nombre || '';

        const clienteData = {
            nombre: 'EJEMPLO CLIENTE S.A.C.',
            dni: '12345678',
            codigo: 'ORO-S04-00000001',
            contrato: '1',
            celular1: '999888777',
            celular2: '999888666',
            direccion: 'Jr. Ejemplo 123 — La Oroya',
            sector: sedeData.sector_prefijo || '—',
        };
        const servicioData = {
            suministro: '2024001',
            plan: 'FIBRA 100 MBPS',
            codigo: '1',
            velocidad: '100 Mbps',
            estado: 'ACTIVO',
            anexos: '1',
            nap: 'NAP-001',
            puerto: '8',
            precinto: 'P-99999',
            serie_equipo: 'SN00001',
            mac_equipo: 'AA:BB:CC:DD:EE:FF',
        };
        const ticketData = {
            motivo: ticket?.nombre || 'Sin señal — fibra cortada',
            detalle: '—',
            fecha_emision: new Date().toLocaleDateString('es-PE'),
            hora_emision: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
            fecha_atencion: '—',
            hora_atencion: '—',
            materiales_usados: '—',
            materiales_retirados: '—',
            observacion: '—',
        };

        window.imprimirTicket(
            logoUrl, 'EJEMPLO', categoria,
            telefono, sedNombre,
            clienteData, servicioData, ticketData, tickNombre
        );
    }

    // Exponer para botones en el DOM
    window._ticketPreview = (tid) => {
        const t = todosLosTickets.find(x => x.id === tid);
        abrirVistaPrevia(t || null);
    };

    function abrirModal(ticketExistente) {
        const isEdit = !!ticketExistente;
        const t = ticketExistente || {};

        // Usar valores de los tickets registrados (solo lo que existe en BD)
        const sugCategorias = categoriasUnicas.length ? categoriasUnicas : ['incidencia', 'averia', 'requerimiento', 'instalacion'];
        const sugModalidades = modalidadesUnicas.length ? modalidadesUnicas : ['remoto', 'campo'];
        const sugTecnologias = tecnologiasUnicas.length ? tecnologiasUnicas : ['internet', 'tv', 'todos'];
        const sugAreas = areasUnicas.length ? areasUnicas : ['planta_interna', 'planta_externa'];

        const normalizeVal = (val) => (val || '').trim().toLowerCase();
        const friendlyMod = (m) => {
            const l = normalizeVal(m);
            return l === 'remoto' ? 'Remoto' : (l === 'campo' ? 'Campo' : (l === 'presencial' ? 'Presencial' : m));
        };

        const buildDatalist = (id, options) => {
            return `<datalist id="${id}">
                ${options.map(o => `<option value="${o}">`).join('')}
            </datalist>`;
        };

        const modalHtml = `
            <div id="ticketModalOverlay"
                 style="position:fixed;inset:0;background:rgba(9,13,22,0.6);backdrop-filter:blur(4px);z-index:3000;
                        display:flex;align-items:center;justify-content:center;padding:1rem;">
                <div style="background:var(--bg-surface);border-radius:12px;padding:2rem;
                            max-width:650px;width:100%;max-height:90vh;overflow-y:auto;
                            box-shadow:0 24px 48px rgba(0,0,0,0.3); border:1px solid var(--border-color);">

                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;border-bottom:1px solid var(--border-color);padding-bottom:0.75rem;">
                        <h3 style="margin:0; font-family:'Outfit',sans-serif; font-weight:700; color:var(--text-primary);">
                            ${isEdit ? 'Editar Tipo de Ticket' : 'Agregar Tipo de Ticket'}
                        </h3>
                        <button type="button" onclick="document.getElementById('ticketModalOverlay').remove()"
                                style="background:none;border:none;font-size:1.5rem;cursor:pointer;line-height:1;color:var(--text-muted);">&times;</button>
                    </div>

                    <form id="ticketCatalogoForm">
                        
                        <!-- SECCIÓN 1: DATOS BÁSICOS -->
                        <div class="config-form-group" style="margin-bottom:1rem;">
                            <label>Nombre del ticket *</label>
                            <input type="text" class="config-form-input" name="nombre"
                                   value="${t.nombre || ''}" required
                                   placeholder="Ej: Atenuación alta">
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                            <div class="config-form-group">
                                <label>Categoría *</label>
                                <input type="text" class="config-form-input" name="categoria" list="datalistCategorias"
                                       value="${t.categoria || ''}" required placeholder="Seleccione o escriba...">
                                ${buildDatalist('datalistCategorias', sugCategorias)}
                            </div>
                            <div class="config-form-group">
                                <label>Modalidad *</label>
                                <input type="text" class="config-form-input" name="modalidad" list="datalistModalidades"
                                       value="${t.modalidad || ''}" required placeholder="Seleccione o escriba...">
                                ${buildDatalist('datalistModalidades', sugModalidades)}
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem;">
                            <div class="config-form-group">
                                <label>Tecnología *</label>
                                <input type="text" class="config-form-input" name="tecnologia" list="datalistTecnologias"
                                       value="${t.tecnologia || ''}" required placeholder="Seleccione o escriba...">
                                ${buildDatalist('datalistTecnologias', sugTecnologias)}
                            </div>
                            <div class="config-form-group">
                                <label>Área *</label>
                                <input type="text" class="config-form-input" name="area" list="datalistAreas"
                                       value="${t.area || ''}" required placeholder="Seleccione o escriba...">
                                ${buildDatalist('datalistAreas', sugAreas)}
                            </div>
                            <div class="config-form-group">
                                <label>Precio Base (S/.)</label>
                                <input type="number" class="config-form-input" name="precio_base" step="0.01" min="0"
                                       value="${t.precio_base || '0.00'}">
                            </div>
                        </div>

                        <!-- SECCIÓN 2: FUNCIONES ESPECIALES -->
                        <div style="background:var(--bg-surface-hover);border:1px solid var(--border-color);border-radius:8px;padding:1rem;margin-bottom:1rem;">
                            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.85rem;display:flex;align-items:center;gap:0.5rem;">
                                ${GLOBAL_ICONS.settings(13)} Funciones Especiales
                            </div>
                            <div style="display:flex;flex-direction:column;gap:0.5rem;">

                                <!-- ── Migración de plan (opción con panel expandible) ── -->
                                <div style="border:1px solid ${t.migracion_plan ? '#06b6d4' : 'var(--border-color)'};border-radius:7px;overflow:hidden;transition:border-color 0.2s;" id="wrap_migracion_plan">
                                    <label style="display:flex;align-items:center;gap:0.65rem;padding:0.6rem 0.85rem;cursor:pointer;background:${t.migracion_plan ? 'rgba(6,182,212,0.07)' : 'transparent'};transition:background 0.2s;">
                                        <input type="checkbox" name="migracion_plan" id="chk_migracion_plan"
                                               ${t.migracion_plan ? 'checked' : ''}
                                               style="accent-color:#06b6d4;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.5rem;color:#06b6d4;">
                                            ${GLOBAL_ICONS.swap(14)}
                                        </span>
                                        <div style="flex:1;">
                                            <div style="font-size:0.83rem;font-weight:700;color:var(--text-primary);">Migración de plan</div>
                                            <div style="font-size:0.73rem;color:var(--text-muted);margin-top:1px;">Al liquidar: corta el plan actual y activa el nuevo plan seleccionado</div>
                                        </div>
                                    </label>
                                    <!-- Panel expandible de configuración de migración -->
                                    <div id="panel_migracion_plan" style="display:${t.migracion_plan ? 'block' : 'none'};padding:0.75rem 0.85rem 0.85rem;border-top:1px solid rgba(6,182,212,0.2);background:rgba(6,182,212,0.04);">
                                        <div style="font-size:0.75rem;font-weight:600;color:#06b6d4;margin-bottom:0.6rem;text-transform:uppercase;letter-spacing:0.04em;">Configuración de migración</div>
                                        <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:0.75rem;line-height:1.5;">
                                            Esta orden cambia el plan del cliente. Al liquidarla, el sistema corta el plan anterior y activa el nuevo. 
                                            El técnico selecciona el plan destino al momento de ejecutar la orden.
                                        </div>
                                        <!-- Sub-opción: derivar orden de cambio de equipo -->
                                        <label style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.7rem;border-radius:6px;cursor:pointer;border:1px solid ${t.migracion_genera_cambio_equipo ? '#8b5cf6' : 'rgba(6,182,212,0.25)'};background:${t.migracion_genera_cambio_equipo ? 'rgba(139,92,246,0.08)' : 'rgba(6,182,212,0.04)'};transition:all 0.2s;" id="lbl_migracion_genera_cambio_equipo">
                                            <input type="checkbox" name="migracion_genera_cambio_equipo" id="chk_migracion_cambio_equipo"
                                                   ${t.migracion_genera_cambio_equipo ? 'checked' : ''}
                                                   style="accent-color:#8b5cf6;width:14px;height:14px;cursor:pointer;flex-shrink:0;">
                                            <span style="display:flex;align-items:center;gap:0.4rem;color:#8b5cf6;flex-shrink:0;">
                                                ${GLOBAL_ICONS.box(13)}
                                            </span>
                                            <div>
                                                <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);">Derivar orden de Cambio de equipo</div>
                                                <div style="font-size:0.72rem;color:var(--text-muted);">Genera automáticamente una orden adicional para cambio de equipo al liquidar</div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <!-- ── Grid 2 columnas para el resto de opciones ── -->
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">

                                    <!-- Instalación -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.es_instalacion ? '#10b981' : 'var(--border-color)'};background:${t.es_instalacion ? 'rgba(16,185,129,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_es_instalacion">
                                        <input type="checkbox" name="es_instalacion" id="chk_es_instalacion"
                                               ${t.es_instalacion ? 'checked' : ''}
                                               style="accent-color:#10b981;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#10b981;flex-shrink:0;">${GLOBAL_ICONS.home(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Instalación</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Activa flujo de instalación</div>
                                        </div>
                                    </label>

                                    <!-- Cobra materiales -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.cobra_materiales_liquidar ? '#ef4444' : 'var(--border-color)'};background:${t.cobra_materiales_liquidar ? 'rgba(239,68,68,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_cobra_materiales">
                                        <input type="checkbox" name="cobra_materiales_liquidar" id="chk_cobra_materiales"
                                               ${t.cobra_materiales_liquidar ? 'checked' : ''}
                                               style="accent-color:#ef4444;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#ef4444;flex-shrink:0;">${GLOBAL_ICONS.receipt(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Cobra materiales</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Genera cargo por materiales</div>
                                        </div>
                                    </label>

                                    <!-- Editar mapa -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.editar_mapa ? '#3b82f6' : 'var(--border-color)'};background:${t.editar_mapa ? 'rgba(59,130,246,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_editar_mapa">
                                        <input type="checkbox" name="editar_mapa" id="chk_editar_mapa"
                                               ${t.editar_mapa ? 'checked' : ''}
                                               style="accent-color:#3b82f6;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#3b82f6;flex-shrink:0;">${GLOBAL_ICONS.map(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Editar mapa</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Permite editar posición NAP</div>
                                        </div>
                                    </label>

                                    <!-- Mantiene equipo anterior -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.mantiene_equipo_anterior ? '#8b5cf6' : 'var(--border-color)'};background:${t.mantiene_equipo_anterior ? 'rgba(139,92,246,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_mantiene_equipo">
                                        <input type="checkbox" name="mantiene_equipo_anterior" id="chk_mantiene_equipo"
                                               ${t.mantiene_equipo_anterior ? 'checked' : ''}
                                               style="accent-color:#8b5cf6;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#8b5cf6;flex-shrink:0;">${GLOBAL_ICONS.box(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Mantiene equipo</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">El equipo anterior se mantiene</div>
                                        </div>
                                    </label>

                                    <!-- Requiere nuevo suministro -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.requiere_nuevo_suministro ? '#f59e0b' : 'var(--border-color)'};background:${t.requiere_nuevo_suministro ? 'rgba(245,158,11,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_requiere_suministro">
                                        <input type="checkbox" name="requiere_nuevo_suministro" id="chk_requiere_suministro"
                                               ${t.requiere_nuevo_suministro ? 'checked' : ''}
                                               style="accent-color:#f59e0b;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#f59e0b;flex-shrink:0;">${GLOBAL_ICONS.zap(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Nuevo suministro</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Requiere N° suministro nuevo</div>
                                        </div>
                                    </label>

                                    <!-- Genera merma -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.genera_merma ? '#ec4899' : 'var(--border-color)'};background:${t.genera_merma ? 'rgba(236,72,153,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_genera_merma">
                                        <input type="checkbox" name="genera_merma" id="chk_genera_merma"
                                               ${t.genera_merma ? 'checked' : ''}
                                               style="accent-color:#ec4899;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#ec4899;flex-shrink:0;">${GLOBAL_ICONS.trash2(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Genera merma</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Registra baja de materiales</div>
                                        </div>
                                    </label>

                                    <!-- Cambio de equipo -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.cambio_equipo ? '#0ea5e9' : 'var(--border-color)'};background:${t.cambio_equipo ? 'rgba(14,165,233,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_cambio_equipo">
                                        <input type="checkbox" name="cambio_equipo" id="chk_cambio_equipo"
                                               ${t.cambio_equipo ? 'checked' : ''}
                                               style="accent-color:#0ea5e9;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#0ea5e9;flex-shrink:0;">${GLOBAL_ICONS.monitor(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Cambio de equipo</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Activa flujo de reemplazo de dispositivo</div>
                                        </div>
                                    </label>

                                    <!-- Corte temporal -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.corte_temporal ? '#f97316' : 'var(--border-color)'};background:${t.corte_temporal ? 'rgba(249,115,22,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_corte_temporal">
                                        <input type="checkbox" name="corte_temporal" id="chk_corte_temporal"
                                               ${t.corte_temporal ? 'checked' : ''}
                                               style="accent-color:#f97316;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#f97316;flex-shrink:0;">${GLOBAL_ICONS.clock(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Corte temporal</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Suspensión temporal del servicio</div>
                                        </div>
                                    </label>

                                    <!-- Morosidad -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.morosidad ? '#dc2626' : 'var(--border-color)'};background:${t.morosidad ? 'rgba(220,38,38,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_morosidad">
                                        <input type="checkbox" name="morosidad" id="chk_morosidad"
                                               ${t.morosidad ? 'checked' : ''}
                                               style="accent-color:#dc2626;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#dc2626;flex-shrink:0;">${GLOBAL_ICONS.alertTriangle(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Morosidad</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Corte por falta de pago</div>
                                        </div>
                                    </label>

                                    <!-- Corte definitivo -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.corte_definitivo ? '#7c3aed' : 'var(--border-color)'};background:${t.corte_definitivo ? 'rgba(124,58,237,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_corte_definitivo">
                                        <input type="checkbox" name="corte_definitivo" id="chk_corte_definitivo"
                                               ${t.corte_definitivo ? 'checked' : ''}
                                               style="accent-color:#7c3aed;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#7c3aed;flex-shrink:0;">${GLOBAL_ICONS.xCircle(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Corte definitivo</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Baja definitiva del servicio</div>
                                        </div>
                                    </label>

                                    <!-- Instalación de anexo -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.instalacion_anexo ? '#14b8a6' : 'var(--border-color)'};background:${t.instalacion_anexo ? 'rgba(20,184,166,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_instalacion_anexo">
                                        <input type="checkbox" name="instalacion_anexo" id="chk_instalacion_anexo"
                                               ${t.instalacion_anexo ? 'checked' : ''}
                                               style="accent-color:#14b8a6;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#14b8a6;flex-shrink:0;">${GLOBAL_ICONS.plusCircle(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Instalación de anexo</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Añade costo mensual al plan</div>
                                        </div>
                                    </label>

                                    <!-- Corte de anexo -->
                                    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:6px;cursor:pointer;border:1px solid ${t.corte_anexo ? '#a855f7' : 'var(--border-color)'};background:${t.corte_anexo ? 'rgba(168,85,247,0.08)' : 'transparent'};transition:all 0.2s;" id="lbl_corte_anexo">
                                        <input type="checkbox" name="corte_anexo" id="chk_corte_anexo"
                                               ${t.corte_anexo ? 'checked' : ''}
                                               style="accent-color:#a855f7;width:15px;height:15px;cursor:pointer;flex-shrink:0;">
                                        <span style="display:flex;align-items:center;gap:0.4rem;color:#a855f7;flex-shrink:0;">${GLOBAL_ICONS.minusCircle(13)}</span>
                                        <div>
                                            <div style="font-size:0.81rem;font-weight:600;color:var(--text-primary);">Corte de anexo</div>
                                            <div style="font-size:0.71rem;color:var(--text-muted);">Baja de anexo TV</div>
                                        </div>
                                    </label>

                                </div>
                            </div>
                        </div>

                        <!-- Acciones -->
                        <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                            <button type="button"
                                    onclick="document.getElementById('ticketModalOverlay').remove()"
                                    class="config-btn-secondary">
                                ${GLOBAL_ICONS.cancel()} Cancelar
                            </button>
                            <button type="submit" class="config-btn-save">
                                ${GLOBAL_ICONS.save()} Guardar
                            </button>
                        </div>
                    </form>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // -- Toggle panel de Migración de plan
        const chkMigracion = document.getElementById('chk_migracion_plan');
        const panelMigracion = document.getElementById('panel_migracion_plan');
        const wrapMigracion = document.getElementById('wrap_migracion_plan');
        if (chkMigracion && panelMigracion && wrapMigracion) {
            chkMigracion.addEventListener('change', () => {
                const activo = chkMigracion.checked;
                panelMigracion.style.display = activo ? 'block' : 'none';
                wrapMigracion.style.borderColor = activo ? '#06b6d4' : 'var(--border-color)';
                chkMigracion.closest('label').style.background = activo ? 'rgba(6,182,212,0.07)' : 'transparent';
            });
        }


        document.getElementById('ticketCatalogoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando…';

            const data = {
                sede_id: sedeId,
                nombre: form.nombre.value.trim(),
                categoria: form.categoria.value.trim(),
                modalidad: form.modalidad.value.trim(),
                tecnologia: form.tecnologia.value.trim(),
                area: form.area.value.trim(),
                precio_base: parseFloat(form.precio_base.value || 0),
                activo: t.activo !== undefined ? t.activo : true,
                permite_eliminar: t.permite_eliminar !== undefined ? t.permite_eliminar : true,
                // Funciones especiales - leer directamente del formulario
                migracion_plan: form.migracion_plan.checked,
                migracion_genera_cambio_equipo: form.migracion_genera_cambio_equipo ? form.migracion_genera_cambio_equipo.checked : false,
                es_instalacion: form.es_instalacion.checked,
                cobra_materiales_liquidar: form.cobra_materiales_liquidar.checked,
                editar_mapa: form.editar_mapa.checked,
                mantiene_equipo_anterior: form.mantiene_equipo_anterior.checked,
                requiere_nuevo_suministro: form.requiere_nuevo_suministro.checked,
                genera_merma: form.genera_merma.checked,
                cambio_equipo: form.cambio_equipo.checked,
                corte_temporal: form.corte_temporal ? form.corte_temporal.checked : false,
                morosidad: form.morosidad ? form.morosidad.checked : false,
                corte_definitivo: form.corte_definitivo ? form.corte_definitivo.checked : false,
                instalacion_anexo: form.instalacion_anexo ? form.instalacion_anexo.checked : false,
                corte_anexo: form.corte_anexo ? form.corte_anexo.checked : false,
                flag_funciones_especiales: t.flag_funciones_especiales || false,
                funciones_especiales: t.funciones_especiales || '',
                es_universal: false,
            };
            if (isEdit) data.ticket_id = t.id;

            try {
                const resp = await fetch('/api/sede/config/catalogo-ticket/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': window.getCookie('csrftoken'),
                    },
                    body: JSON.stringify(data),
                });
                const json = await resp.json();
                if (json.status === 'success') {
                    document.getElementById('ticketModalOverlay')?.remove();
                    // Si es edición, actualizar el ticket existente; si es nuevo, agregarlo
                    if (json.ticket) {
                        if (isEdit) {
                            // Actualizar ticket existente en la lista
                            const index = todosLosTickets.findIndex(x => x.id === t.id);
                            if (index !== -1) {
                                todosLosTickets[index] = json.ticket;
                            }
                        } else {
                            // Agregar nuevo ticket
                            todosLosTickets.push(json.ticket);
                        }
                    }
                    // Actualizar filtros con los nuevos valores
                    actualizarFiltros();
                } else {
                    alert(`Error: ${json.message}`);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Guardar';
                }
            } catch {
                alert('Error de conexión al guardar el ticket.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar';
            }
        });
    }

    // Exponer editar / eliminar
    window._ticketEditar = (tid) => {
        const t = todosLosTickets.find(x => x.id === tid);
        if (!t) { alert('Ticket no encontrado.'); return; }
        abrirModal(t);
    };

    window._ticketEliminar = async (tid) => {
        const t = todosLosTickets.find(x => x.id === tid);
        if (!t) return;
        if (!t.permite_eliminar) {
            alert('Este tipo de ticket está marcado como no eliminable.');
            return;
        }
        if (!confirm(`¿Eliminar el ticket "${t.nombre}"?\nEsta acción no se puede deshacer.`)) return;

        try {
            const resp = await fetch('/api/sede/config/catalogo-ticket/eliminar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.getCookie('csrftoken'),
                },
                body: JSON.stringify({ sede_id: sedeId, ticket_id: tid }),
            });
            const json = await resp.json();
            if (json.status === 'success') {
                // Eliminar de la lista local y re-renderizar sin recargar
                todosLosTickets = todosLosTickets.filter(x => x.id !== tid);
                // También actualizar currentSedeConfigData para consistencia
                if (window.currentSedeConfigData?.catalogo_tickets) {
                    window.currentSedeConfigData.catalogo_tickets =
                        window.currentSedeConfigData.catalogo_tickets.filter(x => x.id !== tid);
                }
                renderizarTickets(todosLosTickets);
            } else {
                alert(`Error: ${json.message}`);
            }
        } catch {
            alert('Error de conexión al eliminar el ticket.');
        }
    };
};

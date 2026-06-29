document.addEventListener('DOMContentLoaded', () => {
    // Variables de Estado
    let currentFilter = 'PENDIENTE';
    let selectedOperatorId = '';
    const ctxVendedor = JSON.parse(document.getElementById('ctx_vendedor_json').textContent || '{}');
    const esAdmin = ctxVendedor.es_admin || false;

    // Elementos del DOM
    const tareasTableBody = document.getElementById('tareasTableBody');
    const opATCSelector = document.getElementById('opATCSelector');
    
    // KPIs
    const kpiPendientes = document.getElementById('kpiPendientes');
    const kpiNotificados = document.getElementById('kpiNotificados');
    const kpiVencidos = document.getElementById('kpiVencidos');

    // Modales y botones
    const modalContacto = document.getElementById('modalContacto');
    const formRegistrarContacto = document.getElementById('formRegistrarContacto');
    const contactoTareaId = document.getElementById('contactoTareaId');
    const contactoEstado = document.getElementById('contactoEstado');
    const contactoObs = document.getElementById('contactoObs');
    const btnCloseContactoModal = document.getElementById('btnCloseContactoModal');
    const btnCancelContactoModal = document.getElementById('btnCancelContactoModal');

    const modalRepartir = document.getElementById('modalRepartir');
    const formRepartirClientes = document.getElementById('formRepartirClientes');
    const btnRepartirModal = document.getElementById('btnRepartirModal');
    const btnCloseRepartirModal = document.getElementById('btnCloseRepartirModal');
    const btnCancelRepartirModal = document.getElementById('btnCancelRepartirModal');
    const repartirFecha = document.getElementById('repartirFecha');

    // ────────────────────────────────────────────────────────────────────────
    // Cargar y Renderizar Tareas
    // ────────────────────────────────────────────────────────────────────────
    const cargarTareas = async () => {
        try {
            let url = `/api/tareas/listar/?estado=${currentFilter}`;
            if (esAdmin && selectedOperatorId) {
                url += `&operador_id=${selectedOperatorId}`;
            }

            const response = await fetch(url);
            const res = await response.json();

            if (res.status === 'success') {
                renderTareas(res.data.tareas);
                actualizarKPIs(res.data.kpis);
                if (esAdmin && opATCSelector && opATCSelector.children.length <= 1) {
                    cargarOperadoresSelector(res.data.operadores);
                }
            } else {
                SITAlert.show(res.message || 'Error al obtener listado de tareas.', 'error');
            }
        } catch (error) {
            console.error('Error al cargar tareas:', error);
            SITAlert.show('Error de red al intentar obtener las tareas.', 'error');
        }
    };

    const renderTareas = (tareas) => {
        if (!tareasTableBody) return;

        if (tareas.length === 0) {
            tareasTableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        No se encontraron tareas de llamada.
                    </td>
                </tr>
            `;
            return;
        }

        tareasTableBody.innerHTML = tareas.map(t => {
            let badgeClass = 'badge-default';
            if (t.estado_contacto === 'PENDIENTE') badgeClass = 'badge-pendiente';
            else if (['NOTIFICADO', 'CONTACTADO', 'WHATSAPP', 'SMS'].includes(t.estado_contacto)) badgeClass = 'badge-notificado';
            else if (t.estado_contacto === 'NO_CONTESTO') badgeClass = 'badge-nocontesto';
            else if (t.estado_contacto === 'RECHAZADO') badgeClass = 'badge-rechazado';

            const vencidaLabel = t.vencida ? `<span class="vencida-label" title="¡Tarea vencida! Requiere atención urgente">VENCIDA</span>` : '';
            
            // Si está pendiente y pertenece al usuario actual, se permite registrar llamada
            const btnAccionHtml = (t.estado_contacto === 'PENDIENTE' && (esAdmin || t.empleado_id === ctxVendedor.personal_id))
                ? `<button class="btn-accion btn-registrar-llamada" data-id="${t.id}">Registrar Llamada</button>`
                : `<span style="color: var(--text-muted); font-size: 0.8rem;">Completado</span>`;

            return `
                <tr data-id="${t.id}">
                    <td style="font-weight: 600;">${esc(t.cliente_nombre)}</td>
                    <td>${esc(t.cliente_documento)}</td>
                    <td>${esc(t.cliente_telefono)}</td>
                    <td><code>${esc(t.servicio_codigo)}</code></td>
                    <td>${esc(t.servicio_estado)}</td>
                    <td>${esc(t.empleado_nombre)}</td>
                    <td>${esc(t.fecha_asignacion)}</td>
                    <td>${esc(t.fecha_vencimiento)} ${vencidaLabel}</td>
                    <td>
                        <span class="status-badge ${badgeClass}">${esc(t.estado_contacto)}</span>
                    </td>
                    <td>${btnAccionHtml}</td>
                </tr>
            `;
        }).join('');

        // Adjuntar eventos a botones de acción
        document.querySelectorAll('.btn-registrar-llamada').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                abrirContactoModal(id);
            });
        });
    };

    const actualizarKPIs = (kpis) => {
        if (kpiPendientes) kpiPendientes.textContent = kpis.pendientes;
        if (kpiNotificados) kpiNotificados.textContent = kpis.notificadas_hoy;
        if (kpiVencidos) kpiVencidos.textContent = kpis.vencidas;
    };

    const cargarOperadoresSelector = (operadores) => {
        if (!opATCSelector) return;
        operadores.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op.id;
            opt.textContent = op.nombre;
            opATCSelector.appendChild(opt);
        });
    };

    // ────────────────────────────────────────────────────────────────────────
    // Manejo de Modales
    // ────────────────────────────────────────────────────────────────────────
    const abrirContactoModal = (tareaId) => {
        if (contactoTareaId) contactoTareaId.value = tareaId;
        if (contactoObs) contactoObs.value = '';
        if (contactoEstado) contactoEstado.value = 'notificado';
        if (modalContacto) modalContacto.classList.add('active');
    };

    const cerrarContactoModal = () => {
        if (modalContacto) modalContacto.classList.remove('active');
    };

    const abrirRepartirModal = () => {
        // Inicializar fecha de vencimiento por defecto a 3 días a partir de hoy
        const hoy = new Date();
        hoy.setDate(hoy.getDate() + 3);
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        if (repartirFecha) repartirFecha.value = `${yyyy}-${mm}-${dd}`;
        if (modalRepartir) modalRepartir.classList.add('active');
    };

    const cerrarRepartirModal = () => {
        if (modalRepartir) modalRepartir.classList.remove('active');
    };

    // Eventos para Cerrar Modales
    if (btnCloseContactoModal) btnCloseContactoModal.addEventListener('click', cerrarContactoModal);
    if (btnCancelContactoModal) btnCancelContactoModal.addEventListener('click', cerrarContactoModal);
    if (btnCloseRepartirModal) btnCloseRepartirModal.addEventListener('click', cerrarRepartirModal);
    if (btnCancelRepartirModal) btnCancelRepartirModal.addEventListener('click', cerrarRepartirModal);

    if (btnRepartirModal) {
        btnRepartirModal.addEventListener('click', abrirRepartirModal);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Envíos de Formulario (AJAX)
    // ────────────────────────────────────────────────────────────────────────
    if (formRegistrarContacto) {
        formRegistrarContacto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                tarea_id: contactoTareaId.value,
                estado_contacto: contactoEstado.value,
                observaciones: contactoObs.value
            };

            try {
                const response = await fetch('/api/tareas/registrar-contacto/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const res = await response.json();

                if (res.status === 'success') {
                    SITAlert.show('Registro de llamada guardado correctamente.', 'success');
                    cerrarContactoModal();
                    cargarTareas();
                } else {
                    SITAlert.show(res.message || 'Error al guardar el contacto.', 'error');
                }
            } catch (error) {
                console.error('Error al registrar contacto:', error);
                SITAlert.show('Error de red al intentar registrar el contacto.', 'error');
            }
        });
    }

    if (formRepartirClientes) {
        formRepartirClientes.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(formRepartirClientes);
            const data = {
                sede_id: fd.get('sede_id'),
                estado_servicio: fd.get('estado_servicio'),
                fecha_vencimiento: fd.get('fecha_vencimiento'),
                observaciones: fd.get('observaciones'),
                evitar_duplicados: fd.get('evitar_duplicados') === 'on'
            };

            try {
                const response = await fetch('/api/tareas/repartir/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const res = await response.json();

                if (res.status === 'success') {
                    SITAlert.show(res.message || 'Reparto equitativo realizado con éxito.', 'success');
                    cerrarRepartirModal();
                    cargarTareas();
                } else {
                    SITAlert.show(res.message || 'Error al ejecutar el reparto.', 'error');
                }
            } catch (error) {
                console.error('Error al repartir clientes:', error);
                SITAlert.show('Error de red al intentar ejecutar el reparto.', 'error');
            }
        });
    }

    // ────────────────────────────────────────────────────────────────────────
    // Filtros e Interacción
    // ────────────────────────────────────────────────────────────────────────
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            cargarTareas();
        });
    });

    if (opATCSelector) {
        opATCSelector.addEventListener('change', (e) => {
            selectedOperatorId = e.target.value;
            cargarTareas();
        });
    }

    // Helpers
    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Carga inicial
    cargarTareas();
});

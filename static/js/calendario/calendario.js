document.addEventListener('DOMContentLoaded', () => {
    // Variables de Estado
    window.currentMode = 'tickets'; // 'tickets' o 'clientes'
    window.currentClientSubfilter = 'instalaciones'; // 'instalaciones' o 'pagos'
    let calendar;

    // Referencias del DOM
    const ticketPoolContainer = document.getElementById('ticket-pool-container');
    const clientFiltersContainer = document.getElementById('client-filters-container');
    const unscheduledList = document.getElementById('unscheduled-tickets-list');

    const modalDetalle = document.getElementById('modal-detalle-evento');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    // Inicializar FullCalendar
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: true,
        droppable: true,
        eventDurationEditable: false, // No redimensionar duración
        eventAllow: function(dropInfo, draggedEvent) {
            // Solo permitir mover tickets
            return draggedEvent.extendedProps.tipo === 'ticket';
        },
        // Origen dinámico de eventos
        events: function(info, successCallback, failureCallback) {
            const params = new URLSearchParams({
                start: info.startStr,
                end: info.endStr,
                modo: window.currentMode,
                filtro_clientes: window.currentClientSubfilter
            });
            fetch(`/api/calendario/eventos/?${params.toString()}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        successCallback(data.events);
                    } else {
                        SITAlert.show(data.message || 'Error al cargar eventos', 'error');
                        failureCallback();
                    }
                })
                .catch(err => {
                    console.error(err);
                    failureCallback();
                });
        },
        // Movimiento de evento existente (reprogramar)
        eventDrop: function(info) {
            const ticketId = info.event.extendedProps.ticket_id;
            const newDate = info.event.startStr;
            reprogramarTicket(ticketId, newDate, () => {
                calendar.refetchEvents();
            }, () => {
                info.revert();
            });
        },
        // Recepción de ticket arrastrado desde la lista lateral
        eventReceive: function(info) {
            const ticketId = info.event.extendedProps.ticket_id;
            const newDate = info.event.startStr;
            reprogramarTicket(ticketId, newDate, () => {
                info.event.remove(); // Remueve el clon temporal
                calendar.refetchEvents();
                loadUnscheduledTickets();
            }, () => {
                info.event.remove();
            });
        },
        // Clic en evento para ver detalles
        eventClick: function(info) {
            verDetallesEvento(info.event);
        }
    });

    calendar.render();

    // Inicializar Drag-and-Drop externo
    new FullCalendar.Draggable(unscheduledList, {
        itemSelector: '.draggable-ticket',
        eventData: function(eventEl) {
            return {
                id: 'temp-' + eventEl.dataset.id,
                title: eventEl.dataset.title,
                duration: '02:00', // duración por defecto
                create: true,
                extendedProps: {
                    tipo: 'ticket',
                    ticket_id: parseInt(eventEl.dataset.id),
                    nombre: eventEl.dataset.nombre,
                    categoria: eventEl.dataset.categoria,
                    prioridad: eventEl.dataset.prioridad,
                    cliente: eventEl.dataset.cliente,
                    codigo_cliente: eventEl.dataset.codigo_cliente
                }
            };
        }
    });

    // Cargar tickets sin programar al inicio
    loadUnscheduledTickets();

    // Cambiar entre modo Tickets y Clientes
    window.changeMode = function(mode) {
        window.currentMode = mode;
        
        // Estilos botones
        document.getElementById('mode-tickets').classList.toggle('active', mode === 'tickets');
        document.getElementById('mode-clientes').classList.toggle('active', mode === 'clientes');

        if (mode === 'tickets') {
            ticketPoolContainer.style.display = 'flex';
            clientFiltersContainer.style.display = 'none';
            calendar.setOption('editable', true);
            loadUnscheduledTickets();
        } else {
            ticketPoolContainer.style.display = 'none';
            clientFiltersContainer.style.display = 'block';
            calendar.setOption('editable', false); // Desactivar drag en modo clientes
        }

        calendar.refetchEvents();
    };

    // Cambiar subfiltros de clientes (instalaciones vs pagos)
    window.changeClientSubfilter = function(subfilter) {
        window.currentClientSubfilter = subfilter;
        
        document.getElementById('sub-instalaciones').classList.toggle('active', subfilter === 'instalaciones');
        document.getElementById('sub-pagos').classList.toggle('active', subfilter === 'pagos');

        calendar.refetchEvents();
    };

    // Obtener tickets sin programar
    function loadUnscheduledTickets() {
        unscheduledList.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:1.5rem;">Cargando...</div>';
        fetch('/api/calendario/sin-programar/')
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    renderUnscheduledTickets(data.tickets);
                } else {
                    SITAlert.show(data.message || 'Error al cargar tickets por programar', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                unscheduledList.innerHTML = '<div style="font-size:0.8rem;color:var(--text-danger);text-align:center;padding:1.5rem;">Fallo de red</div>';
            });
    }

    // Renderizar tickets en el pool
    function renderUnscheduledTickets(tickets) {
        if (tickets.length === 0) {
            unscheduledList.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:2rem;border:1px dashed var(--border-color);border-radius:8px;">No hay tickets pendientes por programar.</div>';
            return;
        }

        unscheduledList.innerHTML = '';
        tickets.forEach(t => {
            const badgeClass = t.prioridad === 'alta' ? 'badge-alta' : t.prioridad === 'media' ? 'badge-media' : 'badge-baja';
            
            const card = document.createElement('div');
            card.className = 'draggable-ticket';
            card.dataset.id = t.id;
            card.dataset.title = `${t.nombre} - ${t.cliente_nombre}`;
            card.dataset.nombre = t.nombre;
            card.dataset.categoria = t.categoria;
            card.dataset.prioridad = t.prioridad;
            card.dataset.cliente = t.cliente_nombre;
            card.dataset.codigo_cliente = t.codigo_cliente;

            card.innerHTML = `
                <span class="ticket-badge ${badgeClass}">${t.prioridad}</span>
                <div class="ticket-title">${t.nombre}</div>
                <div class="ticket-client">Cod: ${t.codigo_cliente} | ${t.cliente_nombre}</div>
            `;
            unscheduledList.appendChild(card);
        });
    }

    // Invocación a la API de reprogramación
    function reprogramarTicket(ticketId, dateStr, onSuccess, onFail) {
        fetch('/api/calendario/reprogramar/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                ticket_id: ticketId,
                fecha_programada: dateStr
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                SITAlert.show(data.message, 'success');
                onSuccess();
            } else {
                SITAlert.show(data.message || 'Error al reprogramar el ticket', 'error');
                onFail();
            }
        })
        .catch(err => {
            console.error(err);
            SITAlert.show('Fallo de red al intentar reprogramar el ticket', 'error');
            onFail();
        });
    }

    // Ver detalles del evento en Modal
    function verDetallesEvento(event) {
        const props = event.extendedProps;
        modalTitle.textContent = event.title;

        let content = '';

        if (props.tipo === 'instalacion') {
            modalTitle.textContent = "Nueva Instalación de Cliente";
            content = `
                <div class="detail-row">
                    <span class="detail-label">Cliente</span>
                    <span class="detail-value">${props.cliente_nombre}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Código Abonado</span>
                    <span class="detail-value">${props.cliente_codigo}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Dirección de Servicio</span>
                    <span class="detail-value">${props.direccion}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Fecha de Instalación</span>
                    <span class="detail-value">${event.start.toLocaleDateString('es-PE')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Estado de Red</span>
                    <span class="detail-value" style="font-weight:700;color:#10b981;">${props.estado.toUpperCase()}</span>
                </div>
            `;
        } else if (props.tipo === 'pago') {
            modalTitle.textContent = "Vencimiento de Compromiso de Pago";
            content = `
                <div class="detail-row">
                    <span class="detail-label">Cliente</span>
                    <span class="detail-value">${props.cliente_nombre}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Código Abonado</span>
                    <span class="detail-value">${props.cliente_codigo}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Monto de la Deuda</span>
                    <span class="detail-value" style="font-weight:700;color:#ef4444;">S/ ${props.monto.toFixed(2)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Fecha Límite</span>
                    <span class="detail-value">${event.start.toLocaleDateString('es-PE')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Concepto</span>
                    <span class="detail-value">${props.descripcion}</span>
                </div>
            `;
        } else { // ticket
            modalTitle.textContent = `Orden de Trabajo: ${props.nombre}`;
            const fProgramada = event.start ? event.start.toLocaleString('es-PE') : '—';
            content = `
                <div class="detail-row">
                    <span class="detail-label">Orden Técnico / ID</span>
                    <span class="detail-value">${props.ticket_id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Cliente Asignado</span>
                    <span class="detail-value">${props.cliente} (${props.codigo_cliente})</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Dirección del Servicio</span>
                    <span class="detail-value">${props.direccion}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Categoría</span>
                    <span class="detail-value" style="text-transform:capitalize;">${props.categoria.replace('_', ' ')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Prioridad de Atención</span>
                    <span class="detail-value" style="font-weight:700;color:${props.prioridad === 'alta' ? '#ef4444' : '#f59e0b'}; text-transform:uppercase;">${props.prioridad}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Fecha y Hora Programada</span>
                    <span class="detail-value" style="font-weight:700;">${fProgramada}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Estado de la Orden</span>
                    <span class="detail-value" style="text-transform:uppercase;">${props.estado}</span>
                </div>
            `;
        }

        modalBody.innerHTML = content;
        modalDetalle.classList.add('active');
    };

    window.closeModal = function() {
        modalDetalle.classList.remove('active');
    };

    // Cerrar modal al hacer clic fuera
    window.onclick = function(event) {
        if (event.target === modalDetalle) {
            closeModal();
        }
    };

    // Helper CSRF Token
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});

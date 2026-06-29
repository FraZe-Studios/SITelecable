document.addEventListener('DOMContentLoaded', () => {
    // Referencias del DOM
    const filterRuc = document.getElementById('filter-ruc');
    const filterTipo = document.getElementById('filter-tipo');
    const filterEstado = document.getElementById('filter-estado');
    const filterFechaInicio = document.getElementById('filter-fecha-inicio');
    const filterFechaFin = document.getElementById('filter-fecha-fin');
    const searchInput = document.getElementById('search-input');
    const tableBody = document.getElementById('sunat-table-body');

    const kpiEmitidos = document.getElementById('kpi-emitidos');
    const kpiPendientes = document.getElementById('kpi-pendientes');
    const kpiRechazados = document.getElementById('kpi-rechazados');
    const kpiMonto = document.getElementById('kpi-monto');

    const modalDetalle = document.getElementById('modal-detalle');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    let rucsLoaded = false;

    // Cargar datos al iniciar
    fetchData();

    // Eventos para filtros
    [filterRuc, filterTipo, filterEstado, filterFechaInicio, filterFechaFin].forEach(element => {
        element.addEventListener('change', fetchData);
    });

    // Búsqueda con debounce simple (300ms)
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(fetchData, 300);
    });

    // Función principal para consultar la API
    function fetchData() {
        const params = new URLSearchParams({
            ruc_emisor_id: filterRuc.value,
            tipo_comprobante: filterTipo.value,
            estado_sunat: filterEstado.value,
            fecha_inicio: filterFechaInicio.value,
            fecha_fin: filterFechaFin.value,
            search: searchInput.value
        });

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <div class="spinner" style="border-top-color: var(--primary-color); width: 1.5rem; height: 1.5rem; border-width:3px;"></div>
                    <div style="margin-top: 0.5rem;">Cargando comprobantes filtrados...</div>
                </td>
            </tr>
        `;

        fetch(`/api/sunat/listar/?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    renderKPIs(data.kpis);
                    renderTable(data.comprobantes);
                    if (!rucsLoaded && data.rucs) {
                        renderRucSelect(data.rucs);
                        rucsLoaded = true;
                    }
                } else {
                    SITAlert.show(data.message || 'Error al obtener datos', 'error');
                }
            })
            .catch(err => {
                console.error(err);
                SITAlert.show('Fallo en la comunicación con el servidor', 'error');
            });
    }

    // Renderizar KPIs
    function renderKPIs(kpis) {
        kpiEmitidos.textContent = kpis.total_emitidos;
        kpiPendientes.textContent = kpis.total_pendientes;
        kpiRechazados.textContent = kpis.total_rechazados;
        kpiMonto.textContent = `S/ ${kpis.monto_total_declarado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
    }

    // Rellenar selector de RUCs
    function renderRucSelect(rucs) {
        // Guardar valor actual
        const currentVal = filterRuc.value;
        filterRuc.innerHTML = '<option value="">Todos los RUCs</option>';
        rucs.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = `${r.ruc_numero} - ${r.razon_social}`;
            filterRuc.appendChild(opt);
        });
        filterRuc.value = currentVal;
    }

    // Renderizar tabla
    function renderTable(comprobantes) {
        if (comprobantes.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        No se encontraron comprobantes registrados en el sistema.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';
        comprobantes.forEach(c => {
            const tr = document.createElement('tr');
            
            // Icono del tipo
            const docIcon = c.tipo_comprobante === 'FACTURA' ? '📄' : '🎫';
            
            // Formatear Badge de estado
            let badgeClass = 'status-pendiente';
            let badgeText = 'Pendiente';
            if (c.estado_sunat === 'emitido') {
                badgeClass = 'status-emitido';
                badgeText = 'Emitido';
            } else if (c.estado_sunat === 'rechazado') {
                badgeClass = 'status-rechazado';
                badgeText = 'Rechazado';
            }

            // Acciones según estado
            let actionButtons = '';
            if (c.estado_sunat === 'pendiente' || c.estado_sunat === 'rechazado') {
                actionButtons = `
                    <button class="btn-action-sunat btn-transmit" onclick="transmitir(${c.id}, this)">
                        🚀 Transmitir a SUNAT
                    </button>
                `;
            } else {
                actionButtons = `
                    <a href="${c.xml_url}" download class="btn-action-sunat btn-xml" title="Descargar XML firmado">
                        📥 XML
                    </a>
                    <button class="btn-action-sunat btn-cdr" onclick="descargarCdr(${c.id})" title="Descargar Constancia de Recepción (CDR)">
                        ✅ CDR
                    </button>
                `;
            }

            // Botón de vista previa PDF
            const pdfButton = `
                <button class="btn-action-sunat" onclick="verPdf(${c.id}, ${c.ruc_emisor_id})" title="Vista previa en formato A4">
                    👁️ Ver PDF
                </button>
            `;

            tr.innerHTML = `
                <td>
                    <div style="font-weight:600;">${c.ruc_emisor_nombre}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${c.ruc_emisor_num}</div>
                </td>
                <td>
                    <div style="font-weight:600;">${docIcon} ${c.tipo_comprobante}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);font-family:monospace;">${c.numero}</div>
                </td>
                <td>
                    <div style="font-weight:600;">${c.cliente_nombre}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${c.cliente_documento}</div>
                </td>
                <td>${c.fecha_emision}</td>
                <td style="font-weight:700;">S/ ${c.monto_total.toFixed(2)}</td>
                <td>
                    <span class="status-badge ${badgeClass}">${badgeText}</span>
                </td>
                <td>
                    <div class="btn-actions-wrapper">
                        ${actionButtons}
                        ${pdfButton}
                        <button class="btn-action-sunat" onclick="verDetalles(${JSON.stringify(c).replace(/"/g, '&quot;')})" title="Ver detalles XML/Hash">
                            ⚙️ Info
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Transmitir comprobante
    window.transmitir = function(id, btn) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Transmitiendo...`;

        fetch('/api/sunat/enviar/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ comprobante_id: id })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                SITAlert.show(data.message, 'success');
                fetchData(); // Refrescar lista y KPIs
            } else {
                SITAlert.show(data.message || 'Error al transmitir el comprobante', 'error');
                btn.disabled = false;
                btn.innerHTML = originalText;
                fetchData();
            }
        })
        .catch(err => {
            console.error(err);
            SITAlert.show('Error de red durante la transmisión', 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
    };

    // Descargar CDR
    window.descargarCdr = function(comprobanteId) {
        // Redireccionar al visor para descargar CDR
        window.location.href = `/api/sede/rucs/1/comprobante/${comprobanteId}/ver/?format=cdr`;
    };

    // Ver PDF
    window.verPdf = function(comprobanteId, rucId) {
        const url = `/api/sede/rucs/${rucId}/comprobante/${comprobanteId}/vista-previa/?formato=A4`;
        window.open(url, '_blank', 'width=900,height=750');
    };

    // Ver detalles del comprobante
    window.verDetalles = function(c) {
        modalTitle.textContent = `Detalles del Comprobante ${c.numero}`;
        
        let errorSection = '';
        if (c.estado_sunat === 'rechazado' && c.mensaje_error) {
            errorSection = `
                <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; color: #dc2626; font-size:0.8rem;">
                    <strong>Fallo SUNAT:</strong> ${c.mensaje_error}
                </div>
            `;
        }

        modalBody.innerHTML = `
            ${errorSection}
            <div class="detail-row">
                <span class="detail-label">ID de Registro</span>
                <span class="detail-value">${c.id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Emisor Razón Social</span>
                <span class="detail-value">${c.ruc_emisor_nombre}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Emisor RUC</span>
                <span class="detail-value">${c.ruc_emisor_num}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Cliente</span>
                <span class="detail-value">${c.cliente_nombre} (${c.cliente_documento})</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Tipo Comprobante</span>
                <span class="detail-value">${c.tipo_comprobante}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Importe Total</span>
                <span class="detail-value">S/ ${c.monto_total.toFixed(2)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Fecha Emisión</span>
                <span class="detail-value">${c.fecha_emision}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Código HASH UBL</span>
                <span class="detail-value" style="font-family:monospace;font-weight:700;">${c.codigo_hash || '—'}</span>
            </div>
            <div class="detail-row" style="flex-direction:column;align-items:flex-start;gap:0.5rem;">
                <span class="detail-label">Formato de Firma Electrónica QR</span>
                <span class="detail-value" style="font-size:0.75rem;color:var(--text-muted);font-family:monospace;text-align:left;word-break:break-all;">
                    ${c.codigo_qr || 'No generado'}
                </span>
            </div>
        `;
        
        modalDetalle.classList.add('active');
    };

    // Cerrar modal
    window.closeModal = function() {
        modalDetalle.classList.remove('active');
    };

    // Cerrar modal al pulsar fuera
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

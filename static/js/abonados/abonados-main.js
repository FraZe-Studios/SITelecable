/**
 * Abonados — orquestador de lista y eventos globales
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('abonadosApp');
    if (!app) return;

    document.getElementById('btnNuevoAbonado')?.addEventListener('click', () => {
        window.AbonadosRegistro?.open({});
    });

    document.querySelectorAll('.btn-agregar-api').forEach(btn => {
        btn.addEventListener('click', () => {
            const doc = btn.dataset.documento || '';
            window.AbonadosRegistro?.open({
                documento: doc,
                nombre: btn.dataset.nombre || '',
                direccion: btn.dataset.direccion || '',
                fecha_nacimiento: btn.dataset.fecha_nacimiento || '',
                estado_civil: btn.dataset.estado_civil || '',
                ubigeo: btn.dataset.ubigeo || '',
                restricciones: btn.dataset.restricciones || '',
                source: btn.dataset.source || '',
            });
        });
    });

    const modalTicketPlanta = document.getElementById('modalTicketPlanta');
    const formTicketPlanta = document.getElementById('formTicketPlanta');
    const btnTicketPlanta = document.getElementById('btnTicketPlanta');
    const btnCerrarModal = document.getElementById('btnCerrarModalTicketPlanta');
    const btnCancelarModal = document.getElementById('btnCancelarTicketPlanta');

    const selectSede = document.getElementById('ticket-planta-sede');
    const selectTipoElemento = document.getElementById('ticket-planta-tipo-elemento');
    const containerElemento = document.getElementById('ticket-planta-elemento-container');
    const labelElemento = document.getElementById('ticket-planta-elemento-label');
    const selectElemento = document.getElementById('ticket-planta-elemento');
    const containerReferencia = document.getElementById('ticket-planta-referencia-container');
    const inputReferencia = document.getElementById('ticket-planta-referencia');
    const selectMassModalidad = document.getElementById('ticket-planta-filter-modalidad');
    const selectMassCategoria = document.getElementById('ticket-planta-filter-categoria');
    const selectCatalogo = document.getElementById('ticket-planta-catalogo');

    let infraData = null;

    function openModal() {
        if (!modalTicketPlanta) return;
        formTicketPlanta?.reset();
        infraData = null;
        if (containerElemento) containerElemento.style.display = 'none';
        if (containerReferencia) containerReferencia.style.display = 'none';
        if (selectElemento) selectElemento.innerHTML = '<option value="">— Seleccione Elemento —</option>';
        if (selectMassModalidad) selectMassModalidad.innerHTML = '<option value="">— Seleccione —</option>';
        if (selectMassCategoria) selectMassCategoria.innerHTML = '<option value="">— Seleccione —</option>';
        if (selectCatalogo) selectCatalogo.innerHTML = '<option value="">— Seleccione Tipo de Ticket —</option>';
        modalTicketPlanta.classList.add('open');
    }

    function closeModal() {
        modalTicketPlanta?.classList.remove('open');
    }

    async function loadInfraestructura(sedeId) {
        try {
            const url = `/api/abonados/infraestructura-red/` + (sedeId ? `?sede_id=${sedeId}` : '');
            const res = await fetch(url);
            const json = await res.json();
            if (json.status === 'success') {
                return json.data;
            }
        } catch (e) {
            console.error('Error fetching infraestructura:', e);
        }
        return null;
    }

    function refreshMassTicketFilters() {
        if (!infraData) return;

        const catalog = infraData.catalog || [];

        // Guardar la selección actual
        const savedModality = selectMassModalidad?.value || '';
        const savedCategory = selectMassCategoria?.value || '';

        // 1. Obtener modalidades únicas
        const availableModalidades = [...new Set(
            catalog
                .map(t => (t.modalidad || '').trim().toUpperCase())
                .filter(m => m && m !== 'TODOS' && m !== 'TODAS')
        )].sort();

        if (selectMassModalidad) {
            selectMassModalidad.innerHTML = '<option value="">— Seleccione —</option>';
            availableModalidades.forEach(mod => {
                const option = document.createElement('option');
                option.value = mod;
                option.textContent = mod === 'REMOTO' ? 'Virtual / Remoto' : (mod === 'CAMPO' || mod === 'PRESENCIAL' ? 'Campo (Técnico)' : mod);
                selectMassModalidad.appendChild(option);
            });
            if (availableModalidades.includes(savedModality)) {
                selectMassModalidad.value = savedModality;
            } else {
                selectMassModalidad.value = '';
            }
        }

        const activeModality = selectMassModalidad?.value || '';

        // 2. Filtrar catálogo por modalidad para obtener categorías válidas
        const filteredByModalidad = catalog.filter(t => {
            if (!activeModality) return true;
            const m = (t.modalidad || '').trim().toUpperCase();
            return m === 'TODOS' || m === 'TODAS' || m === activeModality;
        });

        const availableCategorias = [...new Set(
            filteredByModalidad
                .map(t => (t.categoria || '').trim().toUpperCase())
                .filter(c => c && c !== 'TODOS' && c !== 'TODAS')
        )].sort();

        if (selectMassCategoria) {
            selectMassCategoria.innerHTML = '<option value="">— Seleccione —</option>';
            availableCategorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat.charAt(0) + cat.slice(1).toLowerCase();
                selectMassCategoria.appendChild(option);
            });
            if (availableCategorias.includes(savedCategory)) {
                selectMassCategoria.value = savedCategory;
            } else {
                selectMassCategoria.value = '';
            }
        }

        const activeCategory = selectMassCategoria?.value || '';

        // 3. Filtrar por categoría para obtener tickets de catálogo finales
        const finalTickets = filteredByModalidad.filter(t => {
            if (!activeCategory) return true;
            const c = (t.categoria || '').trim().toUpperCase();
            return c === 'TODOS' || c === 'TODAS' || c === activeCategory;
        });

        // 4. Poblar el dropdown de tickets
        if (selectCatalogo) {
            selectCatalogo.innerHTML = '<option value="">— Seleccione Tipo de Ticket —</option>';
            finalTickets.forEach(ct => {
                const option = document.createElement('option');
                option.value = ct.id;
                option.textContent = ct.nombre;
                selectCatalogo.appendChild(option);
            });
        }
    }

    function updateElementsAndCatalog() {
        if (!infraData) return;

        const tipo = selectTipoElemento?.value || '';

        // Reset elements dropdown
        if (selectElemento) {
            selectElemento.innerHTML = '<option value="">— Seleccione Elemento —</option>';
        }

        if (tipo === 'NAP') {
            if (containerElemento) containerElemento.style.display = 'block';
            if (labelElemento) labelElemento.textContent = 'Caja NAP Afectada';
            if (containerReferencia) containerReferencia.style.display = 'none';
            if (inputReferencia) inputReferencia.removeAttribute('required');
            if (selectElemento) {
                selectElemento.setAttribute('required', 'required');
                (infraData.naps || []).forEach(nap => {
                    const option = document.createElement('option');
                    option.value = nap.id;
                    option.textContent = nap.codigo || `NAP #${nap.id}`;
                    selectElemento.appendChild(option);
                });
            }
        } else if (tipo === 'MUFA') {
            if (containerElemento) containerElemento.style.display = 'block';
            if (labelElemento) labelElemento.textContent = 'Mufa Afectada';
            if (containerReferencia) containerReferencia.style.display = 'none';
            if (inputReferencia) inputReferencia.removeAttribute('required');
            if (selectElemento) {
                selectElemento.setAttribute('required', 'required');
                (infraData.mufas || []).forEach(mufa => {
                    const option = document.createElement('option');
                    option.value = mufa.id;
                    option.textContent = mufa.nombre || `Mufa #${mufa.id}`;
                    selectElemento.appendChild(option);
                });
            }
        } else if (tipo === 'GENERAL') {
            if (containerElemento) containerElemento.style.display = 'none';
            if (selectElemento) {
                selectElemento.removeAttribute('required');
            }
            if (containerReferencia) containerReferencia.style.display = 'block';
            if (inputReferencia) inputReferencia.setAttribute('required', 'required');
        } else {
            if (containerElemento) containerElemento.style.display = 'none';
            if (selectElemento) selectElemento.removeAttribute('required');
            if (containerReferencia) containerReferencia.style.display = 'none';
            if (inputReferencia) inputReferencia.removeAttribute('required');
        }

        // Poblar catálogo inicial y aplicar filtros
        refreshMassTicketFilters();
    }

    // Event Listeners
    btnTicketPlanta?.addEventListener('click', openModal);
    btnCerrarModal?.addEventListener('click', closeModal);
    btnCancelarModal?.addEventListener('click', closeModal);
    modalTicketPlanta?.addEventListener('click', (e) => {
        if (e.target === modalTicketPlanta) closeModal();
    });

    selectSede?.addEventListener('change', async function() {
        const sedeId = this.value;
        if (!sedeId) {
            infraData = null;
            if (containerElemento) containerElemento.style.display = 'none';
            if (containerReferencia) containerReferencia.style.display = 'none';
            if (selectElemento) selectElemento.innerHTML = '<option value="">— Seleccione Elemento —</option>';
            if (selectCatalogo) selectCatalogo.innerHTML = '<option value="">— Seleccione Tipo de Ticket —</option>';
            return;
        }
        infraData = await loadInfraestructura(sedeId);
        updateElementsAndCatalog();
    });

    selectTipoElemento?.addEventListener('change', updateElementsAndCatalog);

    selectMassModalidad?.addEventListener('change', () => {
        if (selectMassCategoria) selectMassCategoria.value = '';
        if (selectCatalogo) selectCatalogo.value = '';
        refreshMassTicketFilters();
    });

    selectMassCategoria?.addEventListener('change', () => {
        if (selectCatalogo) selectCatalogo.value = '';
        refreshMassTicketFilters();
    });

    formTicketPlanta?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const fd = new FormData(this);
        const payload = {
            sede_id: fd.get('sede_id') ? parseInt(fd.get('sede_id')) : null,
            tipo_elemento: fd.get('tipo_elemento'),
            elemento_id: fd.get('elemento_id') ? parseInt(fd.get('elemento_id')) : null,
            referencia_ubicacion: fd.get('referencia_ubicacion') || '',
            catalogo_ticket_id: fd.get('catalogo_ticket_id') ? parseInt(fd.get('catalogo_ticket_id')) : null,
            motivo: fd.get('motivo') || '',
            afectar_abonados: fd.get('afectar_abonados') === 'on'
        };

        // Extra client-side validation
        if (payload.tipo_elemento === 'NAP' && !payload.elemento_id) {
            alert('Debe seleccionar la Caja NAP afectada.');
            return;
        }
        if (payload.tipo_elemento === 'MUFA' && !payload.elemento_id) {
            alert('Debe seleccionar la Mufa afectada.');
            return;
        }
        if (payload.tipo_elemento === 'GENERAL' && !payload.referencia_ubicacion.trim()) {
            alert('Debe ingresar la referencia de ubicación.');
            return;
        }

        try {
            const btnSubmit = document.getElementById('btnEnviarTicketPlanta');
            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            }

            const res = await fetch('/api/abonados/generar-ticket-masivo/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
                },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (json.status === 'success') {
                alert(json.data.mensaje || 'Tickets generados exitosamente.');
                closeModal();
                window.location.reload();
            } else {
                alert(json.message || 'Ocurrió un error al generar los tickets masivos.');
            }
        } catch (err) {
            console.error('Error submitting massive ticket:', err);
            alert('Error de red al comunicarse con el servidor.');
        } finally {
            const btnSubmit = document.getElementById('btnEnviarTicketPlanta');
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Generar Tickets';
            }
        }
    });
});

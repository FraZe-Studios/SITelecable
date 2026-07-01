/**
 * main.js - Orquestación de la Ficha de Cliente
 */
(function() {
    'use strict';
    
    window.FichaCliente = {
        clienteId: null,
        compressor: null,
        
        subirArchivo: async function(file, tipo, suscripcionId) {
            let blob = file;
            const comp = window.FichaCliente.compressor;
            const cliId = window.FichaCliente.clienteId;
            
            if (comp && file.type.startsWith('image/')) {
                try { 
                    blob = await comp.compressImage(file); 
                } catch (_) { 
                    /* original */ 
                }
            }
            const fd = new FormData();
            fd.append('cliente_id', cliId);
            fd.append('suscripcion_id', suscripcionId || '');
            fd.append('tipo', tipo);
            fd.append('archivo', blob, file.name);
            const res = await fetch('/api/abonados/subir-documento/', { method: 'POST', body: fd });
            const json = await res.json();
            if (json.status !== 'success') throw new Error(json.message || 'Error al subir');
            return json.data;
        },
        
        initializeFichaTablePagination: function(panelId) {
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
    };
    
    document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('fichaApp');
        if (!app) return;

        window.FichaCliente.clienteId = app.dataset.clienteId;
        window.FichaCliente.compressor = typeof ImageCompressor !== 'undefined' ? new ImageCompressor({ maxFileSizeKB: 500 }) : null;

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

        // Navegar entre suscripciones
        document.querySelectorAll('.ficha-service-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const url = new URL(window.location.href);
                url.searchParams.set('suscripcion', pill.dataset.suscripcion);
                window.location.href = url.toString();
            });
        });

        // Tabs internas de servicio
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

        // Auto click tab inicial según query param global
        const tabGlobal = new URLSearchParams(window.location.search).get('tab');
        const tabMap = { 
            datos: 'svc-datos', 
            servicio: 'svc-datos', 
            remoto: 'svc-remoto', 
            campo: 'svc-campo', 
            pagos: 'svc-pagos', 
            materiales: 'svc-materiales', 
            contrato: 'svc-contrato' 
        };
        if (tabGlobal && tabMap[tabGlobal]) {
            document.querySelectorAll('.ficha-service-panel.active .ficha-tab-btn').forEach(btn => {
                if (btn.dataset.tabTarget?.startsWith(tabMap[tabGlobal])) btn.click();
            });
        }

        // Uploader de archivos generales
        document.querySelectorAll('.ficha-upload-input').forEach(input => {
            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                    await window.FichaCliente.subirArchivo(file, input.dataset.tipo, input.dataset.suscripcion);
                    window.SITAlert.show('Archivo guardado.', 'success');
                    setTimeout(() => window.location.reload(), 1000);
                } catch (err) {
                    window.SITAlert.show(err.message, 'danger');
                }
            });
        });

        // Inicializar tablas en cada panel de servicio
        document.querySelectorAll('.ficha-service-panel').forEach(panel => {
            const svcId = panel.dataset.suscripcion;
            window.FichaCliente.initializeFichaTablePagination(`svc-remoto-${svcId}`);
            window.FichaCliente.initializeFichaTablePagination(`svc-campo-${svcId}`);
            window.FichaCliente.initializeFichaTablePagination(`svc-pagos-${svcId}`);
            window.FichaCliente.initializeFichaTablePagination(`svc-materiales-${svcId}`);
        });
    });
})();

/**
 * liquidacion.js - Gestión de Liquidación de Campo, Materiales y Deudas
 */
(function() {
    'use strict';

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

    // Helper: crear fila de material "Utilizado" con autocomplete del catálogo
    function crearFilaMaterialUsado(list) {
        const row = document.createElement('div');
        row.className = 'ficha-material-row ficha-material-usado-row';
        row.innerHTML = `
            <div class="mat-desc-container">
                <input type="text" placeholder="Buscar material del catálogo..." class="abonados-select mat-desc" autocomplete="off" required>
                <div class="mat-suggestions" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-surface-active); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 180px; overflow-y: auto; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
            </div>
            <input type="number" placeholder="Cant." min="1" value="1" step="1" class="abonados-select mat-cant" required>
            <button type="button" class="abonados-btn abonados-btn-ghost btn-rm-material" title="Eliminar"><i class="fa-solid fa-trash"></i></button>`;

        row.querySelector('.btn-rm-material')?.addEventListener('click', () => row.remove());
        list.appendChild(row);

        const matDescInput = row.querySelector('.mat-desc');
        const suggestionsBox = row.querySelector('.mat-suggestions');
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

    // Helper: crear fila de material "Retirado" con autocomplete de materiales del cliente
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
                    // No llenar automáticamente los campos de router
                }
            } else {
                // Restaurar el badge del material en el cliente
                const form = list.closest('form');
                const badgeContainer = form?.querySelector('.client-materials-list');
                if (badgeContainer) {
                    badgeContainer.querySelectorAll('.client-mat-badge').forEach(badge => {
                        if (badge.dataset.nombre === nombre) {
                            badge.style.opacity = '1';
                            badge.style.textDecoration = 'none';
                            badge.style.cursor = 'grab';
                            badge.draggable = true;
                            badge.title = '';
                            const btnRetBadge = badge.querySelector('.btn-retire-badge-shortcut');
                            if (btnRetBadge) btnRetBadge.style.display = 'inline-block';
                        }
                    });
                }
            }
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

    // Drag and drop setup logic
    function setupDragAndDrop(form, suscripcionId) {
        const dropzone = form.querySelector('.materials-dropzone');
        const retiradosList = form.querySelector('.ficha-materiales-retirados-list');
        const routerCard = form.querySelector('.installed-router-card');
        const badgeContainer = form.querySelector('.client-materials-list');

        if (!dropzone || !retiradosList) return;

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
            
            // Marcar el badge correspondiente como retirado visualmente
            if (badgeContainer) {
                badgeContainer.querySelectorAll('.client-mat-badge').forEach(badge => {
                    if (badge.dataset.nombre === nombre) {
                        badge.style.opacity = '0.4';
                        badge.style.textDecoration = 'line-through';
                        badge.style.cursor = 'not-allowed';
                        badge.draggable = false;
                        badge.title = 'Material retirado - no disponible';
                        const btnRetBadge = badge.querySelector('.btn-retire-badge-shortcut');
                        if (btnRetBadge) btnRetBadge.style.display = 'none';
                    }
                });
            }
        };

        const retireRouter = () => {
            if (!routerCard) return;
            const modelo = routerCard.dataset.modelo;
            const serie = routerCard.dataset.serie;
            const mac = routerCard.dataset.mac;

            const routerDesc = `EQUIPO: ${modelo} (Serie: ${serie}, MAC: ${mac})`;
            retireMaterial(routerDesc, 1);

            const modeloInput = form.querySelector('[name="router_modelo"]');
            const serieInput = form.querySelector('[name="router_serie"]');
            const macInput = form.querySelector('[name="router_mac"]');
            if (modeloInput) modeloInput.value = '';
            if (serieInput) serieInput.value = '';
            if (macInput) macInput.value = '';

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
                const jsonData = e.dataTransfer.getData('application/json');
                if (!jsonData || jsonData.trim() === '') {
                    console.warn('No hay datos JSON en el drop');
                    return;
                }
                const data = JSON.parse(jsonData);
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

    document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('fichaApp');
        if (!app) return;

        // Initialize autocompletes on Campo Liquidation Forms
        document.querySelectorAll('.ficha-liq-mat-form').forEach(form => {
            const searchInput = form.querySelector('.nap-search-input');
            const hiddenInput = form.querySelector('.nap-id-hidden');
            const suggestionsBox = form.querySelector('.nap-suggestions-box');

            if (searchInput && hiddenInput && suggestionsBox) {
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
            }

            // Router Model autocomplete
            const modelInput = form.querySelector('.router-modelo-input');
            const modelSuggestions = form.querySelector('.router-suggestions-box');

            if (modelInput && modelSuggestions) {
                let activeModelIndex = -1;

                const updateModelSuggestions = async () => {
                    const val = modelInput.value.trim().toLowerCase();
                    modelSuggestions.innerHTML = '';

                    // Solo mostrar sugerencias si el usuario ha escrito algo
                    if (!val) {
                        modelSuggestions.style.display = 'none';
                        return;
                    }

                    const materials = await fetchMaterials();
                    const routers = materials.filter(m => m.tipo_material === 'equipo');
                    const filtered = routers.filter(m => m.nombre.toLowerCase().includes(val));

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

            // Drag and drop setup for materials
            const susId = form.dataset.suscripcion;
            setupDragAndDrop(form, susId);
        });

        // BTN: Agregar Material Utilizado (del catálogo)
        document.querySelectorAll('.btn-add-material-usado').forEach(btn => {
            btn.addEventListener('click', () => {
                const form = btn.closest('form');
                const list = form?.querySelector('.ficha-materiales-usados-list');
                if (!list) return;
                crearFilaMaterialUsado(list);
            });
        });

        // BTN: Agregar Retiro Manual
        document.querySelectorAll('.btn-add-material-retirado').forEach(btn => {
            btn.addEventListener('click', () => {
                const form = btn.closest('form');
                const suscripcionId = form?.dataset.suscripcion;
                const list = form?.querySelector('.ficha-materiales-retirados-list');
                if (!list || !suscripcionId) return;
                crearFilaMaterialRetirado(list, suscripcionId);
            });
        });

        // BTN: Agregar Técnico
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

        // Submit Liquidacion Form
        document.querySelectorAll('.ficha-liq-mat-form').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const materiales = [];

                form.querySelectorAll('.ficha-material-usado-row').forEach(row => {
                    const desc = row.querySelector('.mat-desc')?.value?.trim();
                    if (!desc) return;
                    materiales.push({
                        descripcion: desc,
                        cantidad: row.querySelector('.mat-cant')?.value || 1,
                        precio_unitario: row.querySelector('.mat-precio')?.value || 0,
                    });
                });

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

                // Materiales ya no son obligatorios - se puede liquidar solo con actualización técnica
                // if (materiales.length === 0) {
                //     if (window.SITAlert && window.SITAlert.show) {
                //         window.SITAlert.show('Debe registrar al menos un material utilizado o retirado.', 'warning');
                //     } else {
                //         alert('Debe registrar al menos un material utilizado o retirado.');
                //     }
                //     return;
                // }

                const evidencias = [];
                const files = form.querySelector('.ficha-liq-evidencia')?.files || [];
                for (let i = 0; i < files.length; i++) {
                    try {
                        const data = await window.FichaCliente.subirArchivo(files[i], 'liquidacion', form.dataset.suscripcion);
                        if (data && data.url) {
                            evidencias.push(data.url);
                        }
                    } catch (err) {
                        console.error('Error al subir la evidencia:', err);
                    }
                }
                const evidencia_url = evidencias.length > 0 ? evidencias[0] : null;

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

                // Técnicos ya no son obligatorios - se puede liquidar solo con actualización técnica
                // if (tecnicos_asignados.length === 0) {
                //     if (window.SITAlert && window.SITAlert.show) {
                //         window.SITAlert.show('Debe asignar al menos un técnico de la lista.', 'warning');
                //     } else {
                //         alert('Debe asignar al menos un técnico de la lista.');
                //     }
                //     return;
                // }

                if (hasInvalidTecnico) {
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Por favor, seleccione un técnico válido de la lista de sugerencias para cada fila.', 'warning');
                    } else {
                        alert('Por favor, seleccione un técnico válido de la lista de sugerencias para cada fila.');
                    }
                    return;
                }

                // NAP ya no es obligatoria - se puede liquidar solo con actualización técnica
                // const napId = form.querySelector('.nap-id-hidden')?.value;
                // if (!napId) {
                //     if (window.SITAlert && window.SITAlert.show) {
                //         window.SITAlert.show('Debe seleccionar una NAP válida de la lista de sugerencias.', 'warning');
                //     } else {
                //         alert('Debe seleccionar una NAP válida de la lista de sugerencias.');
                //     }
                //     return;
                // }

                try {
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
                    if (json.status !== 'success') { 
                        if (window.SITAlert && window.SITAlert.show) {
                            window.SITAlert.show(json.message || 'Error al liquidar', 'danger'); 
                        } else {
                            alert(json.message || 'Error al liquidar');
                        }
                        return; 
                    }
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Liquidación en campo registrada.', 'success');
                    } else {
                        alert('Liquidación en campo registrada.');
                    }
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    console.error('Error al enviar la liquidación:', err);
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Error al enviar la liquidación.', 'danger');
                    } else {
                        alert('Error al enviar la liquidación.');
                    }
                }
            });
        });

        // Generar Deuda Manual
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
                try {
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
                    if (json.status !== 'success') { 
                        if (window.SITAlert && window.SITAlert.show) {
                            window.SITAlert.show(json.message, 'danger'); 
                        } else {
                            alert(json.message);
                        }
                        return; 
                    }
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Deuda generada y servicio cortado por morosidad.', 'success');
                    } else {
                        alert('Deuda generada y servicio cortado por morosidad.');
                    }
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Error al generar la deuda.', 'danger');
                    } else {
                        alert('Error al generar la deuda.');
                    }
                }
            });
        });

        // Editar Deuda
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
                try {
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
                    if (json.status !== 'success') { 
                        if (window.SITAlert && window.SITAlert.show) {
                            window.SITAlert.show(json.message, 'danger'); 
                        } else {
                            alert(json.message);
                        }
                        return; 
                    }
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Deuda actualizada correctamente.', 'success');
                    } else {
                        alert('Deuda actualizada correctamente.');
                    }
                    setTimeout(() => window.location.reload(), 1000);
                } catch (err) {
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Error al editar la deuda.', 'danger');
                    } else {
                        alert('Error al editar la deuda.');
                    }
                }
            });
        });

        // Eliminar Deuda
        document.querySelectorAll('.btn-eliminar-deuda').forEach(btn => {
            btn.addEventListener('click', async () => {
                let confirmed = false;
                if (window.SITAlert && window.SITAlert.confirm) {
                    confirmed = await window.SITAlert.confirm('¿Está seguro de que desea eliminar esta deuda? Esta acción no se puede deshacer y restará el monto de la deuda acumulada del servicio.');
                } else {
                    confirmed = confirm('¿Está seguro de que desea eliminar esta deuda? Esta acción no se puede deshacer y restará el monto de la deuda acumulada del servicio.');
                }
                if (!confirmed) return;
                
                try {
                    const res = await fetch('/api/abonados/eliminar-deuda/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deuda_id: btn.dataset.deudaId
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
                        window.SITAlert.show('Deuda eliminada correctamente.', 'success');
                    } else {
                        alert('Deuda eliminada correctamente.');
                    }
                    setTimeout(() => window.location.reload(), 1000);
                } catch (err) {
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Error al eliminar la deuda.', 'danger');
                    } else {
                        alert('Error al eliminar la deuda.');
                    }
                }
            });
        });

        // Compromiso de Pago
        document.querySelectorAll('.btn-compromiso').forEach(btn => {
            btn.addEventListener('click', async () => {
                let fecha = null;
                if (window.SITAlert && window.SITAlert.prompt) {
                    fecha = await window.SITAlert.prompt('Fecha compromiso (AAAA-MM-DD):');
                } else {
                    fecha = prompt('Fecha compromiso (AAAA-MM-DD):');
                }
                if (!fecha) return;
                
                try {
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
                    if (json.status !== 'success') { 
                        if (window.SITAlert && window.SITAlert.show) {
                            window.SITAlert.show(json.message, 'danger'); 
                        } else {
                            alert(json.message);
                        }
                        return; 
                    }
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Compromiso de pago registrado.', 'success');
                    } else {
                        alert('Compromiso de pago registrado.');
                    }
                    setTimeout(() => window.location.reload(), 1000);
                } catch (err) {
                    if (window.SITAlert && window.SITAlert.show) {
                        window.SITAlert.show('Error al registrar compromiso de pago.', 'danger');
                    } else {
                        alert('Error al registrar compromiso de pago.');
                    }
                }
            });
        });

        // ─── Generar Deuda (con materiales disponibles) ──────────────────────────
        let _materialesDisponibles = [];

        async function _cargarMaterialesDisponibles(clienteId, suministroId) {
            const lista = document.getElementById('deuda-materiales-lista');
            const estado = document.getElementById('deuda-materiales-estado');
            if (!lista) return;
            lista.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.8rem;">Cargando...</div>';
            if (estado) estado.textContent = 'Cargando...';
            try {
                const resp = await fetch(`/api/abonados/materiales-disponibles/?cliente_id=${encodeURIComponent(clienteId)}&suministro_id=${encodeURIComponent(suministroId)}`);
                const json = await resp.json();
                _materialesDisponibles = (json.data && json.data.materiales) || [];
                if (estado) estado.textContent = `${_materialesDisponibles.length} disponible(s)`;
                if (_materialesDisponibles.length === 0) {
                    lista.innerHTML = '<div style="text-align:center; padding:0.75rem; color:var(--text-muted); font-size:0.8rem;"><i class="fa-solid fa-box-open"></i> Sin materiales pendientes de cobro</div>';
                    return;
                }
                lista.innerHTML = '';
                _materialesDisponibles.forEach((mat, idx) => {
                    const item = document.createElement('label');
                    item.style = 'display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0.5rem; border-bottom:1px solid var(--border-color); cursor:pointer; font-size:0.8rem;';
                    item.innerHTML = `
                        <input type="checkbox" class="mat-check" data-idx="${idx}" style="flex-shrink:0;">
                        <span style="flex:1; color:var(--text-color);">${mat.descripcion} <em style="color:var(--text-muted);">(Ticket ${mat.ticket_codigo} — ${mat.ticket_fecha})</em></span>
                        <span style="font-weight:700; color:var(--primary-color); white-space:nowrap;">S/ ${parseFloat(mat.precio_total).toFixed(2)}</span>
                    `;
                    lista.appendChild(item);

                    item.querySelector('.mat-check').addEventListener('change', _recalcularDesdeCheks);
                });
            } catch(e) {
                lista.innerHTML = '<div style="text-align:center; padding:0.75rem; color:#ef4444; font-size:0.8rem;">Error al cargar materiales</div>';
                if (estado) estado.textContent = 'Error';
            }
        }

        function _recalcularDesdeCheks() {
            const checks = document.querySelectorAll('#deuda-materiales-lista .mat-check:checked');
            if (checks.length === 0) return;
            let total = 0;
            const conceptos = [];
            checks.forEach(ch => {
                const mat = _materialesDisponibles[parseInt(ch.dataset.idx)];
                if (mat) {
                    total += parseFloat(mat.precio_total || 0);
                    conceptos.push(mat.descripcion);
                }
            });
            const montoInput = document.getElementById('deuda-monto-input');
            const conceptoInput = document.getElementById('deuda-concepto-input');
            if (montoInput) montoInput.value = total.toFixed(2);
            if (conceptoInput) conceptoInput.value = `Cobro de materiales: ${conceptos.join(', ')}`;
        }

        document.querySelectorAll('.btn-generar-deuda').forEach(btn => {
            btn.addEventListener('click', () => {
                const clienteId = btn.dataset.cliente;
                const suministroId = btn.dataset.suministro;
                const modal = document.getElementById('modal-generar-deuda');
                if (!modal) return;
                document.getElementById('deuda-cliente-id').value = clienteId || '';
                document.getElementById('deuda-suministro-id').value = suministroId || '';
                const montoInput = document.getElementById('deuda-monto-input');
                const conceptoInput = document.getElementById('deuda-concepto-input');
                if (montoInput) montoInput.value = '';
                if (conceptoInput) conceptoInput.value = '';
                _materialesDisponibles = [];
                modal.style.display = 'flex';
                _cargarMaterialesDisponibles(clienteId, suministroId);
            });
        });

        const formGenDeuda = document.querySelector('.modal-generar-deuda-form');
        if (formGenDeuda) {
            formGenDeuda.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(formGenDeuda);
                const clienteId = fd.get('cliente_id');
                const suministroId = fd.get('suministro_id');
                const monto = fd.get('monto');
                const concepto = fd.get('concepto');

                // Recoger materiales seleccionados
                const checks = document.querySelectorAll('#deuda-materiales-lista .mat-check:checked');
                const materialesSel = [];
                checks.forEach(ch => {
                    const mat = _materialesDisponibles[parseInt(ch.dataset.idx)];
                    if (mat) materialesSel.push(mat);
                });

                const payload = { cliente_id: clienteId, suministro_id: suministroId, monto, concepto };
                if (materialesSel.length > 0) payload.materiales = materialesSel;

                try {
                    const resp = await fetch('/api/abonados/generar-deuda/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const json = await resp.json();
                    if (json.status !== 'success') {
                        if (window.SITAlert && window.SITAlert.show) window.SITAlert.show(json.message, 'danger');
                        else alert(json.message);
                        return;
                    }
                    document.getElementById('modal-generar-deuda').style.display = 'none';
                    if (window.SITAlert && window.SITAlert.show) window.SITAlert.show('Deuda generada correctamente.', 'success');
                    else alert('Deuda generada correctamente.');
                    setTimeout(() => window.location.reload(), 1200);
                } catch(err) {
                    if (window.SITAlert && window.SITAlert.show) window.SITAlert.show('Error al generar deuda.', 'danger');
                    else alert('Error al generar deuda.');
                }
            });
        }

        // ─── Financiar Deuda ────────────────────────────────────────────────────
        document.querySelectorAll('.btn-financiar-deuda').forEach(btn => {
            btn.addEventListener('click', () => {
                const clienteId = btn.dataset.cliente;
                const suministroId = btn.dataset.suministro;
                const modal = document.getElementById('modal-financiar-deuda');
                if (!modal) return;
                document.getElementById('financiar-cliente-id').value = clienteId || '';
                document.getElementById('financiar-suministro-id').value = suministroId || '';
                const resumen = document.getElementById('financiar-resumen');
                if (resumen) resumen.textContent = 'Selecciona el número de cuotas y confirma.';
                modal.style.display = 'flex';
            });
        });

        const formFinanciar = document.querySelector('.modal-financiar-deuda-form');
        if (formFinanciar) {
            formFinanciar.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(formFinanciar);
                const payload = {
                    cliente_id: fd.get('cliente_id'),
                    suministro_id: fd.get('suministro_id'),
                    num_cuotas: parseInt(fd.get('num_cuotas') || 1),
                };

                const btn = formFinanciar.querySelector('[type="submit"]');
                if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

                try {
                    const resp = await fetch('/api/abonados/financiar-deuda/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const json = await resp.json();
                    if (json.status !== 'success') {
                        if (window.SITAlert && window.SITAlert.show) window.SITAlert.show(json.message || 'Error al financiar deuda.', 'danger');
                        else alert(json.message || 'Error al financiar deuda.');
                        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Financiamiento'; }
                        return;
                    }
                    document.getElementById('modal-financiar-deuda').style.display = 'none';
                    const d = json.data || {};
                    const msg = d.mensaje || `Deuda financiada en ${d.num_cuotas} cuota(s) de S/ ${parseFloat(d.monto_cuota||0).toFixed(2)}`;
                    if (window.SITAlert && window.SITAlert.show) window.SITAlert.show(msg, 'success');
                    else alert(msg);
                    setTimeout(() => window.location.reload(), 1500);
                } catch(err) {
                    if (window.SITAlert && window.SITAlert.show) window.SITAlert.show('Error al procesar financiamiento.', 'danger');
                    else alert('Error al procesar financiamiento.');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Financiamiento'; }
                }
            });
        }

        // ─── Gestión de Anexos (+ / -) ─────────────────────────────────────────
        async function _gestionarAnexo(btn, accion) {
            const clienteId = btn.dataset.cliente;
            const suministroId = btn.dataset.suministro;
            if (!clienteId || !suministroId) return;

            btn.disabled = true;
            const iconOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const resp = await fetch('/api/abonados/gestionar-anexo/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cliente_id: clienteId, suministro_id: suministroId, accion }),
                });
                const json = await resp.json();
                if (json.status !== 'success') {
                    if (window.SITAlert && window.SITAlert.show) window.SITAlert.show(json.message || 'Error al gestionar anexo.', 'danger');
                    else alert(json.message || 'Error al gestionar anexo.');
                    btn.disabled = false;
                    btn.innerHTML = iconOriginal;
                    return;
                }
                const d = json.data || {};
                const cm = d.costo_mensual_real || {};

                // Actualizar contador en pantalla
                const panel = btn.closest('.ficha-service-panel');
                if (panel) {
                    const svc = panel.dataset.suscripcion;
                    const countEl = panel.querySelector(`#anexos-count-${svc}`);
                    if (countEl) countEl.textContent = d.numero_anexos_nuevo || 0;
                }

                // Mostrar mensaje con el nuevo costo
                const msg = `Anexo ${accion === 'agregar' ? 'agregado' : 'quitado'}. ` +
                    `Ahora tiene ${d.numero_anexos_nuevo} anexo(s). ` +
                    `Nuevo costo mensual: S/ ${(cm.costo_final || 0).toFixed(2)}` +
                    (cm.pct_descuento > 0 ? ` (incl. descuento ${cm.pct_descuento}%)` : '');
                if (window.SITAlert && window.SITAlert.show) window.SITAlert.show(msg, 'success');
                else alert(msg);

                // Recargar la página para actualizar el desglose de precio
                setTimeout(() => window.location.reload(), 1800);
            } catch(err) {
                if (window.SITAlert && window.SITAlert.show) window.SITAlert.show('Error al gestionar anexo.', 'danger');
                else alert('Error al gestionar anexo.');
                btn.disabled = false;
                btn.innerHTML = iconOriginal;
            }
        }

        document.querySelectorAll('.btn-agregar-anexo').forEach(btn => {
            btn.addEventListener('click', () => _gestionarAnexo(btn, 'agregar'));
        });

        document.querySelectorAll('.btn-quitar-anexo').forEach(btn => {
            btn.addEventListener('click', () => _gestionarAnexo(btn, 'quitar'));
        });

    });
})();



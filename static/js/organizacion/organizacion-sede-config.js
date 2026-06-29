/**
 * organizacion-sede-config.js
 * Lógica de configuración de sede (vista completa con navegador de burbuja)
 */

document.addEventListener('DOMContentLoaded', () => {

    let currentSedeId = null;
    let currentSedeConfigData = null;
    let activeSedeTab = 'datos';

    const sedeConfigFullView = document.getElementById('sedeConfigFullView');
    const sedeBreadcrumbBack = document.getElementById('sedeBreadcrumbBack');
    const sedeBreadcrumbTitle = document.getElementById('sedeBreadcrumbTitle');
    const sedeBreadcrumbSubtitle = document.getElementById('sedeBreadcrumbSubtitle');
    const sedeConfigBody = document.getElementById('sedeConfigBody');

    // Elementos principales a ocultar/mostrar
    const orgLayout = document.querySelector('.org-layout');
    const orgTopbar = document.querySelector('.org-topbar');

    // Volver a la vista principal
    sedeBreadcrumbBack?.addEventListener('click', () => {
        sedeConfigFullView.style.display = 'none';
        if (orgLayout) orgLayout.style.display = 'flex';
        if (orgTopbar) orgTopbar.style.display = 'flex';
        currentSedeId = null;
        currentSedeConfigData = null;
        window.currentSedeId = null;
        window.currentSedeConfigData = null;
    });

    // Delegar click en las pestañas horizontales
    document.querySelectorAll('.sede-breadcrumb-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sede-breadcrumb-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSedeTab = btn.dataset.tab;
            renderActiveSedeTab();
        });
    });

    window.editarSedePopup = (id) => {
        window.openSedeConfig(id);
    };

    window.openSedeConfig = async (sedeId, initialTab = 'datos') => {
        currentSedeId = sedeId;
        window.currentSedeId = sedeId;
        
        // Ocultar org-layout y org-topbar, mostrar vista completa
        if (orgLayout) orgLayout.style.display = 'none';
        if (orgTopbar) orgTopbar.style.display = 'none';
        sedeConfigFullView.style.display = 'flex';
        
        sedeConfigBody.innerHTML = `
            <div class="sede-loading-spinner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span>Cargando datos detallados de la sede...</span>
            </div>
        `;
        sedeBreadcrumbSubtitle.textContent = 'Cargando...';

        try {
            const resp = await fetch(`/api/sede/config/?sede_id=${sedeId}`);
            const res = await resp.json();
            if (res.status === 'success') {
                currentSedeConfigData = res;
                window.currentSedeConfigData = res;
                const prefijo = res.datos_sede.sector_prefijo || '';
                const baseName = res.datos_sede.nombre_base || res.datos_sede.nombre;
                const activa = res.datos_sede.activa !== false;
                const estadoBadge = activa
                    ? '<span class="config-badge config-badge-success">Activa</span>'
                    : '<span class="config-badge config-badge-danger">Inactiva</span>';
                const prefijoBadge = prefijo
                    ? `<span class="config-badge" style="background:var(--primary-glow);color:var(--primary);margin-left:6px;">Prefijo: ${prefijo}</span>`
                    : '<span class="config-badge config-badge-warning" style="margin-left:6px;">Sin sector</span>';
                sedeBreadcrumbTitle.textContent = `Gestión Sede: ${baseName}`;
                sedeBreadcrumbSubtitle.innerHTML = `${estadoBadge} ${prefijoBadge}`;
                
                document.querySelectorAll('.sede-breadcrumb-tab').forEach(b => {
                    b.classList.toggle('active', b.dataset.tab === initialTab);
                });
                activeSedeTab = initialTab;
                renderActiveSedeTab();
            } else {
                alert(`Error al cargar configuración: ${res.message}`);
                sedeConfigFullView.style.display = 'none';
                if (orgLayout) orgLayout.style.display = 'flex';
                if (orgTopbar) orgTopbar.style.display = 'flex';
            }
        } catch (err) {
            alert('Error de conexión con el servidor.');
            sedeConfigFullView.style.display = 'none';
            if (orgLayout) orgLayout.style.display = 'flex';
            if (orgTopbar) orgTopbar.style.display = 'flex';
        }
    };

    const renderActiveSedeTab = () => {
        if (!currentSedeConfigData) return;
        
        // Renderizar Tab Datos Sede
        if (activeSedeTab === 'datos') {
            const ds = currentSedeConfigData.datos_sede;
            const nombreBase = ds.nombre_base || ds.nombre;
            let sectorOptions = '';
            console.log('Sectores disponibles:', currentSedeConfigData.sectores);
            console.log('Sector ID de la sede:', ds.sector_id);
            currentSedeConfigData.sectores.forEach(sec => {
                const sel = sec.id == ds.sector_id ? 'selected' : '';
                sectorOptions += `<option value="${sec.id}" ${sel}>${sec.nombre} — Prefijo: ${sec.prefijo_comercial}</option>`;
            });

            sedeConfigBody.innerHTML = `
                <div class="sede-datos-split-layout">
                    <div class="sede-datos-form">
                        <div class="config-card">
                            <div class="config-card-title">
                                ${GLOBAL_ICONS.settings()} Editar Información de Sede
                            </div>
                            <form id="sedeDatosForm">
                                <div class="config-form-group">
                                    <label>Nombre de la Sede</label>
                                    <input type="text" class="config-form-input" name="nombre" value="${nombreBase}" required>
                                </div>
                                <div class="config-form-group">
                                    <label>Descripción</label>
                                    <input type="text" class="config-form-input" name="descripcion" value="${ds.descripcion}">
                                </div>
                                <div class="config-form-group">
                                    <label>Sector Geográfico Asignado *</label>
                                    <select class="config-form-input" name="sector_id" required>
                                        ${sectorOptions}
                                    </select>
                                    ${ds.sector_prefijo ? `<div class="config-hint" style="margin-top:6px;">Prefijo vinculado: <strong>${ds.sector_prefijo}</strong> (${ds.sector_codigo || ''})</div>` : ''}
                                </div>
                                <div class="config-form-group">
                                    <label class="config-check-inline">
                                        <input type="checkbox" name="activa" ${ds.activa !== false ? 'checked' : ''}>
                                        <span>Sede operativa (activa)</span>
                                    </label>
                                </div>
                                 <div class="config-form-group" style="margin-bottom:1rem;">
                                     <label>Logo de la Sede</label>
                                     <div class="file-upload-container">
                                         <svg class="file-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:28px;height:28px;margin-bottom:0.5rem;color:var(--text-muted);">
                                             <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                             <polyline points="17 8 12 3 7 8"></polyline>
                                             <line x1="12" y1="3" x2="12" y2="15"></line>
                                         </svg>
                                         <div class="file-upload-text" style="font-size:0.85rem;font-weight:600;margin-bottom:0.2rem;">Haga clic o arrastre el logo de la sede aquí</div>
                                         <div class="file-upload-subtext" style="font-size:0.75rem;color:var(--text-muted);">PNG, JPG, JPEG (Máx. 500KB)</div>
                                         <input type="file" id="sedeLogoInput" name="logo" accept="image/*">
                                     </div>
                                     <div id="sedeLogoPreview" style="margin-top:8px;">
                                         ${ds.logo_url ? `<img src="${ds.logo_url}" style="max-height:40px;border-radius:4px;">` : '<span style="color:var(--text-muted);font-size:0.82rem;">Sin logo (se usará texto por defecto)</span>'}
                                     </div>
                                 </div>
                                <div style="display:flex; gap:1rem;">
                                    <div class="config-form-group" style="flex:1;">
                                        <label>Latitud</label>
                                        <input type="number" step="any" class="config-form-input" name="latitud" value="${ds.latitud}" required>
                                    </div>
                                    <div class="config-form-group" style="flex:1;">
                                        <label>Longitud</label>
                                        <input type="number" step="any" class="config-form-input" name="longitud" value="${ds.longitud}" required>
                                    </div>
                                </div>
                                <div style="text-align: right; margin-top: 1.5rem;">
                                    <button type="submit" class="config-btn-save" title="Guardar Cambios">${GLOBAL_ICONS.save()}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div class="sede-datos-map">
                        <div class="config-card">
                            <div class="config-card-title">
                                ${GLOBAL_ICONS.search()} Ubicación de la Sede
                            </div>
                            <div id="sedeLocationMap" style="border-radius: 8px; overflow: hidden;"></div>
                            <div class="config-form-panel" style="margin-top:1rem;padding:0.75rem;">
                                <div class="config-hint">Coordenadas:</div>
                                <div style="font-weight:600;font-size:0.95rem;">${parseFloat(ds.latitud).toFixed(6)}, ${parseFloat(ds.longitud).toFixed(6)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Inicializar mapa de ubicación de sede
            setTimeout(() => {
                const mapContainer = document.getElementById('sedeLocationMap');
                if (mapContainer && typeof L !== 'undefined') {
                    const sedeMap = L.map('sedeLocationMap', {
                        center: [ds.latitud, ds.longitud],
                        zoom: 16,
                        zoomControl: true
                    });
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap',
                        maxZoom: 19
                    }).addTo(sedeMap);
                    L.marker([ds.latitud, ds.longitud]).addTo(sedeMap)
                        .bindPopup(`<strong>${nombreBase}</strong>${ds.sector_prefijo ? `<br><small>Prefijo: ${ds.sector_prefijo}</small>` : ''}`)
                        .openPopup();
                }
            }, 100);

            const sedeLogoInput = document.getElementById('sedeLogoInput');
            const sedeLogoPreview = document.getElementById('sedeLogoPreview');
            sedeLogoInput?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        sedeLogoPreview.innerHTML = `<img src="${event.target.result}" style="max-height:40px;border-radius:4px;margin-top:8px;">`;
                    };
                    reader.readAsDataURL(file);
                }
            });

            document.getElementById('sedeDatosForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const fd = new FormData(form);
                fd.append('sede_id', currentSedeId);
                fd.set('activa', form.querySelector('[name="activa"]')?.checked ? 'true' : 'false');

                const btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.textContent = 'Guardando...';

                try {
                    const resp = await fetch('/api/sede/config/datos/', {
                        method: 'POST',
                        headers: { 'X-CSRFToken': window.getCookie('csrftoken') },
                        body: fd
                    });
                    const res = await resp.json();
                    if (res.status === 'success') {
                        await window.openSedeConfig(currentSedeId, 'datos');
                        alert('Datos de sede guardados correctamente.');
                    } else {
                        alert(`Error: ${res.message}`);
                        btn.disabled = false;
                        btn.textContent = 'Guardar Cambios';
                    }
                } catch (err) {
                    alert('Error al guardar datos de sede.');
                    btn.disabled = false;
                    btn.textContent = 'Guardar Cambios';
                }
            });
        }
        
        else if (activeSedeTab === 'tickets') {
            sedeConfigBody.innerHTML = `<div class="sede-loading-spinner"><span>Cargando tickets...</span></div>`;
            if (typeof window.initSedeTicketsModule === 'function') {
                window.initSedeTicketsModule();
            }
        }
        
        // Renderizar Tab RUCs
        else if (activeSedeTab === 'rucs') {
            sedeConfigBody.innerHTML = `
                <div class="config-card sede-tab-panel">
                    <div class="config-card-title">
                        ${GLOBAL_ICONS.settings()} Configuración de RUCs para Emisión Electrónica
                    </div>
                    <p class="config-panel-desc">
                        Configure los RUCs que esta sede utilizará para emitir facturas, boletas y notas de venta electrónicas a través de SUNAT.
                    </p>
                    <div class="sede-rucs-toolbar">
                        <div class="sede-rucs-search">
                            <input type="text" id="rucSearchInput" class="config-form-input" placeholder="Buscar por número de RUC o razón social...">
                            <svg class="sede-rucs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${GLOBAL_ICONS.search()}</svg>
                        </div>
                        <button type="button" class="config-btn-secondary" onclick="vincularRucExistente()" title="Vincular existente">${GLOBAL_ICONS.add()}</button>
                        <button type="button" class="config-btn-save" onclick="addNewRuc()" title="Agregar RUC">${GLOBAL_ICONS.add()}</button>
                    </div>
                    <div id="rucsListContainer" class="sede-rucs-list">
                        <div class="config-empty-row" style="text-align:center;padding:2rem;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="margin-bottom:1rem; opacity:0.5;"><path d="M3 21h18M5 21V7l8-4 8 4v14M8 21v-9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v9"/></svg>
                            <p>Cargando RUCs...</p>
                        </div>
                    </div>
                </div>
            `;

            // Set global currentSedeId for RUC module
            window.currentSedeId = currentSedeId;

            // Inicializar módulo de RUCs
            if (typeof window.initSedeRucsModule === 'function') {
                window.initSedeRucsModule(currentSedeId);
            }
            
            // Configurar buscador
            const searchInput = document.getElementById('rucSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    if (typeof window.searchRucs === 'function') {
                        window.searchRucs(e.target.value);
                    }
                });
            }
        }
        
        // Renderizar Tab Cajas
        else if (activeSedeTab === 'cajas') {
            sedeConfigBody.innerHTML = `<div class="sede-loading-spinner"><span>Cargando cajas...</span></div>`;
            if (typeof window.initSedeCajasModule === 'function') {
                window.initSedeCajasModule();
            }
        }
        
        else if (activeSedeTab === 'planes') {
            sedeConfigBody.innerHTML = `<div class="sede-loading-spinner"><span>Cargando planes...</span></div>`;
            if (typeof window.initSedePlanesModule === 'function') {
                window.initSedePlanesModule();
            }
        }

        else if (activeSedeTab === 'personal') {
            sedeConfigBody.innerHTML = `<div class="sede-loading-spinner"><span>Cargando personal...</span></div>`;
            if (typeof window.initSedePersonalModule === 'function') {
                window.initSedePersonalModule();
            }
        }
        else if (activeSedeTab === 'habilidades') {
            sedeConfigBody.innerHTML = `<div class="sede-loading-spinner"><span>Cargando habilidades...</span></div>`;
            if (typeof window.initSedeHabilidadesModule === 'function') {
                window.initSedeHabilidadesModule();
            }
        }
        else if (activeSedeTab === 'materiales') {
            sedeConfigBody.innerHTML = `<div class="sede-loading-spinner"><span>Cargando materiales...</span></div>`;
            if (typeof window.initSedeMaterialesModule === 'function') {
                window.initSedeMaterialesModule();
            }
        }
    };

});

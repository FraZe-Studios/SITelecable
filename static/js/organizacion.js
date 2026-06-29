// ══════════════════════════════════════════════════════════════════════
// ORGANIZACIÓN - MÓDULO DE GESTIÓN DE RED
// ══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

    // ── Tema ──────────────────────────────────────────────────────────────
    const applyTheme = t => { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t); };
    applyTheme(localStorage.getItem('theme') || 'light');
    const toggleTheme = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('drawerThemeToggleBtn')?.addEventListener('click', toggleTheme);

    // ── Drawer ────────────────────────────────────────────────────────────
    const toggleDrawer = show => {
        document.getElementById('mobileMenuDrawer')?.classList.toggle('open', show);
        document.getElementById('drawerBackdrop')?.classList.toggle('show', show);
    };
    document.getElementById('menuHamburger')?.addEventListener('click', () => toggleDrawer(true));
    document.getElementById('closeDrawerBtn')?.addEventListener('click', () => toggleDrawer(false));
    document.getElementById('drawerBackdrop')?.addEventListener('click', () => toggleDrawer(false));

    // ── Avatar ────────────────────────────────────────────────────────────
    const username = localStorage.getItem('session_username') || document.getElementById('django-username')?.textContent || '';
    const letter = (username || 'A')[0].toUpperCase();
    ['avatarLetter','drawerAvatarLetter'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=letter; });
    ['userProfileName','drawerUserProfileName'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=username; });

    // ══════════════════════════════════════════════════════════════════════
    // DATOS DE LA RED (desde Django context via scripts JSON)
    // ══════════════════════════════════════════════════════════════════════
    const RED_DATA = {
        sedes:    JSON.parse(document.getElementById('django-sedes')?.textContent || '[]'),
        hubs:     JSON.parse(document.getElementById('django-hubs')?.textContent || '[]'),
        naps:     JSON.parse(document.getElementById('django-naps')?.textContent || '[]'),
        mufas:    JSON.parse(document.getElementById('django-mufas')?.textContent || '[]'),
        sectores: JSON.parse(document.getElementById('django-sectores')?.textContent || '[]'),
        fibras:   JSON.parse(document.getElementById('django-fibras')?.textContent || '[]'),
    };

    const TIPO_CONFIG = {
        SEDE:   { color:'#ef4444', label:'Sede',   badgeClass:'badge-sede',   radius:10 },
        HUB:    { color:'#f59e0b', label:'Hub',    badgeClass:'badge-hub',    radius:9  },
        NAP:    { color:'#6366f1', label:'NAP',    badgeClass:'badge-nap',    radius:7  },
        MUFA:   { color:'#0ea5e9', label:'Mufa',   badgeClass:'badge-mufa',   radius:6  },
        SECTOR: { color:'#818cf8', label:'Sector', badgeClass:'badge-sector', radius:0  },
        FIBRA:  { color:'#f97316', label:'Fibra',  badgeClass:'badge-fibra',  radius:0  },
    };

    // ══════════════════════════════════════════════════════════════════════
    // MAPA LEAFLET
    // ══════════════════════════════════════════════════════════════════════
    const mapEl = document.getElementById('org-map');
    let initLat=-12.0464, initLng=-77.0428, initZoom=13;
    if (RED_DATA.sedes.length)    { initLat=RED_DATA.sedes[0].latitud;    initLng=RED_DATA.sedes[0].longitud;    initZoom=15; }
    else if (RED_DATA.hubs.length){ initLat=RED_DATA.hubs[0].latitud;     initLng=RED_DATA.hubs[0].longitud;     initZoom=14; }

    const map = L.map('org-map', { center: [initLat, initLng], zoom: initZoom, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Template JS: Icono SVG para marcadores (HTML dentro de JS permitido como template)
    const createIcon = tipo => {
        const cfg=TIPO_CONFIG[tipo];
        const sz=(cfg.radius*2)+6;
        return L.divIcon({
            html:`<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}"><circle cx="${sz/2}" cy="${sz/2}" r="${cfg.radius}" fill="${cfg.color}" stroke="white" stroke-width="2.5"/></svg>`,
            className:'', iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-(sz/2+4)]
        });
    };

    const layerGroups = { SEDE:L.layerGroup().addTo(map), HUB:L.layerGroup().addTo(map), NAP:L.layerGroup().addTo(map), MUFA:L.layerGroup().addTo(map), SECTOR:L.layerGroup().addTo(map), FIBRA:L.layerGroup().addTo(map) };

    // Template JS: Popup HTML (HTML dentro de JS permitido como template)
    const buildPopup = (tipo, item) => {
        const cfg=TIPO_CONFIG[tipo];
        let rows='';
        if(item.codigo)   rows+=`<div class="popup-row"><span class="popup-label">Código</span><span class="popup-value">${item.codigo}</span></div>`;
        if(item.nombre)   rows+=`<div class="popup-row"><span class="popup-label">Nombre</span><span class="popup-value">${item.nombre}</span></div>`;
        if(item.latitud)  rows+=`<div class="popup-row"><span class="popup-label">Lat</span><span class="popup-value">${parseFloat(item.latitud).toFixed(6)}</span></div>`;
        if(item.longitud) rows+=`<div class="popup-row"><span class="popup-label">Lng</span><span class="popup-value">${parseFloat(item.longitud).toFixed(6)}</span></div>`;
        if(item.puertos)  rows+=`<div class="popup-row"><span class="popup-label">Puertos</span><span class="popup-value">${item.puertos}</span></div>`;
        if(item.capacidad)rows+=`<div class="popup-row"><span class="popup-label">Cap. Hilos</span><span class="popup-value">${item.capacidad}</span></div>`;
        return `<div class="popup-header"><span style="width:9px;height:9px;border-radius:50%;background:${cfg.color};display:inline-block;flex-shrink:0;"></span>&nbsp;<strong>${item.codigo||item.nombre||'Sin nombre'}</strong></div><div class="popup-body">${rows}</div>`;
    };

    const allTableItems = [];

    const addMarkerToTable = (tipo, codigo, lat, lng, marker, dbId=null, extra={}) => {
        allTableItems.push({ tipo, codigo, lat:parseFloat(lat), lng:parseFloat(lng), marker, dbId, extra,
            coords:`${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` });
    };

    // SEDES
    RED_DATA.sedes.forEach(s => {
        const m=L.marker([s.latitud,s.longitud],{icon:createIcon('SEDE')}).addTo(layerGroups.SEDE)
            .bindPopup(buildPopup('SEDE',{nombre:s.nombre,latitud:s.latitud,longitud:s.longitud}),{className:'org-popup'});
        addMarkerToTable('SEDE',s.nombre,s.latitud,s.longitud,m,s.id);
    });
    // HUBS
    RED_DATA.hubs.forEach(h => {
        const m=L.marker([h.latitud,h.longitud],{icon:createIcon('HUB')}).addTo(layerGroups.HUB)
            .bindPopup(buildPopup('HUB',{codigo:h.codigo,latitud:h.latitud,longitud:h.longitud}),{className:'org-popup'});
        addMarkerToTable('HUB',h.codigo,h.latitud,h.longitud,m,h.id);
    });
    // NAPS
    RED_DATA.naps.forEach(n => {
        const m=L.marker([n.latitud,n.longitud],{icon:createIcon('NAP')}).addTo(layerGroups.NAP)
            .bindPopup(buildPopup('NAP',{codigo:n.codigo,latitud:n.latitud,longitud:n.longitud,puertos:n.cantidad_puertos}),{className:'org-popup'});
        addMarkerToTable('NAP',n.codigo,n.latitud,n.longitud,m,n.id,{puertos:n.cantidad_puertos});
    });
    // MUFAS
    RED_DATA.mufas.forEach(u => {
        const m=L.marker([u.latitud,u.longitud],{icon:createIcon('MUFA')}).addTo(layerGroups.MUFA)
            .bindPopup(buildPopup('MUFA',{codigo:u.codigo,latitud:u.latitud,longitud:u.longitud,capacidad:u.capacidad_hilos}),{className:'org-popup'});
        addMarkerToTable('MUFA',u.codigo,u.latitud,u.longitud,m,u.id,{capacidad:u.capacidad_hilos});
    });
    // SECTORES
    RED_DATA.sectores.forEach(sec => {
        const m=L.circleMarker([sec.latitud_centro,sec.longitud_centro],{radius:14,color:'#6366f1',fillColor:'#818cf8',fillOpacity:0.25,weight:2,dashArray:'6 3'})
            .addTo(layerGroups.SECTOR).bindPopup(buildPopup('SECTOR',{codigo:sec.codigo,latitud:sec.latitud_centro,longitud:sec.longitud_centro}),{className:'org-popup'});
        addMarkerToTable('SECTOR',sec.codigo,sec.latitud_centro,sec.longitud_centro,m,sec.id,{prefijo:sec.prefijo});
    });
    // FIBRAS
    RED_DATA.fibras.forEach(f => {
        const line=L.polyline([[f.lat_inicio,f.lng_inicio],[f.lat_fin,f.lng_fin]],{color:'#f97316',weight:3,opacity:0.85,dashArray:'8 4'})
            .addTo(layerGroups.FIBRA).bindPopup(buildPopup('FIBRA',{codigo:f.codigo,latitud:f.lat_inicio,longitud:f.lng_inicio}),{className:'org-popup'});
        addMarkerToTable('FIBRA',f.codigo,f.lat_inicio,f.lng_inicio,line,f.id);
    });

    // ══════════════════════════════════════════════════════════════════════
    // TABLA DEL PANEL IZQUIERDO
    // ══════════════════════════════════════════════════════════════════════
    let currentFilter='TODOS', currentSearch='';

    const renderTable = () => {
        const tbody=document.getElementById('orgTableBody');
        const emptyEl=document.getElementById('orgEmptyState');
        const countEl=document.getElementById('itemCountDisplay');

        const filtered=allTableItems.filter(item => {
            const matchType  = currentFilter==='TODOS' || item.tipo===currentFilter;
            const matchSearch= !currentSearch || item.codigo.toLowerCase().includes(currentSearch.toLowerCase());
            return matchType && matchSearch;
        });

        tbody.innerHTML='';
        emptyEl.style.display = filtered.length===0 ? 'flex' : 'none';
        countEl.textContent   = filtered.length;

        filtered.forEach(item => {
            const cfg=TIPO_CONFIG[item.tipo];
            const tr=document.createElement('tr');
            // Template JS: Fila de tabla HTML (HTML dentro de JS permitido como template)
            tr.innerHTML=`
                <td><span class="org-table-badge ${cfg.badgeClass}"><span class="org-table-dot" style="background:${cfg.color};"></span>${cfg.label}</span></td>
                <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.codigo}">${item.codigo}</td>
                <td style="text-align:right;">
                    <div class="row-actions">
                        <button class="row-btn row-btn-edit" data-tipo="${item.tipo}" data-id="${item.dbId}" title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="row-btn row-btn-delete" data-tipo="${item.tipo}" data-id="${item.dbId}" data-codigo="${item.codigo}" title="Eliminar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                        </button>
                    </div>
                </td>`;

            // Clic en fila → volar al mapa
            tr.addEventListener('click', e => {
                if (e.target.closest('.row-btn')) return; // no activar si se hizo clic en botón
                document.querySelectorAll('#orgTableBody tr.selected').forEach(r=>r.classList.remove('selected'));
                tr.classList.add('selected');
                map.flyTo([item.lat, item.lng], 17, {duration:1});
                if (typeof item.marker.openPopup==='function') item.marker.openPopup();
            });

            // Botón editar
            tr.querySelector('.row-btn-edit').addEventListener('click', e => {
                e.stopPropagation();
                openModal(item.tipo, item.lat, item.lng, item);
            });

            // Botón eliminar
            tr.querySelector('.row-btn-delete').addEventListener('click', e => {
                e.stopPropagation();
                openConfirmDelete(item);
            });

            tbody.appendChild(tr);
        });
    };

    renderTable();

    document.getElementById('orgSearchInput').addEventListener('input', e => { currentSearch=e.target.value.trim(); renderTable(); });
    document.querySelectorAll('.org-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.org-filter-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter=btn.dataset.type;
            renderTable();
        });
    });

    // Leyenda → toggle capas
    document.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('active');
            const lg=layerGroups[item.dataset.filter];
            if (!lg) return;
            item.classList.contains('active') ? map.addLayer(lg) : map.removeLayer(lg);
        });
    });

    // Ajustar mapa
    document.getElementById('btnFitMap')?.addEventListener('click', () => {
        const bounds=allTableItems.map(i=>[i.lat,i.lng]);
        if (bounds.length) map.fitBounds(bounds, {padding:[40,40]});
    });

    // ══════════════════════════════════════════════════════════════════════
    // MODO AÑADIR ELEMENTO AL MAPA
    // ══════════════════════════════════════════════════════════════════════
    let addMode=false, selectedType=null, tempMarker=null;
    const addTypePanel   = document.getElementById('addTypePanel');
    const addIndicator   = document.getElementById('mapAddIndicator');
    const btnAddElement  = document.getElementById('btnAddElement');

    const enterAddMode = () => { addMode=true; addTypePanel.classList.add('visible'); btnAddElement.classList.add('add-mode-active'); };
    const exitAddMode  = () => {
        addMode=false; selectedType=null;
        addTypePanel.classList.remove('visible');
        addIndicator.classList.remove('visible');
        btnAddElement.classList.remove('add-mode-active');
        mapEl.classList.remove('add-mode');
        document.querySelectorAll('.add-type-btn').forEach(b=>b.classList.remove('selected-type'));
        if(tempMarker){map.removeLayer(tempMarker);tempMarker=null;}
    };

    btnAddElement?.addEventListener('click', () => addMode ? exitAddMode() : enterAddMode());
    document.getElementById('cancelAddBtn')?.addEventListener('click', exitAddMode);

    document.querySelectorAll('.add-type-btn[data-add-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedType=btn.dataset.addType;
            document.querySelectorAll('.add-type-btn').forEach(b=>b.classList.remove('selected-type'));
            btn.classList.add('selected-type');
            mapEl.classList.add('add-mode');
            addIndicator.classList.add('visible');
            document.getElementById('addIndicatorText').textContent=`Clic en el mapa para añadir ${TIPO_CONFIG[selectedType]?.label||selectedType}`;
        });
    });

    map.on('click', e => {
        if(!addMode||!selectedType) return;
        if(tempMarker){map.removeLayer(tempMarker);}
        tempMarker=L.circleMarker(e.latlng,{radius:8,color:TIPO_CONFIG[selectedType].color,fillColor:TIPO_CONFIG[selectedType].color,fillOpacity:0.4,weight:2}).addTo(map);
        openModal(selectedType, e.latlng.lat, e.latlng.lng, null);
    });

    // ══════════════════════════════════════════════════════════════════════
    // MODAL AÑADIR / EDITAR
    // ══════════════════════════════════════════════════════════════════════
    const overlay    = document.getElementById('orgModalOverlay');
    const modalTitle = document.getElementById('orgModalTitle');
    const titleDot   = document.getElementById('modalTitleDot');
    const modalBody  = document.getElementById('orgModalBody');
    const btnSave    = document.getElementById('orgModalSave');

    const FIELD_SCHEMAS = {
        SEDE:   [
            {id:'sede_nombre',     label:'Nombre',      type:'text',   required:true,  placeholder:'Ej: Sede Central'},
            {id:'sede_descripcion',label:'Descripción', type:'text',   required:false, placeholder:'Opcional'},
            {id:'sede_lat',        label:'Latitud',     type:'number', required:true,  step:'any', colHalf:true},
            {id:'sede_lng',        label:'Longitud',    type:'number', required:true,  step:'any', colHalf:true},
        ],
        HUB:   [
            {id:'hub_codigo',label:'Código', type:'text',  required:true,  placeholder:'Ej: HUB-01'},
            {id:'hub_lat',   label:'Latitud',type:'number',required:true,  step:'any',colHalf:true},
            {id:'hub_lng',   label:'Longitud',type:'number',required:true, step:'any',colHalf:true},
        ],
        NAP:   [
            {id:'nap_codigo',  label:'Código',        type:'text',  required:true,  placeholder:'Ej: NAP-001'},
            {id:'nap_puertos', label:'Cant. Puertos', type:'number',required:true,  placeholder:'8 / 16'},
            {id:'nap_lat',     label:'Latitud',       type:'number',required:true,  step:'any',colHalf:true},
            {id:'nap_lng',     label:'Longitud',      type:'number',required:true,  step:'any',colHalf:true},
        ],
        MUFA:  [
            {id:'mufa_codigo',    label:'Código',       type:'text',  required:true,  placeholder:'Ej: MUFA-001'},
            {id:'mufa_capacidad', label:'Cap. Hilos',   type:'number',required:true,  placeholder:'24'},
            {id:'mufa_lat',       label:'Latitud',      type:'number',required:true,  step:'any',colHalf:true},
            {id:'mufa_lng',       label:'Longitud',     type:'number',required:true,  step:'any',colHalf:true},
        ],
        SECTOR:[
            {id:'sector_codigo', label:'Código',      type:'text',  required:true,  placeholder:'Ej: SECTOR-01'},
            {id:'sector_prefijo',label:'Prefijo',     type:'text',  required:true,  placeholder:'Ej: S01'},
            {id:'sector_lat',    label:'Lat Centro',  type:'number',required:true,  step:'any',colHalf:true},
            {id:'sector_lng',    label:'Lng Centro',  type:'number',required:true,  step:'any',colHalf:true},
        ],
        FIBRA: [
            {id:'fibra_codigo',  label:'Código',       type:'text',  required:true,  placeholder:'Ej: FIBRA-001'},
            {id:'fibra_buffers', label:'Cant. Buffers',type:'number',required:true,  placeholder:'4'},
            {id:'fibra_hilos',   label:'Hilos/Buffer', type:'number',required:true,  placeholder:'12'},
            {id:'fibra_lat_i',   label:'Lat Inicio',   type:'number',required:true,  step:'any',colHalf:true},
            {id:'fibra_lng_i',   label:'Lng Inicio',   type:'number',required:true,  step:'any',colHalf:true},
            {id:'fibra_lat_f',   label:'Lat Fin',      type:'number',required:false, step:'any',colHalf:true,placeholder:'Opcional'},
            {id:'fibra_lng_f',   label:'Lng Fin',      type:'number',required:false, step:'any',colHalf:true,placeholder:'Opcional'},
        ],
    };

    let currentModalType=null, currentModalItem=null;

    const buildModalFields = (tipo, lat, lng, existingItem) => {
        const fields=FIELD_SCHEMAS[tipo]||[];
        let html=''; let halfBuf=[];
        const flushHalves=()=>{
            if(halfBuf.length>0){html+=`<div class="org-form-coords">`;halfBuf.forEach(f=>{html+=buildField(f);});html+=`</div>`;halfBuf=[];}
        };
        fields.forEach(f=>{
            if(f.colHalf){halfBuf.push(f);if(halfBuf.length===2)flushHalves();}
            else{flushHalves();html+=buildField(f);}
        });
        flushHalves();
        return html;

        function buildField(f){
            const req=f.required?'required':'';
            const ph=f.placeholder?`placeholder="${f.placeholder}"`:'';
            const step=f.step?`step="${f.step}"`:'';
            let val='';
            // Prellenar con coordenadas del clic
            if(f.id.endsWith('_lat')||f.id.endsWith('_lat_i')) val=lat?parseFloat(lat).toFixed(7):'';
            if(f.id.endsWith('_lng')||f.id.endsWith('_lng_i')) val=lng?parseFloat(lng).toFixed(7):'';
            // Prellenar con datos existentes al editar
            if(existingItem){
                const mapeo={
                    sede_nombre:existingItem.codigo, hub_codigo:existingItem.codigo, nap_codigo:existingItem.codigo,
                    mufa_codigo:existingItem.codigo, sector_codigo:existingItem.codigo, fibra_codigo:existingItem.codigo,
                    nap_puertos:existingItem.extra?.puertos, mufa_capacidad:existingItem.extra?.capacidad,
                    sector_prefijo:existingItem.extra?.prefijo,
                };
                if(mapeo[f.id]!==undefined) val=mapeo[f.id]||'';
                if(f.id.endsWith('_lat')||f.id.endsWith('_lat_i')) val=parseFloat(existingItem.lat).toFixed(7);
                if(f.id.endsWith('_lng')||f.id.endsWith('_lng_i')) val=parseFloat(existingItem.lng).toFixed(7);
            }
            return `<div class="org-form-group"><label class="org-form-label" for="${f.id}">${f.label}${f.required?' *':''}</label><input class="org-form-input" type="${f.type}" id="${f.id}" name="${f.id}" value="${val}" ${ph} ${step} ${req} autocomplete="off"></div>`;
        }
    };

    const openModal = (tipo, lat, lng, existingItem) => {
        currentModalType=tipo; currentModalItem=existingItem;
        const cfg=TIPO_CONFIG[tipo];
        modalTitle.textContent = existingItem ? `Editar ${cfg.label}` : `Añadir ${cfg.label}`;
        titleDot.style.backgroundColor=cfg.color;
        modalBody.innerHTML=buildModalFields(tipo,lat,lng,existingItem);
        overlay.classList.add('open');
        setTimeout(()=>{ modalBody.querySelector('input')?.focus(); },150);
    };

    const closeModal = () => {
        overlay.classList.remove('open');
        currentModalType=null; currentModalItem=null;
        if(tempMarker){map.removeLayer(tempMarker);tempMarker=null;}
    };

    document.getElementById('orgModalClose')?.addEventListener('click', closeModal);
    document.getElementById('orgModalCancel')?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });

    // Guardar / Actualizar
    btnSave?.addEventListener('click', async () => {
        const tipo=currentModalType; if(!tipo) return;
        const formData={};
        modalBody.querySelectorAll('input').forEach(inp=>{ formData[inp.name]=inp.value; });
        const requiredFields=FIELD_SCHEMAS[tipo].filter(f=>f.required);
        const empty=requiredFields.filter(f=>!formData[f.id]);
        if(empty.length>0){
            empty.forEach(f=>{ const el=document.getElementById(f.id); if(el){el.style.borderColor='var(--danger)';el.style.boxShadow='0 0 0 3px var(--danger-glow)';} });
            setTimeout(()=>{ empty.forEach(f=>{ const el=document.getElementById(f.id); if(el){el.style.borderColor='';el.style.boxShadow='';} }); },2000);
            return;
        }
        btnSave.disabled=true;
        btnSave.innerHTML=`<svg viewBox="0 0 24 24" style="width:14px;height:14px;animation:spin 1s linear infinite;" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Guardando…`;
        try {
            const url=currentModalItem ? '/api/organizacion/actualizar/' : '/api/organizacion/guardar/';
            const body={ tipo, datos:formData };
            if(currentModalItem) body.id=currentModalItem.dbId;
            const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCookie('csrftoken')},body:JSON.stringify(body)});
            const result=await resp.json();
            if(result.status==='success'){closeModal();exitAddMode();window.location.reload();}
            else alert(`Error: ${result.message||'Error desconocido'}`);
        } catch(err){ alert('Error de conexión.'); }
        finally{
            btnSave.disabled=false;
            btnSave.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Guardar`;
        }
    });

    // ══════════════════════════════════════════════════════════════════════
    // MODAL CONFIRMAR ELIMINACIÓN
    // ══════════════════════════════════════════════════════════════════════
    let pendingDeleteItem=null;
    const confirmOverlay=document.getElementById('confirmModalOverlay');

    const openConfirmDelete = item => {
        pendingDeleteItem=item;
        document.getElementById('confirmModalText').textContent=`¿Eliminar ${TIPO_CONFIG[item.tipo]?.label} "${item.codigo}"? Esta acción no se puede deshacer.`;
        confirmOverlay.classList.add('open');
    };

    document.getElementById('confirmModalCancel')?.addEventListener('click', ()=>{ confirmOverlay.classList.remove('open'); pendingDeleteItem=null; });
    confirmOverlay?.addEventListener('click', e=>{ if(e.target===confirmOverlay){confirmOverlay.classList.remove('open');pendingDeleteItem=null;} });

    document.getElementById('confirmModalOk')?.addEventListener('click', async () => {
        if(!pendingDeleteItem) return;
        const item=pendingDeleteItem;
        confirmOverlay.classList.remove('open');
        try{
            const resp=await fetch('/api/organizacion/eliminar/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':getCookie('csrftoken')},body:JSON.stringify({tipo:item.tipo,id:item.dbId})});
            const result=await resp.json();
            if(result.status==='success') window.location.reload();
            else alert(`Error al eliminar: ${result.message}`);
        }catch(err){alert('Error de conexión al eliminar.');}
        pendingDeleteItem=null;
    });

    // ══════════════════════════════════════════════════════════════════════
    // IMPORTAR EXCEL
    // ══════════════════════════════════════════════════════════════════════
    const importOverlay   = document.getElementById('importModalOverlay');
    const dropZone        = document.getElementById('dropZone');
    const dropFileName    = document.getElementById('dropZoneFileName');
    const btnImportarExcel= document.getElementById('btnImportarExcel');
    const btnProcesar     = document.getElementById('btnProcesarImport');
    const fileInput       = document.getElementById('excelFileInput');
    let selectedFile      = null;

    const openImportModal = () => { importOverlay.classList.add('open'); resetImportModal(); };
    const closeImportModal= () => { importOverlay.classList.remove('open'); selectedFile=null; };

    const resetImportModal = () => {
        selectedFile=null; btnProcesar.disabled=true;
        dropFileName.style.display='none'; dropFileName.textContent='';
        document.getElementById('importResult').classList.remove('visible');
        document.getElementById('importErrorsList').style.display='none';
        document.getElementById('importErrorsList').innerHTML='';
        ['statOk','statSkip','statErr'].forEach(id=>{ document.getElementById(id).textContent='0'; });
    };

    btnImportarExcel?.addEventListener('click', openImportModal);
    document.getElementById('importModalClose')?.addEventListener('click', closeImportModal);
    document.getElementById('importModalCancel')?.addEventListener('click', closeImportModal);
    importOverlay?.addEventListener('click', e=>{ if(e.target===importOverlay) closeImportModal(); });

    // Drag & drop
    dropZone?.addEventListener('click', ()=>fileInput.click());
    dropZone?.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone?.addEventListener('dragleave', ()=>dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e=>{ e.preventDefault(); dropZone.classList.remove('drag-over'); handleFileSelect(e.dataTransfer.files[0]); });
    fileInput?.addEventListener('change', e=>{ handleFileSelect(e.target.files[0]); e.target.value=''; });

    const handleFileSelect = file => {
        if(!file) return;
        if(!file.name.match(/\.(xlsx|xls)$/i)){ alert('Por favor selecciona un archivo Excel (.xlsx o .xls)'); return; }
        selectedFile=file;
        dropFileName.textContent=file.name;
        dropFileName.style.display='block';
        btnProcesar.disabled=false;
        document.getElementById('importResult').classList.remove('visible');
    };

    btnProcesar?.addEventListener('click', async () => {
        if(!selectedFile) return;
        btnProcesar.disabled=true;
        btnProcesar.innerHTML=`<svg viewBox="0 0 24 24" style="width:14px;height:14px;animation:spin 1s linear infinite;" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Procesando…`;
        const fd=new FormData();
        fd.append('file', selectedFile);
        try{
            const resp=await fetch('/api/organizacion/importar-excel/',{method:'POST',headers:{'X-CSRFToken':getCookie('csrftoken')},body:fd});
            const result=await resp.json();
            document.getElementById('statOk').textContent   = result.importados||0;
            document.getElementById('statSkip').textContent = result.omitidos||0;
            document.getElementById('statErr').textContent  = result.errores||0;
            document.getElementById('importResult').classList.add('visible');
            const errList=document.getElementById('importErrorsList');
            if(result.detalle_errores&&result.detalle_errores.length>0){
                errList.innerHTML=result.detalle_errores.map(e=>`<div class="import-error-item">${e}</div>`).join('');
                errList.style.display='block';
            } else { errList.style.display='none'; }
            if(result.importados>0) setTimeout(()=>window.location.reload(), 2500);
        }catch(err){ alert('Error al procesar el archivo.'); }
        finally{
            btnProcesar.disabled=false;
            btnProcesar.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Procesar`;
        }
    });

    // DESCARGAR MODELO EXCEL
    document.getElementById('btnDescargarModelo')?.addEventListener('click', () => {
        window.location.href='/api/organizacion/descargar-modelo/';
    });

    // EXPORTAR TODO
    document.getElementById('btnExportarExcel')?.addEventListener('click', () => {
        window.location.href='/api/organizacion/exportar-excel/';
    });

    // ── Helpers ────────────────────────────────────────────────────────────
    function getCookie(name){
        const val=`; ${document.cookie}`;
        const parts=val.split(`; ${name}=`);
        if(parts.length===2) return parts.pop().split(';').shift();
        return '';
    }

    // Animación spin
    const spinStyle=document.createElement('style');
    spinStyle.textContent=`@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(spinStyle);

    // ── Verificar sesión ────────────────────────────────────────────────
    const sessionToken=localStorage.getItem('session_token');
    const checkSession=async()=>{
        if(!username||!sessionToken){window.location.href='/login/';return;}
        try{
            const r=await fetch(`/api/check-session/?username=${encodeURIComponent(username)}&token=${encodeURIComponent(sessionToken)}`);
            const d=await r.json();
            if(!d.valid){localStorage.removeItem('session_username');localStorage.removeItem('session_token');window.location.href='/login/?reason=duplicate';}
        }catch{}
    };
    checkSession();
    setInterval(checkSession,5000);

}); // end DOMContentLoaded

/**
 * organizacion-modales.js
 * Lógica de modales (añadir/editar, confirmar eliminar)
 */

document.addEventListener('DOMContentLoaded', () => {

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
            {id:'nap_lng',     label:'Longitud',      type:'number',required:true, step:'any',colHalf:true},
        ],
        MUFA:  [
            {id:'mufa_codigo',    label:'Código',       type:'text',  required:true,  placeholder:'Ej: MUFA-001'},
            {id:'mufa_capacidad', label:'Cap. Hilos',   type:'number',required:true,  placeholder:'24'},
            {id:'mufa_lat',       label:'Latitud',      type:'number',required:true,  step:'any',colHalf:true},
            {id:'mufa_lng',       label:'Longitud',     type:'number',required:true, step:'any',colHalf:true},
        ],
        SECTOR:[
            {id:'sector_codigo',      label:'Código',  type:'text',   required:true,  placeholder:'Ej: SECTOR-01'},
            {id:'sector_prefijo',     label:'Prefijo', type:'text',   required:true,  placeholder:'Ej: S01'},
            {id:'sector_lat',         label:'Lat Centro',  type:'number', required:false, step:'any', hidden:true},
            {id:'sector_lng',         label:'Lng Centro',  type:'number', required:false, step:'any', hidden:true},
            {id:'sector_coordenadas', label:'Coordenadas', type:'text',   required:false, hidden:true},
        ],
        FIBRA: [
            {id:'fibra_codigo',  label:'Código',       type:'text',  required:true,  placeholder:'Ej: FIBRA-001'},
            {id:'fibra_capacidad',label:'Capacidad (F)',type:'select',required:true,  options:[1,4,6,8,12,24,36,48,60,72,96,120,144]},
            {id:'fibra_lat_i',   label:'Lat Inicio',   type:'number',required:true,  step:'any',colHalf:true},
            {id:'fibra_lng_i',   label:'Lng Inicio',   type:'number',required:true, step:'any',colHalf:true},
            {id:'fibra_lat_f',   label:'Lat Fin',      type:'number',required:false, step:'any',colHalf:true,placeholder:'Opcional'},
            {id:'fibra_lng_f',   label:'Lng Fin',      type:'number',required:false, step:'any',colHalf:true,placeholder:'Opcional'},
            {id:'fibra_coordenadas_ruta', label:'Ruta', type:'text', required:false, hidden:true},
            {id:'fibra_hub_id',           label:'Hub',  type:'text', required:false, hidden:true},
            {id:'fibra_tubo_color',       label:'Color Tubo',  type:'text', required:false, hidden:true},
            {id:'fibra_hilo_color',       label:'Color Hilo',  type:'text', required:false, hidden:true},
        ],
    };

    let currentModalType=null, currentModalItem=null;

    // ── Paleta estándar ITU-T de 12 colores (tubos y hilos) ──────────────
    const FIBER_COLORS = [
        { id:1,  name:'Azul',    hex:'#1d6ef5' },
        { id:2,  name:'Naranja', hex:'#f97316' },
        { id:3,  name:'Verde',   hex:'#22c55e' },
        { id:4,  name:'Marrón',  hex:'#92400e' },
        { id:5,  name:'Gris',    hex:'#6b7280' },
        { id:6,  name:'Blanco',  hex:'#f0f0f0', border:'#aaa' },
        { id:7,  name:'Rojo',    hex:'#ef4444' },
        { id:8,  name:'Negro',   hex:'#111827' },
        { id:9,  name:'Amarillo',hex:'#facc15' },
        { id:10, name:'Violeta', hex:'#7c3aed' },
        { id:11, name:'Rosa',    hex:'#f472b6' },
        { id:12, name:'Aqua',    hex:'#06b6d4' },
    ];

    const buildFibraColorPicker = (existingTubo, existingHilo, capacidad) => {
        const cap = parseInt(capacidad) || 12;
        const numTubes = Math.min(Math.ceil(cap / 12), 12);
        const isSingleFiber = (cap === 1);

        let html = `<div class="fibra-color-picker" id="fibraColorPicker">`;

        if (isSingleFiber) {
            html += `<div class="fibra-picker-label">Fibra cliente (1F) — Selecciona color de hilo:</div>`;
            html += `<div class="fibra-swatch-row" id="hiloSwatchRow">`;
            FIBER_COLORS.forEach(c => {
                const sel = existingHilo === c.name ? 'selected' : '';
                const border = c.border ? `border-color:${c.border};` : '';
                html += `<button type="button" class="fiber-swatch ${sel}" data-color="${c.name}" data-target="hilo"
                    style="background:${c.hex};${border}" title="${c.name}"></button>`;
            });
            html += `</div>`;
            html += `<div class="fibra-selected-info" id="hiloSelectedInfo">${existingHilo ? `Hilo: <strong>${existingHilo}</strong>` : 'Sin seleccionar'}</div>`;
        } else {
            html += `<div class="fibra-picker-label">Tubos disponibles (${numTubes} de 12) — Selecciona el tubo:</div>`;
            html += `<div class="fibra-swatch-row" id="tuboSwatchRow">`;
            for (let i = 0; i < numTubes; i++) {
                const c = FIBER_COLORS[i];
                const sel = existingTubo === c.name ? 'selected' : '';
                const border = c.border ? `border-color:${c.border};` : '';
                html += `<button type="button" class="fiber-swatch ${sel}" data-color="${c.name}" data-coloridx="${i}" data-target="tubo"
                    style="background:${c.hex};${border}" title="Tubo ${i+1}: ${c.name} (Hilos ${i*12+1}-${i*12+12})"></button>`;
            }
            html += `</div>`;
            html += `<div class="fibra-selected-info" id="tuboSelectedInfo">${existingTubo ? `Tubo: <strong>${existingTubo}</strong>` : 'Elige un tubo para ver sus hilos'}</div>`;

            const hilosVisible = existingTubo ? 'block' : 'none';
            html += `<div class="fibra-hilos-section" id="hilosSection" style="display:${hilosVisible}">`;
            html += `<div class="fibra-picker-label" style="margin-top:0.6rem;">Hilos del tubo — Selecciona el hilo:</div>`;
            html += `<div class="fibra-swatch-row" id="hiloSwatchRow">`;
            FIBER_COLORS.forEach(c => {
                const sel = existingHilo === c.name ? 'selected' : '';
                const border = c.border ? `border-color:${c.border};` : '';
                html += `<button type="button" class="fiber-swatch ${sel}" data-color="${c.name}" data-target="hilo"
                    style="background:${c.hex};${border}" title="Hilo ${c.id}: ${c.name}"></button>`;
            });
            html += `</div>`;
            html += `<div class="fibra-selected-info" id="hiloSelectedInfo">${existingHilo ? `Hilo: <strong>${existingHilo}</strong>` : 'Sin seleccionar'}</div>`;
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    };

    const buildModalFields = (tipo, lat, lng, existingItem, polygonPts) => {
        const fields=FIELD_SCHEMAS[tipo]||[];
        let html=''; let halfBuf=[];
        const flushHalves=()=>{
            if(halfBuf.length>0){html+=`<div class="org-form-coords">`;halfBuf.forEach(f=>{html+=buildField(f);});html+=`</div>`;halfBuf=[];}
        };
        // Indicador visual para SECTOR
        if (tipo === 'SECTOR') {
            const pts = polygonPts || (existingItem && existingItem.extra?.coordenadas ? (() => { try { return JSON.parse(existingItem.extra.coordenadas); } catch(e) { return null; } })() : null);
            const nv = pts ? pts.length : 0;
            const color = nv >= 3 ? '#059669' : '#f97316';
            const msg   = nv >= 3 ? `Polígono con ${nv} vértices definido` : 'Dibuja el área en el mapa (clic a clic, doble clic para cerrar)';
            html += `<div style="background:${color}18;border:1px solid ${color}40;border-radius:8px;padding:0.6rem 0.85rem;margin-bottom:0.75rem;font-size:0.78rem;color:${color};display:flex;align-items:center;gap:0.5rem;">`
                  + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;flex-shrink:0;"><polygon points="3 11 12 3 21 11 21 21 3 21"/></svg>`
                  + `<span>${msg}</span></div>`;
        }
        fields.forEach(f=>{
            if (f.hidden) { html += buildField(f); return; }
            if(f.colHalf){halfBuf.push(f);if(halfBuf.length===2)flushHalves();}
            else{flushHalves();html+=buildField(f);}
        });
        flushHalves();

        // ── Selector visual de colores para FIBRA ─────────────────────────
        if (tipo === 'FIBRA') {
            const capVal = existingItem?.extra?.capacidad || 12;
            const tuboVal = existingItem?.extra?.tubo_color || '';
            const hiloVal = existingItem?.extra?.hilo_color || '';
            html += buildFibraColorPicker(tuboVal, hiloVal, capVal);
        }

        return html;

        function buildField(f){
            if (f.hidden) {
                let val = '';
                if (f.id === 'sector_coordenadas') {
                    if (polygonPts) val = JSON.stringify(polygonPts);
                    else if (existingItem && existingItem.extra?.coordenadas) val = existingItem.extra.coordenadas;
                }
                if (f.id === 'sector_lat')  val = (lat != null && lat !== '') ? parseFloat(lat).toFixed(7) : '';
                if (f.id === 'sector_lng')  val = (lng != null && lng !== '') ? parseFloat(lng).toFixed(7) : '';
                if (f.id === 'fibra_coordenadas_ruta') {
                    if (polygonPts) val = JSON.stringify(polygonPts);
                    else if (existingItem && existingItem.extra?.coordenadas_ruta) val = existingItem.extra.coordenadas_ruta;
                }
                if (f.id === 'fibra_hub_id') {
                    if (window.selectedHubId) val = window.selectedHubId;
                    else if (existingItem && existingItem.extra?.hub_id) val = existingItem.extra.hub_id;
                }
                if (f.id === 'fibra_tubo_color') val = existingItem?.extra?.tubo_color || '';
                if (f.id === 'fibra_hilo_color') val = existingItem?.extra?.hilo_color || '';
                return `<input type="hidden" id="${f.id}" name="${f.id}" value="${val}">`;
            }
            const req=f.required?'required':'';
            const ph=f.placeholder?`placeholder="${f.placeholder}"`:'';
            const step=f.step?`step="${f.step}"`:'';
            let val='';
            if(f.id.endsWith('_lat')||f.id.endsWith('_lat_i')) val=lat?parseFloat(lat).toFixed(7):'';
            if(f.id.endsWith('_lng')||f.id.endsWith('_lng_i')) val=lng?parseFloat(lng).toFixed(7):'';
            if(f.id.endsWith('_lat_f')) val=(polygonPts && polygonPts.length > 0)?parseFloat(polygonPts[polygonPts.length - 1][0]).toFixed(7):'';
            if(f.id.endsWith('_lng_f')) val=(polygonPts && polygonPts.length > 0)?parseFloat(polygonPts[polygonPts.length - 1][1]).toFixed(7):'';
            if(existingItem){
                const mapeo={
                    sede_nombre:existingItem.codigo, hub_codigo:existingItem.codigo, nap_codigo:existingItem.codigo,
                    mufa_codigo:existingItem.codigo, sector_codigo:existingItem.codigo, fibra_codigo:existingItem.codigo,
                    nap_puertos:existingItem.extra?.puertos, mufa_capacidad:existingItem.extra?.capacidad,
                    sector_prefijo:existingItem.extra?.prefijo,
                    fibra_capacidad:existingItem.extra?.capacidad,
                };
                if(mapeo[f.id]!==undefined) val=mapeo[f.id]||'';
                if(f.id.endsWith('_lat')||f.id.endsWith('_lat_i')) val=parseFloat(existingItem.lat).toFixed(7);
                if(f.id.endsWith('_lng')||f.id.endsWith('_lng_i')) val=parseFloat(existingItem.lng).toFixed(7);
            }
            if (f.type === 'select') {
                return `<div class="org-form-group"><label class="org-form-label" for="${f.id}">${f.label}${f.required?' *':''}</label>`
                    + `<select class="org-form-input" id="${f.id}" name="${f.id}" ${req}>`
                    + (f.options||[]).map(o => `<option value="${o}"${val==o?' selected':''}>${o}F${o==1?' (Cliente)':o<=12?' (1 tubo)':' ('+Math.ceil(o/12)+' tubos)'}</option>`).join('')
                    + `</select></div>`;
            }
            return `<div class="org-form-group"><label class="org-form-label" for="${f.id}">${f.label}${f.required?' *':''}</label><input class="org-form-input" type="${f.type}" id="${f.id}" name="${f.id}" value="${val}" ${ph} ${step} ${req} autocomplete="off"></div>`;
        }
    };

    window.openModal = (tipo, lat, lng, existingItem, polygonPts) => {
        if (tipo === 'SEDE' && existingItem) {
            window.openSedeConfig(existingItem.dbId);
            return;
        }
        currentModalType=tipo; currentModalItem=existingItem;
        const cfg=window.TIPO_CONFIG[tipo];
        modalTitle.textContent = existingItem ? `Editar ${cfg.label}` : `Añadir ${cfg.label}`;
        titleDot.style.backgroundColor=cfg.color;
        modalBody.innerHTML=buildModalFields(tipo,lat,lng,existingItem,polygonPts||null);
        overlay.classList.add('open');
        // Para SECTOR en edición: mostrar polígono existente en mapa temporalmente
        if (tipo === 'SECTOR' && existingItem && existingItem.extra?.coordenadas) {
            try {
                const pts = JSON.parse(existingItem.extra.coordenadas);
                if (pts && pts.length > 2) {
                    if (window.tempMarker) { window.map.removeLayer(window.tempMarker); }
                    window.tempMarker = L.polygon(pts, {
                        color: '#6366f1', weight: 2, dashArray: '6 4',
                        fillColor: '#818cf8', fillOpacity: 0.25
                    }).addTo(window.map);
                    window.map.fitBounds(window.tempMarker.getBounds(), {padding:[30,30]});
                }
            } catch(e) {}
        }
        setTimeout(()=>{ modalBody.querySelector('input:not([type=hidden])')?.focus(); },150);
    };

    const closeModal = () => {
        overlay.classList.remove('open');
        currentModalType=null; currentModalItem=null;
        if(window.tempMarker){window.map.removeLayer(window.tempMarker);window.tempMarker=null;}
    };

    // ── Lógica interactiva del selector de colores de fibra ──────────────
    modalBody.addEventListener('click', e => {
        const sw = e.target.closest('.fiber-swatch');
        if (!sw) return;
        e.preventDefault();
        const target = sw.dataset.target;
        const colorName = sw.dataset.color;

        if (target === 'tubo') {
            document.querySelectorAll('#tuboSwatchRow .fiber-swatch').forEach(b => b.classList.remove('selected'));
            sw.classList.add('selected');
            const inp = document.getElementById('fibra_tubo_color');
            if (inp) inp.value = colorName;
            const info = document.getElementById('tuboSelectedInfo');
            const colorIdx = parseInt(sw.dataset.coloridx);
            const start = colorIdx * 12 + 1;
            const end   = colorIdx * 12 + 12;
            if (info) info.innerHTML = `Tubo: <strong>${colorName}</strong> — Hilos ${start}–${end}`;
            const hilosSection = document.getElementById('hilosSection');
            if (hilosSection) {
                hilosSection.style.display = 'block';
                document.querySelectorAll('#hiloSwatchRow .fiber-swatch').forEach(b => b.classList.remove('selected'));
                const hiloInp = document.getElementById('fibra_hilo_color');
                if (hiloInp) hiloInp.value = '';
                const hiloInfo = document.getElementById('hiloSelectedInfo');
                if (hiloInfo) hiloInfo.innerHTML = 'Sin seleccionar';
            }
        } else if (target === 'hilo') {
            document.querySelectorAll('#hiloSwatchRow .fiber-swatch').forEach(b => b.classList.remove('selected'));
            sw.classList.add('selected');
            const inp = document.getElementById('fibra_hilo_color');
            if (inp) inp.value = colorName;
            const info = document.getElementById('hiloSelectedInfo');
            if (info) info.innerHTML = `Hilo: <strong>${colorName}</strong>`;
        }
    });

    modalBody.addEventListener('change', e => {
        if (e.target.id !== 'fibra_capacidad') return;
        const picker = document.getElementById('fibraColorPicker');
        if (!picker) return;
        const newCap = parseInt(e.target.value) || 12;
        const tuboVal = document.getElementById('fibra_tubo_color')?.value || '';
        const hiloVal = document.getElementById('fibra_hilo_color')?.value || '';
        picker.outerHTML;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = buildFibraColorPicker(tuboVal, hiloVal, newCap);
        picker.replaceWith(tempDiv.firstChild);
    });

    document.getElementById('orgModalClose')?.addEventListener('click', closeModal);
    document.getElementById('orgModalCancel')?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });

    const parseCoordPoints = (coordStr) => {
        if (!coordStr) return [];
        try {
            const pts = JSON.parse(coordStr);
            return Array.isArray(pts) ? pts : [];
        } catch (e) {
            return [];
        }
    };

    const handleModalSave = async () => {
        const tipo = currentModalType;
        if (!tipo) return;

        const formData = {};
        modalBody.querySelectorAll('input, select').forEach(el => { formData[el.name] = el.value; });

        const requiredFields = FIELD_SCHEMAS[tipo].filter(f => f.required);
        const empty = requiredFields.filter(f => !formData[f.id]);
        if (empty.length > 0) {
            empty.forEach(f => {
                const el = document.getElementById(f.id);
                if (el) {
                    el.style.borderColor = 'var(--danger)';
                    el.style.boxShadow = '0 0 0 3px var(--danger-glow)';
                }
            });
            setTimeout(() => {
                empty.forEach(f => {
                    const el = document.getElementById(f.id);
                    if (el) { el.style.borderColor = ''; el.style.boxShadow = ''; }
                });
            }, 2000);
            alert(`Completa los campos obligatorios: ${empty.map(f => f.label).join(', ')}`);
            return;
        }

        if (tipo === 'SECTOR' && !currentModalItem) {
            const pts = parseCoordPoints(formData.sector_coordenadas);
            if (pts.length < 3) {
                alert('Primero dibuja el área del sector en el mapa:\n\n1. Cierra este modal\n2. Haz clic para agregar vértices\n3. Pulsa Guardar o doble clic para abrir este formulario');
                return;
            }
        }

        if (tipo === 'FIBRA' && !currentModalItem) {
            const pts = parseCoordPoints(formData.fibra_coordenadas_ruta);
            if (pts.length < 2) {
                alert('Primero dibuja la ruta de la fibra en el mapa:\n\n1. Cierra este modal\n2. Haz clic para marcar waypoints\n3. Pulsa Guardar o doble clic para abrir este formulario');
                return;
            }
        }

        if (!btnSave) return;
        btnSave.disabled = true;
        btnSave.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;animation:spin 1s linear infinite;" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Guardando…`;
        try {
            const url = currentModalItem ? '/api/organizacion/actualizar/' : '/api/organizacion/guardar/';
            const body = { tipo, datos: formData };
            if (currentModalItem) body.id = currentModalItem.dbId;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.getCookie('csrftoken') },
                body: JSON.stringify(body)
            });
            const result = await resp.json();
            if (result.status === 'success') {
                closeModal();
                if (window.exitAddMode) window.exitAddMode();
                window.location.reload();
            } else {
                alert(`Error: ${result.message || 'Error desconocido'}`);
            }
        } catch (err) {
            alert('Error de conexión.');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Guardar`;
        }
    };

    btnSave?.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        handleModalSave();
    });

    // ══════════════════════════════════════════════════════════════════════
    // MODAL CONFIRMAR ELIMINACIÓN
    // ══════════════════════════════════════════════════════════════════════
    let pendingDeleteItem=null;
    const confirmOverlay=document.getElementById('confirmModalOverlay');

    window.openConfirmDelete = item => {
        pendingDeleteItem=item;
        document.getElementById('confirmModalText').textContent=`¿Eliminar ${window.TIPO_CONFIG[item.tipo]?.label} "${item.codigo}"? Esta acción no se puede deshacer.`;
        confirmOverlay.classList.add('open');
    };

    document.getElementById('confirmModalCancel')?.addEventListener('click', ()=>{ confirmOverlay.classList.remove('open'); pendingDeleteItem=null; });
    confirmOverlay?.addEventListener('click', e=>{ if(e.target===confirmOverlay){confirmOverlay.classList.remove('open');pendingDeleteItem=null;} });

    document.getElementById('confirmModalOk')?.addEventListener('click', async () => {
        if(!pendingDeleteItem) return;
        const item=pendingDeleteItem;
        confirmOverlay.classList.remove('open');
        try{
            const resp=await fetch('/api/organizacion/eliminar/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':window.getCookie('csrftoken')},body:JSON.stringify({tipo:item.tipo,id:item.dbId})});
            const result=await resp.json();
            if(result.status==='success') window.location.reload();
            else alert(`Error al eliminar: ${result.message}`);
        }catch(err){alert('Error de conexión al eliminar.');}
        pendingDeleteItem=null;
    });

});

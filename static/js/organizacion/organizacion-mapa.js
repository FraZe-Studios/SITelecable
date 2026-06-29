/**
 * organizacion-mapa.js
 * Lógica del mapa Leaflet, marcadores y dibujo de polígonos
 */

document.addEventListener('DOMContentLoaded', () => {

    // ══════════════════════════════════════════════════════════════════════
    // DATOS DE LA RED (se pasan desde el HTML principal)
    // ══════════════════════════════════════════════════════════════════════
    // RED_DATA se define en el HTML principal con las etiquetas de Django

    window.TIPO_CONFIG = {
        SEDE:   { color:'#ef4444', label:'Sede',   badgeClass:'badge-sede',   radius:10 },
        HUB:    { color:'#f59e0b', label:'Hub',    badgeClass:'badge-hub',    radius:9  },
        NAP:    { color:'#6366f1', label:'NAP',    badgeClass:'badge-nap',    radius:7  },
        MUFA:   { color:'#0ea5e9', label:'Mufa',   badgeClass:'badge-mufa',   radius:6  },
        SECTOR: { color:'#818cf8', label:'Sector', badgeClass:'badge-sector', radius:0  },
        FIBRA:  { color:'#f97316', label:'Fibra',  badgeClass:'badge-fibra',  radius:0  },
        CLIENTE:{ color:'#10b981', label:'Cliente', badgeClass:'badge-cliente',radius:5  },
    };

    // ══════════════════════════════════════════════════════════════════════
    // MAPA LEAFLET
    // ══════════════════════════════════════════════════════════════════════
    const mapEl = document.getElementById('org-map');
    let initLat=-12.0464, initLng=-77.0428, initZoom=13;
    if (window.RED_DATA.sedes.length)    { initLat=window.RED_DATA.sedes[0].latitud;    initLng=window.RED_DATA.sedes[0].longitud;    initZoom=15; }
    else if (window.RED_DATA.hubs.length){ initLat=window.RED_DATA.hubs[0].latitud;     initLng=window.RED_DATA.hubs[0].longitud;     initZoom=14; }

    window.map = L.map('org-map', { center: [initLat, initLng], zoom: initZoom, zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(window.map);
    L.control.zoom({ position: 'bottomright' }).addTo(window.map);

    // Icono SVG para marcadores
    const createIcon = tipo => {
        const cfg=window.TIPO_CONFIG[tipo];
        const sz=(cfg.radius*2)+6;
        return L.divIcon({
            html:`<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}"><circle cx="${sz/2}" cy="${sz/2}" r="${cfg.radius}" fill="${cfg.color}" stroke="white" stroke-width="2.5"/></svg>`,
            className:'', iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-(sz/2+4)]
        });
    };

    window.layerGroups = { SEDE:L.layerGroup().addTo(window.map), HUB:L.layerGroup().addTo(window.map), NAP:L.layerGroup().addTo(window.map), MUFA:L.layerGroup().addTo(window.map), SECTOR:L.layerGroup().addTo(window.map), FIBRA:L.layerGroup().addTo(window.map), CLIENTE:L.layerGroup().addTo(window.map) };

    // Popup HTML
    const buildPopup = (tipo, item) => {
        const cfg=window.TIPO_CONFIG[tipo];
        let rows='';
        if(item.codigo)   rows+=`<div class="popup-row"><span class="popup-label">Código</span><span class="popup-value">${item.codigo}</span></div>`;
        if(item.nombre)   rows+=`<div class="popup-row"><span class="popup-label">Nombre</span><span class="popup-value">${item.nombre}</span></div>`;
        if(item.latitud)  rows+=`<div class="popup-row"><span class="popup-label">Lat</span><span class="popup-value">${parseFloat(item.latitud).toFixed(6)}</span></div>`;
        if(item.longitud) rows+=`<div class="popup-row"><span class="popup-label">Lng</span><span class="popup-value">${parseFloat(item.longitud).toFixed(6)}</span></div>`;
        if(item.puertos)  rows+=`<div class="popup-row"><span class="popup-label">Puertos</span><span class="popup-value">${item.puertos}</span></div>`;
        if(item.capacidad)rows+=`<div class="popup-row"><span class="popup-label">Cap. Hilos</span><span class="popup-value">${item.capacidad}</span></div>`;
        
        // Información específica de clientes
        if(tipo === 'CLIENTE') {
            if(item.cliente_nombre) rows+=`<div class="popup-row"><span class="popup-label">Cliente</span><span class="popup-value">${item.cliente_nombre}</span></div>`;
            if(item.cliente_dni) rows+=`<div class="popup-row"><span class="popup-label">DNI</span><span class="popup-value">${item.cliente_dni}</span></div>`;
            if(item.codigo_cliente) rows+=`<div class="popup-row"><span class="popup-label">Cód. Cliente</span><span class="popup-value">${item.codigo_cliente}</span></div>`;
            if(item.codigo_servicio) rows+=`<div class="popup-row"><span class="popup-label">Cód. Servicio</span><span class="popup-value">${item.codigo_servicio}</span></div>`;
            if(item.direccion) rows+=`<div class="popup-row"><span class="popup-label">Dirección</span><span class="popup-value">${item.direccion}</span></div>`;
            if(item.sector_nombre) rows+=`<div class="popup-row"><span class="popup-label">Sector</span><span class="popup-value">${item.sector_nombre}</span></div>`;
            if(item.estado_servicio) rows+=`<div class="popup-row"><span class="popup-label">Estado</span><span class="popup-value" style="text-transform:uppercase; font-weight:bold; color:var(--primary);">${item.estado_servicio.replace('_', ' ')}</span></div>`;
        }
        
        let actions = '';
        if (tipo === 'SEDE' && item.id) {
            actions = `<div class="popup-actions" style="margin-top:8px; display:flex; gap:6px;"><button class="popup-action-btn edit-btn" onclick="window.editarSedePopup(${item.id})">Configurar Sede</button></div>`;
        }
        
        return `<div class="popup-header"><span style="width:9px;height:9px;border-radius:50%;background:${cfg.color};display:inline-block;flex-shrink:0;"></span>&nbsp;<strong>${item.codigo||item.nombre||item.cliente_nombre||'Sin nombre'}</strong></div><div class="popup-body">${rows}${actions}</div>`;
    };

    window.allTableItems = [];

    const addMarkerToTable = (tipo, codigo, lat, lng, marker, dbId=null, extra={}) => {
        window.allTableItems.push({ tipo, codigo, lat:parseFloat(lat), lng:parseFloat(lng), marker, dbId, extra,
            coords:`${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` });
    };

    // SEDES
    window.RED_DATA.sedes.forEach(s => {
        const m=L.marker([s.latitud,s.longitud],{icon:createIcon('SEDE')}).addTo(window.layerGroups.SEDE)
            .bindPopup(buildPopup('SEDE',{id:s.id,nombre:s.nombre,latitud:s.latitud,longitud:s.longitud}),{className:'org-popup'});
        addMarkerToTable('SEDE',s.nombre,s.latitud,s.longitud,m,s.id);
    });
    // HUBS
    window.RED_DATA.hubs.forEach(h => {
        const m=L.marker([h.latitud,h.longitud],{icon:createIcon('HUB')}).addTo(window.layerGroups.HUB)
            .bindPopup(buildPopup('HUB',{codigo:h.codigo,latitud:h.latitud,longitud:h.longitud}),{className:'org-popup'});
        addMarkerToTable('HUB',h.codigo,h.latitud,h.longitud,m,h.id);
    });
    // NAPS
    window.RED_DATA.naps.forEach(n => {
        const m=L.marker([n.latitud,n.longitud],{icon:createIcon('NAP')}).addTo(window.layerGroups.NAP)
            .bindPopup(buildPopup('NAP',{codigo:n.codigo,latitud:n.latitud,longitud:n.longitud,puertos:n.cantidad_puertos}),{className:'org-popup'});
        addMarkerToTable('NAP',n.codigo,n.latitud,n.longitud,m,n.id,{puertos:n.cantidad_puertos});
    });
    // MUFAS
    window.RED_DATA.mufas.forEach(u => {
        const m=L.marker([u.latitud,u.longitud],{icon:createIcon('MUFA')}).addTo(window.layerGroups.MUFA)
            .bindPopup(buildPopup('MUFA',{codigo:u.codigo,latitud:u.latitud,longitud:u.longitud,capacidad:u.capacidad_hilos}),{className:'org-popup'});
        addMarkerToTable('MUFA',u.codigo,u.latitud,u.longitud,m,u.id,{capacidad:u.capacidad_hilos});
    });
    // CLIENTES
    window.RED_DATA.clientes.forEach(c => {
        const m=L.marker([c.latitud,c.longitud],{icon:createIcon('CLIENTE')}).addTo(window.layerGroups.CLIENTE)
            .bindPopup(buildPopup('CLIENTE',{
                cliente_nombre:c.cliente_nombre,
                cliente_dni:c.cliente_dni,
                codigo_cliente:c.codigo_cliente,
                codigo_servicio:c.codigo_servicio,
                direccion:c.direccion,
                sector_nombre:c.sector_nombre,
                estado_servicio:c.estado_servicio,
                latitud:c.latitud,
                longitud:c.longitud
            }),{className:'org-popup'});
        addMarkerToTable('CLIENTE',c.codigo_cliente,c.latitud,c.longitud,m,c.id,{
            cliente_nombre:c.cliente_nombre,
            cliente_dni:c.cliente_dni,
            codigo_servicio:c.codigo_servicio,
            estado_servicio:c.estado_servicio
        });
    });

    // ── Utilidad: punto dentro de polígono (ray casting) ───────────────
    window.pointInPolygon = (lat, lng, polygonPoints) => {
        let inside = false;
        const n = polygonPoints.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygonPoints[i][0], yi = polygonPoints[i][1];
            const xj = polygonPoints[j][0], yj = polygonPoints[j][1];
            if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi))
                inside = !inside;
        }
        return inside;
    };

    // Construir popup enriquecido del sector
    const buildSectorPopup = (sec, polygonPoints) => {
        const cfg = window.TIPO_CONFIG['SECTOR'];
        let napsCount = 0;
        if (polygonPoints && polygonPoints.length > 2) {
            window.RED_DATA.naps.forEach(n => {
                if (window.pointInPolygon(parseFloat(n.latitud), parseFloat(n.longitud), polygonPoints))
                    napsCount++;
            });
        }
        const verticesInfo = polygonPoints && polygonPoints.length > 0
            ? `<div class="popup-row"><span class="popup-label">Vértices</span><span class="popup-value">${polygonPoints.length}</span></div>`
            : `<div class="popup-row"><span class="popup-label">Área</span><span class="popup-value" style="color:#f97316;">Sin polígono</span></div>`;
        const napsInfo = polygonPoints && polygonPoints.length > 2
            ? `<div class="popup-row"><span class="popup-label">NAPs dentro</span><span class="popup-value" style="color:#6366f1;font-weight:600;">${napsCount}</span></div>`
            : '';
        const actions = `
        <div class="popup-actions" style="margin-top: 8px; display: flex; gap: 6px;">
            <button class="popup-action-btn edit-btn" id="edit-btn-SECTOR-${sec.id}" onclick="window.editarVertices('SECTOR', ${sec.id})">Editar Vértice</button>
            <button class="popup-action-btn save-btn" id="save-btn-SECTOR-${sec.id}" style="display: none;" onclick="window.guardarVertices('SECTOR', ${sec.id})">Guardar Vértice</button>
        </div>`;
        return `<div class="popup-header"><span style="width:9px;height:9px;border-radius:2px;background:${cfg.color};display:inline-block;flex-shrink:0;"></span>&nbsp;<strong>${sec.codigo}</strong></div>`
            + `<div class="popup-body">`
            + `<div class="popup-row"><span class="popup-label">Prefijo</span><span class="popup-value">${sec.prefijo}</span></div>`
            + verticesInfo + napsInfo
            + `</div>`
            + actions;
    };

    // SECTORES — renderizar como polígono si tienen coordenadas
    window.RED_DATA.sectores.forEach(sec => {
        let polygonPoints = null;
        let m;
        if (sec.coordenadas) {
            try { polygonPoints = JSON.parse(sec.coordenadas); } catch(e) { polygonPoints = null; }
        }
        if (polygonPoints && polygonPoints.length > 2) {
            m = L.polygon(polygonPoints, {
                color: '#6366f1', weight: 2.5, dashArray: '7 4',
                fillColor: '#818cf8', fillOpacity: 0.18,
            }).addTo(window.layerGroups.SECTOR)
              .bindPopup(buildSectorPopup(sec, polygonPoints), {className:'org-popup'});
            const centLat = polygonPoints.reduce((a,p) => a + p[0], 0) / polygonPoints.length;
            const centLng = polygonPoints.reduce((a,p) => a + p[1], 0) / polygonPoints.length;
            addMarkerToTable('SECTOR', sec.codigo, centLat, centLng, m, sec.id, {prefijo: sec.prefijo, coordenadas: sec.coordenadas});
        } else {
            m = L.circleMarker([sec.latitud_centro, sec.longitud_centro], {
                radius: 14, color: '#6366f1', fillColor: '#818cf8',
                fillOpacity: 0.2, weight: 2, dashArray: '4 3'
            }).addTo(window.layerGroups.SECTOR)
              .bindPopup(buildSectorPopup(sec, null), {className:'org-popup'});
            addMarkerToTable('SECTOR', sec.codigo, sec.latitud_centro, sec.longitud_centro, m, sec.id, {prefijo: sec.prefijo, coordenadas: ''});
        }
    });

    // ── Helpers de distancia Haversine y ruta ──────────────────────────
    window.getHaversineDistance = (p1, p2) => {
        const R = 6371e3;
        const phi1 = p1[0] * Math.PI / 180;
        const phi2 = p2[0] * Math.PI / 180;
        const deltaPhi = (p2[0] - p1[0]) * Math.PI / 180;
        const deltaLambda = (p2[1] - p1[1]) * Math.PI / 180;

        const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
                  Math.cos(phi1) * Math.cos(phi2) *
                  Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    window.getRouteDistance = (pts) => {
        let total = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            total += window.getHaversineDistance(pts[i], pts[i+1]);
        }
        return total;
    };

    const buildFibraPopup = (f, pts) => {
        const cfg = window.TIPO_CONFIG['FIBRA'];
        const totalDist = window.getRouteDistance(pts);
        const distKm = (totalDist / 1000).toFixed(3);
        
        let rows = '';
        rows += `<div class="popup-row"><span class="popup-label">Código</span><span class="popup-value">${f.codigo_identificador || f.codigo}</span></div>`;
        rows += `<div class="popup-row"><span class="popup-label">Distancia</span><span class="popup-value">${distKm} km</span></div>`;
        rows += `<div class="popup-row"><span class="popup-label">Vértices</span><span class="popup-value">${pts.length}</span></div>`;
        if (f.capacidad) {
            const isCli = f.capacidad === 1;
            rows += `<div class="popup-row"><span class="popup-label">Capacidad</span><span class="popup-value" style="color:${isCli?'#6366f1':'#f97316'};font-weight:600;">${f.capacidad}F ${isCli?'(Cliente)':'(Infraestructura)'}</span></div>`;
        }
        if (f.hub_id) {
            const hubObj = window.RED_DATA.hubs.find(h => h.id == f.hub_id);
            if (hubObj) {
                rows += `<div class="popup-row"><span class="popup-label">HUB Origen</span><span class="popup-value">${hubObj.codigo}</span></div>`;
            }
        }
        
        const actions = `
        <div class="popup-actions" style="margin-top: 8px; display: flex; gap: 6px;">
            <button class="popup-action-btn edit-btn" id="edit-btn-FIBRA-${f.id}" onclick="window.editarVertices('FIBRA', ${f.id})">Editar Vértice</button>
            <button class="popup-action-btn save-btn" id="save-btn-FIBRA-${f.id}" style="display: none;" onclick="window.guardarVertices('FIBRA', ${f.id})">Guardar Vértice</button>
        </div>`;

        return `<div class="popup-header"><span style="width:9px;height:9px;border-radius:2px;background:${cfg.color};display:inline-block;flex-shrink:0;"></span>&nbsp;<strong>${f.codigo_identificador || f.codigo}</strong></div>`
            + `<div class="popup-body">${rows}</div>`
            + actions;
    };

    // FIBRAS
    window.RED_DATA.fibras.forEach(f => {
        let pts = null;
        if (f.coordenadas_ruta) {
            try { pts = JSON.parse(f.coordenadas_ruta); } catch(e) { pts = null; }
        }
        if (!pts || !Array.isArray(pts) || pts.length < 2) {
            pts = [[f.lat_inicio, f.lng_inicio], [f.lat_fin, f.lng_fin]];
        }
        const line=L.polyline(pts,{color:'#f97316',weight:3,opacity:0.85,dashArray:'8 4'})
            .addTo(window.layerGroups.FIBRA).bindPopup(buildFibraPopup(f, pts),{className:'org-popup'});
        addMarkerToTable('FIBRA', f.codigo_identificador || f.codigo, f.lat_inicio, f.lng_inicio, line, f.id, { coordenadas_ruta: f.coordenadas_ruta, hub_id: f.hub_id, capacidad: f.capacidad });
    });

    // Ajustar mapa
    document.getElementById('btnFitMap')?.addEventListener('click', () => {
        const bounds=window.allTableItems.map(i=>[i.lat,i.lng]);
        if (bounds.length) window.map.fitBounds(bounds, {padding:[40,40]});
    });

    // Leyenda → toggle capas
    document.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('active');
            const lg=window.layerGroups[item.dataset.filter];
            if (!lg) return;
            item.classList.contains('active') ? window.map.addLayer(lg) : window.map.removeLayer(lg);
        });
    });

});

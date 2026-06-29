/**
 * organizacion-add-mode.js
 * Lógica del modo añadir elemento al mapa
 */

document.addEventListener('DOMContentLoaded', () => {

    let addMode=false, selectedType=null, tempMarker=null;
    let drawingPolygon = false;
    let drawingFibra = false;
    let polygonVertices = [];
    let polygonPreviewLayer = null;
    let polygonDotLayers = [];

    const addTypePanel   = document.getElementById('addTypePanel');
    const addIndicator   = document.getElementById('mapAddIndicator');
    const btnAddElement  = document.getElementById('btnAddElement');
    const mapEl = document.getElementById('org-map');

    const cancelPolygonDraw = () => {
        drawingPolygon = false;
        polygonVertices = [];
        if (polygonPreviewLayer) { window.map.removeLayer(polygonPreviewLayer); polygonPreviewLayer = null; }
        polygonDotLayers.forEach(d => window.map.removeLayer(d));
        polygonDotLayers = [];
        window.map.doubleClickZoom.enable();
        const btn = document.getElementById('btnGuardarDibujo');
        if (btn) btn.style.display = 'none';
    };

    const cancelFibraDraw = () => {
        drawingFibra = false;
        polygonVertices = [];
        if (polygonPreviewLayer) { window.map.removeLayer(polygonPreviewLayer); polygonPreviewLayer = null; }
        polygonDotLayers.forEach(d => window.map.removeLayer(d));
        polygonDotLayers = [];
        document.getElementById('distancePanel').style.display = 'none';
        window.map.doubleClickZoom.enable();
        const btn = document.getElementById('btnGuardarDibujo');
        if (btn) btn.style.display = 'none';
        window.allTableItems.forEach(item => {
            if (item.tipo === 'HUB') {
                const el = item.marker.getElement();
                if (el) el.classList.remove('hub-pulse');
            }
        });
    };

    const enterAddMode = () => { addMode=true; addTypePanel.classList.add('visible'); btnAddElement.classList.add('add-mode-active'); };
    const exitAddMode  = () => {
        addMode=false; selectedType=null;
        cancelPolygonDraw();
        cancelFibraDraw();
        addTypePanel.classList.remove('visible');
        addIndicator.classList.remove('visible');
        btnAddElement.classList.remove('add-mode-active');
        mapEl.classList.remove('add-mode');
        document.querySelectorAll('.add-type-btn').forEach(b=>b.classList.remove('selected-type'));
        if(tempMarker){window.map.removeLayer(tempMarker);tempMarker=null;}
    };

    window.exitAddMode = exitAddMode;

    btnAddElement?.addEventListener('click', () => addMode ? exitAddMode() : enterAddMode());
    document.getElementById('cancelAddBtn')?.addEventListener('click', exitAddMode);

    const updateDistancePanel = (pts) => {
        const routeEl = document.getElementById('dpRuta');
        const holguraEl = document.getElementById('dpHolgura');
        const pctEl = document.getElementById('dpPct');
        if (!routeEl || !holguraEl || !pctEl) return;
        
        if (pts.length < 2) {
            routeEl.textContent = '0.00 km';
            holguraEl.textContent = '0.00 km';
            return;
        }
        
        const dist = window.getRouteDistance(pts);
        const distKm = (dist / 1000).toFixed(3);
        const pct = parseFloat(pctEl.value) || 0;
        const distHolguraKm = ((dist * (1 + pct / 100)) / 1000).toFixed(3);
        
        routeEl.textContent = `${distKm} km`;
        holguraEl.textContent = `${distHolguraKm} km`;
    };

    window.updateDistancePanel = updateDistancePanel;

    document.getElementById('dpPct')?.addEventListener('input', () => {
        if (selectedType === 'FIBRA' && drawingFibra) {
            updateDistancePanel(polygonVertices);
        } else if (window.activeEditLayer && window.activeEditType === 'FIBRA') {
            const latlngs = window.activeEditLayer.getLatLngs();
            const pts = latlngs.map(ll => [ll.lat, ll.lng]);
            updateDistancePanel(pts);
        }
    });

    document.querySelectorAll('.add-type-btn[data-add-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedType=btn.dataset.addType;
            cancelPolygonDraw();
            cancelFibraDraw();
            document.querySelectorAll('.add-type-btn').forEach(b=>b.classList.remove('selected-type'));
            btn.classList.add('selected-type');
            mapEl.classList.add('add-mode');
            addIndicator.classList.add('visible');
            if (selectedType === 'SECTOR') {
                document.getElementById('addIndicatorText').textContent = 'Clic para añadir vértices — luego Guardar o doble clic para cerrar';
                drawingPolygon = true;
                polygonVertices = [];
                window.map.doubleClickZoom.disable();
            } else if (selectedType === 'FIBRA') {
                document.getElementById('addIndicatorText').textContent = 'Selecciona el HUB de origen (clic cerca de un HUB para conectar)';
                drawingFibra = true;
                polygonVertices = [];
                window.selectedHubId = null;
                window.map.doubleClickZoom.disable();
                document.getElementById('distancePanel').style.display = 'flex';
                updateDistancePanel([]);
                
                window.allTableItems.forEach(item => {
                    if (item.tipo === 'HUB') {
                        const el = item.marker.getElement();
                        if (el) el.classList.add('hub-pulse');
                    }
                });
            } else {
                document.getElementById('addIndicatorText').textContent = `Clic en el mapa para añadir ${window.TIPO_CONFIG[selectedType]?.label||selectedType}`;
                drawingPolygon = false;
                drawingFibra = false;
            }
        });
    });

    const updatePolygonPreview = () => {
        if (polygonPreviewLayer) window.map.removeLayer(polygonPreviewLayer);
        if (polygonVertices.length < 2) return;
        
        if (selectedType === 'SECTOR') {
            const pts = polygonVertices.length >= 3
                ? [...polygonVertices, polygonVertices[0]]
                : polygonVertices;
            polygonPreviewLayer = L.polyline(pts, {
                color: '#6366f1', weight: 2.5, dashArray: '6 4', opacity: 0.85
            }).addTo(window.map);
        } else if (selectedType === 'FIBRA') {
            polygonPreviewLayer = L.polyline(polygonVertices, {
                color: '#f97316', weight: 3, opacity: 0.85, dashArray: '8 4'
            }).addTo(window.map);
        }
    };

    // Clic en el mapa
    window.map.on('click', e => {
        if (!addMode || !selectedType) return;

        if (selectedType === 'SECTOR' && drawingPolygon) {
            const latlng = e.latlng;
            polygonVertices.push([latlng.lat, latlng.lng]);
            const dot = L.circleMarker(latlng, {
                radius: 5, color: '#6366f1', fillColor: '#818cf8', fillOpacity: 1, weight: 2
            }).addTo(window.map);
            polygonDotLayers.push(dot);
            updatePolygonPreview();
            document.getElementById('addIndicatorText').textContent =
                `${polygonVertices.length} vértice${polygonVertices.length>1?'s':''} fijado(s)`;
            const btnGuardar = document.getElementById('btnGuardarDibujo');
            if (polygonVertices.length >= 3) {
                btnGuardar.style.display = 'inline-flex';
                document.getElementById('addIndicatorText').textContent =
                    `${polygonVertices.length} vértices — pulsa Guardar o doble clic para continuar`;
            } else {
                btnGuardar.style.display = 'none';
            }
            return;
        }

        if (selectedType === 'FIBRA' && drawingFibra) {
            const latlng = e.latlng;
            let coords = [latlng.lat, latlng.lng];
            
            if (polygonVertices.length === 0) {
                let closestHub = null;
                let minDistance = Infinity;
                window.RED_DATA.hubs.forEach(h => {
                    const dist = window.getHaversineDistance([latlng.lat, latlng.lng], [h.latitud, h.longitud]);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestHub = h;
                    }
                });
                
                if (minDistance <= 30) {
                    coords = [closestHub.latitud, closestHub.longitud];
                    window.selectedHubId = closestHub.id;
                    document.getElementById('addIndicatorText').textContent = `Conectado a HUB: ${closestHub.codigo}.`;
                } else {
                    window.selectedHubId = null;
                    document.getElementById('addIndicatorText').textContent = 'Inicio fijado (sin HUB cercano).';
                }
            } else {
                document.getElementById('addIndicatorText').textContent = `${polygonVertices.length + 1} waypoint(s) fijado(s)`;
            }
            
            polygonVertices.push(coords);
            const dot = L.circleMarker(coords, {
                radius: 4, color: '#f97316', fillColor: '#ea580c', fillOpacity: 1, weight: 2
            }).addTo(window.map);
            polygonDotLayers.push(dot);
            updatePolygonPreview();
            updateDistancePanel(polygonVertices);
            
            const btnGuardar = document.getElementById('btnGuardarDibujo');
            if (polygonVertices.length >= 2) {
                btnGuardar.style.display = 'inline-flex';
                document.getElementById('addIndicatorText').textContent =
                    `${polygonVertices.length} waypoint(s) — pulsa Guardar o doble clic para continuar`;
            } else {
                btnGuardar.style.display = 'none';
            }
            return;
        }

        // Otros tipos: marcador simple
        if(tempMarker){window.map.removeLayer(tempMarker);}
        tempMarker=L.circleMarker(e.latlng,{radius:8,color:window.TIPO_CONFIG[selectedType].color,fillColor:window.TIPO_CONFIG[selectedType].color,fillOpacity:0.4,weight:2}).addTo(window.map);
        window.openModal(selectedType, e.latlng.lat, e.latlng.lng, null);
    });

    const finalizeDrawing = () => {
        if (!addMode || !selectedType) return false;

        if (selectedType === 'SECTOR' && drawingPolygon) {
            if (polygonVertices.length < 3) {
                alert('Necesitas al menos 3 vértices para definir un área. Sigue haciendo clic en el mapa.');
                return false;
            }
            const centLat = polygonVertices.reduce((a, p) => a + p[0], 0) / polygonVertices.length;
            const centLng = polygonVertices.reduce((a, p) => a + p[1], 0) / polygonVertices.length;
            window.openModal('SECTOR', centLat, centLng, null, [...polygonVertices]);
            return true;
        }

        if (selectedType === 'FIBRA' && drawingFibra) {
            if (polygonVertices.length < 2) {
                alert('Necesitas al menos 2 puntos para definir una fibra. Sigue haciendo clic en el mapa.');
                return false;
            }
            window.openModal('FIBRA', polygonVertices[0][0], polygonVertices[0][1], null, [...polygonVertices]);
            return true;
        }

        return false;
    };

    document.getElementById('btnGuardarDibujo')?.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        finalizeDrawing();
    });

    // Doble clic en el mapa → cerrar polígono o terminar línea
    window.map.on('dblclick', e => {
        if (!addMode || !selectedType) return;
        if (selectedType === 'SECTOR' || selectedType === 'FIBRA') {
            L.DomEvent.stopPropagation(e);
            finalizeDrawing();
        }
    });

});

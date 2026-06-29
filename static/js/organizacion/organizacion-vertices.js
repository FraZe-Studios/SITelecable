/**
 * organizacion-vertices.js
 * Lógica de edición de vértices (sector y fibra)
 */

document.addEventListener('DOMContentLoaded', () => {

    window.editarVertices = (tipo, id) => {
        const item = window.allTableItems.find(x => x.tipo === tipo && x.dbId === id);
        if (!item) {
            alert("No se encontró el elemento para editar.");
            return;
        }
        
        if (window.activeEditLayer) {
            window.activeEditLayer.editing.disable();
            if (window.editInterval) {
                clearInterval(window.editInterval);
                window.editInterval = null;
            }
        }
        
        const layer = item.marker;
        window.activeEditLayer = layer;
        window.activeEditType = tipo;
        window.activeEditId = id;
        
        layer.editing.enable();
        
        const editBtn = document.getElementById(`edit-btn-${tipo}-${id}`);
        const saveBtn = document.getElementById(`save-btn-${tipo}-${id}`);
        if (editBtn) editBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'inline-flex';
        
        if (tipo === 'FIBRA') {
            document.getElementById('distancePanel').style.display = 'flex';
            
            const updateDistance = () => {
                if (window.activeEditLayer && window.activeEditType === 'FIBRA') {
                    const latlngs = window.activeEditLayer.getLatLngs();
                    const pts = latlngs.map(ll => [ll.lat, ll.lng]);
                    window.updateDistancePanel(pts);
                }
            };
            updateDistance();
            window.editInterval = setInterval(updateDistance, 150);
        }
    };

    window.guardarVertices = async (tipo, id) => {
        if (!window.activeEditLayer || window.activeEditType !== tipo || window.activeEditId !== id) {
            alert("No hay una edición activa para este elemento.");
            return;
        }
        
        const layer = window.activeEditLayer;
        layer.editing.disable();
        if (window.editInterval) {
            clearInterval(window.editInterval);
            window.editInterval = null;
        }
        
        document.getElementById('distancePanel').style.display = 'none';
        
        if (tipo === 'SECTOR') {
            let latlngs = layer.getLatLngs();
            if (latlngs.length && Array.isArray(latlngs[0])) {
                latlngs = latlngs[0];
            }
            const coords = latlngs.map(ll => [ll.lat, ll.lng]);
            
            if (coords.length < 3) {
                alert('El polígono debe tener al menos 3 vértices.');
                layer.editing.enable();
                return;
            }
            
            try {
                const saveBtn = document.getElementById(`save-btn-SECTOR-${id}`);
                if (saveBtn) saveBtn.disabled = true;
                
                const resp = await fetch('/api/organizacion/vertices-sector/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': window.getCookie('csrftoken')
                    },
                    body: JSON.stringify({ id: id, coordenadas: coords })
                });
                const res = await resp.json();
                if (res.status === 'success') {
                    alert(`Sector actualizado. NAPs asociadas dentro del área: ${res.naps_actualizadas}`);
                    window.location.reload();
                } else {
                    alert('Error al guardar: ' + res.message);
                    layer.editing.enable();
                }
            } catch (e) {
                alert('Error de red al intentar guardar los vértices.');
                layer.editing.enable();
            } finally {
                const saveBtn = document.getElementById(`save-btn-SECTOR-${id}`);
                if (saveBtn) saveBtn.disabled = false;
            }
        } else if (tipo === 'FIBRA') {
            const latlngs = layer.getLatLngs();
            const coords = latlngs.map(ll => [ll.lat, ll.lng]);
            
            if (coords.length < 2) {
                alert('La fibra debe tener al menos 2 puntos.');
                layer.editing.enable();
                return;
            }
            
            const totalDist = window.getRouteDistance(coords);
            const backupKey = 'fibra_backup_' + id;
            
            localStorage.setItem(backupKey, JSON.stringify({
                id: id,
                coordenadas_ruta: coords,
                distancia_m: totalDist,
                timestamp: Date.now()
            }));
            
            try {
                const saveBtn = document.getElementById(`save-btn-FIBRA-${id}`);
                if (saveBtn) saveBtn.disabled = true;
                
                let snappedHubId = null;
                let minDistance = Infinity;
                window.RED_DATA.hubs.forEach(h => {
                    const dist = window.getHaversineDistance(coords[0], [h.latitud, h.longitud]);
                    if (dist < minDistance) {
                        minDistance = dist;
                        snappedHubId = h.id;
                    }
                });
                const hub_id = (minDistance <= 30) ? snappedHubId : null;

                const resp = await fetch('/api/organizacion/vertices-fibra/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': window.getCookie('csrftoken')
                    },
                    body: JSON.stringify({ id: id, coordenadas_ruta: coords, distancia_m: totalDist, hub_id: hub_id })
                });
                
                const res = await resp.json();
                if (res.status === 'success') {
                    localStorage.removeItem(backupKey);
                    alert('Fibra guardada correctamente en el servidor.');
                    window.location.reload();
                } else {
                    throw new Error(res.message || 'Error desconocido');
                }
            } catch (err) {
                const popupNode = layer.getPopup().getElement();
                if (popupNode) {
                    const popupBody = popupNode.querySelector('.popup-body');
                    if (popupBody) {
                        const existing = popupBody.querySelector('.failsafe-alert');
                        if (existing) existing.remove();
                        
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'failsafe-alert';
                        alertDiv.innerHTML = `
                            <span><strong>Error al guardar:</strong> Los datos se guardaron localmente.</span>
                            <button onclick="window.reintentarGuardarFibra(${id})">Reintentar</button>
                        `;
                        popupBody.appendChild(alertDiv);
                    }
                }
            } finally {
                const saveBtn = document.getElementById(`save-btn-FIBRA-${id}`);
                if (saveBtn) saveBtn.disabled = false;
            }
        }
        
        window.activeEditLayer = null;
        window.activeEditType = null;
        window.activeEditId = null;
    };

    window.reintentarGuardarFibra = async (id) => {
        const backupKey = 'fibra_backup_' + id;
        const backupData = localStorage.getItem(backupKey);
        if (!backupData) return;
        const { coordenadas_ruta, distancia_m } = JSON.parse(backupData);
        
        let snappedHubId = null;
        let minDistance = Infinity;
        window.RED_DATA.hubs.forEach(h => {
            const dist = window.getHaversineDistance(coordenadas_ruta[0], [h.latitud, h.longitud]);
            if (dist < minDistance) {
                minDistance = dist;
                snappedHubId = h.id;
            }
        });
        const hub_id = (minDistance <= 30) ? snappedHubId : null;

        try {
            const resp = await fetch('/api/organizacion/vertices-fibra/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.getCookie('csrftoken')
                },
                body: JSON.stringify({ id: id, coordenadas_ruta: coordenadas_ruta, distancia_m: distancia_m, hub_id: hub_id })
            });
            const res = await resp.json();
            if (res.status === 'success') {
                localStorage.removeItem(backupKey);
                alert('Fibra guardada correctamente en el servidor.');
                window.location.reload();
            } else {
                alert('Error al reintentar guardar: ' + (res.message || 'Intente nuevamente.'));
            }
        } catch (e) {
            alert('Error de red al reintentar guardar la fibra.');
        }
    };

});

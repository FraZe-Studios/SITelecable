/**
 * oferta.js - Gestión de Ofertas del Abonado
 */
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('fichaApp');
        if (!app) return;

        const esc = (s) => String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

        // Manejar botón de aprobación de oferta
        document.querySelectorAll('.btn-aprobar-oferta').forEach(btn => {
            btn.addEventListener('click', async () => {
                const suscripcionId = btn.dataset.suscripcion;
                if (!suscripcionId) return;
                
                const confirmed = await window.SITAlert.confirm('¿Está seguro de aprobar esta oferta? Esto activará el servicio del cliente.');
                if (!confirmed) return;
                
                try {
                    const response = await fetch('/api/abonados/aprobar-oferta/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            suscripcion_id: suscripcionId
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        window.SITAlert.show('Oferta aprobada exitosamente', 'success');
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        window.SITAlert.show('Error al aprobar oferta: ' + (data.message || 'Error desconocido'), 'danger');
                    }
                } catch (error) {
                    console.error('Error al aprobar oferta:', error);
                    window.SITAlert.show('Error al aprobar oferta', 'danger');
                }
            });
        });

        // Manejar botón de ver oferta
        document.querySelectorAll('.btn-ver-oferta').forEach(btn => {
            btn.addEventListener('click', async () => {
                const suscripcionId = btn.dataset.suscripcion;
                if (!suscripcionId) return;
                
                const modal = document.getElementById(`modal-oferta-${suscripcionId}`);
                if (!modal) return;
                
                modal.style.display = 'flex';
                
                // Load offer details
                try {
                    const response = await fetch(`/api/abonados/obtener-oferta/?suscripcion_id=${suscripcionId}`);
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        const oferta = data.data.oferta;
                        const detallesDiv = document.getElementById(`oferta-detalles-${suscripcionId}`);
                        
                        if (oferta && detallesDiv) {
                            detallesDiv.innerHTML = `
                                <div style="background:var(--bg-surface-active); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
                                    <h4 style="margin:0 0 0.5rem 0; color:var(--text-primary);">Información del Plan</h4>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Plan:</strong> ${oferta.plan_nombre || 'N/A'}</p>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Descuento:</strong> ${oferta.descuento_plan || 0}%</p>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Meses de Descuento:</strong> ${oferta.meses_descuento || 0}</p>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Monto Instalación:</strong> S/ ${oferta.monto_instalacion || 0}</p>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Descuento Instalación:</strong> ${oferta.descuento_instalacion || 0}%</p>
                                </div>
                                <div style="background:var(--bg-surface-active); padding:1rem; border-radius:var(--radius-sm); margin-bottom:1rem;">
                                    <h4 style="margin:0 0 0.5rem 0; color:var(--text-primary);">Información del Vendedor</h4>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>ID Vendedor:</strong> ${oferta.vendedor_id || 'N/A'}</p>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Fecha Registro:</strong> ${oferta.fecha_registro || 'N/A'}</p>
                                </div>
                                <div style="background:var(--bg-surface-active); padding:1rem; border-radius:var(--radius-sm);">
                                    <h4 style="margin:0 0 0.5rem 0; color:var(--text-primary);">Estado</h4>
                                    <p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Estado:</strong> <span style="color:${oferta.estado === 'pendiente_aprobacion' ? '#f59e0b' : '#22c55e'}; font-weight:bold;">${oferta.estado || 'N/A'}</span></p>
                                    ${oferta.aprobado_por_nombre ? `<p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Aprobado por:</strong> ${oferta.aprobado_por_nombre}</p>` : ''}
                                    ${oferta.fecha_aprobacion ? `<p style="margin:0.25rem 0; color:var(--text-secondary);"><strong>Fecha Aprobación:</strong> ${oferta.fecha_aprobacion}</p>` : ''}
                                </div>
                            `;
                        }
                    } else {
                        document.getElementById(`oferta-detalles-${suscripcionId}`).innerHTML = 
                            `<p style="color:var(--error-color);">Error al cargar detalles: ${data.message || 'Error desconocido'}</p>`;
                    }
                } catch (error) {
                    console.error('Error al cargar oferta:', error);
                    document.getElementById(`oferta-detalles-${suscripcionId}`).innerHTML = 
                        '<p style="color:var(--error-color);">Error de conexión al cargar detalles</p>';
                }
            });
        });

        // Manejar botón de aprobar oferta desde modal
        document.querySelectorAll('.btn-aprobar-oferta-modal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const suscripcionId = btn.dataset.suscripcion;
                if (!suscripcionId) return;
                
                const confirmed = await window.SITAlert.confirm('¿Está seguro de aprobar esta oferta? Esto activará el servicio del cliente.');
                if (!confirmed) return;
                
                try {
                    const response = await fetch('/api/abonados/aprobar-oferta/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            suscripcion_id: suscripcionId
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.status === 'success') {
                        window.SITAlert.show('Oferta aprobada exitosamente', 'success');
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        window.SITAlert.show('Error al aprobar oferta: ' + (data.message || 'Error desconocido'), 'danger');
                    }
                } catch (error) {
                    console.error('Error al aprobar oferta:', error);
                    window.SITAlert.show('Error al aprobar oferta', 'danger');
                }
            });
        });
    });
})();

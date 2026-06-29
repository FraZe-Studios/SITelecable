/**
 * Componente de Configuración Dinámica de Planes (JSONB Modular)
 * Renderiza switches dinámicos basados en la estructura JSONB del backend
 */

class PlanDinamicoConfig {
    constructor(planId, containerId) {
        this.planId = planId;
        this.container = document.getElementById(containerId);
        this.caracteristicas = {};
        this.esquemaMaestro = {};
        this.loading = false;
        
        this.init();
    }

    async init() {
        if (!this.container) {
            console.error('Container not found:', this.containerId);
            return;
        }

        await this.loadConfig();
        this.render();
    }

    async loadConfig() {
        this.loading = true;
        this.renderLoading();

        try {
            const resp = await fetch(`/api/sede/config/plan/dinamico/?plan_id=${this.planId}`);
            const data = await resp.json();

            if (data.status === 'success') {
                this.caracteristicas = data.plan.caracteristicas_tecnicas_json || {};
                this.esquemaMaestro = data.esquema_maestro || {};
            } else {
                console.error('Error loading config:', data.message);
                this.renderError(data.message);
            }
        } catch (error) {
            console.error('Error fetching config:', error);
            this.renderError('Error al cargar configuración');
        } finally {
            this.loading = false;
        }
    }

    async saveConfig() {
        try {
            const resp = await fetch('/api/sede/config/plan/dinamico/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCookie('csrftoken')
                },
                body: JSON.stringify({
                    plan_id: this.planId,
                    caracteristicas_tecnicas_json: this.caracteristicas
                })
            });

            const data = await resp.json();

            if (data.status === 'success') {
                this.caracteristicas = data.caracteristicas_tecnicas_json;
                alert('Configuración guardada correctamente');
            } else {
                alert('Error: ' + data.message);
            }
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Error al guardar configuración');
        }
    }

    // Manejador de estado único para cambios de toggle
    handleToggleChange(seccion, llave) {
        if (!this.caracteristicas[seccion]) {
            this.caracteristicas[seccion] = {};
        }
        
        // Invertir valor booleano
        this.caracteristicas[seccion][llave] = !this.caracteristicas[seccion][llave];
        
        // Re-renderizar para reflejar el cambio
        this.render();
    }

    // Manejador para cambios de inputs numéricos
    handleInputChange(seccion, llave, valor) {
        if (!this.caracteristicas[seccion]) {
            this.caracteristicas[seccion] = {};
        }
        
        this.caracteristicas[seccion][llave] = parseInt(valor) || 0;
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    render() {
        if (this.loading) {
            this.renderLoading();
            return;
        }

        const secciones = ['caracteristicas_base', 'activacion_funciones', 'permisos_formularios'];
        
        let html = `
            <div class="plan-dinamico-config">
                <div class="config-header">
                    <h3>Configuración Dinámica del Plan</h3>
                    <button onclick="window.planDinamicoConfig.saveConfig()" class="btn-save">
                        Guardar Cambios
                    </button>
                </div>
        `;

        secciones.forEach(seccion => {
            const seccionData = this.esquemaMaestro[seccion] || {};
            const seccionLabel = this.formatSectionLabel(seccion);
            
            html += `
                <div class="config-section">
                    <h4>${seccionLabel}</h4>
                    <div class="config-items">
            `;

            Object.entries(seccionData).forEach(([llave, config]) => {
                const valor = this.caracteristicas[seccion]?.[llave];
                const label = config.label || llave;
                const descripcion = config.descripcion || '';
                const tipo = config.tipo || 'boolean';

                if (tipo === 'boolean') {
                    html += `
                        <div class="config-item">
                            <div class="config-item-info">
                                <label class="config-label">${label}</label>
                                ${descripcion ? `<small class="config-desc">${descripcion}</small>` : ''}
                            </div>
                            <label class="switch">
                                <input type="checkbox" 
                                    ${valor ? 'checked' : ''} 
                                    onchange="window.planDinamicoConfig.handleToggleChange('${seccion}', '${llave}')">
                                <span class="slider"></span>
                            </label>
                        </div>
                    `;
                } else if (tipo === 'integer') {
                    html += `
                        <div class="config-item">
                            <div class="config-item-info">
                                <label class="config-label">${label}</label>
                                ${descripcion ? `<small class="config-desc">${descripcion}</small>` : ''}
                            </div>
                            <input type="number" 
                                class="config-input" 
                                value="${valor || 0}" 
                                onchange="window.planDinamicoConfig.handleInputChange('${seccion}', '${llave}', this.value)">
                        </div>
                    `;
                } else if (tipo === 'array') {
                    const arrayValue = Array.isArray(valor) ? valor : [];
                    html += `
                        <div class="config-item">
                            <div class="config-item-info">
                                <label class="config-label">${label}</label>
                                ${descripcion ? `<small class="config-desc">${descripcion}</small>` : ''}
                            </div>
                            <div class="config-array">
                                <span class="array-count">${arrayValue.length} items</span>
                            </div>
                        </div>
                    `;
                }
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <style>
                .plan-dinamico-config {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                .config-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .config-header h3 {
                    margin: 0;
                    font-size: 1.5rem;
                    color: #1f2937;
                }
                
                .btn-save {
                    padding: 10px 20px;
                    background-color: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.2s;
                }
                
                .btn-save:hover {
                    background-color: #2563eb;
                }
                
                .config-section {
                    margin-bottom: 30px;
                    padding: 20px;
                    background-color: #f9fafb;
                    border-radius: 8px;
                }
                
                .config-section h4 {
                    margin: 0 0 20px 0;
                    font-size: 1.1rem;
                    color: #374151;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .config-items {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .config-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    background-color: white;
                    border-radius: 6px;
                    border: 1px solid #e5e7eb;
                }
                
                .config-item-info {
                    flex: 1;
                }
                
                .config-label {
                    font-weight: 500;
                    color: #1f2937;
                    margin-bottom: 4px;
                }
                
                .config-desc {
                    color: #6b7280;
                    font-size: 0.875rem;
                }
                
                /* Switch Toggle */
                .switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 26px;
                }
                
                .switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                
                .slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: 0.4s;
                    border-radius: 26px;
                }
                
                .slider:before {
                    position: absolute;
                    content: "";
                    height: 20px;
                    width: 20px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: 0.4s;
                    border-radius: 50%;
                }
                
                input:checked + .slider {
                    background-color: #3b82f6;
                }
                
                input:checked + .slider:before {
                    transform: translateX(24px);
                }
                
                .config-input {
                    width: 100px;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 1rem;
                }
                
                .config-array {
                    padding: 8px 12px;
                    background-color: #f3f4f6;
                    border-radius: 4px;
                }
                
                .array-count {
                    color: #6b7280;
                    font-size: 0.875rem;
                }
                
                .loading, .error {
                    text-align: center;
                    padding: 40px;
                    color: #6b7280;
                }
            </style>
        `;

        this.container.innerHTML = html;
    }

    renderLoading() {
        this.container.innerHTML = '<div class="loading">Cargando configuración...</div>';
    }

    renderError(message) {
        this.container.innerHTML = `<div class="error">Error: ${message}</div>`;
    }

    formatSectionLabel(seccion) {
        const labels = {
            'caracteristicas_base': 'Características Base',
            'activacion_funciones': 'Activación de Funciones',
            'permisos_formularios': 'Permisos de Formularios'
        };
        return labels[seccion] || seccion;
    }
}

// Función de inicialización global
function initPlanDinamicoConfig(planId, containerId) {
    window.planDinamicoConfig = new PlanDinamicoConfig(planId, containerId);
}

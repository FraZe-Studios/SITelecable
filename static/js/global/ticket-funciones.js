// ============================================================================
// TICKET FUNCTIONS - Funciones Especiales de Tickets
// ============================================================================
// Manejo de funciones especiales: cambio_equipo, migracion_plan, instalacion,
// cobra_materiales, editar_mapa, mantiene_equipo, nuevo_suministro, genera_merma
// ============================================================================

class TicketFuncionesManager {
    constructor(ticketId) {
        this.ticketId = ticketId;
        this.funciones = {};
        this.baseUrl = '/api/ticket/' + ticketId;
    }

    // Cargar todas las funciones especiales del ticket
    async cargarFunciones() {
        try {
            const response = await fetch(this.baseUrl + '/funciones/obtener/');
            const data = await response.json();
            if (data.success) {
                this.funciones = data.funciones_especiales;
                return this.funciones;
            }
            throw new Error(data.error || 'Error al cargar funciones');
        } catch (error) {
            console.error('Error cargando funciones:', error);
            throw error;
        }
    }

    // Activar una función especial
    async activarFuncion(funcionKey, datos = {}) {
        try {
            const response = await fetch(this.baseUrl + '/funciones/activar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    funcion_key: funcionKey,
                    datos: datos
                })
            });
            const data = await response.json();
            if (data.success) {
                this.funciones = data.funciones_especiales;
                return data;
            }
            throw new Error(data.error || 'Error al activar función');
        } catch (error) {
            console.error('Error activando función:', error);
            throw error;
        }
    }

    // Actualizar estado de una función
    async actualizarEstadoFuncion(funcionKey, estado, datos = {}) {
        try {
            const response = await fetch(this.baseUrl + '/funciones/actualizar-estado/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    funcion_key: funcionKey,
                    estado: estado,
                    datos: datos
                })
            });
            const data = await response.json();
            if (data.success) {
                this.funciones = data.funciones_especiales;
                return data;
            }
            throw new Error(data.error || 'Error al actualizar estado');
        } catch (error) {
            console.error('Error actualizando estado:', error);
            throw error;
        }
    }

    // Completar una función
    async completarFuncion(funcionKey, datos = {}) {
        try {
            const response = await fetch(this.baseUrl + '/funciones/completar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    funcion_key: funcionKey,
                    datos: datos
                })
            });
            const data = await response.json();
            if (data.success) {
                this.funciones = data.funciones_especiales;
                return data;
            }
            throw new Error(data.error || 'Error al completar función');
        } catch (error) {
            console.error('Error completando función:', error);
            throw error;
        }
    }

    // Cambio de equipo
    async cambioEquipo(equipoAnterior, equipoNuevo, motivo) {
        return await this.activarFuncion('cambio_equipo', {
            equipo_anterior: equipoAnterior,
            equipo_nuevo: equipoNuevo,
            motivo: motivo
        });
    }

    // Migración de plan
    async migracionPlan(planNuevoId) {
        return await this.activarFuncion('migracion_plan', {
            plan_nuevo_id: planNuevoId
        });
    }

    // Ejecutar migración de plan
    async ejecutarMigracionPlan() {
        try {
            const response = await fetch(this.baseUrl + '/migracion-plan/ejecutar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (data.success) {
                this.funciones = data.funciones_especiales;
                return data;
            }
            throw new Error(data.error || 'Error al ejecutar migración');
        } catch (error) {
            console.error('Error ejecutando migración:', error);
            throw error;
        }
    }

    // Instalación
    async instalacion(tecnicoId) {
        return await this.activarFuncion('instalacion', {
            tecnico_id: tecnicoId
        });
    }

    // Cobra materiales
    async cobraMateriales(materiales, montoTotal) {
        return await this.activarFuncion('cobra_materiales', {
            materiales: materiales,
            monto_total: montoTotal
        });
    }

    // Editar mapa
    async editarMapa(napId, coordenadasAnteriores, coordenadasNuevas) {
        return await this.activarFuncion('editar_mapa', {
            nap_id: napId,
            coordenadas_anteriores: coordenadasAnteriores,
            coordenadas_nuevas: coordenadasNuevas
        });
    }

    // Mantiene equipo
    async mantieneEquipo(equipoMantenido) {
        return await this.activarFuncion('mantiene_equipo', {
            equipo_mantenido: equipoMantenido
        });
    }

    // Nuevo suministro
    async nuevoSuministro(suministroNuevo) {
        return await this.activarFuncion('nuevo_suministro', {
            suministro_nuevo: suministroNuevo
        });
    }

    // Ejecutar nuevo suministro
    async ejecutarNuevoSuministro() {
        try {
            const response = await fetch(this.baseUrl + '/nuevo-suministro/ejecutar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (data.success) {
                this.funciones = data.funciones_especiales;
                return data;
            }
            throw new Error(data.error || 'Error al ejecutar cambio de suministro');
        } catch (error) {
            console.error('Error ejecutando cambio de suministro:', error);
            throw error;
        }
    }

    // Genera merma
    async generaMerma(materialesMerma, motivo, autorizadoPor) {
        return await this.activarFuncion('genera_merma', {
            materiales_merma: materialesMerma,
            motivo: motivo,
            autorizado_por: autorizadoPor
        });
    }

    // Obtener estado de una función específica
    getEstadoFuncion(funcionKey) {
        return this.funciones[funcionKey] || { activado: false, estado: 'pendiente' };
    }

    // Verificar si una función está activada
    isFuncionActivada(funcionKey) {
        const funcion = this.getEstadoFuncion(funcionKey);
        return funcion.activado === true;
    }

    // Obtener CSRF token
    getCsrfToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }
}

// ============================================================================
// UI COMPONENT - Panel de Funciones Especiales
// ============================================================================

class TicketFuncionesUI {
    constructor(ticketId, containerId) {
        this.manager = new TicketFuncionesManager(ticketId);
        this.container = document.getElementById(containerId);
        this.ticketId = ticketId;
    }

    async inicializar() {
        await this.manager.cargarFunciones();
        this.renderizar();
    }

    renderizar() {
        if (!this.container) return;

        const funciones = this.manager.funciones;
        const html = `
            <div class="ticket-funciones-panel">
                <div class="funciones-header">
                    <h3>Funciones Especiales</h3>
                    <button class="btn-recargar" onclick="this.closest('.ticket-funciones-panel').ui.recargar()">
                        ↻ Recargar
                    </button>
                </div>
                
                <div class="funciones-grid">
                    ${this.renderizarFuncion('cambio_equipo', 'Cambio de Equipo', 'Activa flujo de reemplazo de dispositivo', funciones.cambio_equipo)}
                    ${this.renderizarFuncion('migracion_plan', 'Migración de Plan', 'Corta plan actual y activa nuevo plan', funciones.migracion_plan, true)}
                    ${this.renderizarFuncion('instalacion', 'Instalación', 'Activa flujo de instalación', funciones.instalacion)}
                    ${this.renderizarFuncion('cobra_materiales', 'Cobra Materiales', 'Genera cargo por materiales', funciones.cobra_materiales)}
                    ${this.renderizarFuncion('editar_mapa', 'Editar Mapa', 'Permite editar posición NAP', funciones.editar_mapa)}
                    ${this.renderizarFuncion('mantiene_equipo', 'Mantiene Equipo', 'El equipo anterior se mantiene', funciones.mantiene_equipo)}
                    ${this.renderizarFuncion('nuevo_suministro', 'Nuevo Suministro', 'Requiere N° suministro nuevo', funciones.nuevo_suministro, true)}
                    ${this.renderizarFuncion('genera_merma', 'Genera Merma', 'Registra baja de materiales', funciones.genera_merma)}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.querySelector('.ticket-funciones-panel').ui = this;
    }

    renderizarFuncion(key, titulo, descripcion, funcion, tieneEjecutar = false) {
        const activado = funcion?.activado || false;
        const estado = funcion?.estado || 'pendiente';
        const estadoClass = this.getEstadoClass(estado);

        return `
            <div class="funcion-card ${activado ? 'activado' : ''}" data-funcion="${key}">
                <div class="funcion-header">
                    <div class="funcion-titulo">
                        <span class="funcion-nombre">${titulo}</span>
                        <span class="funcion-estado ${estadoClass}">${estado.toUpperCase()}</span>
                    </div>
                    <button class="btn-activar" onclick="this.closest('.funcion-card').ui.toggleFuncion('${key}')">
                        ${activado ? '✓ Activado' : '+ Activar'}
                    </button>
                </div>
                <div class="funcion-descripcion">${descripcion}</div>
                ${activado ? this.renderizarDetallesFuncion(key, funcion, tieneEjecutar) : ''}
            </div>
        `;
    }

    renderizarDetallesFuncion(key, funcion, tieneEjecutar) {
        let detalles = '';
        
        switch(key) {
            case 'cambio_equipo':
                detalles = `
                    <div class="funcion-detalles">
                        ${funcion.equipo_anterior ? `<div>Equipo anterior: ${funcion.equipo_anterior}</div>` : ''}
                        ${funcion.equipo_nuevo ? `<div>Equipo nuevo: ${funcion.equipo_nuevo}</div>` : ''}
                        ${funcion.motivo ? `<div>Motivo: ${funcion.motivo}</div>` : ''}
                        ${funcion.fecha_activacion ? `<div>Activado: ${new Date(funcion.fecha_activacion).toLocaleString()}</div>` : ''}
                    </div>
                `;
                break;
            case 'migracion_plan':
                detalles = `
                    <div class="funcion-detalles">
                        ${funcion.plan_anterior_id ? `<div>Plan anterior ID: ${funcion.plan_anterior_id}</div>` : ''}
                        ${funcion.plan_nuevo_id ? `<div>Plan nuevo ID: ${funcion.plan_nuevo_id}</div>` : ''}
                        ${tieneEjecutar ? `<button class="btn-ejecutar" onclick="this.closest('.funcion-card').ui.ejecutarMigracion()">Ejecutar Migración</button>` : ''}
                        ${funcion.fecha_corte ? `<div>Corte: ${new Date(funcion.fecha_corte).toLocaleString()}</div>` : ''}
                        ${funcion.fecha_activacion_nuevo ? `<div>Activación nuevo: ${new Date(funcion.fecha_activacion_nuevo).toLocaleString()}</div>` : ''}
                    </div>
                `;
                break;
            case 'instalacion':
                detalles = `
                    <div class="funcion-detalles">
                        ${funcion.tecnico_id ? `<div>Técnico ID: ${funcion.tecnico_id}</div>` : ''}
                        ${funcion.fecha_inicio ? `<div>Inicio: ${new Date(funcion.fecha_inicio).toLocaleString()}</div>` : ''}
                        ${funcion.fecha_fin ? `<div>Fin: ${new Date(funcion.fecha_fin).toLocaleString()}</div>` : ''}
                    </div>
                `;
                break;
            case 'cobra_materiales':
                detalles = `
                    <div class="funcion-detalles">
                        ${funcion.materiales?.length ? `<div>Materiales: ${funcion.materiales.length}</div>` : ''}
                        ${funcion.monto_total ? `<div>Monto total: S/ ${funcion.monto_total}</div>` : ''}
                    </div>
                `;
                break;
            case 'editar_mapa':
                detalles = `
                    <div class="funcion-detalles">
                        ${funcion.nap_id ? `<div>NAP ID: ${funcion.nap_id}</div>` : ''}
                        ${funcion.coordenadas_nuevas ? `<div>Coordenadas nuevas: ${funcion.coordenadas_nuevas}</div>` : ''}
                    </div>
                `;
                break;
            case 'nuevo_suministro':
                detalles = `
                    <div class="funcion-detalles">
                        ${funcion.suministro_anterior ? `<div>Suministro anterior: ${funcion.suministro_anterior}</div>` : ''}
                        ${funcion.suministro_nuevo ? `<div>Suministro nuevo: ${funcion.suministro_nuevo}</div>` : ''}
                        ${tieneEjecutar ? `<button class="btn-ejecutar" onclick="this.closest('.funcion-card').ui.ejecutarCambioSuministro()">Ejecutar Cambio</button>` : ''}
                    </div>
                `;
                break;
            case 'genera_merma':
                detalles = `
                    <div class="funcion-detalles">
                        ${funcion.materiales_merma?.length ? `<div>Materiales: ${funcion.materiales_merma.length}</div>` : ''}
                        ${funcion.motivo ? `<div>Motivo: ${funcion.motivo}</div>` : ''}
                        ${funcion.autorizado_por ? `<div>Autorizado por: ${funcion.autorizado_por}</div>` : ''}
                    </div>
                `;
                break;
        }

        return detalles;
    }

    getEstadoClass(estado) {
        const clases = {
            'pendiente': 'estado-pendiente',
            'en_proceso': 'estado-proceso',
            'completado': 'estado-completado',
            'cancelado': 'estado-cancelado'
        };
        return clases[estado] || 'estado-pendiente';
    }

    async toggleFuncion(key) {
        const funcion = this.manager.getEstadoFuncion(key);
        
        if (funcion.activado) {
            // Si ya está activado, mostrar opción de completar
            if (confirm('¿Desea completar esta función?')) {
                await this.manager.completarFuncion(key);
            }
        } else {
            // Activar función
            const datos = this.solicitarDatosFuncion(key);
            if (datos !== null) {
                await this.manager.activarFuncion(key, datos);
            }
        }
        
        await this.recargar();
    }

    solicitarDatosFuncion(key) {
        switch(key) {
            case 'cambio_equipo':
                const equipoAnterior = prompt('Equipo anterior:');
                const equipoNuevo = prompt('Equipo nuevo:');
                const motivo = prompt('Motivo:');
                if (equipoAnterior && equipoNuevo) {
                    return { equipo_anterior: equipoAnterior, equipo_nuevo: equipoNuevo, motivo: motivo };
                }
                break;
            case 'migracion_plan':
                const planNuevoId = prompt('ID del plan nuevo:');
                if (planNuevoId) {
                    return { plan_nuevo_id: parseInt(planNuevoId) };
                }
                break;
            case 'instalacion':
                const tecnicoId = prompt('ID del técnico:');
                if (tecnicoId) {
                    return { tecnico_id: parseInt(tecnicoId) };
                }
                break;
            case 'cobra_materiales':
                const montoTotal = prompt('Monto total:');
                if (montoTotal) {
                    return { materiales: [], monto_total: parseFloat(montoTotal) };
                }
                break;
            case 'editar_mapa':
                const napId = prompt('ID del NAP:');
                const coordenadas = prompt('Coordenadas nuevas (lat,lng):');
                if (napId && coordenadas) {
                    return { nap_id: parseInt(napId), coordenadas_nuevas: coordenadas };
                }
                break;
            case 'mantiene_equipo':
                const equipoMantenido = prompt('Equipo mantenido:');
                if (equipoMantenido) {
                    return { equipo_mantenido: equipoMantenido };
                }
                break;
            case 'nuevo_suministro':
                const suministroNuevo = prompt('Nuevo número de suministro:');
                if (suministroNuevo) {
                    return { suministro_nuevo: suministroNuevo };
                }
                break;
            case 'genera_merma':
                const motivoMerma = prompt('Motivo de la merma:');
                const autorizadoPor = prompt('Autorizado por:');
                if (motivoMerma) {
                    return { materiales_merma: [], motivo: motivoMerma, autorizado_por: autorizadoPor };
                }
                break;
        }
        return null;
    }

    async ejecutarMigracion() {
        if (confirm('¿Está seguro de ejecutar la migración de plan? Esto cortará el plan actual y activará el nuevo.')) {
            try {
                await this.manager.ejecutarMigracionPlan();
                alert('Migración ejecutada correctamente');
                await this.recargar();
            } catch (error) {
                alert('Error al ejecutar migración: ' + error.message);
            }
        }
    }

    async ejecutarCambioSuministro() {
        if (confirm('¿Está seguro de ejecutar el cambio de suministro?')) {
            try {
                await this.manager.ejecutarNuevoSuministro();
                alert('Cambio de suministro ejecutado correctamente');
                await this.recargar();
            } catch (error) {
                alert('Error al ejecutar cambio: ' + error.message);
            }
        }
    }

    async recargar() {
        await this.manager.cargarFunciones();
        this.renderizar();
    }
}

// ============================================================================
// ESTILOS CSS (se pueden mover a un archivo CSS separado)
// ============================================================================

const ticketFuncionesStyles = `
.ticket-funciones-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
}

.funciones-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.funciones-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
}

.btn-recargar {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
}

.funciones-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
}

.funcion-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 1rem;
    transition: all 0.3s ease;
}

.funcion-card.activado {
    border-color: #4CAF50;
    background: rgba(76, 175, 80, 0.1);
}

.funcion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.funcion-titulo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.funcion-nombre {
    font-weight: 600;
    color: var(--text-primary);
}

.funcion-estado {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-weight: 600;
}

.estado-pendiente {
    background: #FFA726;
    color: white;
}

.estado-proceso {
    background: #2196F3;
    color: white;
}

.estado-completado {
    background: #4CAF50;
    color: white;
}

.estado-cancelado {
    background: #F44336;
    color: white;
}

.btn-activar {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
}

.btn-activar:hover {
    opacity: 0.9;
}

.funcion-descripcion {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.funcion-detalles {
    font-size: 0.8rem;
    color: var(--text-primary);
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
}

.funcion-detalles > div {
    margin: 0.25rem 0;
}

.btn-ejecutar {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    margin-top: 0.5rem;
    width: 100%;
}

.btn-ejecutar:hover {
    opacity: 0.9;
}
`;

// Inyectar estilos si no existen
if (!document.getElementById('ticket-funciones-styles')) {
    const style = document.createElement('style');
    style.id = 'ticket-funciones-styles';
    style.textContent = ticketFuncionesStyles;
    document.head.appendChild(style);
}

// ============================================================================
// EXPORTAR PARA USO GLOBAL
// ============================================================================

window.TicketFuncionesManager = TicketFuncionesManager;
window.TicketFuncionesUI = TicketFuncionesUI;

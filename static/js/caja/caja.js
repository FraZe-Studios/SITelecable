document.addEventListener('DOMContentLoaded', () => {
    // Inicializar fecha de hoy en el input
    const dateInput = document.getElementById('filtro-fecha');
    const todayStr = new Date().toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD local
    if (dateInput) {
        dateInput.value = todayStr;
    }

    // Cargar datos al iniciar
    cargarDatosCaja();
});

// Variables globales para evitar bucles de carga
let sedesCargadas = false;

function cargarDatosCaja() {
    const fecha = document.getElementById('filtro-fecha').value;
    const sedeSelect = document.getElementById('filtro-sede');
    const cajaSelect = document.getElementById('filtro-caja');

    let url = `/api/caja/resumen/?fecha=${fecha}`;
    if (sedeSelect && sedeSelect.value) {
        url += `&sede_id=${sedeSelect.value}`;
    }
    if (cajaSelect && cajaSelect.value && cajaSelect.value !== '') {
        url += `&caja_id=${cajaSelect.value}`;
    }

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                renderResumen(data);
                cargarMovimientos();
            } else if (data.code === 'no_active_caja') {
                // El cajero tiene múltiples cajas asignadas pero ninguna activa
                renderSelectorDeCajaInicial(data.cajas_autorizadas);
            } else {
                SITAlert.show(data.message || 'Error al cargar resumen de caja', 'error');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            SITAlert.show('Fallo de red al cargar resumen', 'error');
        });
}

function renderSelectorDeCajaInicial(cajas) {
    const panelsLayout = document.getElementById('caja-panels-layout');
    if (panelsLayout) {
        // Mostrar vista limpia obligando a seleccionar caja
        const options = cajas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        
        panelsLayout.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; text-align: center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" style="color:var(--primary-color); margin-bottom: 1.5rem;">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M12 2v5"/>
                    <path d="M12 17v5"/>
                </svg>
                <h3 style="font-size:1.3rem; font-weight:800; margin-bottom:0.5rem;">Caja Diaria de Trabajo</h3>
                <p style="color:var(--text-muted); font-size:0.9rem; max-width:400px; margin-bottom:1.5rem;">
                    Se ha detectado que tiene acceso a múltiples cajas. Por favor, seleccione la caja con la que operará en este turno.
                </p>
                <div style="display:flex; gap:0.75rem; width:100%; max-width:320px;">
                    <select id="selector-caja-inicial" class="form-input" style="flex:1;">
                        ${options}
                    </select>
                    <button type="button" class="btn-submit" style="width:auto; padding:0 1.5rem;" onclick="seleccionarCaja(document.getElementById('selector-caja-inicial').value)">Ingresar</button>
                </div>
            </div>`;
    }
}

function seleccionarCaja(cajaId) {
    if (!cajaId) return;
    const fecha = document.getElementById('filtro-fecha').value;
    
    fetch(`/api/caja/resumen/?set_active_caja_id=${cajaId}&fecha=${fecha}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                SITAlert.show(`Sesión de caja iniciada correctamente.`, 'success');
                // Forzar reload completo de la estructura
                window.location.reload();
            } else {
                SITAlert.show(data.message || 'Error al seleccionar caja', 'error');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            SITAlert.show('Error al conectar con el servidor', 'error');
        });
}

function renderResumen(data) {
    // Guardar en variable global la configuración de recaudación de la caja activa
    if (data.active_caja) {
        window.CURRENT_CAJA_RECAUDO = data.active_caja.recaudo;
        // Si no es admin y hay subtítulo, actualizarlo con la caja activa
        const subtitle = document.getElementById('caja-subtitle-info');
        if (subtitle && data.sede) {
            subtitle.innerHTML = `Consolidado y registro de transacciones de la sede: <strong>${data.sede.nombre}</strong> — Caja: <strong style="color:var(--primary-color);">${data.active_caja.nombre}</strong>`;
        }
    } else {
        window.CURRENT_CAJA_RECAUDO = null;
        const subtitle = document.getElementById('caja-subtitle-info');
        if (subtitle) {
            subtitle.textContent = data.sede ? `Consolidado general de auditoría de cajas de la sede: ${data.sede.nombre}` : 'Consolidado general de auditoría de cajas';
        }
    }

    // Actualizar KPIs de Sede
    document.getElementById('kpi-sede-neto').textContent = formatearSoles(data.sede_totales.neto);
    document.getElementById('kpi-sede-ingresos').textContent = formatearSoles(data.sede_totales.ingresos);
    document.getElementById('kpi-sede-egresos').textContent = formatearSoles(data.sede_totales.egresos);

    // Actualizar desglose global
    document.getElementById('kpi-sede-tot-global').textContent = formatearSoles(data.sede_totales.ingresos);
    document.getElementById('kpi-metodo-efectivo').textContent = formatearSoles(data.sede_totales.efectivo);
    document.getElementById('kpi-metodo-transferencia').textContent = formatearSoles(data.sede_totales.transferencia);
    document.getElementById('kpi-metodo-otros').textContent = formatearSoles(data.sede_totales.otros);

    // Ajustar Layout Admin vs Cajero
    const panelsLayout = document.getElementById('caja-panels-layout');
    const kpiPersonal = document.getElementById('card-kpi-personal');
    const secTablaPersonal = document.getElementById('seccion-tabla-personal');
    const cardPermisos = document.getElementById('card-permisos-cajero');
    const panelAdminPermisos = document.getElementById('panel-admin-permisos');
    
    const filtroSedeCont = document.getElementById('filtro-sede-container');
    const filtroUserCont = document.getElementById('filtro-usuario-container');
    const filtroCajaCont = document.getElementById('filtro-caja-container');

    // Poblar dropdown de Caja
    const cajaSelect = document.getElementById('filtro-caja');
    if (cajaSelect) {
        cajaSelect.innerHTML = '';
        if (data.is_admin) {
            const optAll = document.createElement('option');
            optAll.value = 'all';
            optAll.textContent = 'Todas las cajas';
            cajaSelect.appendChild(optAll);
            
            data.cajas_sede.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nombre;
                if (data.active_caja && c.id === data.active_caja.id) {
                    opt.selected = true;
                }
                cajaSelect.appendChild(opt);
            });
        } else {
            // Cajero regular
            data.cajas_autorizadas.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nombre;
                if (data.active_caja && c.id === data.active_caja.id) {
                    opt.selected = true;
                }
                cajaSelect.appendChild(opt);
            });
        }
    }

    // Configurar campos permitidos de la caja activa en el selector de medios de pago del formulario
    const metodoSelect = document.getElementById('metodo_pago');
    if (metodoSelect && data.active_caja) {
        const rec = data.active_caja.recaudo || { efectivo: true, transferencia: true };
        
        const optEfectivo = metodoSelect.querySelector('option[value="efectivo"]');
        if (optEfectivo) optEfectivo.disabled = !rec.efectivo;
        
        const optTransferencia = metodoSelect.querySelector('option[value="transferencia"]');
        if (optTransferencia) optTransferencia.disabled = !rec.transferencia;

        // Auto-seleccionar el método permitido disponible si el actual se deshabilitó
        if (metodoSelect.value === 'efectivo' && !rec.efectivo) {
            metodoSelect.value = 'transferencia';
        } else if (metodoSelect.value === 'transferencia' && !rec.transferencia) {
            metodoSelect.value = 'efectivo';
        }
    }

    if (data.is_admin) {
        // Modo Admin
        panelsLayout.classList.add('admin-active');
        if (kpiPersonal) kpiPersonal.style.display = 'none';
        if (secTablaPersonal) secTablaPersonal.style.display = 'none';
        if (cardPermisos) cardPermisos.style.display = 'none';
        if (panelAdminPermisos) panelAdminPermisos.style.display = 'block';

        // Mostrar filtros admin
        if (filtroSedeCont) filtroSedeCont.style.display = 'flex';
        if (filtroUserCont) filtroUserCont.style.display = 'flex';
        if (filtroCajaCont) filtroCajaCont.style.display = 'flex';

        // Cargar listas de sedes y cajeros en los filtros una sola vez
        if (!sedesCargadas) {
            const sedeSelect = document.getElementById('filtro-sede');
            if (sedeSelect) {
                sedeSelect.innerHTML = '<option value="all">Todas las Sedes</option>';
                data.sedes.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.nombre;
                    if (data.sede && s.id === data.sede.id) {
                        opt.selected = true;
                    }
                    sedeSelect.appendChild(opt);
                });
            }
            
            const userSelect = document.getElementById('filtro-usuario');
            if (userSelect) {
                userSelect.innerHTML = '<option value="all">Todos los cajeros</option>';
                data.cajeros.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.textContent = `${u.nombre_completo} (${u.username})`;
                    userSelect.appendChild(opt);
                });
            }
            sedesCargadas = true;
        }

        // Renderizar lista de cajeros y permisos
        renderAdminPermisos(data.cajeros);

        // Ajustar títulos
        document.getElementById('consolidado-table-title').textContent = 'Transacciones de Caja Filtradas';
        document.getElementById('consolidado-table-subtitle').textContent = 'Consulta de auditoría administrativa';
        document.getElementById('th-usuario-caja').style.display = '';
        
        // El administrador no registra directamente movimientos desde aquí si no tiene sede activa
        const cardRegistro = document.getElementById('card-registro-movimiento');
        if (!data.sede) {
            if (cardRegistro) cardRegistro.style.display = 'none';
        } else {
            if (cardRegistro) cardRegistro.style.display = 'block';
        }

    } else {
        // Modo Cajero Regular
        panelsLayout.classList.remove('admin-active');
        if (kpiPersonal) kpiPersonal.style.display = 'flex';
        if (secTablaPersonal) secTablaPersonal.style.display = 'block';
        if (cardPermisos) cardPermisos.style.display = 'block';
        if (panelAdminPermisos) panelAdminPermisos.style.display = 'none';

        // Ocultar filtros admin, pero dejar filtroCaja visible si tiene más de una
        if (filtroSedeCont) filtroSedeCont.style.display = 'none';
        if (filtroUserCont) filtroUserCont.style.display = 'none';
        if (filtroCajaCont) {
            filtroCajaCont.style.display = data.cajas_autorizadas.length > 1 ? 'flex' : 'none';
        }

        // Actualizar KPIs de cajero
        document.getElementById('kpi-personal-neto').textContent = formatearSoles(data.personal_totales.neto);
        document.getElementById('kpi-personal-ingresos').textContent = formatearSoles(data.personal_totales.ingresos);
        document.getElementById('kpi-personal-egresos').textContent = formatearSoles(data.personal_totales.egresos);

        // Actualizar Badges de Permiso
        updatePermisoBadge('permiso-badge-efectivo', data.permisos.efectivo);
        updatePermisoBadge('permiso-badge-transferencia', data.permisos.transferencia);

        // Ocultar columna usuario en la tabla de consolidado porque es de la misma sede
        document.getElementById('th-usuario-caja').style.display = '';
        document.getElementById('consolidado-table-title').textContent = 'Transacciones Consolidadas de la Caja';
        document.getElementById('consolidado-table-subtitle').textContent = 'Cuadre general de caja del día';
    }
}

function updatePermisoBadge(id, tienePermiso) {
    const badge = document.getElementById(id);
    if (badge) {
        if (tienePermiso) {
            badge.textContent = 'Permitido';
            badge.className = 'permit-badge badge-authorized';
        } else {
            badge.textContent = 'No Permitido';
            badge.className = 'permit-badge badge-denied';
        }
    }
}

function renderAdminPermisos(cajeros) {
    const listContainer = document.getElementById('lista-admin-cajeros');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (cajeros.length === 0) {
        listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted);">No hay cajeros registrados.</td></tr>';
        return;
    }

    cajeros.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${c.username}</td>
            <td>${c.nombre_completo}</td>
            <td style="text-transform:uppercase;font-size:0.75rem;color:var(--text-muted);font-weight:700;">${c.rol}</td>
            <td style="text-align: center;">
                <label class="switch">
                    <input type="checkbox" ${c.permiso_efectivo ? 'checked' : ''} onchange="togglePermiso(${c.id}, 'efectivo', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td style="text-align: center;">
                <label class="switch">
                    <input type="checkbox" ${c.permiso_transferencia ? 'checked' : ''} onchange="togglePermiso(${c.id}, 'transferencia', this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
        `;
        listContainer.appendChild(tr);
    });
}

function togglePermiso(usuarioId, permisoTipo, valor) {
    fetch('/api/caja/toggle-permiso/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            usuario_id: usuarioId,
            permiso_tipo: permisoTipo,
            valor: valor
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            SITAlert.show(data.message, 'success');
            // Recargar datos sin reiniciar listas de filtros
            cargarDatosCaja();
        } else {
            SITAlert.show(data.message || 'Error al cambiar permiso', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        SITAlert.show('Fallo de red al guardar permiso', 'error');
    });
}

function cargarMovimientos() {
    const fecha = document.getElementById('filtro-fecha').value;
    const sedeSelect = document.getElementById('filtro-sede');
    const cajaSelect = document.getElementById('filtro-caja');
    const usuarioSelect = document.getElementById('filtro-usuario');

    let url = `/api/caja/movimientos/?fecha=${fecha}`;
    if (sedeSelect && sedeSelect.value) {
        url += `&sede_id=${sedeSelect.value}`;
    }
    if (cajaSelect && cajaSelect.value && cajaSelect.value !== '') {
        url += `&caja_id=${cajaSelect.value}`;
    }
    if (usuarioSelect && usuarioSelect.value) {
        url += `&usuario_id=${usuarioSelect.value}`;
    }

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                if (data.is_admin) {
                    renderTablaCaja('lista-movimientos-consolidado', data.movimientos, true);
                } else {
                    renderTablaCaja('lista-movimientos-personal', data.personales, false);
                    renderTablaCaja('lista-movimientos-consolidado', data.totales, true);
                }
            } else {
                SITAlert.show(data.message || 'Error al cargar transacciones', 'error');
            }
        })
        .catch(err => {
            console.error('Error:', err);
        });
}

function renderTablaCaja(tbodyId, movimientos, mostrarUsuario) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = '';
    if (movimientos.length === 0) {
        const colCount = mostrarUsuario ? 6 : 5;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:2rem;color:var(--text-muted);">No hay transacciones registradas.</td></tr>`;
        return;
    }

    movimientos.forEach(m => {
        const tr = document.createElement('tr');
        const badgeClass = m.tipo_movimiento === 'entrada_pago' ? 'badge-entrada' : 'badge-salida';
        const tipoTxt = m.tipo_movimiento === 'entrada_pago' ? 'Ingreso' : 'Egreso';
        const montoSigno = m.tipo_movimiento === 'entrada_pago' ? '+' : '-';
        const montoColor = m.tipo_movimiento === 'entrada_pago' ? 'text-green' : 'text-red';
        const userCell = mostrarUsuario ? `<td>${m.usuario}</td>` : '';

        // Formatear método de pago
        let metodoTxt = m.metodo_pago;
        if (m.metodo_pago === 'efectivo') metodoTxt = '💵 Efectivo';
        if (m.metodo_pago === 'transferencia') metodoTxt = '🏦 Transferencia/Virtual';
        if (m.metodo_pago === 'otros') metodoTxt = '💳 Otros';

        // Formatear hora de fecha
        const horaStr = m.fecha.split(' ')[1] || m.fecha;

        tr.innerHTML = `
            <td style="color:var(--text-muted);font-weight:600;">${horaStr}</td>
            ${userCell}
            <td><span class="badge-movement ${badgeClass}">${tipoTxt}</span></td>
            <td style="font-weight:500;">${metodoTxt}</td>
            <td style="font-weight:700;" class="${montoColor}">${montoSigno} S/ ${m.monto.toFixed(2)}</td>
            <td style="max-width:300px;word-wrap:break-word;">${m.descripcion}</td>
        `;
        tbody.appendChild(tr);
    });
}

function registrarMovimiento(e) {
    e.preventDefault();

    const tipo_movimiento = document.getElementById('tipo_movimiento').value;
    const metodo_pago = document.getElementById('metodo_pago').value;
    const monto = document.getElementById('monto').value;
    const descripcion = document.getElementById('descripcion').value.trim();

    // Validar en cliente de acuerdo a permisos locales cargados en badges
    if (metodo_pago === 'efectivo') {
        const badge = document.getElementById('permiso-badge-efectivo');
        if (badge && badge.textContent === 'No Permitido') {
            SITAlert.show('No tiene permiso para registrar transacciones en Efectivo.', 'error');
            return;
        }
    }
    if (metodo_pago === 'transferencia') {
        const badge = document.getElementById('permiso-badge-transferencia');
        if (badge && badge.textContent === 'No Permitido') {
            SITAlert.show('No tiene permiso para registrar transacciones por Transferencia.', 'error');
            return;
        }
    }

    // Validar si el canal está permitido en la caja
    if (window.CURRENT_CAJA_RECAUDO) {
        if (metodo_pago === 'efectivo' && !window.CURRENT_CAJA_RECAUDO.efectivo) {
            SITAlert.show('El método de pago Efectivo no está permitido en esta caja.', 'error');
            return;
        }
        if (metodo_pago === 'transferencia' && !window.CURRENT_CAJA_RECAUDO.transferencia) {
            SITAlert.show('Los cobros o egresos bancarios/virtuales no están permitidos en esta caja.', 'error');
            return;
        }
    }

    fetch('/api/caja/registrar/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            tipo_movimiento: tipo_movimiento,
            metodo_pago: metodo_pago,
            monto: monto,
            descripcion: descripcion
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            SITAlert.show(data.message, 'success');
            // Limpiar inputs
            document.getElementById('monto').value = '';
            document.getElementById('descripcion').value = '';
            // Recargar datos
            cargarDatosCaja();
        } else {
            SITAlert.show(data.message || 'Error al registrar movimiento', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        SITAlert.show('Fallo de red al registrar transacción', 'error');
    });
}

// Helpers
function formatearSoles(valor) {
    return `S/ ${parseFloat(valor).toFixed(2)}`;
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

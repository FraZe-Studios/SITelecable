/**
 * ticket-simple.js  —  Módulo global de ticket de atención
 * Único punto de verdad para generar el HTML del ticket A5 landscape.
 * Usado en: organizacion (vista previa + config tickets) y cliente (ficha).
 */

/**
 * Genera el HTML interno del ticket de atención (sin ventana, sin overlay).
 * Todo el contenido está ajustado para caber en 210mm × 148mm (A5 landscape)
 * sin overflow ni scroll.
 */
window.generateSimpleTicketHTML = (
    logoUrl,
    ticketNumber,
    categoria       = 'INCIDENCIA',
    telefono        = '064466080',
    sede            = 'LA OROYA',
    clienteData     = {},
    servicioData    = {},
    ticketData      = {},
    ticketNombre    = ''
) => {
    // Logo
    const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="Logo" style="max-height:30px;object-fit:contain;">`
        : `<div style="font-size:14pt;font-weight:800;color:#0056b3;letter-spacing:-0.5px;line-height:1;">telecable</div>`;

    // Título (categorías automáticas usan el nombre del ticket)
    const CATS_AUTO = ['INSTALACION','CORTES','RETIROS LOGICOS','RETIRO DE MATERIALES'];
    const tituloTicket = (CATS_AUTO.includes((categoria || '').toUpperCase()) && ticketNombre)
        ? ticketNombre
        : categoria;

    // Encabezado
    const headerHtml = `
        <div style="display:flex;align-items:center;gap:5mm;width:100%;
                    border-bottom:1.5px solid #000;padding-bottom:2mm;">
            <div style="flex-shrink:0;">${logoHtml}</div>
            <div style="display:flex;flex-direction:column;gap:0.5mm;">
                <div style="font-size:7pt;font-weight:600;color:#1f2937;">Telf. ${telefono}</div>
                <div style="font-size:7pt;font-weight:600;color:#1f2937;">Sede: ${(sede||'').toUpperCase()}</div>
            </div>
            <div style="flex-grow:1;text-align:center;">
                <div style="font-size:11pt;font-weight:800;color:#1f2937;text-transform:uppercase;">
                    Orden &mdash; ${tituloTicket.toUpperCase()}
                </div>
            </div>
            <div style="flex-shrink:0;">
                <div style="font-size:9pt;font-weight:800;color:#1f2937;">N&deg;${ticketNumber}</div>
            </div>
        </div>`;

    return `
        <div style="width:210mm;height:148mm;display:flex;flex-direction:column;
                    padding:3mm 10px;box-sizing:border-box;
                    font-family:Arial,sans-serif;background:#fff;
                    overflow:hidden;">

            ${headerHtml}

            <!-- Dos columnas -->
            <div style="margin-top:2mm;display:grid;grid-template-columns:1fr 1fr;gap:3mm;min-height:0;">

                <!-- Izquierda: cliente y servicio -->
                <div style="display:flex;flex-direction:column;gap:1mm;font-size:7.5pt;color:#1f2937;overflow:hidden;">
                    <div><strong>Abonado:</strong> ${clienteData.nombre    || '&mdash;'}</div>
                    <div><strong>D.N.I:</strong> ${clienteData.dni         || '&mdash;'}</div>
                    <div><strong>C&oacute;digo:</strong> ${clienteData.codigo    || '&mdash;'}</div>
                    <div><strong>Contrato:</strong> ${clienteData.contrato  || '&mdash;'}</div>
                    <div style="display:flex;gap:4mm;">
                        <div><strong>Tel&eacute;fono:</strong> ${clienteData.celular1 || '&mdash;'}</div>
                        <div><strong>Celular:</strong> ${clienteData.celular2 || '&mdash;'}</div>
                    </div>
                    <div><strong>Direcci&oacute;n:</strong> ${clienteData.direccion || '&mdash;'}</div>
                    <div><strong>Suministro:</strong> ${servicioData.suministro || '&mdash;'}</div>
                    <div><strong>Sector:</strong> ${clienteData.sector      || '&mdash;'}</div>
                    <div><strong>Plan:</strong> ${servicioData.plan         || '&mdash;'}</div>
                    <div>
                        <strong>Servicio:</strong> ${servicioData.codigo    || '&mdash;'} |
                        <strong>Velocidad:</strong> ${servicioData.velocidad || '&mdash;'} |
                        <strong>Estado:</strong> ${servicioData.estado       || '&mdash;'}
                    </div>
                    <div><strong>Anexos:</strong> ${servicioData.anexos     || '&mdash;'}</div>
                    <div style="display:flex;gap:4mm;">
                        <div><strong>NAP:</strong> ${servicioData.nap       || '&mdash;'}</div>
                        <div><strong>Puerto:</strong> ${servicioData.puerto  || '&mdash;'}</div>
                        <div><strong>Precinto:</strong> ${servicioData.precinto || '&mdash;'}</div>
                    </div>
                    <div><strong>Serie Equipo:</strong> ${servicioData.serie_equipo || '&mdash;'}</div>
                    <div><strong>MAC Equipo:</strong> ${servicioData.mac_equipo   || '&mdash;'}</div>
                </div>

                <!-- Derecha: ticket -->
                <div style="display:flex;flex-direction:column;gap:1mm;font-size:7.5pt;color:#1f2937;overflow:hidden;">
                    <div><strong>Motivo:</strong> ${ticketData.motivo  || '&mdash;'}</div>
                    <div><strong>Detalle:</strong> ${ticketData.detalle || '&mdash;'}</div>
                    <div style="display:flex;gap:4mm;">
                        <div><strong>Fecha emisi&oacute;n:</strong> ${ticketData.fecha_emision || '&mdash;'}</div>
                        <div><strong>Hora emisi&oacute;n:</strong> ${ticketData.hora_emision   || '&mdash;'}</div>
                    </div>
                    <div style="display:flex;gap:4mm;">
                        <div><strong>Fecha atenci&oacute;n:</strong> ${ticketData.fecha_atencion || '&mdash;'}</div>
                        <div><strong>Hora atenci&oacute;n:</strong> ${ticketData.hora_atencion   || '&mdash;'}</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2mm;margin-top:1.5mm;">
                        <div>
                            <div style="margin-bottom:0.5mm;"><strong>Materiales usados:</strong></div>
                            <div style="height:18mm;border:1px solid #ccc;background:#f2f2f2;padding:1.5mm;font-size:7pt;overflow:hidden;box-sizing:border-box;">
                                ${ticketData.materiales_usados || '&mdash;'}
                            </div>
                        </div>
                        <div>
                            <div style="margin-bottom:0.5mm;"><strong>Materiales retirados:</strong></div>
                            <div style="height:18mm;border:1px solid #ccc;background:#f2f2f2;padding:1.5mm;font-size:7pt;overflow:hidden;box-sizing:border-box;">
                                ${ticketData.materiales_retirados || '&mdash;'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Observaci\u00f3n -->
            <div style="margin-top:1.5mm;">
                <div style="margin-bottom:0.5mm;font-size:7.5pt;font-weight:700;color:#1f2937;">
                    <strong>Observaci&oacute;n:</strong>
                </div>
                <div style="height:10mm;border:1px solid #ccc;background:#f2f2f2;padding:1.5mm;font-size:7pt;overflow:hidden;box-sizing:border-box;">
                    ${ticketData.observacion || '&mdash;'}
                </div>
            </div>

            <!-- Firmas -->
            <div style="margin-top:4mm;padding-top:2mm;
                        display:grid;grid-template-columns:1fr 1fr;gap:6mm;">
                <div style="text-align:center;">
                    <div style="height:6mm;"></div>
                    <div style="font-size:7pt;font-weight:700;color:#1f2937;margin-top:0.5mm;">Firma del cliente</div>
                    <div style="margin-top:0.5mm;text-align:left;font-size:6.5pt;color:#1f2937;">
                        <div><strong>Apellidos y nombre:</strong> _____________________</div>
                        <div><strong>DNI:</strong> _____________________</div>
                    </div>
                </div>
                <div style="text-align:center;">
                    <div style="height:6mm;"></div>
                    <div style="font-size:7pt;font-weight:700;color:#1f2937;margin-top:0.5mm;">Firma del t&eacute;cnico</div>
                    <div style="margin-top:0.5mm;text-align:left;font-size:6.5pt;color:#1f2937;">
                        <div><strong>Apellidos y nombre:</strong> _____________________</div>
                        <div><strong>DNI:</strong> _____________________</div>
                    </div>
                </div>
            </div>
        </div>`;
};


/**
 * Muestra el ticket como overlay en la misma página.
 *
 * Diseño:
 *   · Fondo oscuro semitransparente con blur sobre la página actual
 *   · Ticket A5 landscape (210×148 mm) centrado, blanco, limpio — sin contenedores extra
 *   · Botones "Imprimir" y "×" flotando como burbujas sobre el borde superior derecho del ticket
 *   · Al imprimir (Ctrl+P / botón) solo sale el ticket — los botones desaparecen
 *   · Escape o clic en el fondo oscuro cierra el overlay
 */
window.imprimirTicket = (
    logoUrl, ticketNumber, categoria, telefono, sede,
    clienteData, servicioData, ticketData, ticketNombre
) => {
    // Evitar duplicados
    document.getElementById('__ticketOverlay')?.remove();

    const ticketHtml = window.generateSimpleTicketHTML(
        logoUrl, ticketNumber, categoria, telefono, sede,
        clienteData, servicioData, ticketData, ticketNombre
    );

    // Estilos @media print — inyectados una sola vez en <head>
    if (!document.getElementById('__ticketPrintStyles')) {
        const s = document.createElement('style');
        s.id = '__ticketPrintStyles';
        s.textContent = `
            @media print {
                body > *:not(#__ticketOverlay) { display:none !important; }
                #__ticketOverlay {
                    position:static !important;
                    background:transparent !important;
                    padding:0 !important;
                }
                .__tkfloat { display:none !important; }
                .__tkwrap {
                    position:static !important;
                    transform:none !important;
                    box-shadow:none !important;
                    overflow:visible !important;
                }
                @page { size:A5 landscape; margin:0; }
                * { -webkit-print-color-adjust:exact !important;
                    print-color-adjust:exact !important; }
            }`;
        document.head.appendChild(s);
    }

    // Overlay de fondo
    const overlay = document.createElement('div');
    overlay.id = '__ticketOverlay';
    Object.assign(overlay.style, {
        position:             'fixed',
        inset:                '0',
        zIndex:               '9999',
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'center',
        background:           'rgba(0,0,0,0.72)',
        backdropFilter:       'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding:              '0',
    });

    // Cerrar al click en el fondo oscuro
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // Wrapper: tamaño exacto A5 landscape, sin margen extra
    const wrap = document.createElement('div');
    wrap.className = '__tkwrap';
    Object.assign(wrap.style, {
        position:     'relative',
        width:        '210mm',
        height:       '148mm',
        minWidth:     '210mm',
        maxWidth:     '210mm',
        minHeight:    '148mm',
        maxHeight:    '148mm',
        background:   '#fff',
        overflow:     'hidden',
        borderRadius: '2px',
        boxShadow:    '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
    });

    wrap.innerHTML = ticketHtml;

    // Botones flotantes fuera del ticket (arriba a la derecha)
    const floatRow = document.createElement('div');
    floatRow.className = '__tkfloat';
    Object.assign(floatRow.style, {
        position:   'absolute',
        top:        '-52px',
        right:      '0',
        display:    'flex',
        gap:        '8px',
        alignItems: 'center',
    });

    // Botón imprimir
    const btnPrint = document.createElement('button');
    btnPrint.title = 'Imprimir ticket';
    btnPrint.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round"
             style="margin-right:6px;flex-shrink:0;">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Imprimir`;
    Object.assign(btnPrint.style, {
        display:       'flex',
        alignItems:    'center',
        padding:       '0 20px',
        height:        '40px',
        background:    '#1d4ed8',
        color:         '#fff',
        border:        'none',
        borderRadius:  '999px',
        fontSize:      '13px',
        fontWeight:    '700',
        letterSpacing: '0.02em',
        cursor:        'pointer',
        boxShadow:     '0 4px 16px rgba(29,78,216,0.45)',
        transition:    'background 0.15s, transform 0.1s',
        whiteSpace:    'nowrap',
    });
    btnPrint.addEventListener('click',      () => window.print());
    btnPrint.addEventListener('mouseenter', () => { btnPrint.style.background = '#1e40af'; });
    btnPrint.addEventListener('mouseleave', () => { btnPrint.style.background = '#1d4ed8'; });
    btnPrint.addEventListener('mousedown',  () => { btnPrint.style.transform  = 'scale(0.95)'; });
    btnPrint.addEventListener('mouseup',    () => { btnPrint.style.transform  = 'scale(1)'; });

    // Botón cerrar (×)
    const btnClose = document.createElement('button');
    btnClose.title = 'Cerrar (Esc)';
    btnClose.innerHTML = '&times;';
    Object.assign(btnClose.style, {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          '40px',
        height:         '40px',
        background:     'rgba(255,255,255,0.14)',
        color:          '#fff',
        border:         '1.5px solid rgba(255,255,255,0.3)',
        borderRadius:   '999px',
        fontSize:       '22px',
        fontWeight:     '300',
        lineHeight:     '1',
        cursor:         'pointer',
        boxShadow:      '0 4px 14px rgba(0,0,0,0.3)',
        transition:     'background 0.15s, transform 0.1s',
    });
    btnClose.addEventListener('click',      () => overlay.remove());
    btnClose.addEventListener('mouseenter', () => { btnClose.style.background = 'rgba(255,255,255,0.28)'; });
    btnClose.addEventListener('mouseleave', () => { btnClose.style.background = 'rgba(255,255,255,0.14)'; });
    btnClose.addEventListener('mousedown',  () => { btnClose.style.transform  = 'scale(0.92)'; });
    btnClose.addEventListener('mouseup',    () => { btnClose.style.transform  = 'scale(1)'; });

    floatRow.appendChild(btnPrint);
    floatRow.appendChild(btnClose);
    wrap.appendChild(floatRow);
    overlay.appendChild(wrap);
    document.body.appendChild(overlay);

    // Cerrar con Escape
    const onKey = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', onKey);
        }
    };
    document.addEventListener('keydown', onKey);
};

/**
 * organizacion-tabla.js
 * Lógica de la tabla, filtros y búsqueda
 */

document.addEventListener('DOMContentLoaded', () => {

    // ══════════════════════════════════════════════════════════════════════
    // TABLA DEL PANEL IZQUIERDO
    // ══════════════════════════════════════════════════════════════════════
    let currentFilter='TODOS', currentSearch='';

    const renderTable = () => {
        const tbody=document.getElementById('orgTableBody');
        const emptyEl=document.getElementById('orgEmptyState');
        const countEl=document.getElementById('itemCountDisplay');

        const filtered=window.allTableItems.filter(item => {
            const matchType  = currentFilter==='TODOS' || item.tipo===currentFilter;
            const matchSearch= !currentSearch || item.codigo.toLowerCase().includes(currentSearch.toLowerCase());
            return matchType && matchSearch;
        });

        tbody.innerHTML='';
        emptyEl.style.display = filtered.length===0 ? 'flex' : 'none';
        countEl.textContent   = filtered.length;

        filtered.forEach(item => {
            const cfg=window.TIPO_CONFIG[item.tipo];
            const tr=document.createElement('tr');
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
                if (e.target.closest('.row-btn')) return;
                document.querySelectorAll('#orgTableBody tr.selected').forEach(r=>r.classList.remove('selected'));
                tr.classList.add('selected');
                window.map.flyTo([item.lat, item.lng], 17, {duration:1});
                if (typeof item.marker.openPopup==='function') item.marker.openPopup();
            });

            // Botón editar
            tr.querySelector('.row-btn-edit').addEventListener('click', e => {
                e.stopPropagation();
                window.openModal(item.tipo, item.lat, item.lng, item);
            });

            // Botón eliminar
            tr.querySelector('.row-btn-delete').addEventListener('click', e => {
                e.stopPropagation();
                window.openConfirmDelete(item);
            });

            tbody.appendChild(tr);
        });
    };

    // Esperar a que allTableItems esté disponible (se carga en organizacion-mapa.js)
    const initTable = () => {
        if (window.allTableItems && window.allTableItems.length > 0) {
            renderTable();
        } else {
            setTimeout(initTable, 100);
        }
    };
    initTable();

    document.getElementById('orgSearchInput').addEventListener('input', e => { currentSearch=e.target.value.trim(); renderTable(); });
    document.querySelectorAll('.org-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.org-filter-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter=btn.dataset.type;
            renderTable();
        });
    });

});

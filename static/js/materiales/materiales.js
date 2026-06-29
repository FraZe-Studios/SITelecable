/**
 * Materiales y Equipos - Gestión de catálogo
 */

document.addEventListener('DOMContentLoaded', () => {
    
    const TIPO_MATERIAL_LABELS = {
        equipo: 'Equipo',
        materiales: 'Materiales'
    };

    let materialesCache = [];
    let editingMaterialId = null;
    let deleteMaterialId = null;
    let currentFilter = 'todos';

    // DOM Elements
    const materialesTableBody = document.getElementById('materialesTableBody');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchMaterial');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const materialModal = document.getElementById('materialModal');
    const confirmModal = document.getElementById('confirmModal');
    const materialForm = document.getElementById('materialForm');
    const modalTitle = document.getElementById('modalTitle');

    // Load materials on page load
    cargarMateriales();

    // Event Listeners
    document.getElementById('btnNuevoMaterial')?.addEventListener('click', () => openMaterialForm());
    document.getElementById('btnCloseModal')?.addEventListener('click', closeMaterialModal);
    document.getElementById('btnCancel')?.addEventListener('click', closeMaterialModal);
    document.getElementById('btnCloseConfirmModal')?.addEventListener('click', closeConfirmModal);
    document.getElementById('btnCancelDelete')?.addEventListener('click', closeConfirmModal);
    document.getElementById('btnConfirmDelete')?.addEventListener('click', confirmDelete);
    
    materialModal?.addEventListener('click', (e) => {
        if (e.target === materialModal) closeMaterialModal();
    });
    
    confirmModal?.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmModal();
    });

    materialForm?.addEventListener('submit', guardarMaterial);

    searchInput?.addEventListener('input', (e) => {
        filtrarMateriales(e.target.value, currentFilter);
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            filtrarMateriales(searchInput.value, currentFilter);
        });
    });

    // Functions
    async function cargarMateriales() {
        try {
            const resp = await fetch('/api/materiales/listar/');
            const res = await resp.json();
            if (res.status === 'success') {
                materialesCache = res.data;
                renderMateriales(materialesCache);
            }
        } catch (err) {
            console.error('Error al cargar materiales:', err);
        }
    }

    function renderMateriales(lista) {
        if (!materialesTableBody) return;

        if (!lista.length) {
            materialesTableBody.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        materialesTableBody.innerHTML = lista.map(m => `
            <tr data-material-id="${m.id}">
                <td><strong>${m.nombre}</strong></td>
                <td><span class="badge badge-${m.tipo_material}">${TIPO_MATERIAL_LABELS[m.tipo_material] || m.tipo_material}</span></td>
                <td>${m.requiere_mac ? 'Sí' : 'No'}</td>
                <td>${m.requiere_serie ? 'Sí' : 'No'}</td>
                <td>${m.descripcion || '-'}</td>
                <td style="text-align: right;">
                    <button class="btn-icon btn-edit" data-action="edit" data-id="${m.id}" title="Editar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" data-action="delete" data-id="${m.id}" title="Eliminar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');

        bindRowActions();
    }

    function bindRowActions() {
        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const material = materialesCache.find(m => m.id === parseInt(btn.dataset.id, 10));
                if (material) openMaterialForm(material);
            });
        });

        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteMaterialId = parseInt(btn.dataset.id, 10);
                confirmModal.style.display = 'flex';
            });
        });
    }

    function filtrarMateriales(searchTerm, filterType) {
        let filtered = materialesCache;

        // Apply type filter
        if (filterType !== 'todos') {
            filtered = filtered.filter(m => m.tipo_material === filterType);
        }

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(m => 
                m.nombre.toLowerCase().includes(term) ||
                (m.descripcion && m.descripcion.toLowerCase().includes(term))
            );
        }

        renderMateriales(filtered);
    }

    function openMaterialForm(material = null) {
        editingMaterialId = material?.id || null;
        modalTitle.textContent = material ? 'Editar material' : 'Nuevo material';
        
        materialForm.reset();
        
        if (material) {
            document.getElementById('nombre').value = material.nombre || '';
            document.getElementById('tipo_material').value = material.tipo_material || '';
            document.getElementById('requiere_mac').checked = material.requiere_mac || false;
            document.getElementById('requiere_serie').checked = material.requiere_serie || false;
            document.getElementById('descripcion').value = material.descripcion || '';
        }

        materialModal.style.display = 'flex';
    }

    function closeMaterialModal() {
        materialModal.style.display = 'none';
        materialForm.reset();
        editingMaterialId = null;
    }

    function closeConfirmModal() {
        confirmModal.style.display = 'none';
        deleteMaterialId = null;
    }

    async function guardarMaterial(e) {
        e.preventDefault();
        
        const data = {
            nombre: document.getElementById('nombre').value.trim(),
            tipo_material: document.getElementById('tipo_material').value,
            requiere_mac: document.getElementById('requiere_mac').checked,
            requiere_serie: document.getElementById('requiere_serie').checked,
            descripcion: document.getElementById('descripcion').value.trim(),
            activo: true
        };
        
        if (!data.tipo_material) {
            alert('Por favor seleccione un tipo de material');
            return;
        }

        if (editingMaterialId) {
            data.id = editingMaterialId;
        }

        const btn = materialForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            const url = editingMaterialId ? '/api/materiales/actualizar/' : '/api/materiales/crear/';
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(data),
            });
            const res = await resp.json();
            
            if (res.status === 'success') {
                await cargarMateriales();
                closeMaterialModal();
                alert('Material guardado correctamente.');
            } else {
                alert(`Error: ${res.message}`);
                if (res.errors) {
                    console.error('Errores de validación:', res.errors);
                }
            }
        } catch (err) {
            console.error('Error al guardar material:', err);
            alert('Error al guardar material.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar';
        }
    }

    async function confirmDelete() {
        if (!deleteMaterialId) return;

        try {
            const resp = await fetch('/api/materiales/eliminar/', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ id: deleteMaterialId }),
            });
            const res = await resp.json();
            
            if (res.status === 'success') {
                await cargarMateriales();
                closeConfirmModal();
                alert('Material eliminado correctamente.');
            } else {
                alert(`Error: ${res.message}`);
            }
        } catch (err) {
            console.error('Error al eliminar:', err);
            alert('Error al eliminar material.');
        }
    }

    // Helper function to get CSRF token
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
});

// Selector de cajas en la navbar global
(function() {
    // Cargar cajas autorizadas del usuario
    async function cargarCajasNavbar() {
        try {
            const response = await fetch('/api/caja/resumen/');
            if (!response.ok) return;
            
            const data = await response.json();
            const select = document.getElementById('navbar-caja-select');
            if (!select) return;
            
            // Limpiar opciones excepto la primera
            select.innerHTML = '<option value="">Seleccionar Caja</option>';
            
            // Agregar cajas autorizadas
            if (data.cajas_autorizadas && data.cajas_autorizadas.length > 0) {
                data.cajas_autorizadas.forEach(caja => {
                    const option = document.createElement('option');
                    option.value = caja.id;
                    option.textContent = caja.nombre;
                    select.appendChild(option);
                });
                
                // Seleccionar caja activa si existe
                if (data.active_caja) {
                    select.value = data.active_caja.id;
                }
            } else {
                select.disabled = true;
                select.innerHTML = '<option value="">Sin cajas asignadas</option>';
            }
        } catch (error) {
            console.error('Error al cargar cajas:', error);
        }
    }
    
    // Función global para seleccionar caja desde navbar
    window.seleccionarCajaDesdeNavbar = async function(cajaId) {
        if (!cajaId) return;
        
        try {
            const response = await fetch(`/api/caja/resumen/?set_active_caja_id=${cajaId}`);
            if (response.ok) {
                // Recargar página para aplicar cambios
                window.location.reload();
            }
        } catch (error) {
            console.error('Error al seleccionar caja:', error);
        }
    };
    
    // Cargar cajas al iniciar
    document.addEventListener('DOMContentLoaded', cargarCajasNavbar);
    
    // Recargar cajas periódicamente (cada 30 segundos)
    setInterval(cargarCajasNavbar, 30000);
})();

/**
 * organizacion-main.js
 * Configuración inicial, tema, drawer, avatar y sesión
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── Helpers ────────────────────────────────────────────────────────────
    window.getCookie = function(name){
        const val=`; ${document.cookie}`;
        const parts=val.split(`; ${name}=`);
        if(parts.length===2) return parts.pop().split(';').shift();
        return '';
    };

    // Animación spin
    const spinStyle=document.createElement('style');
    spinStyle.textContent=`@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(spinStyle);

    // ── Función: Cambio de Equipo ────────────────────────────────────────────
    const btnCambioEquipo = document.getElementById('btnCambioEquipo');
    if (btnCambioEquipo) {
        btnCambioEquipo.addEventListener('click', async () => {
            // Solicitar datos del cambio de equipo
            const equipoAnterior = prompt('Equipo anterior:');
            if (!equipoAnterior) return;
            
            const equipoNuevo = prompt('Equipo nuevo:');
            if (!equipoNuevo) return;
            
            const motivo = prompt('Motivo del cambio:');
            
            // Confirmar acción
            if (!confirm(`¿Confirmar cambio de equipo?\n\nDe: ${equipoAnterior}\nA: ${equipoNuevo}\nMotivo: ${motivo || 'No especificado'}`)) {
                return;
            }
            
            try {
                // Aquí se llamaría a la API para activar la función
                // Por ahora, mostramos un mensaje de confirmación
                alert('Función de cambio de equipo activada correctamente.\n\nEl flujo de reemplazo de dispositivo se ha iniciado.');
                
                // TODO: Integrar con la API real cuando esté disponible
                // const response = await fetch('/api/ticket/<ticket_id>/cambio-equipo/', {
                //     method: 'POST',
                //     headers: {
                //         'Content-Type': 'application/json',
                //         'X-CSRFToken': getCookie('csrftoken')
                //     },
                //     body: JSON.stringify({
                //         equipo_anterior: equipoAnterior,
                //         equipo_nuevo: equipoNuevo,
                //         motivo: motivo
                //     })
                // });
                
            } catch (error) {
                console.error('Error al activar cambio de equipo:', error);
                alert('Error al activar la función de cambio de equipo. Por favor, intente nuevamente.');
            }
        });
    }
});

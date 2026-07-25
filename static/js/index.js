// index.js

function abrirModalEliminar(id, nombre) {
    document.getElementById('nombreProductoEliminar').innerText = nombre;
    document.getElementById('formEliminar').action = '/eliminar/' + id;
    document.getElementById('modalEliminar').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalEliminar').style.display = 'none';
}

async function toggleFavorito(boton, productoId) {
    const eraFavorito = boton.classList.contains('activo');
    try {
        const resp = await fetch('/api/toggle_favorito', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ producto_id: productoId, favorito: !eraFavorito })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            boton.classList.toggle('activo');
            boton.textContent = eraFavorito ? '☆' : '⭐';
            boton.title = eraFavorito ? 'Marcar como acceso rápido en Ventas' : 'Quitar de accesos rápidos';
        }
    } catch (e) {
        console.error('Error al marcar favorito', e);
    }
}

// ocultar flash después de 3 segundos
window.onload = function() {
    const flashMessage = document.getElementById('flash-message');
    if (flashMessage) {
        setTimeout(function() {
            flashMessage.style.opacity = '0';
            setTimeout(function() { flashMessage.remove(); }, 600);
        }, 3000);
    }
};

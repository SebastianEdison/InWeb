// index.js

function abrirModalEliminar(id, nombre) {
    document.getElementById('nombreProductoEliminar').innerText = nombre;
    document.getElementById('formEliminar').action = '/eliminar/' + id;
    document.getElementById('modalEliminar').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalEliminar').style.display = 'none';
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

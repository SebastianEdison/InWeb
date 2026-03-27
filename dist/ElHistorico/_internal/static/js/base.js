// base.js

function confirmarLogout() {
    const total = parseInt(localStorage.getItem('venta_total_dia') || 0);
    if (total > 0) {
        return confirm('⚠️ Aún no has cerrado la caja.\n\n¿Estás seguro de que deseas salir sin cerrar caja?');
    }
    return true;
}

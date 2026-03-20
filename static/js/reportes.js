document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos de las tarjetas al entrar
    cargarDatosTarjetas();
    // Por defecto mostramos la tabla de muertos
    verDetalle('muertos', document.querySelector('.tab-link.active'));
});

async function cargarDatosTarjetas() {
    // Aquí iría tu fetch a Python para llenar los h2 de las tarjetas
    // Por ahora simulamos la recuperación de localStorage para coherencia con Ventas
    const ingresos = localStorage.getItem('venta_total_dia') || 0;
    const fiados = localStorage.getItem('total_fiado_dia') || 0;
    
    document.getElementById('rep-ingresos').innerText = `$${parseInt(ingresos).toLocaleString('es-CL')}`;
    document.getElementById('rep-fiados').innerText = `$${parseInt(fiados).toLocaleString('es-CL')}`;
}

function verDetalle(tipo, elemento) {
    // 1. Manejar estado visual de los botones
    document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
    elemento.classList.add('active');

    const header = document.getElementById('tabla-header');
    const titulo = document.getElementById('titulo-detalle');
    const body = document.getElementById('tabla-body');

    // 2. Cambiar encabezados y título según la opción
    if (tipo === 'muertos') {
        titulo.innerText = "Lista de Productos Muertos (Sin ventas en 30 días)";
        header.innerHTML = `
            <th>Código</th>
            <th>Producto</th>
            <th>Última Venta</th>
            <th>Stock Actual</th>
            <th>Precio</th>
        `;
        // Aquí cargarías los datos reales desde Python
        body.innerHTML = '<tr><td colspan="5">No hay productos muertos registrados.</td></tr>';
    } else {
        titulo.innerText = "Lista de Productos Próximos a Vencer";
        header.innerHTML = `
            <th>Producto</th>
            <th>Fecha Vencimiento</th>
            <th>Días Restantes</th>
            <th>Stock</th>
            <th>Acción</th>
        `;
        body.innerHTML = '<tr><td colspan="5">No hay productos próximos a vencer.</td></tr>';
    }
}
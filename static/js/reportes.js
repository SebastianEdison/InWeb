/**
 * Evento principal: Se ejecuta cuando la página carga
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Panel de control cargado correctamente.");
    
    // 1. Cargamos los totales en las tarjetas superiores (Venta en vivo)
    cargarDatosTarjetas();
    
    // 2. Forzamos la carga de la tabla de "Informes Diarios" por defecto
    mostrarDetalle('diario');

    // --- NUEVO: Escuchar cambios en el calendario de fecha ---
    const filtroFecha = document.getElementById('fecha-busqueda'); // Verifica que este ID esté en tu HTML
    if (filtroFecha) {
        filtroFecha.addEventListener('change', (e) => {
            const fechaSeleccionada = e.target.value; // Formato YYYY-MM-DD
            if (fechaSeleccionada) {
                // Convertimos YYYY-MM-DD a DD-MM-YYYY para que coincida con la DB
                const partes = fechaSeleccionada.split('-');
                const fechaFormateada = `${partes[2]}-${partes[1]}-${partes[0]}`;
                
                console.log("Filtrando por fecha:", fechaFormateada);
                mostrarDetalle('diario', fechaFormateada);
            }
        });
    }
});

/**
 * Carga los valores de la venta EN CURSO (lo que hay en localStorage actualmente)
 */
function cargarDatosTarjetas() {
    const efectivo = parseInt(localStorage.getItem('total_efectivo') || 0);
    const tarjeta = parseInt(localStorage.getItem('total_tarjeta') || 0);
    const otros = parseInt(localStorage.getItem('total_otros') || 0);
    const fiados = parseInt(localStorage.getItem('total_fiados') || 0);

    const totalRecaudado = efectivo + tarjeta + otros;

    const repIngresos = document.getElementById('rep-ingresos');
    const repFiados = document.getElementById('rep-fiados');

    if (repIngresos) {
        repIngresos.innerText = `$${totalRecaudado.toLocaleString('es-CL')}`;
    }
    if (repFiados) {
        repFiados.innerText = `$${fiados.toLocaleString('es-CL')}`;
    }
    
    const labelIngresos = document.querySelector('.card-ingresos .label');
    if (labelIngresos) labelIngresos.innerText = "Recaudado en Turno";
}

/**
 * Cambia el contenido de la tabla inferior y permite filtrar por fecha
 * @param {string} tipo - El tipo de reporte
 * @param {string} fechaParaFiltrar - Fecha opcional en formato DD-MM-YYYY
 */
async function mostrarDetalle(tipo, fechaParaFiltrar = "") {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body = document.getElementById('tabla-body');

    if (!titulo || !header || !body) return;

    // --- 1. CASO: INFORMES DIARIOS (Historial desde DB) ---
    if (tipo === 'diario') {
        titulo.innerText = fechaParaFiltrar ? `Cierres del día ${fechaParaFiltrar}` : "Historial de Cierres de Caja";
        header.innerHTML = `
            <th>Fecha / Turno</th>
            <th>Desglose de Pagos</th>
            <th>Total Caja</th>
            <th>Acciones</th>
        `;

        try {
            // Si hay fecha, la pasamos como parámetro ?fecha=...
            let url = '/api/historial';
            if (fechaParaFiltrar) {
                url += `?fecha=${fechaParaFiltrar}`;
            }

            const respuesta = await fetch(url);
            const datos = await respuesta.json();
            const cierres = datos.cierres;

            let filasHtml = "";
            
            if (!cierres || cierres.length === 0) {
                filasHtml = `<tr><td colspan="4">No se encontraron cierres para esta selección.</td></tr>`;
            } else {
                cierres.forEach(c => {
                    const efectivo = c.efectivo || 0;
                    const tarjeta = c.tarjeta || 0;
                    const otros = c.otros || 0;
                    const fiados = c.fiados || 0;
                    const total = c.total || 0;

                    filasHtml += `
                        <tr class="fila-turno">
                            <td>
                                <strong>${c.fecha}</strong><br>
                                <small style="color: #64748b;">${c.turno || 'Único'}</small>
                            </td>
                            <td>
                                <div class="desglose-pagos" style="font-size: 0.85rem; text-align: left; line-height: 1.4;">
                                    <span><i class="fas fa-money-bill-wave" style="color: #10b981; width: 15px;"></i> Efec: $${efectivo.toLocaleString('es-CL')}</span><br>
                                    <span><i class="far fa-credit-card" style="color: #3b82f6; width: 15px;"></i> Tarj: $${tarjeta.toLocaleString('es-CL')}</span><br>
                                    <span><i class="fas fa-wallet" style="color: #8b5cf6; width: 15px;"></i> Otro: $${otros.toLocaleString('es-CL')}</span><br>
                                    <span style="color: #64748b; border-top: 1px solid #eee; display: block; margin-top: 2px;">
                                        <i class="fas fa-user-tag" style="width: 15px;"></i> Fiad: $${fiados.toLocaleString('es-CL')}
                                    </span>
                                </div>
                            </td>
                            <td>
                                <strong style="font-size: 1.1rem; color: #1e293b;">$${total.toLocaleString('es-CL')}</strong>
                            </td>
                            <td>
                                <button class="btn-ver-ticket" onclick="verTicketLocal()" 
                                        style="border:none; background:#f1f5f9; padding: 8px; border-radius: 6px; cursor:pointer;">
                                    <i class="fas fa-eye" style="color: #3b82f6;"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }
            body.innerHTML = filasHtml;

        } catch (error) {
            console.error("Error al cargar historial:", error);
            body.innerHTML = `<tr><td colspan="4" style="color:red;">Error de conexión con el servidor</td></tr>`;
        }
    } 

    // --- 2. CASO: PRODUCTOS MUERTOS ---
    else if (tipo === 'muertos') {
        titulo.innerText = "Lista de Productos Muertos";
        header.innerHTML = `<th>Código</th><th>Producto</th><th>Días sin Venta</th><th>Stock</th>`;
        body.innerHTML = `<tr><td colspan="4">No se encontraron productos sin movimiento en los últimos 30 días.</td></tr>`;
    } 
    
    // --- 3. CASO: PRÓXIMOS A VENCER ---
    else if (tipo === 'vencer') {
        titulo.innerText = "Productos Próximos a Vencer";
        header.innerHTML = `<th>Producto</th><th>Fecha Vencimiento</th><th>Estado</th>`;
        body.innerHTML = `<tr><td colspan="3">No hay productos con fecha de vencimiento próxima.</td></tr>`;
    }
}

/**
 * Redirige a la página del último ticket generado
 */
function verTicketLocal() {
    window.location.href = '/detalle_cierre';
}
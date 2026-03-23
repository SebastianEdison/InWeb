/**
 * reportes.js
 * Panel de control con ventas reales desde la DB
 */

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosTarjetas();
    mostrarDetalle('diario');

    const filtroFecha = document.getElementById('fecha-busqueda');
    if (filtroFecha) {
        filtroFecha.addEventListener('change', (e) => {
            const fechaSeleccionada = e.target.value;
            if (fechaSeleccionada) {
                mostrarDetalle('diario', fechaSeleccionada);
            } else {
                mostrarDetalle('diario');
            }
        });
    }
});

// ============================================================
// --- TARJETAS SUPERIORES ---
// ============================================================

function cargarDatosTarjetas() {
    const efectivo = parseInt(localStorage.getItem('total_efectivo') || 0);
    const tarjeta  = parseInt(localStorage.getItem('total_tarjeta')  || 0);
    const otros    = parseInt(localStorage.getItem('total_otros')    || 0);
    const fiados   = parseInt(localStorage.getItem('total_fiados')   || 0);
    const total    = efectivo + tarjeta + otros;

    const repIngresos = document.getElementById('rep-ingresos');
    const repFiados   = document.getElementById('rep-fiados');

    if (repIngresos) repIngresos.innerText = `$${total.toLocaleString('es-CL')}`;
    if (repFiados)   repFiados.innerText   = `$${fiados.toLocaleString('es-CL')}`;

    const labelIngresos = document.querySelector('.card-ingresos .label');
    if (labelIngresos) labelIngresos.innerText = "Recaudado en Turno";
}

// ============================================================
// --- MOSTRAR DETALLE SEGÚN TARJETA ---
// ============================================================

async function mostrarDetalle(tipo, fechaParam = "") {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    if (!titulo || !header || !body) return;

    // ── INFORMES DIARIOS ──────────────────────────────────────
    if (tipo === 'diario') {
        titulo.innerText = fechaParam
            ? `Ventas del día ${formatearFechaDisplay(fechaParam)}`
            : "Historial de Ventas por Día";

        header.innerHTML = `
            <th style="width:180px;">Fecha</th>
            <th style="width:100px;">Ventas</th>
            <th>Desglose</th>
            <th style="width:130px;">Total del Día</th>
            <th style="width:50px;"></th>
        `;

        body.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">
                    <i class="fas fa-spinner fa-spin"></i> Cargando...
                </td>
            </tr>
        `;

        try {
            let url = '/api/ventas_por_dia';
            if (fechaParam) url += `?fecha=${fechaParam}`;

            const respuesta = await fetch(url);
            const datos     = await respuesta.json();
            const dias      = datos.dias;

            if (!dias || dias.length === 0) {
                body.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">
                            No hay ventas registradas para esta selección.
                        </td>
                    </tr>
                `;
                return;
            }

            let html = "";
            dias.forEach((dia, idx) => {
                const efectivo = dia.efectivo || 0;
                const tarjeta  = dia.tarjeta  || 0;
                const otros    = dia.otros    || 0;
                const total    = dia.total_dia || 0;

                // Fila resumen del día
                html += `
                    <tr class="fila-dia" style="background:#f8fafc; cursor:pointer;"
                        onclick="toggleDia('dia-${idx}', this)">
                        <td style="font-weight:700; color:#1e293b;">
                            <i class="fas fa-chevron-right toggle-icon" 
                               style="margin-right:8px; font-size:0.75rem; color:#94a3b8; transition:transform 0.2s;"></i>
                            ${formatearFechaDisplay(dia.dia)}
                        </td>
                        <td style="text-align:center;">
                            <span style="background:#eff6ff; color:#3b82f6; padding:3px 10px; 
                                         border-radius:20px; font-size:0.8rem; font-weight:700;">
                                ${dia.total_ventas} venta${dia.total_ventas !== 1 ? 's' : ''}
                            </span>
                        </td>
                        <td>
                            <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.82rem;">
                                <span><i class="fas fa-money-bill-wave" style="color:#10b981;"></i> 
                                    Efec: <strong>$${efectivo.toLocaleString('es-CL')}</strong></span>
                                <span><i class="fas fa-credit-card" style="color:#3b82f6;"></i> 
                                    Tarj: <strong>$${tarjeta.toLocaleString('es-CL')}</strong></span>
                                <span><i class="fas fa-wallet" style="color:#f59e0b;"></i> 
                                    Otros: <strong>$${otros.toLocaleString('es-CL')}</strong></span>
                            </div>
                        </td>
                        <td>
                            <strong style="font-size:1.05rem; color:#1e293b;">
                                $${total.toLocaleString('es-CL')}
                            </strong>
                        </td>
                        <td></td>
                    </tr>
                `;

                // Filas expandibles — detalle de cada venta del día
                html += `
                    <tr id="dia-${idx}" style="display:none;">
                        <td colspan="5" style="padding:0; background:#fff;">
                            <div style="padding:10px 20px 15px 40px;">
                `;

                if (!dia.ventas || dia.ventas.length === 0) {
                    html += `<p style="color:#94a3b8; font-size:0.85rem;">Sin detalle disponible.</p>`;
                } else {
                    dia.ventas.forEach((venta, vIdx) => {
                        const hora = venta.fecha ? venta.fecha.split(' ')[1]?.substring(0,5) : '--:--';
                        const metodoIcon = {
                            'efectivo': '💵', 'tarjeta': '💳', 'otros': '📱'
                        }[venta.metodo_pago] || '💰';

                        html += `
                            <div style="border:1px solid #e2e8f0; border-radius:10px; 
                                        margin-bottom:8px; overflow:hidden;">
                                
                                <!-- Cabecera de la venta -->
                                <div style="display:flex; justify-content:space-between; align-items:center;
                                            padding:10px 15px; background:#f1f5f9; cursor:pointer;"
                                     onclick="toggleVenta('venta-${idx}-${vIdx}', this)">
                                    <span style="font-weight:600; color:#1e293b; font-size:0.9rem;">
                                        <i class="fas fa-chevron-right toggle-icon" 
                                           style="margin-right:6px; font-size:0.7rem; color:#94a3b8; transition:transform 0.2s;"></i>
                                        Venta #${venta.id} — ${hora}
                                    </span>
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <span style="font-size:0.8rem; color:#64748b;">
                                            ${metodoIcon} ${venta.metodo_pago}
                                        </span>
                                        <strong style="color:#1e293b;">
                                            $${(venta.total || 0).toLocaleString('es-CL')}
                                        </strong>
                                    </div>
                                </div>

                                <!-- Detalle de productos de la venta -->
                                <div id="venta-${idx}-${vIdx}" style="display:none; padding:10px 15px;">
                        `;

                        if (!venta.productos || venta.productos.length === 0) {
                            html += `<p style="color:#94a3b8; font-size:0.82rem;">Sin productos registrados.</p>`;
                        } else {
                            html += `
                                <table style="width:100%; font-size:0.82rem; border-collapse:collapse;">
                                    <thead>
                                        <tr style="color:#64748b; border-bottom:1px solid #e2e8f0;">
                                            <th style="padding:5px 8px; text-align:left; font-weight:600;">Producto</th>
                                            <th style="padding:5px 8px; text-align:center; font-weight:600;">Cant.</th>
                                            <th style="padding:5px 8px; text-align:right; font-weight:600;">P. Unit.</th>
                                            <th style="padding:5px 8px; text-align:right; font-weight:600;">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                            `;
                            venta.productos.forEach(prod => {
                                html += `
                                    <tr style="border-bottom:1px solid #f8fafc;">
                                        <td style="padding:6px 8px; color:#334155;">${prod.nombre}</td>
                                        <td style="padding:6px 8px; text-align:center; color:#64748b;">${prod.cantidad}</td>
                                        <td style="padding:6px 8px; text-align:right; color:#64748b;">$${(prod.precio_unitario || 0).toLocaleString('es-CL')}</td>
                                        <td style="padding:6px 8px; text-align:right; font-weight:600; color:#1e293b;">$${(prod.subtotal || 0).toLocaleString('es-CL')}</td>
                                    </tr>
                                `;
                            });
                            html += `</tbody></table>`;
                        }

                        html += `</div></div>`;
                    });
                }

                html += `</div></td></tr>`;
            });

            body.innerHTML = html;

        } catch (error) {
            console.error("Error al cargar ventas:", error);
            body.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:30px; color:#ef4444;">
                        Error de conexión con el servidor.
                    </td>
                </tr>
            `;
        }
    }

    // ── PRODUCTOS MUERTOS ─────────────────────────────────────
    else if (tipo === 'muertos') {
        titulo.innerText = "Lista de Productos Muertos";
        header.innerHTML = `<th>Código</th><th>Producto</th><th>Días sin Venta</th><th>Stock</th>`;
        body.innerHTML   = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">No se encontraron productos sin movimiento en los últimos 30 días.</td></tr>`;
    }

    // ── PRÓXIMOS A VENCER ─────────────────────────────────────
    else if (tipo === 'vencer') {
        titulo.innerText = "Productos Próximos a Vencer";
        header.innerHTML = `<th>Producto</th><th>Fecha Vencimiento</th><th>Estado</th>`;
        body.innerHTML   = `<tr><td colspan="3" style="text-align:center; padding:30px; color:#94a3b8;">No hay productos con fecha de vencimiento próxima.</td></tr>`;
    }
}

// ============================================================
// --- TOGGLE EXPANDIR / CONTRAER ---
// ============================================================

function toggleDia(id, fila) {
    const contenido = document.getElementById(id);
    if (!contenido) return;

    const icon = fila.querySelector('.toggle-icon');
    const visible = contenido.style.display !== 'none';

    contenido.style.display = visible ? 'none' : 'table-row';
    if (icon) icon.style.transform = visible ? 'rotate(0deg)' : 'rotate(90deg)';
}

function toggleVenta(id, cabecera) {
    const contenido = document.getElementById(id);
    if (!contenido) return;

    const icon = cabecera.querySelector('.toggle-icon');
    const visible = contenido.style.display !== 'none';

    contenido.style.display = visible ? 'none' : 'block';
    if (icon) icon.style.transform = visible ? 'rotate(0deg)' : 'rotate(90deg)';
}

// ============================================================
// --- HELPERS ---
// ============================================================

function formatearFechaDisplay(fecha) {
    // Acepta tanto YYYY-MM-DD como DD-MM-YYYY
    if (!fecha) return '';

    let anio, mes, dia;

    if (fecha.includes('-') && fecha.split('-')[0].length === 4) {
        // Formato YYYY-MM-DD
        [anio, mes, dia] = fecha.split('-');
    } else if (fecha.includes('-')) {
        // Formato DD-MM-YYYY
        [dia, mes, anio] = fecha.split('-');
    } else {
        return fecha;
    }

    const meses = [
        'enero','febrero','marzo','abril','mayo','junio',
        'julio','agosto','septiembre','octubre','noviembre','diciembre'
    ];

    return `${parseInt(dia)} de ${meses[parseInt(mes) - 1]} de ${anio}`;
}

function verTicketLocal() {
    window.location.href = '/detalle_cierre';
}
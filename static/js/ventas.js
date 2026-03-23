// static/js/ventas.js

document.addEventListener('DOMContentLoaded', () => {
    const buscador = document.getElementById('buscador-ventas');
    const listaSugerencias = document.getElementById('lista-sugerencias');
    const inputRecibido = document.getElementById('monto-recibido');
    let timeoutBusqueda;

    actualizarInterfazVentas();

    const carritoGuardado = JSON.parse(localStorage.getItem('carrito_actual') || "[]");
    if (carritoGuardado.length > 0) {
        reconstruirCarritoDesdeStorage(carritoGuardado);
    }

    if (buscador) {
        buscador.addEventListener('input', () => {
            const query = buscador.value.trim();
            clearTimeout(timeoutBusqueda);

            if (query.length < 2) {
                listaSugerencias.innerHTML = "";
                listaSugerencias.style.display = "none";
                return;
            }

            timeoutBusqueda = setTimeout(async () => {
                try {
                    const response = await fetch(`/buscar_producto?busqueda=${query}`);
                    const productos = await response.json();
                    const productoExacto = productos.find(p => p.codigo_barra === query);

                    if (productoExacto) {
                        agregarAlCarrito(productoExacto);
                        buscador.value = "";
                        listaSugerencias.style.display = "none";
                        return;
                    }

                    listaSugerencias.innerHTML = "";
                    if (productos.length > 0) {
                        listaSugerencias.style.display = "block";
                        productos.forEach(p => {
                            const li = document.createElement('li');
                            li.innerHTML = `
                                <span class="nombre-sugerencia">
                                    ${p.nombre}
                                    ${p.unidad === 'Kg' ? '<span style="background:#eff6ff;color:#3b82f6;padding:2px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">⚖ Kg</span>' : ''}
                                </span>
                                <span class="precio-sugerencia">$${p.precio.toLocaleString('es-CL')}${p.unidad === 'Kg' ? '/kg' : ''}</span>
                            `;
                            li.addEventListener('mousedown', (e) => {
                                e.preventDefault();
                                agregarAlCarrito(p);
                                buscador.value = "";
                                listaSugerencias.style.display = "none";
                                buscador.focus();
                            });
                            listaSugerencias.appendChild(li);
                        });
                    }
                } catch (error) {
                    console.error("Error en búsqueda:", error);
                }
            }, 100);
        });

        buscador.addEventListener('blur', () => {
            setTimeout(() => { listaSugerencias.style.display = "none"; }, 200);
        });
    }

    if (inputRecibido) inputRecibido.addEventListener('input', calcularVuelto);
});

// ============================================================
// --- FUNCIONES DE INTERFAZ ---
// ============================================================

function actualizarInterfazVentas() {
    const totalDia      = localStorage.getItem('venta_total_dia') || "0";
    const totalEfectivo = localStorage.getItem('total_efectivo')  || "0";
    const totalTarjeta  = localStorage.getItem('total_tarjeta')   || "0";
    const totalOtros    = localStorage.getItem('total_otros')     || "0";

    const elTotalDia  = document.getElementById('total-dia-acumulado');
    const elEfectivo  = document.getElementById('total-efectivo');
    const elTarjeta   = document.getElementById('total-tarjeta');
    const elOtros     = document.getElementById('total-otros');

    if (elTotalDia)  elTotalDia.textContent  = `$${parseInt(totalDia).toLocaleString('es-CL')}`;
    if (elEfectivo)  elEfectivo.textContent  = `$${parseInt(totalEfectivo).toLocaleString('es-CL')}`;
    if (elTarjeta)   elTarjeta.textContent   = `$${parseInt(totalTarjeta).toLocaleString('es-CL')}`;
    if (elOtros)     elOtros.textContent     = `$${parseInt(totalOtros).toLocaleString('es-CL')}`;
}

// ============================================================
// --- GESTIÓN DEL CARRITO ---
// ============================================================

function agregarAlCarrito(p) {
    if (p.unidad === 'Kg') {
        abrirModalPeso(p);
        return;
    }

    const cuerpoTabla = document.getElementById('cuerpo-tabla-ventas');
    let filaExistente = document.querySelector(`tr[data-id="${p.id}"]`);

    // Validación de stock al agregar
    if (p.stock !== undefined && p.stock !== 999999) {
        const cantidadActual = filaExistente
            ? parseInt(filaExistente.querySelector('.celda-cantidad').textContent)
            : 0;
        const cantidadNueva = cantidadActual + 1;

        if (cantidadNueva > p.stock) {
            const confirmar = confirm(
                `⚠️ Stock insuficiente\n\n` +
                `"${p.nombre}" solo tiene ${p.stock} unidad(es) disponible(s).\n` +
                `¿Deseas agregarlo de todas formas?`
            );
            if (!confirmar) return;
        }
    }

    if (filaExistente) {
        const btnSuma = filaExistente.querySelector('.btn-qty-plus');
        cambiarCantidad(btnSuma, 1, p.precio, p.stock);
    } else {
        const nuevaFila = document.createElement('tr');
        nuevaFila.setAttribute('data-id', p.id);
        nuevaFila.setAttribute('data-unidad', 'Unidad');
        nuevaFila.setAttribute('data-stock', p.stock ?? 999999);

        nuevaFila.innerHTML = `
            <td>${p.nombre}</td>
            <td class="col-cantidad">
                <div class="control-cantidad">
                    <button class="btn-qty" onclick="cambiarCantidad(this, -1, ${p.precio}, ${p.stock ?? 999999})">-</button>
                    <span class="celda-cantidad">1</span>
                    <button class="btn-qty btn-qty-plus" onclick="cambiarCantidad(this, 1, ${p.precio}, ${p.stock ?? 999999})">+</button>
                </div>
            </td>
            <td class="celda-precio-unitario">$${p.precio.toLocaleString('es-CL')}</td>
            <td class="celda-neto">$${Math.round(p.precio / 1.19).toLocaleString('es-CL')}</td>
            <td class="celda-iva">$${(p.precio - Math.round(p.precio / 1.19)).toLocaleString('es-CL')}</td>
            <td class="celda-total-fila"><strong>$${p.precio.toLocaleString('es-CL')}</strong></td>
            <td>
                <button class="btn-eliminar-fila" onclick="eliminarFila(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        cuerpoTabla.appendChild(nuevaFila);
    }

    actualizarTotalesGenerales();
    guardarEstadoCarrito();
}

// ============================================================
// --- MODAL DE MONTO (Productos por Kg) ---
// ============================================================

let _productoKgPendiente = null;

function abrirModalPeso(producto) {
    _productoKgPendiente = producto;
    document.getElementById('modal-peso-nombre').textContent = producto.nombre;
    document.getElementById('modal-peso-precio').textContent = `Precio referencia: $${producto.precio.toLocaleString('es-CL')}/kg`;
    document.getElementById('input-kg').value = '';
    document.getElementById('modal-peso-total').textContent = '$0';
    document.getElementById('modal-peso').style.display = 'flex';
    setTimeout(() => document.getElementById('input-kg').focus(), 100);
}

function cerrarModalPeso() {
    document.getElementById('modal-peso').style.display = 'none';
    _productoKgPendiente = null;
    document.getElementById('buscador-ventas').focus();
}

function calcularTotalPeso() {
    const monto = parseInt(document.getElementById('input-kg').value) || 0;
    document.getElementById('modal-peso-total').textContent = `$${monto.toLocaleString('es-CL')}`;
}

function confirmarProductoPeso() {
    const totalFila = parseInt(document.getElementById('input-kg').value);

    if (!totalFila || totalFila <= 0) {
        alert('Por favor ingresa un monto válido.');
        return;
    }

    const p    = _productoKgPendiente;
    const neto = Math.round(totalFila / 1.19);
    const iva  = totalFila - neto;

    const cuerpoTabla = document.getElementById('cuerpo-tabla-ventas');
    const nuevaFila   = document.createElement('tr');

    nuevaFila.setAttribute('data-id', `${p.id}-kg-${Date.now()}`);
    nuevaFila.setAttribute('data-unidad', 'Kg');
    nuevaFila.setAttribute('data-precio-kg', p.precio);
    nuevaFila.setAttribute('data-producto-id', p.id);

    nuevaFila.innerHTML = `
        <td>
            ${p.nombre}
            <small style="display:block; color:#94a3b8; font-size:0.75rem;">Venta por peso</small>
        </td>
        <td class="col-cantidad">
            <div class="control-cantidad">
                <span class="celda-cantidad" style="padding:0 10px; color:#3b82f6; font-weight:700;">1</span>
            </div>
        </td>
        <td class="celda-precio-unitario">$${totalFila.toLocaleString('es-CL')}</td>
        <td class="celda-neto">$${neto.toLocaleString('es-CL')}</td>
        <td class="celda-iva">$${iva.toLocaleString('es-CL')}</td>
        <td class="celda-total-fila"><strong>$${totalFila.toLocaleString('es-CL')}</strong></td>
        <td>
            <button class="btn-eliminar-fila" onclick="eliminarFila(this)">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

    cuerpoTabla.appendChild(nuevaFila);
    actualizarTotalesGenerales();
    guardarEstadoCarrito();
    cerrarModalPeso();
}

// ============================================================
// --- CIERRE DE CAJA ---
// ============================================================

function solicitarCierreTurno() {
    const efectivo = parseInt(localStorage.getItem('total_efectivo') || 0);
    const tarjeta  = parseInt(localStorage.getItem('total_tarjeta')  || 0);
    const otros    = parseInt(localStorage.getItem('total_otros')    || 0);
    const fiados   = parseInt(localStorage.getItem('total_fiados')   || 0);
    const total    = efectivo + tarjeta + otros;

    document.getElementById('cierre-efectivo').textContent = `$${efectivo.toLocaleString('es-CL')}`;
    document.getElementById('cierre-tarjeta').textContent  = `$${tarjeta.toLocaleString('es-CL')}`;
    document.getElementById('cierre-otros').textContent    = `$${otros.toLocaleString('es-CL')}`;
    document.getElementById('cierre-fiados').textContent   = `$${fiados.toLocaleString('es-CL')}`;
    document.getElementById('cierre-total').textContent    = `$${total.toLocaleString('es-CL')}`;

    document.getElementById('modal-cierre').style.display = 'flex';
}

function cerrarModalCierre() {
    document.getElementById('modal-cierre').style.display = 'none';
}

async function confirmarCierreCaja() {
    const efectivo = parseInt(localStorage.getItem('total_efectivo') || 0);
    const tarjeta  = parseInt(localStorage.getItem('total_tarjeta')  || 0);
    const otros    = parseInt(localStorage.getItem('total_otros')    || 0);
    const fiados   = parseInt(localStorage.getItem('total_fiados')   || 0);

    const btn = document.querySelector('#modal-cierre button:last-child');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        const response = await fetch('/api/guardar_cierre', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ efectivo, tarjeta, otros, fiados })
        });

        const result = await response.json();

        if (result.status === 'success') {
            localStorage.removeItem('venta_total_dia');
            localStorage.removeItem('total_efectivo');
            localStorage.removeItem('total_tarjeta');
            localStorage.removeItem('total_otros');
            localStorage.removeItem('total_fiados');
            localStorage.removeItem('carrito_actual');
            window.location.href = '/reportes';
        } else {
            alert('Error al guardar el cierre. Intenta de nuevo.');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-power-off"></i> Confirmar Cierre'; }
        }

    } catch (error) {
        console.error("Error al cerrar caja:", error);
        alert('Error de conexión con el servidor.');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-power-off"></i> Confirmar Cierre'; }
    }
}

// ============================================================
// --- CANTIDAD Y CÁLCULOS ---
// ============================================================

function cambiarCantidad(btn, delta, precioBase, stock) {
    const fila = btn.closest('tr');
    const span = fila.querySelector('.celda-cantidad');

    let nuevaCant = parseInt(span.textContent) + delta;
    if (nuevaCant < 1) return;

    // Validación de stock al usar botón +
    if (delta > 0 && stock !== undefined && stock !== 999999 && nuevaCant > stock) {
        const confirmar = confirm(
            `⚠️ Stock insuficiente\n\n` +
            `Solo hay ${stock} unidad(es) disponible(s).\n` +
            `¿Deseas agregar de todas formas?`
        );
        if (!confirmar) return;
    }

    span.textContent = nuevaCant;
    recalcularFila(fila, precioBase, nuevaCant);
}

function recalcularFila(fila, precio, cantidad) {
    const nuevoTotal = precio * cantidad;
    const nuevoNeto  = Math.round(nuevoTotal / 1.19);
    const nuevoIva   = nuevoTotal - nuevoNeto;

    fila.querySelector('.celda-neto').textContent     = `$${nuevoNeto.toLocaleString('es-CL')}`;
    fila.querySelector('.celda-iva').textContent      = `$${nuevoIva.toLocaleString('es-CL')}`;
    fila.querySelector('.celda-total-fila').innerHTML = `<strong>$${nuevoTotal.toLocaleString('es-CL')}</strong>`;

    actualizarTotalesGenerales();
    guardarEstadoCarrito();
}

function eliminarFila(btn) {
    btn.closest('tr').remove();
    actualizarTotalesGenerales();
    guardarEstadoCarrito();
}

function actualizarTotalesGenerales() {
    let granTotal = 0;
    document.querySelectorAll('.celda-total-fila').forEach(celda => {
        granTotal += parseInt(celda.textContent.replace(/[^0-9]/g, "")) || 0;
    });
    document.getElementById('gran-total').textContent  = `$${granTotal.toLocaleString('es-CL')}`;
    document.getElementById('total-neto').textContent  = `$${Math.round(granTotal / 1.19).toLocaleString('es-CL')}`;
    document.getElementById('total-iva').textContent   = `$${(granTotal - Math.round(granTotal / 1.19)).toLocaleString('es-CL')}`;
}

// ============================================================
// --- PERSISTENCIA DEL CARRITO ---
// ============================================================

function guardarEstadoCarrito() {
    const productos = [];
    document.querySelectorAll('#cuerpo-tabla-ventas tr').forEach(fila => {
        const esKg      = fila.getAttribute('data-unidad') === 'Kg';
        const totalFila = parseInt(fila.querySelector('.celda-total-fila').textContent.replace(/[^0-9]/g, ""));
        const cant      = fila.querySelector('.celda-cantidad').textContent;

        let precioActual = 0;
        if (esKg) {
            precioActual = parseFloat(fila.getAttribute('data-precio-kg')) || 0;
        } else {
            precioActual = totalFila / parseInt(cant);
        }

        productos.push({
            id:       fila.getAttribute('data-id'),
            nombre:   fila.cells[0].innerText,
            cantidad: cant,
            precio:   precioActual,
            unidad:   fila.getAttribute('data-unidad'),
            stock:    parseInt(fila.getAttribute('data-stock')) || 999999
        });
    });
    localStorage.setItem('carrito_actual', JSON.stringify(productos));
}

function reconstruirCarritoDesdeStorage(productos) {
    document.getElementById('cuerpo-tabla-ventas').innerHTML = "";
    productos.forEach(p => agregarAlCarrito(p));
}

// ============================================================
// --- PROCESO DE PAGO ---
// ============================================================

async function procesarVentaFinal() {
    const totalTexto = document.getElementById('modal-total-grande').textContent;
    const totalVenta = parseInt(totalTexto.replace(/[^0-9]/g, ""));
    const metodo     = document.getElementById('metodo-seleccionado').value;

    // Validar monto en efectivo
    if (metodo === 'efectivo') {
        const recibido = parseInt(document.getElementById('monto-recibido').value) || 0;
        if (recibido < totalVenta) {
            mostrarAlertaVenta(`❌ El monto ingresado ($${recibido.toLocaleString('es-CL')}) es menor al total a cobrar`, 'error');
            return;
        }
    }

    const carrito = [];
    document.querySelectorAll('#cuerpo-tabla-ventas tr').forEach(fila => {
        const esKg      = fila.getAttribute('data-unidad') === 'Kg';
        const totalFila = parseInt(fila.querySelector('.celda-total-fila').textContent.replace(/[^0-9]/g, "")) || 0;

        if (esKg) {
            const idReal = parseInt(fila.getAttribute('data-producto-id'));
            carrito.push({ id: idReal, cantidad: 1, precio: totalFila });
        } else {
            const cantidad = parseInt(fila.querySelector('.celda-cantidad').textContent) || 1;
            const precio   = Math.round(totalFila / cantidad);
            carrito.push({ id: parseInt(fila.getAttribute('data-id')), cantidad, precio });
        }
    });

    const btnConfirmar = document.querySelector('.btn-finalizar-venta');
    if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = 'Procesando...'; }

    try {
        const response = await fetch('/api/registrar_venta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carrito, metodo_pago: metodo })
        });

        const result = await response.json();

        if (result.status === 'success') {
            actualizarIndicadoresPersistentes(totalVenta, metodo);
            localStorage.removeItem('carrito_actual');
            document.getElementById('cuerpo-tabla-ventas').innerHTML = "";
            actualizarTotalesGenerales();
            cerrarModal();
            mostrarAlertaVenta(`✅ Venta #${result.venta_id} registrada con éxito`);
        } else {
            cerrarModal();
            mostrarAlertaVenta(`❌ ${result.message}`, 'error');
        }

    } catch (error) {
        console.error("Error al registrar venta:", error);
        cerrarModal();
        mostrarAlertaVenta('❌ Error de conexión con el servidor', 'error');
    } finally {
        if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = 'CONFIRMAR COBRO'; }
    }
}

function actualizarIndicadoresPersistentes(monto, metodo) {
    let totalActual = parseInt(localStorage.getItem('venta_total_dia') || 0);
    localStorage.setItem('venta_total_dia', totalActual + monto);

    let claveMetodo = `total_${metodo}`;
    let montoMetodo = parseInt(localStorage.getItem(claveMetodo) || 0) + monto;
    localStorage.setItem(claveMetodo, montoMetodo);

    actualizarInterfazVentas();
}

function mostrarAlertaVenta(mensaje, tipo = 'success') {
    const alerta = document.createElement('div');
    alerta.className = `alert-floating ${tipo === 'success' ? 'alert-green' : 'alert-red'}`;
    alerta.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${mensaje}`;
    document.body.appendChild(alerta);
    setTimeout(() => {
        alerta.style.opacity = '0';
        setTimeout(() => alerta.remove(), 500);
    }, 3000);
}

function abrirModalCobro() {
    const total = document.getElementById('gran-total').textContent;
    if (total === "$0") return alert("El carrito está vacío");
    document.getElementById('modal-total-grande').textContent = total;
    document.getElementById('modal-cobro').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modal-cobro').style.display = 'none';
    const btnConfirmar = document.querySelector('.btn-finalizar-venta');
    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = 'CONFIRMAR COBRO'; }
}

function calcularVuelto() {
    const total    = parseInt(document.getElementById('modal-total-grande').textContent.replace(/[^0-9]/g, ""));
    const recibido = parseInt(document.getElementById('monto-recibido').value) || 0;
    const vuelto   = recibido - total;
    const display  = document.getElementById('vuelto-cliente');
    display.textContent = `$${(vuelto >= 0 ? vuelto : 0).toLocaleString('es-CL')}`;
    display.parentElement.style.background = vuelto >= 0 ? "#2ecc71" : "#e74c3c";
}

function seleccionarMetodo(el, m) {
    document.querySelectorAll('.metodo-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('metodo-seleccionado').value = m;
    document.getElementById('seccion-efectivo').style.display = m === 'efectivo' ? 'block' : 'none';
}
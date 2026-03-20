// static/js/ventas.js

document.addEventListener('DOMContentLoaded', () => {
    const buscador = document.getElementById('buscador-ventas');
    const listaSugerencias = document.getElementById('lista-sugerencias');
    const inputRecibido = document.getElementById('monto-recibido');
    let timeoutBusqueda;

    // --- 1. REHIDRATAR INTERFAZ (Recuperar datos de localStorage) ---
    
    // Recuperar Total General del Día
    const totalDia = localStorage.getItem('venta_total_dia') || "0";
    const elTotalDia = document.getElementById('total-dia-acumulado');
    if (elTotalDia) elTotalDia.textContent = `$${parseInt(totalDia).toLocaleString('es-CL')}`;

    // Recuperar Efectivo
    const totalEfectivo = localStorage.getItem('total_efectivo') || "0";
    const elEfectivo = document.getElementById('total-efectivo');
    if (elEfectivo) elEfectivo.textContent = `$${parseInt(totalEfectivo).toLocaleString('es-CL')}`;

    // Recuperar Tarjeta
    const totalTarjeta = localStorage.getItem('total_tarjeta') || "0";
    const elTarjeta = document.getElementById('total-tarjeta');
    if (elTarjeta) elTarjeta.textContent = `$${parseInt(totalTarjeta).toLocaleString('es-CL')}`;

    // Recuperar Carrito Actual
    const carritoGuardado = JSON.parse(localStorage.getItem('carrito_actual') || "[]");
    if (carritoGuardado.length > 0) {
        reconstruirCarritoDesdeStorage(carritoGuardado);
    }

    // --- 2. LÓGICA DE BÚSQUEDA ---
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
                    const response = await fetch(`/buscar_producto?q=${query}`);
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
                                <span class="nombre-sugerencia">${p.nombre}</span> 
                                <span class="precio-sugerencia">$${p.precio.toLocaleString('es-CL')}</span>
                            `;
                            li.onclick = () => {
                                agregarAlCarrito(p);
                                buscador.value = "";
                                listaSugerencias.style.display = "none";
                                buscador.focus();
                            };
                            listaSugerencias.appendChild(li);
                        });
                    }
                } catch (error) {
                    console.error("Error en búsqueda:", error);
                }
            }, 100);
        });
    }

    if (inputRecibido) inputRecibido.addEventListener('input', calcularVuelto);
});

/**
 * --- 3. GESTIÓN DEL CARRITO Y PERSISTENCIA ---
 */
function agregarAlCarrito(p) {
    const cuerpoTabla = document.getElementById('cuerpo-tabla-ventas');
    let filaExistente = document.querySelector(`tr[data-id="${p.id}"]`);

    if (filaExistente) {
        const btnSuma = filaExistente.querySelector('.btn-qty-plus');
        cambiarCantidad(btnSuma, 1, p.precio);
    } else {
        const nuevaFila = document.createElement('tr');
        nuevaFila.setAttribute('data-id', p.id); 
        nuevaFila.innerHTML = `
            <td>${p.nombre}</td>
            <td class="col-cantidad">
                <div class="control-cantidad">
                    <button class="btn-qty" onclick="cambiarCantidad(this, -1, ${p.precio})">-</button>
                    <span class="celda-cantidad">1</span>
                    <button class="btn-qty btn-qty-plus" onclick="cambiarCantidad(this, 1, ${p.precio})">+</button>
                </div>
            </td>
            <td>$${p.precio.toLocaleString('es-CL')}</td>
            <td class="celda-neto">$${Math.round(p.precio/1.19).toLocaleString('es-CL')}</td>
            <td class="celda-iva">${(p.precio - Math.round(p.precio/1.19)).toLocaleString('es-CL')}</td>
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

function guardarEstadoCarrito() {
    const productos = [];
    document.querySelectorAll('#cuerpo-tabla-ventas tr').forEach(fila => {
        const cant = parseInt(fila.querySelector('.celda-cantidad').textContent);
        const totalFila = parseInt(fila.querySelector('.celda-total-fila').textContent.replace(/[^0-9]/g, ""));
        productos.push({
            id: fila.getAttribute('data-id'),
            nombre: fila.cells[0].innerText,
            cantidad: cant,
            precio: totalFila / cant
        });
    });
    localStorage.setItem('carrito_actual', JSON.stringify(productos));
}

function reconstruirCarritoDesdeStorage(productos) {
    const cuerpoTabla = document.getElementById('cuerpo-tabla-ventas');
    cuerpoTabla.innerHTML = "";
    productos.forEach(p => {
        const totalFila = p.precio * p.cantidad;
        const nuevaFila = document.createElement('tr');
        nuevaFila.setAttribute('data-id', p.id);
        nuevaFila.innerHTML = `
            <td>${p.nombre}</td>
            <td class="col-cantidad">
                <div class="control-cantidad">
                    <button class="btn-qty" onclick="cambiarCantidad(this, -1, ${p.precio})">-</button>
                    <span class="celda-cantidad">${p.cantidad}</span>
                    <button class="btn-qty btn-qty-plus" onclick="cambiarCantidad(this, 1, ${p.precio})">+</button>
                </div>
            </td>
            <td>$${p.precio.toLocaleString('es-CL')}</td>
            <td class="celda-neto">$${Math.round(totalFila/1.19).toLocaleString('es-CL')}</td>
            <td class="celda-iva">$${(totalFila - Math.round(totalFila/1.19)).toLocaleString('es-CL')}</td>
            <td class="celda-total-fila"><strong>$${totalFila.toLocaleString('es-CL')}</strong></td>
            <td><button class="btn-eliminar-fila" onclick="eliminarFila(this)"><i class="fas fa-trash"></i></button></td>
        `;
        cuerpoTabla.appendChild(nuevaFila);
    });
    actualizarTotalesGenerales();
}

/**
 * --- 4. CÁLCULOS Y MODAL ---
 */
function cambiarCantidad(btn, delta, precioUnitario) {
    const fila = btn.closest('tr');
    const span = fila.querySelector('.celda-cantidad');
    let nuevaCant = parseInt(span.textContent) + delta;
    if (nuevaCant < 1) return;
    span.textContent = nuevaCant;
    
    const nuevoTotal = precioUnitario * nuevaCant;
    fila.querySelector('.celda-neto').textContent = `$${Math.round(nuevoTotal/1.19).toLocaleString('es-CL')}`;
    fila.querySelector('.celda-iva').textContent = `$${(nuevoTotal - Math.round(nuevoTotal/1.19)).toLocaleString('es-CL')}`;
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
    document.getElementById('gran-total').textContent = `$${granTotal.toLocaleString('es-CL')}`;
    document.getElementById('total-neto').textContent = `$${Math.round(granTotal/1.19).toLocaleString('es-CL')}`;
    document.getElementById('total-iva').textContent = `$${(granTotal - Math.round(granTotal/1.19)).toLocaleString('es-CL')}`;
}

/**
 * --- 5. FINALIZAR VENTA ---
 */
function procesarVentaFinal() {
    const totalTexto = document.getElementById('modal-total-grande').textContent;
    const totalVenta = parseInt(totalTexto.replace(/[^0-9]/g, ""));
    const metodo = document.getElementById('metodo-seleccionado').value;

    actualizarIndicadoresPersistentes(totalVenta, metodo);

    localStorage.removeItem('carrito_actual');
    document.getElementById('cuerpo-tabla-ventas').innerHTML = "";
    actualizarTotalesGenerales();
    cerrarModal();
    alert("Venta procesada exitosamente.");
}

function actualizarIndicadoresPersistentes(monto, metodo) {
    // Actualizar Total General
    let totalActual = parseInt(localStorage.getItem('venta_total_dia') || 0);
    let nuevoTotal = totalActual + monto;
    localStorage.setItem('venta_total_dia', nuevoTotal);
    document.getElementById('total-dia-acumulado').textContent = `$${nuevoTotal.toLocaleString('es-CL')}`;

    // Actualizar Método Específico
    let claveMetodo = `total_${metodo}`;
    let montoMetodo = parseInt(localStorage.getItem(claveMetodo) || 0) + monto;
    localStorage.setItem(claveMetodo, montoMetodo);
    
    const elMetodo = document.getElementById(`total-${metodo}`);
    if (elMetodo) elMetodo.textContent = `$${montoMetodo.toLocaleString('es-CL')}`;
}

// Funciones de apoyo para Modal
function abrirModalCobro() {
    const total = document.getElementById('gran-total').textContent;
    if (total === "$0") return alert("Carrito vacío");
    document.getElementById('modal-total-grande').textContent = total;
    document.getElementById('modal-cobro').style.display = 'flex';
}

function cerrarModal() { document.getElementById('modal-cobro').style.display = 'none'; }

function calcularVuelto() {
    const total = parseInt(document.getElementById('modal-total-grande').textContent.replace(/[^0-9]/g, ""));
    const recibido = parseInt(document.getElementById('monto-recibido').value) || 0;
    const vuelto = recibido - total;
    const display = document.getElementById('vuelto-cliente');
    display.textContent = `$${(vuelto >= 0 ? vuelto : 0).toLocaleString('es-CL')}`;
    display.parentElement.style.background = vuelto >= 0 ? "#2ecc71" : "#e74c3c";
}

function seleccionarMetodo(el, m) {
    document.querySelectorAll('.metodo-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('metodo-seleccionado').value = m;
    document.getElementById('seccion-efectivo').style.display = m === 'efectivo' ? 'block' : 'none';
}
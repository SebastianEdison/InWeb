document.addEventListener('DOMContentLoaded', () => {
    const buscador = document.getElementById('buscador-ventas');
    const listaSugerencias = document.getElementById('lista-sugerencias');

    // --- 1. BUSCAR PREDICCIONES MIENTRAS ESCRIBE ---
    buscador.addEventListener('input', async () => {
        const query = buscador.value.trim();
        
        if (query.length < 2) {
            listaSugerencias.innerHTML = "";
            listaSugerencias.style.display = "none";
            return;
        }

        try {
            const response = await fetch(`/buscar_producto?q=${query}`);
            const productos = await response.json();

            listaSugerencias.innerHTML = "";
            
            if (productos.length === 0) {
                listaSugerencias.innerHTML = `<li style="color:gray; padding:10px;">No se encontró "${query}"</li>`;
                listaSugerencias.style.display = "block";
                return;
            }

            listaSugerencias.style.display = "block";
            productos.forEach(p => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${p.nombre}</span> <strong>$${p.precio.toLocaleString('es-CL')}</strong>`;
                
                li.onclick = () => {
                    agregarAlCarrito(p);
                    buscador.value = "";
                    listaSugerencias.innerHTML = "";
                    listaSugerencias.style.display = "none";
                    buscador.focus();
                };
                listaSugerencias.appendChild(li);
            });

        } catch (error) {
            console.error("Error en la búsqueda:", error);
        }
    });

    document.addEventListener('click', (e) => {
        if (!buscador.contains(e.target) && !listaSugerencias.contains(e.target)) {
            listaSugerencias.style.display = "none";
        }
    });
});

/**
 * --- 2. FUNCIÓN PARA AGREGAR O SUMAR AL CARRITO ---
 */
function agregarAlCarrito(p) {
    const cuerpoTabla = document.getElementById('cuerpo-tabla-ventas');
    
    // BUSCAMOS SI EL PRODUCTO YA ESTÁ EN LA TABLA USANDO UN ATRIBUTO DE DATOS
    let filaExistente = document.querySelector(`tr[data-id="${p.id}"]`);

    if (filaExistente) {
        // SI YA EXISTE: Solo actualizamos la cantidad y los totales de esa fila
        let celdaCantidad = filaExistente.querySelector('.celda-cantidad');
        let nuevaCantidad = parseInt(celdaCantidad.textContent) + 1;
        celdaCantidad.textContent = nuevaCantidad;

        actualizarFila(filaExistente, p.precio, nuevaCantidad);
    } else {
        // SI NO EXISTE: Creamos la fila completa
        const precioTotal = p.precio;
        const neto = Math.round(precioTotal / 1.19);
        const iva = precioTotal - neto;

        const nuevaFila = document.createElement('tr');
        nuevaFila.setAttribute('data-id', p.id); // Guardamos el ID para encontrarlo luego
        
        nuevaFila.innerHTML = `
            <td>${p.nombre}</td>
            <td class="celda-cantidad">1</td>
            <td>$${precioTotal.toLocaleString('es-CL')}</td>
            <td class="celda-neto">$${neto.toLocaleString('es-CL')}</td>
            <td class="celda-iva">$${iva.toLocaleString('es-CL')}</td>
            <td class="celda-total-fila"><strong>$${precioTotal.toLocaleString('es-CL')}</strong></td>
            <td>
                <button class="btn-eliminar-fila" onclick="this.parentElement.parentElement.remove(); actualizarTotalesGenerales();">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        cuerpoTabla.appendChild(nuevaFila);
    }
    
    actualizarTotalesGenerales();
}

/**
 * --- 3. ACTUALIZA LOS VALORES DENTRO DE UNA FILA EXISTENTE ---
 */
function actualizarFila(fila, precioUnitario, cantidad) {
    const nuevoTotal = precioUnitario * cantidad;
    const nuevoNeto = Math.round(nuevoTotal / 1.19);
    const nuevoIva = nuevoTotal - nuevoNeto;

    fila.querySelector('.celda-neto').textContent = `$${nuevoNeto.toLocaleString('es-CL')}`;
    fila.querySelector('.celda-iva').textContent = `$${nuevoIva.toLocaleString('es-CL')}`;
    fila.querySelector('.celda-total-fila').innerHTML = `<strong>$${nuevoTotal.toLocaleString('es-CL')}</strong>`;
}

/**
 * --- 4. ACTUALIZA EL RESUMEN DE VENTA (EL CUADRO DE LA DERECHA) ---
 */
function actualizarTotalesGenerales() {
    let netoTotal = 0;
    let ivaTotal = 0;
    let granTotal = 0;

    // Recorremos todas las filas de la tabla para sumar
    document.querySelectorAll('#cuerpo-tabla-ventas tr').forEach(fila => {
        // Extraemos los números quitando el signo $ y los puntos de miles
        const totalFila = parseInt(fila.querySelector('.celda-total-fila').textContent.replace(/[^0-9]/g, ""));
        granTotal += totalFila;
    });

    netoTotal = Math.round(granTotal / 1.19);
    ivaTotal = granTotal - netoTotal;

    // Actualizamos los textos en el HTML
    document.getElementById('total-neto').textContent = `$${netoTotal.toLocaleString('es-CL')}`;
    document.getElementById('total-iva').textContent = `$${ivaTotal.toLocaleString('es-CL')}`;
    document.getElementById('gran-total').textContent = `$${granTotal.toLocaleString('es-CL')}`;
}
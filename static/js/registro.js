// 1. AL CARGAR: Foco inicial
document.addEventListener('DOMContentLoaded', () => {
    const inputSearch = document.getElementById('codigo_search');
    if (inputSearch) inputSearch.focus();
});

// 2. SELECCIONAR TIPO (Código vs Peso)
function seleccionarTipo(tipo) {
    const btnCodigo = document.getElementById('btn-con-codigo');
    const btnPeso = document.getElementById('btn-por-peso');
    const inputBusqueda = document.getElementById('codigo_search');
    const helperText = document.getElementById('helper-identificador');
    
    // Elementos de la unidad de medida
    const contenedorMedida = document.getElementById('contenedor-medida');
    const columnaCantidad = document.getElementById('columna-cantidad');
    const selectUnidad = document.getElementById('form_unidad');

    btnCodigo.classList.remove('active');
    btnPeso.classList.remove('active');

    if (tipo === 'peso') {
        btnPeso.classList.add('active');
        inputBusqueda.value = "AUTO-GENERADO";
        inputBusqueda.readOnly = true;
        helperText.innerText = "Producto artesanal (ID se creará al guardar)";
        
        // Muestra el selector de medida y ajusta anchos
        if(contenedorMedida) contenedorMedida.style.display = 'block';
        if(columnaCantidad) columnaCantidad.style.flex = "2";
        if(selectUnidad) selectUnidad.value = "Kg"; // Por defecto Kg en este modo

        document.getElementById('form_nombre').focus();
    } else {
        btnCodigo.classList.add('active');
        inputBusqueda.value = "";
        inputBusqueda.readOnly = false;
        inputBusqueda.placeholder = "Escanea el código...";
        helperText.innerText = "El lector está listo para escanear";
        
        // Oculta el selector de medida
        if(contenedorMedida) contenedorMedida.style.display = 'none';
        if(columnaCantidad) columnaCantidad.style.flex = "1";
        if(selectUnidad) selectUnidad.value = "Unidad"; // Por defecto Unidad para códigos

        inputBusqueda.focus();
    }
}

// 3. SWITCH VENTA LIBRE
document.getElementById('chk_venta_libre').addEventListener('change', function() {
    const inputStock = document.getElementById('form_stock');
    if (this.checked) {
        inputStock.value = "0";
        inputStock.disabled = true;
        inputStock.style.opacity = "0.5";
    } else {
        inputStock.disabled = false;
        inputStock.style.opacity = "1";
        inputStock.focus();
    }
});

// 4. GUARDAR PRODUCTO (Envío a Python)
async function procesarIngreso(event) {
    if (event) event.preventDefault();

    const esPeso = document.getElementById('btn-por-peso').classList.contains('active');
    
    const codigoValue = document.getElementById('codigo_search').value.trim();
    const nombreValue = document.getElementById('form_nombre').value.trim();
    const pVentaValue = document.getElementById('form_pventa').value;
    const pCompraValue = document.getElementById('form_pcompra').value;
    const stockValue = document.getElementById('form_stock').value;
    const unidadValue = document.getElementById('form_unidad').value; // <--- CAPTURA LA UNIDAD

    // --- VALIDACIONES ---
    if (!esPeso && !codigoValue) {
        mostrarAlerta("⚠️ Escanea un código primero", "error");
        document.getElementById('codigo_search').focus();
        return;
    }
    if (!nombreValue) {
        mostrarAlerta("⚠️ El nombre es obligatorio", "error");
        document.getElementById('form_nombre').focus();
        return;
    }
    if (!pVentaValue || parseFloat(pVentaValue) <= 0) {
        mostrarAlerta("⚠️ Ingresa un precio de venta válido", "error");
        document.getElementById('form_pventa').focus();
        return;
    }

    // Armamos el objeto JSON incluyendo la UNIDAD
    const datos = {
        codigo: esPeso ? "" : codigoValue,
        nombre: nombreValue,
        precio_compra: pCompraValue ? parseFloat(pCompraValue) : 0,
        precio_venta: parseFloat(pVentaValue),
        stock: document.getElementById('chk_venta_libre').checked ? 999999 : (parseInt(stockValue) || 0),
        unidad: unidadValue // <--- SE ENVÍA A PYTHON
    };

    try {
        const response = await fetch('/agregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const result = await response.json();

        if (result.status === "success") {
            mostrarAlerta("✨ Producto registrado con éxito", "success");
            resetearTodo();
        } else {
            mostrarAlerta("Error: " + result.message, "error");
        }
    } catch (error) {
        console.error("Error en la petición:", error);
        mostrarAlerta("Error de conexión con el servidor", "error");
    }
}

// 5. ALERTAS Y RESET
function mostrarAlerta(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.className = `alert-floating ${tipo === 'success' ? 'alert-green' : 'alert-red'}`;
    alerta.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i> ${mensaje}`;
    document.body.appendChild(alerta);
    setTimeout(() => {
        alerta.style.opacity = '0';
        setTimeout(() => alerta.remove(), 500);
    }, 3000);
}

function resetearTodo() {
    const form = document.getElementById('form-ingreso-completo');
    if(form) form.reset();
    seleccionarTipo('codigo');
}

// 6. BUSCAR DATOS DEL PRODUCTO
async function buscarDatosProducto() {
    const codigoInput = document.getElementById('codigo_search');
    const codigo = codigoInput.value.trim();
    
    if (!codigo || codigo === "AUTO-GENERADO") return;

    try {
        // Usamos 'busqueda' porque recordamos que 'q' ahora es 'busqueda'
        const response = await fetch(`/buscar_producto?busqueda=${codigo}`);
        const productos = await response.json();

        if (productos && productos.length > 0) {
            const data = productos[0];
            document.getElementById('form_nombre').value = data.nombre;
            document.getElementById('form_pcompra').value = data.costo || "";
            document.getElementById('form_pventa').value = data.precio_venta || "";
            
            // Si el producto ya tiene una unidad guardada, la seleccionamos
            if(data.unidad) document.getElementById('form_unidad').value = data.unidad;

            mostrarAlerta("📦 Producto encontrado", "success");
            document.getElementById('form_stock').focus();
        } else {
            document.getElementById('form_nombre').value = "";
            document.getElementById('form_pcompra').value = "";
            document.getElementById('form_pventa').value = "";
            document.getElementById('form_nombre').focus();
        }
    } catch (error) {
        console.error("Error al buscar:", error);
    }
}

// 7. DETECTOR DE ENTER (PISTOLA)
document.getElementById('codigo_search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        buscarDatosProducto();
    }
});
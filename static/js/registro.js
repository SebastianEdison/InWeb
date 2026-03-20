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

    btnCodigo.classList.remove('active');
    btnPeso.classList.remove('active');

    if (tipo === 'peso') {
        btnPeso.classList.add('active');
        inputBusqueda.value = "AUTO-GENERADO"; // Texto visual
        inputBusqueda.readOnly = true;
        helperText.innerText = "Producto artesanal (ID se creará al guardar)";
        document.getElementById('form_nombre').focus();
    } else {
        btnCodigo.classList.add('active');
        inputBusqueda.value = "";
        inputBusqueda.readOnly = false;
        inputBusqueda.placeholder = "Escanea el código...";
        helperText.innerText = "El lector está listo para escanear";
        inputBusqueda.focus();
    }
}

// 3. SWITCH VENTA LIBRE (Kuchen)
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
    
    // Capturamos los valores de los inputs
    const codigoValue = document.getElementById('codigo_search').value.trim();
    const nombreValue = document.getElementById('form_nombre').value.trim();
    const pVentaValue = document.getElementById('form_pventa').value;
    const pCompraValue = document.getElementById('form_pcompra').value;
    const stockValue = document.getElementById('form_stock').value;

    // --- VALIDACIONES ANTES DE ENVIAR ---
    if (!esPeso && !codigoValue) {
        mostrarAlerta("⚠️ Escanea un código primero", "error");
        document.getElementById('codigo_search').focus();
        return;
    }

    if (!nombreValue) {
        mostrarAlerta("⚠️ El nombre del producto es obligatorio", "error");
        document.getElementById('form_nombre').focus();
        return;
    }

    if (!pVentaValue || parseFloat(pVentaValue) <= 0) {
        mostrarAlerta("⚠️ Ingresa un precio de venta válido", "error");
        document.getElementById('form_pventa').focus();
        return;
    }

    // Armamos el objeto JSON limpio
    const datos = {
        codigo: esPeso ? "" : codigoValue,
        nombre: nombreValue,
        precio_compra: pCompraValue ? parseFloat(pCompraValue) : 0,
        precio_venta: parseFloat(pVentaValue), // Convertimos a número para la DB
        stock: document.getElementById('chk_venta_libre').checked ? 999999 : (parseInt(stockValue) || 0),
        tipo: esPeso ? 'peso' : 'codigo'
    };

    try {
        const response = await fetch('/agregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        const result = await response.json();

        if (result.status === "success") {
            mostrarAlerta(result.message, "success");
            resetearTodo(); // Esta función debe limpiar los campos y poner foco en el buscador
        } else {
            // Aquí capturamos el error de la base de datos que venga de Python
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
    document.getElementById('form-ingreso-completo').reset();
    seleccionarTipo('codigo');
}

// 6. DETECTAR ENTER DE LA PISTOLA
document.getElementById('codigo_search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        // Cuando escaneas, el cursor salta al nombre para seguir llenando
        document.getElementById('form_nombre').focus();
    }
});
// --- NUEVA FUNCIÓN: BUSCAR DATOS DEL PRODUCTO ---
async function buscarDatosProducto() {
    const codigoInput = document.getElementById('codigo_search');
    const codigo = codigoInput.value.trim();
    
    if (!codigo || codigo === "AUTO-GENERADO") return;

    try {
        // Llamamos a tu ruta de búsqueda (asegúrate que sea la que usas: /buscar_producto o /buscar)
        const response = await fetch(`/buscar_producto?q=${codigo}`);
        const productos = await response.json();

        if (productos && productos.length > 0) {
            const data = productos[0]; // Tomamos el producto existente
            
            // Rellenamos los campos automáticamente
            document.getElementById('form_nombre').value = data.nombre;
            document.getElementById('form_pcompra').value = data.precio_compra || "";
            document.getElementById('form_pventa').value = data.precio || data.precio_venta || "";
            
            // Si quieres mostrar un mensaje de que se encontró:
            mostrarAlerta("📦 Producto encontrado en inventario", "success");
            
            // Ponemos el foco en el stock para solo sumar lo nuevo
            document.getElementById('form_stock').focus();
        } else {
            // Si es nuevo, limpiamos para que escribas de cero
            document.getElementById('form_nombre').value = "";
            document.getElementById('form_pcompra').value = "";
            document.getElementById('form_pventa').value = "";
            document.getElementById('form_nombre').focus();
        }
    } catch (error) {
        console.error("Error al buscar:", error);
    }
}

// --- ACTUALIZACIÓN DEL DETECTOR DE LA PISTOLA ---
document.getElementById('codigo_search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        buscarDatosProducto(); // <--- AQUÍ LLAMAMOS A LA BÚSQUEDA
    }
});
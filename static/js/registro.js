// 1. AL CARGAR LA PÁGINA: Poner el foco en el buscador
document.addEventListener('DOMContentLoaded', () => {
    const inputSearch = document.getElementById('codigo_search');
    if (inputSearch) inputSearch.focus();
});

// 2. FUNCIÓN PARA BUSCAR EL PRODUCTO (Pistola o Botón Lupa)
async function verificarProducto() {
    const codigoInput = document.getElementById('codigo_search');
    const codigo = codigoInput.value.trim();
    
    if (!codigo) return;

    try {
        const response = await fetch(`/api/buscar_producto/${codigo}`);
        const data = await response.json();

        const form = document.getElementById('form-ingreso-producto');
        const badge = document.getElementById('status-badge');
        
        document.getElementById('final_codigo').value = codigo;
        form.style.display = 'block';

        if (data.existe) {
            badge.innerHTML = '<span class="badge-exist">✅ PRODUCTO ENCONTRADO</span>';
            document.getElementById('form_nombre').value = data.nombre;
            document.getElementById('form_pcompra').value = data.costo;
            document.getElementById('form_pventa').value = data.precio_venta;
            document.getElementById('label-stock').innerText = "Cantidad a SUMAR:";
            document.getElementById('current-stock-info').innerText = `Stock actual: ${data.stock} unidades`;
            document.getElementById('form_stock').focus();
        } else {
            badge.innerHTML = '<span class="badge-new">✨ PRODUCTO NUEVO</span>';
            document.getElementById('form_nombre').value = "";
            document.getElementById('form_pcompra').value = "";
            document.getElementById('form_pventa').value = "";
            document.getElementById('label-stock').innerText = "Stock Inicial:";
            document.getElementById('current-stock-info').innerText = "Nuevo registro.";
            document.getElementById('form_nombre').focus();
        }
    } catch (error) {
        console.error("Error:", error);
        mostrarAlerta("Error al conectar con el servidor", "error");
    }
}

// 3. FUNCIÓN PARA GUARDAR (AJAX)
async function procesarIngreso(event) {
    event.preventDefault(); // IMPORTANTE: Evita que la página se recargue
    
    // VALIDACIÓN DE PRECIO DE VENTA
    const precioVenta = document.getElementById('form_pventa').value;
    if (!precioVenta || parseFloat(precioVenta) <= 0) {
        mostrarAlerta("¡Falta el precio de venta! Es obligatorio.", "error");
        document.getElementById('form_pventa').focus(); // Ponemos el cursor ahí para ayudarla
        return; // Detiene la ejecución aquí
    }
    const formulario = document.getElementById('form-ingreso-producto');
    const formData = new FormData(formulario);

    try {
        const response = await fetch('/agregar', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === "success") {
            mostrarAlerta(result.message, "success");
            resetearBuscador(); // Limpia y vuelve arriba para la pistola
        } else {
            mostrarAlerta("Error: " + result.message, "error");
        }
    } catch (error) {
        mostrarAlerta("Error al guardar los datos", "error");
    }
}

// 4. ALERTAS FLOTANTES
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

// 5. RESETEO PARA EL SIGUIENTE PRODUCTO
function resetearBuscador() {
    document.getElementById('form-ingreso-producto').style.display = 'none';
    const inputSearch = document.getElementById('codigo_search');
    inputSearch.value = '';
    inputSearch.focus();
}

// 6. DETECTAR ENTER EN EL BUSCADOR
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'codigo_search') {
        e.preventDefault();
        verificarProducto();
    }
});


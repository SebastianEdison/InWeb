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
        // CORRECCIÓN: Usamos la ruta que ya tienes funcionando en app.py
        const response = await fetch(`/buscar_producto?q=${codigo}`);
        const productos = await response.json();

        const form = document.getElementById('form-ingreso-producto');
        const badge = document.getElementById('status-badge');
        
        // El input oculto que guarda el código final para el envío
        document.getElementById('final_codigo').value = codigo;
        form.style.display = 'block';

        // CORRECCIÓN: Como el servidor devuelve una lista [], verificamos si tiene contenido
        if (productos && productos.length > 0) {
            const data = productos[0]; // Tomamos el primer producto encontrado
            
            badge.innerHTML = '<span class="badge-exist">✅ PRODUCTO ENCONTRADO</span>';
            
            // Rellenamos los campos con los nombres de columna de tu DB
            document.getElementById('form_nombre').value = data.nombre;
            // Si en obtener_productos traes el costo, lo usamos; si no, dejamos vacío
            document.getElementById('form_pcompra').value = data.precio_compra || ""; 
            document.getElementById('form_pventa').value = data.precio; // 'precio' viene del jsonify de app.py
            
            document.getElementById('label-stock').innerText = "Cantidad a SUMAR:";
            // Mostramos el stock actual si lo incluiste en la consulta
            const stockActual = data.stock !== undefined ? data.stock : "?";
            document.getElementById('current-stock-info').innerText = `Stock actual: ${stockActual} unidades`;
            
            document.getElementById('form_stock').focus();
        } else {
            // PRODUCTO NUEVO
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

// 3. FUNCIÓN PARA GUARDAR (AJAX) - Mantenemos tu lógica de validación
async function procesarIngreso(event) {
    if (event) event.preventDefault(); 
    
    const precioVenta = document.getElementById('form_pventa').value;
    if (!precioVenta || parseFloat(precioVenta) <= 0) {
        mostrarAlerta("¡Falta el precio de venta! Es obligatorio.", "error");
        document.getElementById('form_pventa').focus();
        return;
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
            resetearBuscador(); 
        } else {
            mostrarAlerta("Error: " + result.message, "error");
        }
    } catch (error) {
        mostrarAlerta("Error al guardar los datos", "error");
    }
}

// 4. ALERTAS FLOTANTES (Sin cambios)
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
    if (inputSearch) {
        inputSearch.value = '';
        inputSearch.focus();
    }
}

// 6. DETECTAR ENTER EN EL BUSCADOR
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'codigo_search') {
        e.preventDefault();
        verificarProducto();
    }
});
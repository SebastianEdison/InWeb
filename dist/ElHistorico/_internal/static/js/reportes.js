let seccionActiva = null;
let _cacheFiados   = [];
let _cacheFacturas = [];

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosTarjetas();

    const filtroFecha = document.getElementById('fecha-busqueda');
    if (filtroFecha) {
        filtroFecha.addEventListener('change', (e) => {
            cargarVentasDiarias(e.target.value || "");
        });
    }
});

// tarjetas superiores

async function cargarDatosTarjetas() {
    const efectivo = parseInt(localStorage.getItem('total_efectivo') || 0);
    const tarjeta  = parseInt(localStorage.getItem('total_tarjeta')  || 0);
    const otros    = parseInt(localStorage.getItem('total_otros')    || 0);
    const total    = efectivo + tarjeta + otros;

    const repIngresos = document.getElementById('rep-ingresos');
    if (repIngresos) repIngresos.innerText = `$${total.toLocaleString('es-CL')}`;

    try {
        const resp  = await fetch('/api/obtener_fiados');
        const datos = await resp.json();
        const pendientes  = (datos.fiados || []).filter(f => f.estado !== 'pagado');
        const totalFiados = pendientes.reduce((a, f) => a + (f.monto_total - f.monto_pagado), 0);
        const el = document.getElementById('rep-fiados');
        if (el) el.innerText = `$${totalFiados.toLocaleString('es-CL')}`;
    } catch(e) {}

    try {
        const resp  = await fetch('/api/obtener_facturas');
        const datos = await resp.json();
        const pendientes = (datos.facturas || []).filter(f => f.estado === 'pendiente');
        const el = document.getElementById('rep-facturas');
        if (el) el.innerText = pendientes.length;
    } catch(e) {}

    try {
        const resp  = await fetch('/api/productos_muertos?dias=60');
        const datos = await resp.json();
        const el = document.getElementById('rep-muertos');
        if (el) el.innerText = (datos.productos || []).length;
    } catch(e) {}

    // Productos por vencer
    try {
        const resp  = await fetch('/api/productos_por_vencer?dias=7');
        const datos = await resp.json();
        const el = document.getElementById('rep-vencer');
        if (el) el.innerText = (datos.productos || []).length;
    } catch(e) {}

    // Proveedores
    try {
        const resp  = await fetch('/api/obtener_proveedores');
        const datos = await resp.json();
        const el = document.getElementById('rep-proveedores');
        if (el) el.innerText = (datos.proveedores || []).length;
    } catch(e) {}
}

// navegación entre secciones

function mostrarSeccion(seccion) {
    seccionActiva = seccion;

    document.querySelectorAll('.card-metrica').forEach(c => c.classList.remove('card-activa'));
    const tab = document.getElementById('tab-' + seccion);
    if (tab) tab.classList.add('card-activa');

    ocultarFiltros();
    document.getElementById('panel-vacio').style.display     = 'none';
    document.getElementById('panel-config').style.display    = 'none';
    document.getElementById('tabla-principal').style.display = 'none';

    if (seccion === 'diario')       { mostrarFiltro('filtro-fecha');        cargarVentasDiarias(); }
    if (seccion === 'fiados')       { mostrarFiltro('filtro-fiados');       cargarFiados(); }
    if (seccion === 'graficos')     { cargarGraficos(); }
    if (seccion === 'facturas')     { mostrarFiltro('filtro-facturas');     cargarFacturas(); }
    if (seccion === 'muertos')      { mostrarFiltro('filtro-muertos');      cargarProductosMuertos(); }
    if (seccion === 'config')       { cargarConfig(); }
    if (seccion === 'vencer')       { mostrarFiltro('filtro-vencer');       cargarProductosPorVencer(); }
    if (seccion === 'movimientos')  { mostrarFiltro('filtro-movimientos');  cargarMovimientos(); }
    if (seccion === 'proveedores')  { mostrarFiltro('filtro-proveedores');  cargarProveedores(); }
}

function ocultarFiltros() {
    ['filtro-fecha','filtro-fiados','filtro-facturas','filtro-muertos','filtro-vencer','filtro-movimientos','filtro-proveedores'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function mostrarFiltro(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

function mostrarTabla() {
    document.getElementById('tabla-principal').style.display = 'table';
    document.getElementById('panel-config').style.display    = 'none';
    document.getElementById('panel-vacio').style.display     = 'none';
}

// ventas diarias

async function cargarVentasDiarias(fechaParam) {
    if (fechaParam === undefined) fechaParam = "";
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    titulo.innerText = fechaParam
        ? 'Ventas del dia ' + formatearFechaDisplay(fechaParam)
        : "Historial de Ventas por Dia";

    header.innerHTML = `
        <th style="width:180px;">Fecha</th>
        <th style="width:100px;">Ventas</th>
        <th>Desglose</th>
        <th style="width:130px;">Total del Dia</th>
        <th style="width:50px;"></th>
    `;

    mostrarTabla();
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        var url = '/api/ventas_por_dia';
        if (fechaParam) url += '?fecha=' + fechaParam;

        const resp  = await fetch(url);
        const datos = await resp.json();
        const dias  = datos.dias;

        if (!dias || dias.length === 0) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">No hay ventas registradas.</td></tr>';
            return;
        }

        var html = "";
        dias.forEach(function(dia, idx) {
            var efectivo = dia.efectivo || 0;
            var tarjeta  = dia.tarjeta  || 0;
            var otros    = dia.otros    || 0;
            var total    = dia.total_dia || 0;

            html += '<tr style="background:#f8fafc; cursor:pointer;" onclick="toggleDia(\'dia-' + idx + '\', this)">';
            html += '<td style="font-weight:700; color:#1e293b;"><i class="fas fa-chevron-right toggle-icon" style="margin-right:8px; font-size:0.75rem; color:#94a3b8; transition:transform 0.2s;"></i>' + formatearFechaDisplay(dia.dia) + '</td>';
            html += '<td style="text-align:center;"><span style="background:#eff6ff; color:#3b82f6; padding:3px 10px; border-radius:20px; font-size:0.8rem; font-weight:700;">' + dia.total_ventas + ' venta' + (dia.total_ventas !== 1 ? 's' : '') + '</span></td>';
            html += '<td><div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.82rem;">';
            html += '<span><i class="fas fa-money-bill-wave" style="color:#10b981;"></i> Efec: <strong>$' + efectivo.toLocaleString('es-CL') + '</strong></span>';
            html += '<span><i class="fas fa-credit-card" style="color:#3b82f6;"></i> Tarj: <strong>$' + tarjeta.toLocaleString('es-CL') + '</strong></span>';
            html += '<span><i class="fas fa-wallet" style="color:#f59e0b;"></i> Otros: <strong>$' + otros.toLocaleString('es-CL') + '</strong></span>';
            html += '</div></td>';
            html += '<td><strong style="font-size:1.05rem; color:#1e293b;">$' + total.toLocaleString('es-CL') + '</strong></td>';
            html += '<td><button onclick="descargarExcelDia(\'' + dia.dia + '\')" title="Descargar Excel" ' +
                    'style="background:#10b981; color:white; border:none; padding:5px 10px; ' +
                    'border-radius:6px; cursor:pointer; font-size:0.8rem;">' +
                    '<i class="fas fa-file-excel"></i></button></td></tr>';

            html += '<tr id="dia-' + idx + '" style="display:none;"><td colspan="5" style="padding:0; background:#fff;"><div style="padding:10px 20px 15px 40px;">';

            if (dia.ventas && dia.ventas.length > 0) {
                dia.ventas.forEach(function(venta, vIdx) {
                    var hora = venta.fecha ? venta.fecha.split(' ')[1].substring(0,5) : '--:--';
                    var metodoIconos = { 'efectivo': '💵', 'tarjeta': '💳', 'otros': '📱' };
                    var metodoIcon = metodoIconos[venta.metodo_pago] || '💰';
                    var anulada = venta.anulada;

                    // badge o boton de anular
                    var btnAnular = anulada
                        ? '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Anulada</span>'
                        : '<button onclick="anularVenta(' + venta.id + ')" class="btn-anular-venta">Anular</button>';

                    html += '<div style="border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; overflow:hidden;' + (anulada ? 'opacity:0.55;' : '') + '">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:#f1f5f9; cursor:pointer;" onclick="toggleVenta(\'v-' + idx + '-' + vIdx + '\', this)">';
                    html += '<span style="font-weight:600; color:#1e293b; font-size:0.9rem;"><i class="fas fa-chevron-right toggle-icon" style="margin-right:6px; font-size:0.7rem; color:#94a3b8; transition:transform 0.2s;"></i>Venta #' + venta.id + ' — ' + hora + '</span>';
                    html += '<div style="display:flex; align-items:center; gap:12px;"><span style="font-size:0.8rem; color:#64748b;">' + metodoIcon + ' ' + venta.metodo_pago + '</span>';
                    html += '<strong style="color:#1e293b;">$' + (venta.total || 0).toLocaleString('es-CL') + '</strong>';
                    html += btnAnular + '</div></div>';
                    html += '<div id="v-' + idx + '-' + vIdx + '" style="display:none; padding:10px 15px;">';

                    if (venta.productos && venta.productos.length > 0) {
                        html += '<table style="width:100%; font-size:0.82rem; border-collapse:collapse;">';
                        html += '<thead><tr style="color:#64748b; border-bottom:1px solid #e2e8f0;">';
                        html += '<th style="padding:5px 8px; text-align:left;">Producto</th>';
                        html += '<th style="padding:5px 8px; text-align:center;">Cant.</th>';
                        html += '<th style="padding:5px 8px; text-align:right;">P. Unit.</th>';
                        html += '<th style="padding:5px 8px; text-align:right;">Subtotal</th>';
                        html += '</tr></thead><tbody>';
                        venta.productos.forEach(function(p) {
                            html += '<tr style="border-bottom:1px solid #f8fafc;">';
                            html += '<td style="padding:6px 8px;">' + p.nombre + '</td>';
                            html += '<td style="padding:6px 8px; text-align:center;">' + p.cantidad + '</td>';
                            html += '<td style="padding:6px 8px; text-align:right;">$' + (p.precio_unitario||0).toLocaleString('es-CL') + '</td>';
                            html += '<td style="padding:6px 8px; text-align:right; font-weight:600;">$' + (p.subtotal||0).toLocaleString('es-CL') + '</td>';
                            html += '</tr>';
                        });
                        html += '</tbody></table>';
                    } else {
                        html += '<p style="color:#94a3b8; font-size:0.82rem;">Sin productos registrados.</p>';
                    }
                    html += '</div></div>';
                });
            } else {
                html += '<p style="color:#94a3b8; font-size:0.85rem;">Sin detalle disponible.</p>';
            }
            html += '</div></td></tr>';
        });

        body.innerHTML = html;

    } catch(e) {
        console.error("Error ventas:", e);
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#ef4444;">Error de conexion.</td></tr>';
    }
}

// fiados

async function cargarFiados() {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    titulo.innerText = "Fiados por Cobrar";
    header.innerHTML = '<th>Cliente</th><th>Fecha</th><th>Detalle</th><th style="width:110px;">Total</th><th style="width:110px;">Pagado</th><th style="width:110px;">Saldo</th><th style="width:90px;">Estado</th><th style="width:80px;"></th>';

    mostrarTabla();
    body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        const resp  = await fetch('/api/obtener_fiados');
        const datos = await resp.json();
        _cacheFiados = datos.fiados || [];
        var fiados   = _cacheFiados.slice();

        const filtro = document.getElementById('filtro-estado-fiados') ? document.getElementById('filtro-estado-fiados').value : 'pendientes';
        if (filtro === 'pendientes') fiados = fiados.filter(function(f) { return f.estado !== 'pagado'; });
        else if (filtro === 'pagados') fiados = fiados.filter(function(f) { return f.estado === 'pagado'; });

        if (fiados.length === 0) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No hay fiados para mostrar.</td></tr>';
            return;
        }

        paginar(fiados, function(f) {
            var saldo = f.monto_total - f.monto_pagado;
            var badges = {
                'pendiente': '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Pendiente</span>',
                'parcial':   '<span style="background:#fff7ed;color:#c2410c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Parcial</span>',
                'pagado':    '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Pagado</span>'
            };
            var badge = badges[f.estado] || f.estado;
            var btnSaldar = f.estado !== 'pagado'
                ? '<button onclick="abrirModalSaldar(' + f.id + ', \'' + f.nombre_cliente + '\', ' + saldo + ')" style="background:#f59e0b; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:0.8rem; font-weight:600;">Saldar</button>'
                : '<span style="color:#94a3b8; font-size:0.8rem;">✓</span>';
            var btnVer = '<button onclick="verDetalleFiado(' + f.id + ')" style="background:#3b82f6; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem; margin-left:4px;" title="Ver detalle"><i class="fas fa-eye"></i></button>';

            return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="font-weight:700; color:#1e293b;"><i class="fas fa-user" style="color:#f59e0b; margin-right:6px;"></i>' + f.nombre_cliente + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + f.fecha + '</td>' +
                '<td style="font-size:0.8rem; color:#64748b; max-width:180px;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + (f.detalle||'') + '">' + (f.detalle||'—') + '</span></td>' +
                '<td style="font-weight:600;">$' + f.monto_total.toLocaleString('es-CL') + '</td>' +
                '<td style="color:#10b981; font-weight:600;">$' + f.monto_pagado.toLocaleString('es-CL') + '</td>' +
                '<td style="font-weight:700; color:' + (saldo > 0 ? '#b91c1c' : '#10b981') + ';">$' + saldo.toLocaleString('es-CL') + '</td>' +
                '<td>' + badge + '</td>' +
                '<td style="white-space:nowrap;">' + btnSaldar + btnVer + '</td>' +
                '</tr>';
        }, 8);

    } catch(e) {
        console.error("Error fiados:", e);
        body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#ef4444;">Error de conexion.</td></tr>';
    }
}

// facturas

async function cargarFacturas() {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    titulo.innerText = "Facturas de Proveedores";
    header.innerHTML = '<th>N° Factura</th><th>Proveedor</th><th>RUT</th><th>Fecha</th><th>Productos</th><th style="width:120px;">Monto</th><th style="width:100px;">Estado</th><th style="width:80px;"></th>';

    mostrarTabla();
    body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        const resp   = await fetch('/api/obtener_facturas');
        const datos  = await resp.json();
        _cacheFacturas = datos.facturas || [];
        var facturas   = _cacheFacturas.slice();

        const filtro = document.getElementById('filtro-estado-facturas') ? document.getElementById('filtro-estado-facturas').value : 'pendientes';
        if (filtro === 'pendientes') facturas = facturas.filter(function(f) { return f.estado === 'pendiente'; });
        else if (filtro === 'pagadas') facturas = facturas.filter(function(f) { return f.estado === 'pagada'; });

        if (facturas.length === 0) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No hay facturas. <button onclick="abrirModalFactura()" style="margin-left:10px; background:#3b82f6; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-weight:600;">+ Agregar</button></td></tr>';
            return;
        }

        paginar(facturas, function(f) {
            var badge = f.estado === 'pagada'
                ? '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Pagada</span>'
                : '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Pendiente</span>';
            var btnPagar = f.estado === 'pendiente'
                ? '<button onclick="marcarFacturaPagada(' + f.id + ')" style="background:#10b981; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.75rem; font-weight:600;">✓ Pagar</button>'
                : '<span style="color:#94a3b8; font-size:0.8rem;">✓</span>';
            var btnVer = '<button onclick="verDetalleFactura(' + f.id + ')" style="background:#3b82f6; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.8rem; margin-left:4px;" title="Ver detalle"><i class="fas fa-eye"></i></button>';

            return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="font-weight:700; color:#1e293b;"><i class="fas fa-file-invoice" style="color:#3b82f6; margin-right:6px;"></i>#' + f.numero_factura + '</td>' +
                '<td style="font-weight:600; color:#334155;">' + f.proveedor + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (f.rut_proveedor||'—') + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + f.fecha + '</td>' +
                '<td style="font-size:0.8rem; color:#64748b; max-width:180px;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + (f.productos||'') + '">' + (f.productos||'—') + '</span></td>' +
                '<td style="font-weight:700; color:#1e293b;">$' + (f.monto_total||0).toLocaleString('es-CL') + '</td>' +
                '<td>' + badge + '</td>' +
                '<td style="white-space:nowrap;">' + btnPagar + btnVer + '</td>' +
                '</tr>';
        }, 8);

    } catch(e) {
        console.error("Error facturas:", e);
        body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#ef4444;">Error de conexion.</td></tr>';
    }
}

async function marcarFacturaPagada(id) {
    if (!confirm('¿Marcar esta factura como pagada?')) return;
    try {
        const resp = await fetch('/api/actualizar_estado_factura', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ factura_id: id, estado: 'pagada' })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            mostrarAlerta('✅ Factura marcada como pagada');
            cargarFacturas();
            cargarDatosTarjetas();
        }
    } catch(e) {
        mostrarAlerta('❌ Error de conexion', 'error');
    }
}

// productos muertos

async function cargarProductosMuertos() {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    const dias = document.getElementById('filtro-dias-muertos') ? document.getElementById('filtro-dias-muertos').value : 60;
    titulo.innerText = 'Productos sin venta hace mas de ' + dias + ' dias';
    header.innerHTML = '<th>Codigo</th><th>Producto</th><th style="width:120px;">Stock</th><th style="width:180px;">Ultima Venta</th>';

    mostrarTabla();
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        const resp      = await fetch('/api/productos_muertos?dias=' + dias);
        const datos     = await resp.json();
        const productos = datos.productos || [];

        if (productos.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">Todos los productos han tenido movimiento 🎉</td></tr>';
            return;
        }

        paginar(productos, function(p) {
            var stockColor = p.stock <= 3 ? '#b91c1c' : '#475569';
            var stockBg    = p.stock <= 3 ? '#fee2e2' : '#f1f5f9';
            return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (p.codigo_barra||'—') + '</td>' +
                '<td style="font-weight:600; color:#1e293b;">' + p.nombre + '</td>' +
                '<td style="text-align:center;"><span style="background:' + stockBg + '; color:' + stockColor + '; padding:3px 10px; border-radius:20px; font-size:0.85rem; font-weight:700;">' + p.stock + ' uds</span></td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (p.ultima_venta ? p.ultima_venta.substring(0,10) : '<span style="color:#ef4444;">Sin ventas</span>') + '</td>' +
                '</tr>';
        }, 4);

    } catch(e) {
        console.error("Error muertos:", e);
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#ef4444;">Error de conexion.</td></tr>';
    }
}

// configuración

async function cargarConfig() {
    const titulo = document.getElementById('titulo-detalle');
    titulo.innerText = "Configuracion del Sistema";

    document.getElementById('tabla-principal').style.display = 'none';
    document.getElementById('panel-vacio').style.display     = 'none';
    const panel = document.getElementById('panel-config');
    panel.style.display = 'block';
    panel.innerHTML = '<p style="text-align:center; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</p>';

    try {
        const respConfig   = await fetch('/api/obtener_config');
        const respUsuarios = await fetch('/api/usuarios');
        const config       = await respConfig.json();
        const dataUsuarios = await respUsuarios.json();
        const usuarios     = dataUsuarios.usuarios || [];

        var listaUsuarios = usuarios.map(function(u) {
            return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:white; border-radius:8px; margin-bottom:6px; border:1px solid #e2e8f0;">' +
                '<span style="font-weight:600; color:#1e293b; font-size:0.9rem;"><i class="fas fa-user-circle" style="color:' + (u.rol === 'admin' ? '#2563eb' : '#94a3b8') + ';"></i> ' + u.nombre + '</span>' +
                '<div style="display:flex; align-items:center; gap:8px;">' +
                '<span style="font-size:0.75rem; color:#64748b;">@' + u.username + '</span>' +
                '<span style="background:' + (u.rol === 'admin' ? '#eff6ff' : '#f1f5f9') + '; color:' + (u.rol === 'admin' ? '#2563eb' : '#64748b') + '; padding:2px 8px; border-radius:20px; font-size:0.7rem; font-weight:700;">' + u.rol + '</span>' +
                '</div></div>';
        }).join('');

        panel.innerHTML =
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:25px;">' +

            // Datos negocio
            '<div style="background:#f8fafc; border-radius:12px; padding:20px;">' +
            '<h4 style="color:#1e293b; margin:0 0 15px 0; display:flex; align-items:center; gap:8px;"><i class="fas fa-store" style="color:#3b82f6;"></i> Datos del Negocio</h4>' +
            '<div style="margin-bottom:12px;"><label style="font-size:0.8rem; font-weight:700; color:#475569; text-transform:uppercase; display:block; margin-bottom:5px;">Nombre</label>' +
            '<input type="text" id="cfg-nombre" value="' + (config.nombre_negocio||'') + '" style="width:100%; padding:10px; border:2px solid #e2e8f0; border-radius:8px; font-size:0.95rem; outline:none; box-sizing:border-box;"></div>' +
            '<div style="margin-bottom:12px;"><label style="font-size:0.8rem; font-weight:700; color:#475569; text-transform:uppercase; display:block; margin-bottom:5px;">RUT</label>' +
            '<input type="text" id="cfg-rut" value="' + (config.rut_negocio||'') + '" placeholder="12.345.678-9" style="width:100%; padding:10px; border:2px solid #e2e8f0; border-radius:8px; font-size:0.95rem; outline:none; box-sizing:border-box;"></div>' +
            '<div style="margin-bottom:15px; display:flex; align-items:center; gap:10px;">' +
            '<label style="font-size:0.8rem; font-weight:700; color:#475569; text-transform:uppercase;">Aplica IVA (19%)</label>' +
            '<input type="checkbox" id="cfg-iva" ' + (config.aplica_iva === '1' ? 'checked' : '') + ' style="width:18px; height:18px; cursor:pointer;"></div>' +
            '<button onclick="guardarConfig()" style="background:#3b82f6; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.9rem;">' +
            '<i class="fas fa-save"></i> Guardar Cambios</button>' +
            '<button onclick="descargarRespaldo()" style="background:#10b981; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.9rem; margin-top:10px; display:flex; align-items:center; gap:6px;">' +
            '<i class="fas fa-download"></i> Descargar Respaldo DB</button>' +
            '</div>' +

            // Usuarios
            '<div style="background:#f8fafc; border-radius:12px; padding:20px;">' +
            '<h4 style="color:#1e293b; margin:0 0 15px 0; display:flex; align-items:center; gap:8px;"><i class="fas fa-users" style="color:#8b5cf6;"></i> Usuarios del Sistema</h4>' +
            '<div style="margin-bottom:15px; max-height:150px; overflow-y:auto;">' + listaUsuarios + '</div>' +
            '<div style="border-top:1px solid #e2e8f0; padding-top:15px;">' +
            '<p style="font-size:0.8rem; font-weight:700; color:#475569; text-transform:uppercase; margin:0 0 10px 0;">Nuevo Usuario</p>' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">' +
            '<input type="text" id="nuevo-nombre" placeholder="Nombre completo" style="padding:9px; border:2px solid #e2e8f0; border-radius:8px; font-size:0.85rem; outline:none;">' +
            '<input type="text" id="nuevo-username" placeholder="Usuario" style="padding:9px; border:2px solid #e2e8f0; border-radius:8px; font-size:0.85rem; outline:none;"></div>' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">' +
            '<input type="password" id="nuevo-password" placeholder="Contrasena" style="padding:9px; border:2px solid #e2e8f0; border-radius:8px; font-size:0.85rem; outline:none;">' +
            '<select id="nuevo-rol" style="padding:9px; border:2px solid #e2e8f0; border-radius:8px; font-size:0.85rem; outline:none; background:#f8fafc;">' +
            '<option value="empleado">Empleado</option><option value="admin">Admin</option></select></div>' +
            '<button onclick="crearUsuario()" style="background:#8b5cf6; color:white; border:none; padding:9px 18px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">' +
            '<i class="fas fa-user-plus"></i> Crear Usuario</button>' +
            '</div>' +
            '<div style="border-top:1px solid #e2e8f0; padding-top:15px; margin-top:15px;">' +
            '<p style="font-size:0.8rem; font-weight:700; color:#475569; text-transform:uppercase; margin:0 0 10px 0;">Mi Cuenta</p>' +
            '<button onclick="abrirModalPassword()" style="background:#3b82f6; color:white; border:none; padding:9px 18px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:6px;">' +
            '<i class="fas fa-lock"></i> Cambiar mi Contrasena</button>' +
            '</div>' +
            '</div>' +

            '</div>';

        } catch(e) {
            console.error("Error config:", e);
            panel.innerHTML = `
                <div style="text-align:center; padding:40px 20px;">
                    <i class="fas fa-lock" style="font-size:3rem; color:#94a3b8; margin-bottom:15px; display:block;"></i>
                    <h3 style="color:#1e293b; margin-bottom:8px;">Acceso Restringido</h3>
                    <p style="color:#64748b; font-size:0.95rem;">
                        Esta sección solo está disponible para administradores.
                    </p>
                </div>
            `;
        }
}

async function guardarConfig() {
    const datos = {
        nombre_negocio: document.getElementById('cfg-nombre').value.trim(),
        rut_negocio:    document.getElementById('cfg-rut').value.trim(),
        aplica_iva:     document.getElementById('cfg-iva').checked ? '1' : '0'
    };
    try {
        const resp = await fetch('/api/guardar_config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const result = await resp.json();
        if (result.status === 'success') mostrarAlerta('✅ Configuracion guardada');
        else mostrarAlerta('❌ ' + result.message, 'error');
    } catch(e) {
        mostrarAlerta('❌ Error de conexion', 'error');
    }
}

async function crearUsuario() {
    const nombre   = document.getElementById('nuevo-nombre').value.trim();
    const username = document.getElementById('nuevo-username').value.trim();
    const password = document.getElementById('nuevo-password').value.trim();
    const rol      = document.getElementById('nuevo-rol').value;

    if (!nombre || !username || !password) {
        mostrarAlerta('❌ Todos los campos son obligatorios', 'error');
        return;
    }
    try {
        const resp = await fetch('/api/crear_usuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, username, password, rol })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            mostrarAlerta('✅ Usuario "' + username + '" creado');
            cargarConfig();
        } else {
            mostrarAlerta('❌ ' + result.message, 'error');
        }
    } catch(e) {
        mostrarAlerta('❌ Error de conexion', 'error');
    }
}

// modal saldar fiado

function abrirModalSaldar(id, nombre, saldo) {
    document.getElementById('saldar-id').value            = id;
    document.getElementById('saldar-nombre').textContent  = nombre;
    document.getElementById('saldar-saldo').textContent   = '$' + saldo.toLocaleString('es-CL');
    document.getElementById('saldar-monto').value         = saldo;
    document.getElementById('modal-saldar').style.display = 'flex';
    setTimeout(function() { document.getElementById('saldar-monto').focus(); }, 100);
}

function cerrarModalSaldar() {
    document.getElementById('modal-saldar').style.display = 'none';
}

async function confirmarSaldar() {
    const id    = parseInt(document.getElementById('saldar-id').value);
    const monto = parseInt(document.getElementById('saldar-monto').value) || 0;
    if (!monto || monto <= 0) {
        document.getElementById('saldar-monto').style.borderColor = '#ef4444';
        return;
    }
    try {
        const resp = await fetch('/api/saldar_fiado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fiado_id: id, monto: monto })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            cerrarModalSaldar();
            mostrarAlerta('✅ Pago registrado correctamente');
            cargarDatosTarjetas();
            cargarFiados();
        } else {
            mostrarAlerta('❌ ' + result.message, 'error');
        }
    } catch(e) {
        mostrarAlerta('❌ Error de conexion', 'error');
    }
}

// modal nueva factura

function abrirModalFactura() {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fac-fecha').value     = hoy;
    document.getElementById('fac-numero').value    = '';
    document.getElementById('fac-proveedor').value = '';
    document.getElementById('fac-rut').value       = '';
    document.getElementById('fac-monto').value     = '';
    document.getElementById('fac-productos').value = '';
    document.getElementById('fac-estado').value    = 'pendiente';
    document.getElementById('modal-factura').style.display = 'flex';
    setTimeout(function() { document.getElementById('fac-numero').focus(); }, 100);
}

function cerrarModalFactura() {
    document.getElementById('modal-factura').style.display = 'none';
}

async function guardarFactura() {
    const numero    = document.getElementById('fac-numero').value.trim();
    const proveedor = document.getElementById('fac-proveedor').value.trim();
    const rut       = document.getElementById('fac-rut').value.trim();
    const fecha     = document.getElementById('fac-fecha').value;
    const monto     = parseFloat(document.getElementById('fac-monto').value) || 0;
    const productos = document.getElementById('fac-productos').value.trim();
    const estado    = document.getElementById('fac-estado').value;

    if (!numero || !proveedor) {
        mostrarAlerta('❌ Numero de factura y proveedor son obligatorios', 'error');
        return;
    }

    const partes       = fecha.split('-');
    const fechaFormato = partes.length === 3 ? partes[2] + '-' + partes[1] + '-' + partes[0] : fecha;

    try {
        const resp = await fetch('/api/guardar_factura', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                numero_factura: numero,
                proveedor:      proveedor,
                rut_proveedor:  rut,
                fecha:          fechaFormato,
                monto_total:    monto,
                productos:      productos,
                estado:         estado
            })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            cerrarModalFactura();
            mostrarAlerta('✅ Factura guardada correctamente');
            cargarFacturas();
            cargarDatosTarjetas();
        } else {
            mostrarAlerta('❌ ' + result.message, 'error');
        }
    } catch(e) {
        mostrarAlerta('❌ Error de conexion', 'error');
    }
}

// toggle

function toggleDia(id, fila) {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = fila.querySelector('.toggle-icon');
    const vis  = el.style.display !== 'none';
    el.style.display = vis ? 'none' : 'table-row';
    if (icon) icon.style.transform = vis ? 'rotate(0deg)' : 'rotate(90deg)';
}

function toggleVenta(id, cabecera) {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = cabecera.querySelector('.toggle-icon');
    const vis  = el.style.display !== 'none';
    el.style.display = vis ? 'none' : 'block';
    if (icon) icon.style.transform = vis ? 'rotate(0deg)' : 'rotate(90deg)';
}

// helpers

function formatearFechaDisplay(fecha) {
    if (!fecha) return '';
    var partes;
    if (fecha.split('-')[0].length === 4) {
        partes = fecha.split('-');
        var anio = partes[0], mes = partes[1], dia = partes[2];
    } else {
        partes = fecha.split('-');
        var dia = partes[0], mes = partes[1], anio = partes[2];
    }
    var meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return parseInt(dia) + ' de ' + meses[parseInt(mes)-1] + ' de ' + anio;
}

function mostrarAlerta(mensaje, tipo) {
    if (tipo === undefined) tipo = 'success';
    const alerta = document.createElement('div');
    alerta.className = 'alert-floating ' + (tipo === 'success' ? 'alert-green' : 'alert-red');
    alerta.innerHTML = '<i class="fas ' + (tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle') + '"></i> ' + mensaje;
    document.body.appendChild(alerta);
    setTimeout(function() {
        alerta.style.opacity = '0';
        setTimeout(function() { alerta.remove(); }, 500);
    }, 3000);
}

function abrirModalPassword() {
    document.getElementById('pwd-actual').value   = '';
    document.getElementById('pwd-nueva').value    = '';
    document.getElementById('pwd-confirma').value = '';
    document.getElementById('pwd-error').style.display = 'none';
    document.getElementById('modal-password').style.display = 'flex';
    setTimeout(function() { document.getElementById('pwd-actual').focus(); }, 100);
}

function cerrarModalPassword() {
    document.getElementById('modal-password').style.display = 'none';
}

async function confirmarCambioPassword() {
    const actual   = document.getElementById('pwd-actual').value.trim();
    const nueva    = document.getElementById('pwd-nueva').value.trim();
    const confirma = document.getElementById('pwd-confirma').value.trim();
    const errorEl  = document.getElementById('pwd-error');

    if (!actual || !nueva || !confirma) {
        errorEl.textContent = 'Todos los campos son obligatorios.';
        errorEl.style.display = 'block';
        return;
    }
    if (nueva !== confirma) {
        errorEl.textContent = 'Las contraseñas nuevas no coinciden.';
        errorEl.style.display = 'block';
        return;
    }
    if (nueva.length < 4) {
        errorEl.textContent = 'Minimo 4 caracteres.';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';

    try {
        const resp = await fetch('/api/cambiar_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password_actual:   actual,
                password_nueva:    nueva,
                password_confirma: confirma
            })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            cerrarModalPassword();
            mostrarAlerta('✅ Contraseña actualizada correctamente');
        } else {
            errorEl.textContent = result.message;
            errorEl.style.display = 'block';
        }
    } catch(e) {
        errorEl.textContent = 'Error de conexion.';
        errorEl.style.display = 'block';
    }
}
function descargarRespaldo() {
    window.location.href = '/api/respaldo_db';
    mostrarAlerta('✅ Descargando respaldo...');
}

function descargarExcelDia(fecha) {
    window.location.href = '/api/excel_dia/' + fecha;
}

// gráficos

let chartTorta   = null;
let chartBarras  = null;
let chartLinea   = null;

async function cargarGraficos() {
    const titulo = document.getElementById('titulo-detalle');
    titulo.innerText = "Análisis Visual del Negocio";

    document.getElementById('tabla-principal').style.display = 'none';
    document.getElementById('panel-vacio').style.display     = 'none';
    const panel = document.getElementById('panel-config');
    panel.style.display = 'block';
    panel.innerHTML = '<p style="text-align:center; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando gráficos...</p>';

    try {
        const resp  = await fetch('/api/datos_graficos');
        const datos = await resp.json();

        // Destruir gráficos anteriores si existen
        if (chartTorta)  { chartTorta.destroy();  chartTorta  = null; }
        if (chartBarras) { chartBarras.destroy();  chartBarras = null; }
        if (chartLinea)  { chartLinea.destroy();   chartLinea  = null; }

        panel.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px; margin-bottom:25px;">

                <!-- Torta: Métodos de pago -->
                <div style="background:#f8fafc; border-radius:12px; padding:20px;">
                    <h4 style="color:#1e293b; margin:0 0 15px 0; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-chart-pie" style="color:#3b82f6;"></i>
                        Métodos de Pago (últimos 30 días)
                    </h4>
                    <div style="position:relative; height:250px;">
                        <canvas id="chart-torta"></canvas>
                    </div>
                </div>

                <!-- Línea: Evolución semanal -->
                <div style="background:#f8fafc; border-radius:12px; padding:20px;">
                    <h4 style="color:#1e293b; margin:0 0 15px 0; display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-chart-line" style="color:#10b981;"></i>
                        Evolución de Ventas por Semana
                    </h4>
                    <div style="position:relative; height:250px;">
                        <canvas id="chart-linea"></canvas>
                    </div>
                </div>

            </div>

            <!-- Barras: Productos más vendidos -->
            <div style="background:#f8fafc; border-radius:12px; padding:20px;">
                <h4 style="color:#1e293b; margin:0 0 15px 0; display:flex; align-items:center; gap:8px;">
                    <i class="fas fa-chart-bar" style="color:#8b5cf6;"></i>
                    Productos Más Vendidos
                </h4>
                <div style="position:relative; height:280px;">
                    <canvas id="chart-barras"></canvas>
                </div>
            </div>
        `;

        // ── GRÁFICO TORTA ──
        const metodos = datos.metodos || {};
        chartTorta = new Chart(
            document.getElementById('chart-torta'),
            {
                type: 'doughnut',
                data: {
                    labels: Object.keys(metodos).map(function(m) {
                        return m.charAt(0).toUpperCase() + m.slice(1);
                    }),
                    datasets: [{
                        data: Object.values(metodos),
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function(ctx) {
                                    return ' $' + ctx.parsed.toLocaleString('es-CL');
                                }
                            }
                        }
                    }
                }
            }
        );

        // ── GRÁFICO LÍNEA ──
        const semanas = datos.semanas || [];
        chartLinea = new Chart(
            document.getElementById('chart-linea'),
            {
                type: 'line',
                data: {
                    labels: semanas.map(function(s) { return s.semana; }),
                    datasets: [{
                        label: 'Ventas',
                        data: semanas.map(function(s) { return s.total; }),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#10b981',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(val) {
                                    return '$' + val.toLocaleString('es-CL');
                                }
                            }
                        }
                    }
                }
            }
        );

        // ── GRÁFICO BARRAS HORIZONTALES ──
        const productos = datos.productos || [];
        chartBarras = new Chart(
            document.getElementById('chart-barras'),
            {
                type: 'bar',
                data: {
                    labels: productos.map(function(p) { return p.nombre; }),
                    datasets: [{
                        label: 'Unidades vendidas',
                        data: productos.map(function(p) { return p.cantidad; }),
                        backgroundColor: [
                            '#3b82f6','#10b981','#f59e0b','#8b5cf6',
                            '#ef4444','#06b6d4','#84cc16','#f97316'
                        ],
                        borderRadius: 6,
                        borderWidth: 0
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(val) {
                                    return val + ' uds';
                                }
                            }
                        }
                    }
                }
            }
        );

    } catch(e) {
        console.error("Error graficos:", e);
        document.getElementById('panel-config').innerHTML =
            '<p style="text-align:center; color:#ef4444;">Error al cargar gráficos.</p>';
    }
}

// paginación

let paginaActual = 1;
const ITEMS_POR_PAGINA = 10;
let datosCompletos = [];

function paginar(datos, funcionRenderFila, colspan) {
    datosCompletos = datos;
    paginaActual   = 1;
    renderPagina(funcionRenderFila, colspan);
}

function renderPagina(funcionRenderFila, colspan) {
    const body      = document.getElementById('tabla-body');
    const inicio    = (paginaActual - 1) * ITEMS_POR_PAGINA;
    const fin       = inicio + ITEMS_POR_PAGINA;
    const pagina    = datosCompletos.slice(inicio, fin);
    const totalPags = Math.ceil(datosCompletos.length / ITEMS_POR_PAGINA);

    var html = "";
    pagina.forEach(function(item) {
        html += funcionRenderFila(item);
    });

    // Fila de paginación
    if (totalPags > 1) {
        html += `
            <tr>
                <td colspan="${colspan}" style="padding:15px; text-align:center; border-top:2px solid #f1f5f9;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                        <button onclick="cambiarPagina(-1)"
                                ${paginaActual === 1 ? 'disabled' : ''}
                                style="padding:6px 14px; border-radius:8px; border:1px solid #e2e8f0;
                                       background:${paginaActual === 1 ? '#f8fafc' : '#fff'};
                                       color:${paginaActual === 1 ? '#94a3b8' : '#1e293b'};
                                       cursor:${paginaActual === 1 ? 'not-allowed' : 'pointer'};
                                       font-weight:600;">
                            ← Anterior
                        </button>
                        <span style="font-size:0.85rem; color:#64748b;">
                            Página <strong style="color:#1e293b;">${paginaActual}</strong> de <strong style="color:#1e293b;">${totalPags}</strong>
                            &nbsp;·&nbsp; ${datosCompletos.length} registros
                        </span>
                        <button onclick="cambiarPagina(1)"
                                ${paginaActual === totalPags ? 'disabled' : ''}
                                style="padding:6px 14px; border-radius:8px; border:1px solid #e2e8f0;
                                       background:${paginaActual === totalPags ? '#f8fafc' : '#fff'};
                                       color:${paginaActual === totalPags ? '#94a3b8' : '#1e293b'};
                                       cursor:${paginaActual === totalPags ? 'not-allowed' : 'pointer'};
                                       font-weight:600;">
                            Siguiente →
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    body.innerHTML = html;
}

function cambiarPagina(delta) {
    const totalPags = Math.ceil(datosCompletos.length / ITEMS_POR_PAGINA);
    paginaActual = Math.max(1, Math.min(paginaActual + delta, totalPags));

    if (seccionActiva === 'fiados')   { renderPagina(renderFilaFiado, 8); }
    if (seccionActiva === 'facturas') { renderPagina(renderFilaFactura, 8); }
    if (seccionActiva === 'muertos')  { renderPagina(renderFilaMuerto, 4); }
    if (seccionActiva === 'diario')   { renderPagina(renderFilaDia, 5); }
}

async function cargarProductosPorVencer() {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    const dias = document.getElementById('filtro-dias-vencer') ? document.getElementById('filtro-dias-vencer').value : 7;
    titulo.innerText = 'Productos que vencen en los próximos ' + dias + ' días';
    header.innerHTML = '<th>Producto</th><th>Código</th><th style="width:120px;">Stock</th><th style="width:160px;">Vence</th><th style="width:100px;">Estado</th>';

    mostrarTabla();
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        const resp      = await fetch('/api/productos_por_vencer?dias=' + dias);
        const datos     = await resp.json();
        const productos = datos.productos || [];

        // Actualizar contador en tarjeta
        const el = document.getElementById('rep-vencer');
        if (el) el.innerText = productos.length;

        if (productos.length === 0) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">No hay productos próximos a vencer en este período 🎉</td></tr>';
            return;
        }

        paginar(productos, function(p) {
            const hoy        = new Date();
            const vence      = new Date(p.fecha_vencimiento);
            const diffDias   = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));

            const badge = diffDias <= 3
                ? '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">⚠ Urgente</span>'
                : '<span style="background:#fff7ed;color:#c2410c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Próximo</span>';

            return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="font-weight:600; color:#1e293b;">' + p.nombre + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (p.codigo_barra||'—') + '</td>' +
                '<td style="text-align:center;"><span style="background:#f1f5f9; color:#475569; padding:3px 10px; border-radius:20px; font-size:0.85rem; font-weight:700;">' + p.stock + ' uds</span></td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + p.fecha_vencimiento + ' <small style="color:#94a3b8;">(' + diffDias + ' días)</small></td>' +
                '<td>' + badge + '</td>' +
                '</tr>';
        }, 5);

    } catch(e) {
        console.error("Error vencer:", e);
        body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#ef4444;">Error de conexión.</td></tr>';
    }
}
// detalle fiado

function verDetalleFiado(id) {
    var f = _cacheFiados.find(function(x) { return x.id === id; });
    if (!f) return;

    var saldo = f.monto_total - f.monto_pagado;
    var badges = {
        'pendiente': '<span style="background:#fee2e2;color:#b91c1c;padding:3px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;">Pendiente</span>',
        'parcial':   '<span style="background:#fff7ed;color:#c2410c;padding:3px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;">Parcial</span>',
        'pagado':    '<span style="background:#dcfce7;color:#166534;padding:3px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;">Pagado</span>'
    };

    var itemsHtml = '';
    if (f.detalle) {
        f.detalle.split('|').forEach(function(item) {
            var t = item.trim();
            if (t) {
                itemsHtml += '<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:0.9rem;">' +
                    '<span style="color:#334155;">' + t + '</span></div>';
            }
        });
    } else {
        itemsHtml = '<p style="color:#94a3b8; font-size:0.85rem;">Sin detalle de productos.</p>';
    }

    document.getElementById('df-nombre').textContent  = f.nombre_cliente;
    document.getElementById('df-fecha').textContent   = f.fecha;
    document.getElementById('df-estado').innerHTML    = badges[f.estado] || f.estado;
    document.getElementById('df-items').innerHTML     = itemsHtml;
    document.getElementById('df-total').textContent   = '$' + f.monto_total.toLocaleString('es-CL');
    document.getElementById('df-pagado').textContent  = '$' + f.monto_pagado.toLocaleString('es-CL');
    document.getElementById('df-saldo').textContent   = '$' + saldo.toLocaleString('es-CL');
    document.getElementById('df-saldo').style.color   = saldo > 0 ? '#b91c1c' : '#10b981';

    document.getElementById('modal-detalle-fiado').style.display = 'flex';
}

function cerrarModalDetalleFiado() {
    document.getElementById('modal-detalle-fiado').style.display = 'none';
}

// detalle factura

function verDetalleFactura(id) {
    var f = _cacheFacturas.find(function(x) { return x.id === id; });
    if (!f) return;

    var badge = f.estado === 'pagada'
        ? '<span style="background:#dcfce7;color:#166534;padding:3px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;">Pagada</span>'
        : '<span style="background:#fee2e2;color:#b91c1c;padding:3px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;">Pendiente</span>';

    document.getElementById('dfac-numero').textContent    = '#' + f.numero_factura;
    document.getElementById('dfac-proveedor').textContent = f.proveedor;
    document.getElementById('dfac-rut').textContent       = f.rut_proveedor || '—';
    document.getElementById('dfac-fecha').textContent     = f.fecha;
    document.getElementById('dfac-monto').textContent     = '$' + (f.monto_total || 0).toLocaleString('es-CL');
    document.getElementById('dfac-estado').innerHTML      = badge;
    document.getElementById('dfac-productos').textContent = f.productos || '—';

    document.getElementById('modal-detalle-factura').style.display = 'flex';
}

function cerrarModalDetalleFactura() {
    document.getElementById('modal-detalle-factura').style.display = 'none';
}

// Feature 5: anular venta

async function anularVenta(id) {
    if (!confirm('¿Estás seguro de que deseas anular la Venta #' + id + '? Se restaurará el stock.')) return;
    try {
        const resp = await fetch('/api/anular_venta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ venta_id: id })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            mostrarAlerta('Venta #' + id + ' anulada y stock restaurado');
            cargarVentasDiarias(document.getElementById('fecha-busqueda') ? document.getElementById('fecha-busqueda').value : '');
        } else {
            mostrarAlerta('Error: ' + result.message, 'error');
        }
    } catch(e) {
        mostrarAlerta('Error de conexión', 'error');
    }
}

// Feature 6: movimientos de stock

async function cargarMovimientos() {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    titulo.innerText = 'Historial de Movimientos de Stock';
    header.innerHTML = '<th>Producto</th><th>Código</th><th style="width:110px;">Tipo</th><th style="width:80px;">Cantidad</th><th>Motivo</th><th style="width:145px;">Fecha</th>';

    mostrarTabla();
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        const resp  = await fetch('/api/historial_stock');
        const datos = await resp.json();
        const movs  = datos.movimientos || [];

        if (movs.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">Sin movimientos registrados.</td></tr>';
            return;
        }

        var coloresTipo = {
            'VENTA':     '#fee2e2|#b91c1c',
            'ENTRADA':   '#dcfce7|#166534',
            'SALIDA':    '#fff7ed|#c2410c',
            'ANULACION': '#eff6ff|#2563eb'
        };

        paginar(movs, function(m) {
            var partes   = (coloresTipo[m.tipo] || '#f1f5f9|#475569').split('|');
            var badge    = '<span style="background:' + partes[0] + ';color:' + partes[1] + ';padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">' + m.tipo + '</span>';
            var fecha    = m.fecha ? m.fecha.substring(0, 16).replace('T', ' ') : '—';
            return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="font-weight:600; color:#1e293b;">' + (m.producto_nombre || '—') + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (m.codigo_barra || '—') + '</td>' +
                '<td>' + badge + '</td>' +
                '<td style="text-align:center; font-weight:700;">' + m.cantidad + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (m.motivo || '—') + '</td>' +
                '<td style="color:#64748b; font-size:0.82rem;">' + fecha + '</td>' +
                '</tr>';
        }, 6);

    } catch(e) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#ef4444;">Error de conexión.</td></tr>';
    }
}

// modal ajuste manual de stock

let _productosCache = [];

function abrirModalAjusteStock() {
    document.getElementById('ajuste-buscar').value        = '';
    document.getElementById('ajuste-cantidad').value      = '';
    document.getElementById('ajuste-motivo').value        = '';
    document.getElementById('ajuste-producto-id').value   = '';
    document.getElementById('ajuste-producto-nombre').textContent = '';
    document.getElementById('ajuste-sugerencias').innerHTML = '';
    document.getElementById('modal-ajuste-stock').style.display = 'flex';
    setTimeout(function() { document.getElementById('ajuste-buscar').focus(); }, 100);
}

function cerrarModalAjusteStock() {
    document.getElementById('modal-ajuste-stock').style.display = 'none';
}

async function confirmarAjusteStock() {
    const idProducto = parseInt(document.getElementById('ajuste-producto-id').value);
    const cantidad   = parseInt(document.getElementById('ajuste-cantidad').value);
    const motivo     = document.getElementById('ajuste-motivo').value.trim() || 'Ajuste manual';

    if (!idProducto) {
        mostrarAlerta('Selecciona un producto', 'error');
        return;
    }
    if (!cantidad || cantidad === 0) {
        mostrarAlerta('Ingresa una cantidad distinta de 0', 'error');
        return;
    }

    try {
        const resp = await fetch('/api/ajuste_stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ producto_id: idProducto, cantidad: cantidad, motivo: motivo })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            cerrarModalAjusteStock();
            mostrarAlerta('Stock actualizado correctamente');
            cargarMovimientos();
        } else {
            mostrarAlerta('Error: ' + result.message, 'error');
        }
    } catch(e) {
        mostrarAlerta('Error de conexión', 'error');
    }
}

// Feature 7: proveedores

async function cargarProveedores() {
    const titulo = document.getElementById('titulo-detalle');
    const header = document.getElementById('tabla-header');
    const body   = document.getElementById('tabla-body');

    titulo.innerText = 'Gestión de Proveedores';
    header.innerHTML = '<th>Nombre</th><th>RUT</th><th>Teléfono</th><th>Email</th><th>Notas</th><th style="width:90px;"></th>';

    mostrarTabla();
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

    try {
        const resp  = await fetch('/api/obtener_proveedores');
        const datos = await resp.json();
        const provs = datos.proveedores || [];

        // actualizar contador tarjeta
        const el = document.getElementById('rep-proveedores');
        if (el) el.innerText = provs.length;

        if (provs.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">No hay proveedores. <button onclick="abrirModalProveedor()" style="margin-left:10px; background:#3b82f6; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-weight:600;">+ Agregar</button></td></tr>';
            return;
        }

        paginar(provs, function(p) {
            return '<tr style="border-bottom:1px solid #f1f5f9;">' +
                '<td style="font-weight:700; color:#1e293b;"><i class="fas fa-truck" style="color:#3b82f6; margin-right:6px;"></i>' + p.nombre + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (p.rut || '—') + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (p.telefono || '—') + '</td>' +
                '<td style="color:#64748b; font-size:0.85rem;">' + (p.email || '—') + '</td>' +
                '<td style="color:#64748b; font-size:0.8rem; max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + (p.notas || '—') + '</td>' +
                '<td style="white-space:nowrap;">' +
                '<button onclick="eliminarProveedor(' + p.id + ')" style="background:#fee2e2;color:#b91c1c;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem;" title="Eliminar"><i class="fas fa-trash"></i></button>' +
                '</td></tr>';
        }, 6);

    } catch(e) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#ef4444;">Error de conexión.</td></tr>';
    }
}

function abrirModalProveedor() {
    document.getElementById('prov-id').value       = '';
    document.getElementById('prov-nombre').value   = '';
    document.getElementById('prov-rut').value      = '';
    document.getElementById('prov-telefono').value = '';
    document.getElementById('prov-email').value    = '';
    document.getElementById('prov-notas').value    = '';
    document.getElementById('modal-nuevo-proveedor').style.display = 'flex';
    setTimeout(function() { document.getElementById('prov-nombre').focus(); }, 100);
}

function cerrarModalProveedor() {
    document.getElementById('modal-nuevo-proveedor').style.display = 'none';
}

async function guardarProveedor() {
    const nombre = document.getElementById('prov-nombre').value.trim();
    if (!nombre) {
        mostrarAlerta('El nombre es obligatorio', 'error');
        return;
    }
    const datos = {
        id:       document.getElementById('prov-id').value || null,
        nombre:   nombre,
        rut:      document.getElementById('prov-rut').value.trim(),
        telefono: document.getElementById('prov-telefono').value.trim(),
        email:    document.getElementById('prov-email').value.trim(),
        notas:    document.getElementById('prov-notas').value.trim()
    };
    try {
        const resp = await fetch('/api/guardar_proveedor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const result = await resp.json();
        if (result.status === 'success') {
            cerrarModalProveedor();
            mostrarAlerta('Proveedor guardado correctamente');
            cargarProveedores();
            cargarDatosTarjetas();
        } else {
            mostrarAlerta('Error: ' + result.message, 'error');
        }
    } catch(e) {
        mostrarAlerta('Error de conexión', 'error');
    }
}

async function eliminarProveedor(id) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    try {
        const resp = await fetch('/api/eliminar_proveedor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        const result = await resp.json();
        if (result.status === 'success') {
            mostrarAlerta('Proveedor eliminado');
            cargarProveedores();
            cargarDatosTarjetas();
        } else {
            mostrarAlerta('Error: ' + result.message, 'error');
        }
    } catch(e) {
        mostrarAlerta('Error de conexión', 'error');
    }
}

// configurar event listeners para modales del DOM (reportes)
document.addEventListener('DOMContentLoaded', function() {
    // botón abrir ajuste manual
    var btnAjuste = document.getElementById('btn-abrir-ajuste');
    if (btnAjuste) btnAjuste.addEventListener('click', abrirModalAjusteStock);

    // botones cerrar/confirmar ajuste
    var btnCerrarAjuste    = document.getElementById('btn-cerrar-ajuste');
    var btnCancelarAjuste  = document.getElementById('btn-cancelar-ajuste');
    var btnConfirmarAjuste = document.getElementById('btn-confirmar-ajuste');
    if (btnCerrarAjuste)    btnCerrarAjuste.addEventListener('click', cerrarModalAjusteStock);
    if (btnCancelarAjuste)  btnCancelarAjuste.addEventListener('click', cerrarModalAjusteStock);
    if (btnConfirmarAjuste) btnConfirmarAjuste.addEventListener('click', confirmarAjusteStock);

    // búsqueda de producto en modal ajuste
    var ajusteBuscar = document.getElementById('ajuste-buscar');
    if (ajusteBuscar) {
        var timeoutAjuste;
        ajusteBuscar.addEventListener('input', function() {
            clearTimeout(timeoutAjuste);
            var q = this.value.trim();
            if (q.length < 2) {
                document.getElementById('ajuste-sugerencias').innerHTML = '';
                return;
            }
            timeoutAjuste = setTimeout(async function() {
                try {
                    var resp = await fetch('/buscar_producto?busqueda=' + q);
                    var prods = await resp.json();
                    var lista = document.getElementById('ajuste-sugerencias');
                    lista.innerHTML = '';
                    prods.slice(0, 6).forEach(function(p) {
                        var div = document.createElement('div');
                        div.className = 'ajuste-sug-item';
                        div.textContent = p.nombre + ' (stock: ' + p.stock + ')';
                        div.addEventListener('mousedown', function(e) {
                            e.preventDefault();
                            document.getElementById('ajuste-producto-id').value = p.id;
                            document.getElementById('ajuste-buscar').value      = p.nombre;
                            document.getElementById('ajuste-producto-nombre').textContent = 'Seleccionado: ' + p.nombre + ' — Stock actual: ' + p.stock;
                            lista.innerHTML = '';
                        });
                        lista.appendChild(div);
                    });
                } catch(err) {}
            }, 200);
        });
    }

    // botón abrir proveedor
    var btnProv = document.getElementById('btn-abrir-proveedor');
    if (btnProv) btnProv.addEventListener('click', abrirModalProveedor);

    // botones cerrar/guardar proveedor
    var btnCerrarProv  = document.getElementById('btn-cerrar-proveedor');
    var btnCancelarProv = document.getElementById('btn-cancelar-proveedor');
    var btnGuardarProv  = document.getElementById('btn-guardar-proveedor');
    if (btnCerrarProv)   btnCerrarProv.addEventListener('click', cerrarModalProveedor);
    if (btnCancelarProv) btnCancelarProv.addEventListener('click', cerrarModalProveedor);
    if (btnGuardarProv)  btnGuardarProv.addEventListener('click', guardarProveedor);
});

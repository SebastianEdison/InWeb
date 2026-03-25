/**
 * reportes.js — Panel de control completo
 */

let seccionActiva = null;

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosTarjetas();

    const filtroFecha = document.getElementById('fecha-busqueda');
    if (filtroFecha) {
        filtroFecha.addEventListener('change', (e) => {
            cargarVentasDiarias(e.target.value || "");
        });
    }
});

// ============================================================
// --- TARJETAS SUPERIORES ---
// ============================================================

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
}

// ============================================================
// --- NAVEGACIÓN ENTRE SECCIONES ---
// ============================================================

function mostrarSeccion(seccion) {
    seccionActiva = seccion;

    document.querySelectorAll('.card-metrica').forEach(c => c.classList.remove('card-activa'));
    const tab = document.getElementById('tab-' + seccion);
    if (tab) tab.classList.add('card-activa');

    ocultarFiltros();
    document.getElementById('panel-vacio').style.display     = 'none';
    document.getElementById('panel-config').style.display    = 'none';
    document.getElementById('tabla-principal').style.display = 'none';

    if (seccion === 'diario')   { mostrarFiltro('filtro-fecha');    cargarVentasDiarias(); }
    if (seccion === 'fiados')   { mostrarFiltro('filtro-fiados');   cargarFiados(); }
    if (seccion === 'facturas') { mostrarFiltro('filtro-facturas'); cargarFacturas(); }
    if (seccion === 'muertos')  { mostrarFiltro('filtro-muertos');  cargarProductosMuertos(); }
    if (seccion === 'config')   { cargarConfig(); }
}

function ocultarFiltros() {
    ['filtro-fecha','filtro-fiados','filtro-facturas','filtro-muertos'].forEach(id => {
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

// ============================================================
// --- VENTAS DIARIAS ---
// ============================================================

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

                    html += '<div style="border:1px solid #e2e8f0; border-radius:10px; margin-bottom:8px; overflow:hidden;">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:#f1f5f9; cursor:pointer;" onclick="toggleVenta(\'v-' + idx + '-' + vIdx + '\', this)">';
                    html += '<span style="font-weight:600; color:#1e293b; font-size:0.9rem;"><i class="fas fa-chevron-right toggle-icon" style="margin-right:6px; font-size:0.7rem; color:#94a3b8; transition:transform 0.2s;"></i>Venta #' + venta.id + ' — ' + hora + '</span>';
                    html += '<div style="display:flex; align-items:center; gap:12px;"><span style="font-size:0.8rem; color:#64748b;">' + metodoIcon + ' ' + venta.metodo_pago + '</span>';
                    html += '<strong style="color:#1e293b;">$' + (venta.total || 0).toLocaleString('es-CL') + '</strong></div></div>';
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

// ============================================================
// --- FIADOS ---
// ============================================================

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
        var fiados  = datos.fiados || [];

        const filtro = document.getElementById('filtro-estado-fiados') ? document.getElementById('filtro-estado-fiados').value : 'pendientes';
        if (filtro === 'pendientes') fiados = fiados.filter(function(f) { return f.estado !== 'pagado'; });
        else if (filtro === 'pagados') fiados = fiados.filter(function(f) { return f.estado === 'pagado'; });

        if (fiados.length === 0) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No hay fiados para mostrar.</td></tr>';
            return;
        }

        var html = "";
        fiados.forEach(function(f) {
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

            html += '<tr style="border-bottom:1px solid #f1f5f9;">';
            html += '<td style="font-weight:700; color:#1e293b;"><i class="fas fa-user" style="color:#f59e0b; margin-right:6px;"></i>' + f.nombre_cliente + '</td>';
            html += '<td style="color:#64748b; font-size:0.85rem;">' + f.fecha + '</td>';
            html += '<td style="font-size:0.8rem; color:#64748b; max-width:180px;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + (f.detalle||'') + '">' + (f.detalle||'—') + '</span></td>';
            html += '<td style="font-weight:600;">$' + f.monto_total.toLocaleString('es-CL') + '</td>';
            html += '<td style="color:#10b981; font-weight:600;">$' + f.monto_pagado.toLocaleString('es-CL') + '</td>';
            html += '<td style="font-weight:700; color:' + (saldo > 0 ? '#b91c1c' : '#10b981') + ';">$' + saldo.toLocaleString('es-CL') + '</td>';
            html += '<td>' + badge + '</td>';
            html += '<td>' + btnSaldar + '</td>';
            html += '</tr>';
        });
        body.innerHTML = html;

    } catch(e) {
        console.error("Error fiados:", e);
        body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#ef4444;">Error de conexion.</td></tr>';
    }
}

// ============================================================
// --- FACTURAS ---
// ============================================================

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
        var facturas = datos.facturas || [];

        const filtro = document.getElementById('filtro-estado-facturas') ? document.getElementById('filtro-estado-facturas').value : 'pendientes';
        if (filtro === 'pendientes') facturas = facturas.filter(function(f) { return f.estado === 'pendiente'; });
        else if (filtro === 'pagadas') facturas = facturas.filter(function(f) { return f.estado === 'pagada'; });

        if (facturas.length === 0) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">No hay facturas. <button onclick="abrirModalFactura()" style="margin-left:10px; background:#3b82f6; color:white; border:none; padding:6px 14px; border-radius:8px; cursor:pointer; font-weight:600;">+ Agregar</button></td></tr>';
            return;
        }

        var html = "";
        facturas.forEach(function(f) {
            var badge = f.estado === 'pagada'
                ? '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Pagada</span>'
                : '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;">Pendiente</span>';
            var btnPagar = f.estado === 'pendiente'
                ? '<button onclick="marcarFacturaPagada(' + f.id + ')" style="background:#10b981; color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.75rem; font-weight:600;">✓ Pagar</button>'
                : '<span style="color:#94a3b8; font-size:0.8rem;">✓</span>';

            html += '<tr style="border-bottom:1px solid #f1f5f9;">';
            html += '<td style="font-weight:700; color:#1e293b;"><i class="fas fa-file-invoice" style="color:#3b82f6; margin-right:6px;"></i>#' + f.numero_factura + '</td>';
            html += '<td style="font-weight:600; color:#334155;">' + f.proveedor + '</td>';
            html += '<td style="color:#64748b; font-size:0.85rem;">' + (f.rut_proveedor||'—') + '</td>';
            html += '<td style="color:#64748b; font-size:0.85rem;">' + f.fecha + '</td>';
            html += '<td style="font-size:0.8rem; color:#64748b; max-width:180px;"><span style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + (f.productos||'') + '">' + (f.productos||'—') + '</span></td>';
            html += '<td style="font-weight:700; color:#1e293b;">$' + (f.monto_total||0).toLocaleString('es-CL') + '</td>';
            html += '<td>' + badge + '</td>';
            html += '<td>' + btnPagar + '</td>';
            html += '</tr>';
        });
        body.innerHTML = html;

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

// ============================================================
// --- PRODUCTOS MUERTOS ---
// ============================================================

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
        const resp  = await fetch('/api/productos_muertos?dias=' + dias);
        const datos = await resp.json();
        const productos = datos.productos || [];

        if (productos.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">Todos los productos han tenido movimiento 🎉</td></tr>';
            return;
        }

        var html = "";
        productos.forEach(function(p) {
            var stockColor = p.stock <= 3 ? '#b91c1c' : '#475569';
            var stockBg    = p.stock <= 3 ? '#fee2e2' : '#f1f5f9';
            html += '<tr style="border-bottom:1px solid #f1f5f9;">';
            html += '<td style="color:#64748b; font-size:0.85rem;">' + (p.codigo_barra||'—') + '</td>';
            html += '<td style="font-weight:600; color:#1e293b;">' + p.nombre + '</td>';
            html += '<td style="text-align:center;"><span style="background:' + stockBg + '; color:' + stockColor + '; padding:3px 10px; border-radius:20px; font-size:0.85rem; font-weight:700;">' + p.stock + ' uds</span></td>';
            html += '<td style="color:#64748b; font-size:0.85rem;">' + (p.ultima_venta ? p.ultima_venta.substring(0,10) : '<span style="color:#ef4444;">Sin ventas</span>') + '</td>';
            html += '</tr>';
        });
        body.innerHTML = html;

    } catch(e) {
        console.error("Error muertos:", e);
        body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#ef4444;">Error de conexion.</td></tr>';
    }
}

// ============================================================
// --- CONFIGURACIÓN ---
// ============================================================

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
        panel.innerHTML = '<p style="text-align:center; color:#ef4444;">Error al cargar configuracion.</p>';
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

// ============================================================
// --- MODAL SALDAR FIADO ---
// ============================================================

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

// ============================================================
// --- MODAL NUEVA FACTURA ---
// ============================================================

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

// ============================================================
// --- TOGGLE ---
// ============================================================

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

// ============================================================
// --- HELPERS ---
// ============================================================

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
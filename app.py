from flask import Flask, render_template, request, redirect, jsonify, url_for, flash,session, send_file
import sqlite3, os
from functools import wraps
from datetime import datetime , timedelta
import pytz

from databases import (
    obtener_productos, eliminar_producto, actualizar_producto, 
    agregar_producto, buscar_producto_por_codigo, conectar, 
    crear_tablas, guardar_cierre_db, obtener_historial_db,
    registrar_venta,guardar_fiado_db, obtener_fiados_db, saldar_fiado_db,
    verificar_usuario, crear_usuario, obtener_usuarios, guardar_factura_db, obtener_facturas_db, actualizar_estado_factura_db,
    obtener_productos_muertos_db, obtener_config_db, guardar_config_db ,cambiar_password_db, generar_reporte_excel,generar_excel_dia
)

app = Flask(__name__)
app.secret_key = 'clave_secreta'
tz_chile = pytz.timezone('America/Santiago')
fecha_local = datetime.now(tz_chile).strftime('%d-%m-%Y %H:%M')


# ── DECORADOR: protege rutas que requieren login ──
def login_requerido(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'usuario_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

# ── DECORADOR: solo admin ──
def solo_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('rol') != 'admin':
            flash('Acceso denegado. Se requiere rol administrador.', 'error')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated

# ── LOGIN ──
@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'usuario_id' in session:
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        
        usuario = verificar_usuario(username, password)
        
        if usuario:
            session['usuario_id'] = usuario['id']
            session['username']   = usuario['username']
            session['nombre']     = usuario['nombre']
            session['rol']        = usuario['rol']
            return redirect(url_for('index'))
        else:
            flash('Usuario o contraseña incorrectos', 'error')
    
    return render_template('login.html')

# ── LOGOUT ──
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ── GESTIÓN DE USUARIOS (solo admin) ──
@app.route('/api/usuarios', methods=['GET'])
@login_requerido
@solo_admin
def api_usuarios():
    usuarios = obtener_usuarios()
    return jsonify({'usuarios': usuarios})

@app.route('/api/crear_usuario', methods=['POST'])
@login_requerido
@solo_admin
def api_crear_usuario():
    try:
        data     = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        nombre   = data.get('nombre', '').strip()
        rol      = data.get('rol', 'empleado')

        if not username or not password or not nombre:
            return jsonify({"status": "error", "message": "Todos los campos son obligatorios"}), 400

        exito, mensaje = crear_usuario(username, password, nombre, rol)
        if exito:
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": mensaje}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- VARIABLE TEMPORAL SOLO PARA EL TICKET ACTUAL ---
cierre_reciente_ticket = {} 

# --- RUTA PRINCIPAL (INVENTARIO) ---
@app.route('/')
@login_requerido
def index():
    busqueda = request.args.get('busqueda', '').strip()
    solo_bajo_stock = request.args.get('bajo_stock')
    productos_db = obtener_productos(busqueda if busqueda else None)
    if solo_bajo_stock:
        productos_db = [p for p in productos_db if p['stock'] <= 3]
    
    todos = obtener_productos(None)
    alertas_count = sum(1 for p in todos if p['stock'] <= 3)

    return render_template('index.html', lista=productos_db, busqueda=busqueda, alertas=alertas_count, filtrado_bajo=solo_bajo_stock)

# --- VENTAS Y REPORTES ---
@app.route('/ventas')
@login_requerido
def ventas():
    return render_template('ventas.html')

@app.route('/reportes')
@login_requerido
def reportes():
    return render_template('reportes.html')

# --- REGISTRAR VENTA EN BASE DE DATOS ---
@app.route('/api/registrar_venta', methods=['POST'])
@login_requerido
def api_registrar_venta():
    try:
        data = request.get_json()
        carrito = data.get('carrito', [])
        metodo_pago = data.get('metodo_pago', 'Efectivo')

        if not carrito:
            return jsonify({"status": "error", "message": "El carrito está vacío"}), 400

        exito, resultado = registrar_venta(carrito, metodo_pago)

        if exito:
            return jsonify({"status": "success", "venta_id": resultado})
        else:
            return jsonify({"status": "error", "message": resultado}), 400

    except Exception as e:
        print(f"Error en api_registrar_venta: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# --- LÓGICA DE CIERRE DE CAJA CON BASE DE DATOS ---
@app.route('/api/guardar_cierre', methods=['POST'])
@login_requerido
def guardar_cierre():
    global cierre_reciente_ticket
    try:
        data = request.get_json()
        
        efectivo = int(data.get('efectivo', 0))
        tarjeta  = int(data.get('tarjeta', 0))
        otros    = int(data.get('otros', 0))
        fiados   = int(data.get('fiados', 0))
        total_real = efectivo + tarjeta + otros

        # Hora correcta de Chile (maneja verano/invierno automáticamente)
        tz_chile  = pytz.timezone('America/Santiago')
        fecha_local = datetime.now(tz_chile).strftime('%d-%m-%Y %H:%M')

        cierre_reciente_ticket = {
            'fecha': fecha_local,
            'efectivo': efectivo,
            'tarjeta':  tarjeta,
            'otros':    otros,
            'fiados':   fiados,
            'total':    total_real,
            'turno':    'Único'
        }
        # Generar Excel silenciosamente
        try:
            config = obtener_config_db()
            cierre_reciente_ticket['nombre_negocio'] = config.get('nombre_negocio', 'EL HISTORICO')
            generar_reporte_excel(cierre_reciente_ticket)
        except Exception as e:
            print(f"Error generando Excel: {e}")
            # No interrumpimos el flujo aunque falle el Excel
        guardar_cierre_db(cierre_reciente_ticket)
        return jsonify({"status": "success"})

    except Exception as e:
        print(f"Error al guardar cierre: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
@app.route('/api/historial')
@login_requerido
def api_historial():
    historial = obtener_historial_db()
    return jsonify({'cierres': historial})

@app.route('/api/guardar_fiado', methods=['POST'])
@login_requerido
def api_guardar_fiado():
    try:
        data = request.get_json()
        nombre  = data.get('nombre', '').strip()
        monto   = data.get('monto', 0)
        detalle = data.get('detalle', '')

        if not nombre:
            return jsonify({"status": "error", "message": "El nombre es obligatorio"}), 400
        if not monto or monto <= 0:
            return jsonify({"status": "error", "message": "El monto debe ser mayor a 0"}), 400

        guardar_fiado_db(nombre, monto, detalle)
        return jsonify({"status": "success"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/obtener_fiados')
@login_requerido
def api_obtener_fiados():
    try:
        fiados = obtener_fiados_db()
        return jsonify({"fiados": fiados})
    except Exception as e:
        return jsonify({"fiados": [], "error": str(e)}), 500


@app.route('/api/saldar_fiado', methods=['POST'])
@login_requerido
def api_saldar_fiado():
    try:
        data     = request.get_json()
        fiado_id = data.get('fiado_id')
        monto    = float(data.get('monto', 0))

        if not fiado_id or monto <= 0:
            return jsonify({"status": "error", "message": "Datos inválidos"}), 400

        exito, estado = saldar_fiado_db(fiado_id, monto)

        if exito:
            return jsonify({"status": "success", "estado": estado})
        else:
            return jsonify({"status": "error", "message": estado}), 400

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/ventas_por_dia')
@login_requerido
def api_ventas_por_dia():
    try:
        fecha = request.args.get('fecha', '')
        conn = conectar()
        cursor = conn.cursor()

        # Traer ventas agrupadas por día
        if fecha:
            cursor.execute("""
                SELECT 
                    DATE(fecha) as dia,
                    COUNT(*) as total_ventas,
                    SUM(total) as total_dia,
                    SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END) as efectivo,
                    SUM(CASE WHEN metodo_pago = 'tarjeta' THEN total ELSE 0 END) as tarjeta,
                    SUM(CASE WHEN metodo_pago = 'otros' THEN total ELSE 0 END) as otros
                FROM ventas
                WHERE DATE(fecha) = ?
                GROUP BY DATE(fecha)
                ORDER BY dia DESC
            """, (fecha,))
        else:
            cursor.execute("""
                SELECT 
                    DATE(fecha) as dia,
                    COUNT(*) as total_ventas,
                    SUM(total) as total_dia,
                    SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END) as efectivo,
                    SUM(CASE WHEN metodo_pago = 'tarjeta' THEN total ELSE 0 END) as tarjeta,
                    SUM(CASE WHEN metodo_pago = 'otros' THEN total ELSE 0 END) as otros
                FROM ventas
                GROUP BY DATE(fecha)
                ORDER BY dia DESC
            """)

        dias = [dict(row) for row in cursor.fetchall()]

        # Para cada día, traer el detalle de cada venta
        for dia in dias:
            cursor.execute("""
                SELECT v.id, v.fecha, v.total, v.metodo_pago
                FROM ventas v
                WHERE DATE(v.fecha) = ?
                ORDER BY v.fecha DESC
            """, (dia['dia'],))
            ventas = [dict(row) for row in cursor.fetchall()]

            # Para cada venta, traer sus productos
            for venta in ventas:
                cursor.execute("""
                    SELECT p.nombre, dv.cantidad, dv.precio_unitario, dv.subtotal
                    FROM detalle_venta dv
                    JOIN productos p ON p.id = dv.producto_id
                    WHERE dv.venta_id = ?
                """, (venta['id'],))
                venta['productos'] = [dict(row) for row in cursor.fetchall()]

            dia['ventas'] = ventas

        conn.close()
        return jsonify({'dias': dias})

    except Exception as e:
        print(f"Error en ventas_por_dia: {e}")
        return jsonify({'dias': [], 'error': str(e)}), 500

@app.route('/detalle_cierre')
@login_requerido
def detalle_cierre():
    return render_template('detalle_cierre.html', cierre=cierre_reciente_ticket)

# --- CRUD DE PRODUCTOS ---
@app.route('/actualizar', methods=['POST'])
@login_requerido
def actualizar():
    actualizar_producto(
        request.form['id'],
        request.form['nombre'],
        float(request.form['precio']),
        float(request.form['costo']),
        int(request.form['stock']),
        request.form.get('unidad', 'Unidad')  # ← agregar esto
    )
    return redirect('/')

@app.route('/editar/<int:id_p>')
@login_requerido
def editar_vista(id_p):
    conn = conectar()
    conn.row_factory = sqlite3.Row 
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM productos WHERE id = ?", (id_p,))
    producto = cursor.fetchone()
    conn.close()
    return render_template('editar.html', p=producto) if producto else ("No encontrado", 404)

@app.route('/agregar', methods=['GET', 'POST'])
@login_requerido
def agregar():
    if request.method == 'POST':
        data = request.get_json()
        
        codigo = data.get('codigo')
        nombre = data.get('nombre')
        precio_v = data.get('precio_venta')
        precio_c = data.get('precio_compra') or 0
        stock = data.get('stock') or 0
        unidad = data.get('unidad', 'Unidad')
        
        agregar_producto(codigo, nombre, precio_v, precio_c, stock, unidad)
        
        return jsonify({"status": "success"})
    
    return render_template('agregar.html')

@app.route('/buscar_producto')
@login_requerido
def buscar_producto():
    q = request.args.get('busqueda', '')
    productos = obtener_productos(q)
    
    lista = []
    for p in productos:
        lista.append({
            "id": p['id'],
            "nombre": p['nombre'],
            "precio": p['precio_venta'],
            "unidad": p['unidad'],
            "codigo_barra": p['codigo_barra'],
            "stock": p['stock']
        })
    return jsonify(lista)

@app.route('/eliminar/<int:id>', methods=['POST'])
@login_requerido
def eliminar(id):
    eliminar_producto(id)
    return redirect('/')

# ── FACTURAS ──
@app.route('/api/guardar_factura', methods=['POST'])
@login_requerido
def api_guardar_factura():
    try:
        data = request.get_json()
        tz_chile = pytz.timezone('America/Santiago')
        fecha    = datetime.now(tz_chile).strftime('%d-%m-%Y')

        datos = {
            'numero_factura': data.get('numero_factura', '').strip(),
            'proveedor':      data.get('proveedor', '').strip(),
            'rut_proveedor':  data.get('rut_proveedor', '').strip(),
            'fecha':          data.get('fecha', fecha),
            'monto_total':    float(data.get('monto_total', 0)),
            'productos':      data.get('productos', ''),
            'estado':         data.get('estado', 'pendiente')
        }

        if not datos['numero_factura'] or not datos['proveedor']:
            return jsonify({"status": "error", "message": "Número de factura y proveedor son obligatorios"}), 400

        guardar_factura_db(datos)
        return jsonify({"status": "success"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/obtener_facturas')
@login_requerido
def api_obtener_facturas():
    try:
        facturas = obtener_facturas_db()
        return jsonify({"facturas": facturas})
    except Exception as e:
        return jsonify({"facturas": [], "error": str(e)}), 500


@app.route('/api/actualizar_estado_factura', methods=['POST'])
@login_requerido
def api_actualizar_estado_factura():
    try:
        data       = request.get_json()
        factura_id = data.get('factura_id')
        estado     = data.get('estado')

        if not factura_id or not estado:
            return jsonify({"status": "error", "message": "Datos inválidos"}), 400

        actualizar_estado_factura_db(factura_id, estado)
        return jsonify({"status": "success"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ── PRODUCTOS MUERTOS ──
@app.route('/api/productos_muertos')
@login_requerido
def api_productos_muertos():
    try:
        dias      = int(request.args.get('dias', 60))
        productos = obtener_productos_muertos_db(dias)
        return jsonify({"productos": productos, "dias": dias})
    except Exception as e:
        return jsonify({"productos": [], "error": str(e)}), 500


# ── CONFIGURACIÓN ──
@app.route('/configuracion')
@login_requerido
@solo_admin
def configuracion():
    return render_template('configuracion.html')


@app.route('/api/obtener_config')
@login_requerido
def api_obtener_config():
    try:
        config = obtener_config_db()
        return jsonify(config)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/guardar_config', methods=['POST'])
@login_requerido
@solo_admin
def api_guardar_config():
    try:
        data = request.get_json()
        guardar_config_db(data)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
# En el import de databases agrega:
cambiar_password_db

# Nueva ruta:
@app.route('/api/cambiar_password', methods=['POST'])
@login_requerido
def api_cambiar_password():
    try:
        data             = request.get_json()
        password_actual  = data.get('password_actual', '').strip()
        password_nueva   = data.get('password_nueva', '').strip()
        password_confirma= data.get('password_confirma', '').strip()

        if not password_actual or not password_nueva:
            return jsonify({"status": "error", "message": "Todos los campos son obligatorios"}), 400

        if password_nueva != password_confirma:
            return jsonify({"status": "error", "message": "Las contraseñas nuevas no coinciden"}), 400

        if len(password_nueva) < 4:
            return jsonify({"status": "error", "message": "La contraseña debe tener al menos 4 caracteres"}), 400

        exito, mensaje = cambiar_password_db(session['usuario_id'], password_actual, password_nueva)

        if exito:
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": mensaje}), 400

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route('/api/respaldo_db')
@login_requerido
@solo_admin
def api_respaldo_db():
    try:
        db_path = os.path.join(os.path.dirname(__file__), 'inventario.db')
        return send_file(
            db_path,
            as_attachment=True,
            download_name=f'respaldo_{datetime.now(pytz.timezone("America/Santiago")).strftime("%d-%m-%Y_%H-%M")}.db',
            mimetype='application/octet-stream'
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/excel_dia/<fecha>')
@login_requerido
def api_excel_dia(fecha):
    try:
        from flask import send_file
        excel = generar_excel_dia(fecha)
        return send_file(
            excel,
            as_attachment=True,
            download_name=f'ventas_{fecha}.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    crear_tablas() 
    app.run(debug=True)
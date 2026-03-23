from flask import Flask, render_template, request, redirect, jsonify, url_for, flash
import sqlite3
from datetime import datetime 
from databases import (
    obtener_productos, eliminar_producto, actualizar_producto, 
    agregar_producto, buscar_producto_por_codigo, conectar, 
    crear_tablas, guardar_cierre_db, obtener_historial_db,
    registrar_venta
)

app = Flask(__name__)
app.secret_key = 'clave_secreta'

# --- VARIABLE TEMPORAL SOLO PARA EL TICKET ACTUAL ---
cierre_reciente_ticket = {} 

# --- RUTA PRINCIPAL (INVENTARIO) ---
@app.route('/')
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
def ventas():
    return render_template('ventas.html')

@app.route('/reportes')
def reportes():
    return render_template('reportes.html')

# --- REGISTRAR VENTA EN BASE DE DATOS ---
@app.route('/api/registrar_venta', methods=['POST'])
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
def guardar_cierre():
    global cierre_reciente_ticket
    try:
        data = request.get_json()
        
        efectivo = int(data.get('efectivo', 0))
        tarjeta = int(data.get('tarjeta', 0))
        otros = int(data.get('otros', 0))
        fiados = int(data.get('fiados', 0))
        total_real = efectivo + tarjeta + otros

        cierre_reciente_ticket = {
            'fecha': datetime.now().strftime('%d-%m-%Y %H:%M'),
            'efectivo': efectivo,
            'tarjeta': tarjeta,
            'otros': otros,
            'fiados': fiados,
            'total': total_real,
            'turno': 'Único'
        }
        
        guardar_cierre_db(cierre_reciente_ticket)
        
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error al guardar cierre: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/historial')
def api_historial():
    historial = obtener_historial_db()
    return jsonify({'cierres': historial})

@app.route('/detalle_cierre')
def detalle_cierre():
    return render_template('detalle_cierre.html', cierre=cierre_reciente_ticket)

# --- CRUD DE PRODUCTOS ---
@app.route('/actualizar', methods=['POST'])
def actualizar():
    actualizar_producto(request.form['id'], request.form['nombre'], float(request.form['precio']), float(request.form['costo']), int(request.form['stock']))
    return redirect('/')

@app.route('/editar/<int:id_p>')
def editar_vista(id_p):
    conn = conectar()
    conn.row_factory = sqlite3.Row 
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM productos WHERE id = ?", (id_p,))
    producto = cursor.fetchone()
    conn.close()
    return render_template('editar.html', p=producto) if producto else ("No encontrado", 404)

@app.route('/agregar', methods=['GET', 'POST'])
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
def eliminar(id):
    eliminar_producto(id)
    return redirect('/')

if __name__ == '__main__':
    crear_tablas() 
    app.run(debug=True)
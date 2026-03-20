from flask import Flask, render_template, request, redirect, jsonify, url_for, flash
# Importamos funciones de bbdd
from databases import obtener_productos, eliminar_producto, actualizar_producto, agregar_producto, buscar_producto_por_codigo, conectar, crear_tablas
import sqlite3

app = Flask(__name__)
app.secret_key = 'clave_secreta'

# --- RUTA PRINCIPAL ---
@app.route('/')
def index():
    busqueda = request.args.get('busqueda', '').strip()
    solo_bajo_stock = request.args.get('bajo_stock')

    nombre_buscar = busqueda if busqueda else None
    productos_db = obtener_productos(nombre_buscar)

    if solo_bajo_stock:
        productos_db = [p for p in productos_db if p['stock'] <= 3]

    todos = obtener_productos(None)
    alertas_count = sum(1 for p in todos if p['stock'] <= 3)

    return render_template('index.html', 
                           lista=productos_db, 
                           busqueda=busqueda, 
                           alertas=alertas_count,
                           filtrado_bajo=solo_bajo_stock)

# --- ACTUALIZAR ---
@app.route('/actualizar', methods=['POST'])
def actualizar():
    actualizar_producto(
        request.form['id'],
        request.form['nombre'],
        float(request.form['precio']),
        float(request.form['costo']),
        int(request.form['stock'])
    )
    return redirect('/')

# --- VISTA EDITAR ---
@app.route('/editar/<int:id_p>')
def editar_vista(id_p):
    conn = conectar()
    conn.row_factory = sqlite3.Row 
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM productos WHERE id = ?", (id_p,))
    producto = cursor.fetchone()
    conn.close()
    
    if producto:
        return render_template('editar.html', p=producto)
    return "Producto no encontrado", 404

# --- AGREGAR ---
@app.route('/agregar', methods=['GET', 'POST']) # <--- Verifica que estén AMBOS aquí
def agregar():
    if request.method == 'POST':
        try:
            data = request.get_json()
            
            # Extraemos con .get() para evitar errores si falta un campo
            codigo = data.get('codigo')
            nombre = data.get('nombre')
            p_compra = data.get('precio_compra') or 0
            p_venta = data.get('precio_venta')
            stock = data.get('stock') or 0

            # Si no hay precio de venta, lanzamos error antes de la base de datos
            if not p_venta:
                return jsonify({"status": "error", "message": "Falta el precio de venta"}), 400

            # Tu función que guarda en la DB
            agregar_producto(codigo, nombre, p_venta, p_compra, stock)
            
            return jsonify({"status": "success", "message": "Producto guardado con éxito"})
        
        except Exception as e:
            print(f"Error en POST /agregar: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500

    # Si el método es GET, simplemente mostramos la página
    return render_template('agregar.html')

# --- API BUSQUEDA (LA QUE USA EL JS) ---
@app.route('/buscar_producto')
def buscar_producto():
    query = request.args.get('q') or request.args.get('busqueda')
    if not query:
        return jsonify([])

    filas = obtener_productos(query)
    
    lista_productos = []
    for p in filas:
        lista_productos.append({
            'id': p['id'],
            'nombre': p['nombre'],
            'precio': p['precio_venta'], # Nombre real en tu tabla
            'codigo_barra': p['codigo_barra']
        })
    return jsonify(lista_productos)

# --- ELIMINAR ---
@app.route('/eliminar/<int:id>', methods=['POST'])
def eliminar(id):
    eliminar_producto(id)
    flash('✅ Producto eliminado con éxito', 'success') 
    return redirect('/')

# --- VENTAS ---
@app.route('/ventas')
def ventas():
    return render_template('ventas.html')

@app.route('/reportes')
def reportes():
    # Por ahora solo devolvemos el template. 
    # Más adelante aquí calcularemos los datos de "Productos Muertos" y "A Vencer".
    return render_template('reportes.html')

if __name__ == '__main__':
    crear_tablas()
    app.run(debug=True)
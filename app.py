from flask import Flask, render_template, request, redirect, jsonify,url_for, flash
#Importamos funciones de bbdd
from databases import obtener_productos,eliminar_producto,actualizar_producto, agregar_producto,buscar_producto_por_codigo
import sqlite3

app = Flask(__name__)
app.secret_key = 'clave_secreta' # Pon cualquier frase aquí
# Definimos la ruta principal (pagina de inicio)

@app.route('/')
def index():
    # 1. Capturamos lo que viene del HTML (ahora con el nombre 'busqueda')
    busqueda = request.args.get('busqueda', '').strip()
    solo_bajo_stock = request.args.get('bajo_stock')

    # 2. Mantenemos TU variable 'nombre_buscar'
    if busqueda:
        nombre_buscar = busqueda
    else:
        nombre_buscar = None
    
    # 3. Traemos la lista inicial usando TU función
    productos_db = obtener_productos(nombre_buscar)

    # 4. Filtro extra de Bajo Stock (si se presionó el botón naranja)
    if solo_bajo_stock:
        productos_db = [p for p in productos_db if p['stock'] <= 3]

    # 5. Conteo para el botón de alertas (usando None para traer todos los activos)
    todos = obtener_productos(None)
    alertas_count = sum(1 for p in todos if p['stock'] <= 3)

    return render_template('index.html', 
                           lista=productos_db, 
                           busqueda=busqueda, 
                           alertas=alertas_count,
                           filtrado_bajo=solo_bajo_stock)

@app.route('/actualizar', methods=['POST'])
def actualizar():

    from databases import actualizar_producto
    actualizar_producto(
        request.form['id'],
        request.form['nombre'],
        float(request.form['precio']),
        float(request.form['costo']),
        int(request.form['stock'])
    )
    return redirect('/')

@app.route('/editar/<int:id_p>')
def editar_vista(id_p):
    import sqlite3
    from databases import conectar # O donde tengas tu función de conectar
    
    conn = conectar()
    # ESTA LÍNEA ES VITAL: permite usar p['nombre'] en vez de p[1]
    conn.row_factory = sqlite3.Row 
    cursor = conn.cursor()
    
    # Buscamos el producto
    cursor.execute("SELECT * FROM productos WHERE id = ?", (id_p,))
    producto = cursor.fetchone()
    conn.close()
    
    if producto:
        return render_template('editar.html', p=producto)
    else:
        return "Producto no encontrado", 404
    
@app.route('/agregar', methods=['GET', 'POST'])
def agregar():
    if request.method == 'POST':
        try:
            codigo = request.form.get('codigo')
            nombre = request.form.get('nombre')
            p_venta = request.form.get('precio_venta')
            p_compra = request.form.get('precio_compra')
            cantidad = int(request.form.get('stock'))

            # Usamos tu lógica de databases.py
            # Esta función ya maneja si suma o crea nuevo
            agregar_producto(codigo, nombre, p_venta, p_compra, cantidad)
            
            return jsonify({"status": "success", "message": f"Producto '{nombre}' procesado correctamente."})
        
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
    
    return render_template('agregar.html')

# RUTA 1: La API que consulta el JS mientras escaneas
@app.route('/api/buscar_producto/<codigo>')
def api_buscar_producto(codigo):
    producto = buscar_producto_por_codigo(codigo)
    if producto:
        return jsonify({
            "existe": True,
            "nombre": producto['nombre'],
            "costo": producto['costo'],
            "precio_venta": producto['precio_venta'],
            "stock": producto['stock']
        })
    return jsonify({"existe": False})

@app.route('/eliminar/<int:id>', methods=['POST'])
def eliminar(id):
    eliminar_producto(id) # Nombre de tu función en databases.py
    # El primer texto es el mensaje, el segundo es la categoría para el CSS
    flash('✅ Producto eliminado con éxito', 'success') 
    return redirect('/')

@app.route('/ventas')
def ventas():
    # Por ahora solo mostramos la página vacía para ver el diseño
    # Pasamos una lista vacía para que no de error el 'for' si lo tuvieras
    return render_template('ventas.html')


if __name__ == '__main__':
    #Crea las tablas por si se borro el archivo .db
    from databases import crear_tablas
    #debug = True sirve para que el servidor se reinicia
    app.run(debug=True)
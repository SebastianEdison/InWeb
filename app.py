from flask import Flask, render_template, request, redirect
#Importamos funciones de bbdd
from databases import obtener_productos

app = Flask(__name__)

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

@app.route('/agregar' , methods = ['POST'])
def agregar():
    nombre = request.form['nombre']
    precio_venta =request.form['precio']#Lo que va a pagar el cliente
    precio_compra = request.form ['costo']# A lo que se compra el producto
    stock_inicial = request.form['stock']
    codigo = request.form ['codigo']

    # Se guarda en la bbdd
    from databases import agregar_productos
    agregar_productos(codigo, nombre, precio_venta, precio_compra, stock_inicial)

    return redirect('/')


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
    




if __name__ == '__main__':
    #Crea las tablas por si se borro el archivo .db
    from databases import crear_tablas
    #debug = True sirve para que el servidor se reinicia
    app.run(debug=True)
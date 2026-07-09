from flask import Blueprint, render_template, request, redirect, jsonify

from db.productos import (
    obtener_productos, obtener_producto_por_id, agregar_producto,
    actualizar_producto, eliminar_producto, obtener_productos_muertos_db,
    obtener_productos_por_vencer, obtener_historial_stock_db, ajuste_manual_stock_db,
)
from utils.decorators import login_requerido

inventario_bp = Blueprint('inventario', __name__)


def _es_stock_bajo(p):
    stock = p['stock']
    if stock <= 0:
        return False
    if p['stock_minimo'] and p['stock_minimo'] > 0:
        return stock <= p['stock_minimo']
    return stock <= 3

@inventario_bp.route('/')
@login_requerido
def index():
    busqueda = request.args.get('busqueda', '').strip()
    solo_bajo_stock = request.args.get('bajo_stock')
    categoria_filter = request.args.get('categoria', '')

    productos_db = obtener_productos(busqueda if busqueda else None)

    # filtro por categoría
    if categoria_filter:
        productos_db = [p for p in productos_db if p['categoria'] == categoria_filter]

    if solo_bajo_stock:
        productos_db = [p for p in productos_db if _es_stock_bajo(p)]

    todos = obtener_productos(None)
    alertas_count = sum(1 for p in todos if _es_stock_bajo(p))

    # lista de categorías distintas para mostrar filtros
    categorias_set = sorted({p['categoria'] for p in todos if p['categoria']})

    return render_template(
        'index.html',
        lista=productos_db,
        busqueda=busqueda,
        alertas=alertas_count,
        filtrado_bajo=solo_bajo_stock,
        categorias=categorias_set,
        categoria_activa=categoria_filter
    )

@inventario_bp.route('/actualizar', methods=['POST'])
@login_requerido
def actualizar():
    actualizar_producto(
        request.form['id'],
        request.form['nombre'],
        float(request.form['precio']),
        float(request.form['costo']),
        int(request.form['stock']),
        request.form.get('unidad', 'Unidad'),
        request.form.get('fecha_vencimiento') or None,
        int(request.form.get('stock_minimo', 0)),
        request.form.get('categoria', 'General')
    )
    return redirect('/')

@inventario_bp.route('/editar/<int:id_p>')
@login_requerido
def editar_vista(id_p):
    producto = obtener_producto_por_id(id_p)
    return render_template('editar.html', p=producto) if producto else ("No encontrado", 404)

@inventario_bp.route('/agregar', methods=['GET', 'POST'])
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
        fecha_vencimiento = data.get('fecha_vencimiento', None)

        stock_minimo = data.get('stock_minimo', 0)
        categoria = data.get('categoria', 'General')
        agregar_producto(codigo, nombre, precio_v, precio_c, stock, unidad, fecha_vencimiento, stock_minimo, categoria)

        return jsonify({"status": "success"})

    return render_template('agregar.html')

@inventario_bp.route('/buscar_producto')
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
            "stock": p['stock'],
            "fecha_vencimiento": p['fecha_vencimiento'] if p['fecha_vencimiento'] else None,
            "categoria": p['categoria'] if p['categoria'] else 'General'
        })
    return jsonify(lista)

@inventario_bp.route('/eliminar/<int:id>', methods=['POST'])
@login_requerido
def eliminar(id):
    eliminar_producto(id)
    return redirect('/')

@inventario_bp.route('/api/productos_por_vencer')
@login_requerido
def api_productos_por_vencer():
    try:
        dias     = int(request.args.get('dias', 7))
        productos = obtener_productos_por_vencer(dias)
        return jsonify({"productos": productos, "dias": dias})
    except Exception as e:
        return jsonify({"productos": [], "error": str(e)}), 500

@inventario_bp.route('/api/productos_muertos')
@login_requerido
def api_productos_muertos():
    try:
        dias      = int(request.args.get('dias', 60))
        productos = obtener_productos_muertos_db(dias)
        return jsonify({"productos": productos, "dias": dias})
    except Exception as e:
        return jsonify({"productos": [], "error": str(e)}), 500

@inventario_bp.route('/api/historial_stock')
@login_requerido
def api_historial_stock():
    try:
        limite = int(request.args.get('limite', 100))
        historial = obtener_historial_stock_db(limite)
        return jsonify({"movimientos": historial})
    except Exception as e:
        return jsonify({"movimientos": [], "error": str(e)}), 500

@inventario_bp.route('/api/ajuste_stock', methods=['POST'])
@login_requerido
def api_ajuste_stock():
    try:
        data = request.get_json()
        producto_id = data.get('producto_id')
        cantidad    = int(data.get('cantidad', 0))
        motivo      = data.get('motivo', 'Ajuste manual').strip()

        if not producto_id or cantidad == 0:
            return jsonify({"status": "error", "message": "Datos inválidos"}), 400

        exito, msg = ajuste_manual_stock_db(producto_id, cantidad, motivo)
        if exito:
            return jsonify({"status": "success", "message": msg})
        return jsonify({"status": "error", "message": msg}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

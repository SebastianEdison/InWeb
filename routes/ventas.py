from flask import Blueprint, render_template, request, jsonify

from db.ventas import registrar_venta, anular_venta_db, obtener_ventas_por_dia
from utils.decorators import login_requerido

ventas_bp = Blueprint('ventas', __name__)


@ventas_bp.route('/ventas')
@login_requerido
def ventas():
    return render_template('ventas.html')

@ventas_bp.route('/api/registrar_venta', methods=['POST'])
@login_requerido
def api_registrar_venta():
    try:
        data = request.get_json()
        carrito = data.get('carrito', [])
        metodo_pago = data.get('metodo_pago', 'Efectivo')
        forzar = data.get('forzar', False)

        if not carrito:
            return jsonify({"status": "error", "message": "El carrito está vacío"}), 400

        descuento = data.get('descuento', 0)
        exito, resultado = registrar_venta(carrito, metodo_pago, forzar, descuento)

        if exito:
            return jsonify({"status": "success", "venta_id": resultado})
        else:
            return jsonify({"status": "error", "message": resultado}), 400

    except Exception as e:
        print(f"Error en api_registrar_venta: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@ventas_bp.route('/api/anular_venta', methods=['POST'])
@login_requerido
def api_anular_venta():
    try:
        data = request.get_json()
        venta_id = data.get('venta_id')
        exito, msg = anular_venta_db(venta_id)
        if exito:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": msg}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@ventas_bp.route('/api/ventas_por_dia')
@login_requerido
def api_ventas_por_dia():
    try:
        fecha = request.args.get('fecha', '')
        dias = obtener_ventas_por_dia(fecha if fecha else None)
        return jsonify({'dias': dias})
    except Exception as e:
        print(f"Error en ventas_por_dia: {e}")
        return jsonify({'dias': [], 'error': str(e)}), 500

from flask import Blueprint, request, jsonify
from datetime import datetime
import pytz

from db.facturas import guardar_factura_db, obtener_facturas_db, actualizar_estado_factura_db
from db.proveedores import obtener_proveedores_db, guardar_proveedor_db, eliminar_proveedor_db
from utils.decorators import login_requerido
from utils.errores import respuesta_error

proveedores_bp = Blueprint('proveedores', __name__)


@proveedores_bp.route('/api/guardar_factura', methods=['POST'])
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
        return respuesta_error(e)

@proveedores_bp.route('/api/obtener_facturas')
@login_requerido
def api_obtener_facturas():
    try:
        facturas = obtener_facturas_db()
        return jsonify({"facturas": facturas})
    except Exception as e:
        return jsonify({"facturas": [], "error": str(e)}), 500

@proveedores_bp.route('/api/actualizar_estado_factura', methods=['POST'])
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
        return respuesta_error(e)

@proveedores_bp.route('/api/obtener_proveedores')
@login_requerido
def api_obtener_proveedores():
    try:
        proveedores = obtener_proveedores_db()
        return jsonify({"proveedores": proveedores})
    except Exception as e:
        return jsonify({"proveedores": [], "error": str(e)}), 500

@proveedores_bp.route('/api/guardar_proveedor', methods=['POST'])
@login_requerido
def api_guardar_proveedor():
    try:
        data = request.get_json()
        if not data.get('nombre', '').strip():
            return jsonify({"status": "error", "message": "El nombre es obligatorio"}), 400
        guardar_proveedor_db(data)
        return jsonify({"status": "success"})
    except Exception as e:
        return respuesta_error(e)

@proveedores_bp.route('/api/eliminar_proveedor', methods=['POST'])
@login_requerido
def api_eliminar_proveedor():
    try:
        data = request.get_json()
        proveedor_id = data.get('id')
        if not proveedor_id:
            return jsonify({"status": "error", "message": "ID inválido"}), 400
        eliminar_proveedor_db(proveedor_id)
        return jsonify({"status": "success"})
    except Exception as e:
        return respuesta_error(e)

import os
from datetime import datetime
from flask import Blueprint, request, jsonify, session, send_file
import pytz

from db.config import obtener_config_db, guardar_config_db
from db.usuarios import cambiar_password_db
from db.conexion import get_app_dir
from utils.decorators import login_requerido, solo_admin

configuracion_bp = Blueprint('configuracion', __name__)


@configuracion_bp.route('/api/obtener_config')
@login_requerido
def api_obtener_config():
    try:
        config = obtener_config_db()
        return jsonify(config)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@configuracion_bp.route('/api/guardar_config', methods=['POST'])
@login_requerido
@solo_admin
def api_guardar_config():
    try:
        data = request.get_json()
        guardar_config_db(data)
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@configuracion_bp.route('/api/cambiar_password', methods=['POST'])
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

@configuracion_bp.route('/api/respaldo_db')
@login_requerido
@solo_admin
def api_respaldo_db():
    try:
        db_path = os.path.join(get_app_dir(), 'inventario.db')
        return send_file(
            db_path,
            as_attachment=True,
            download_name=f'respaldo_{datetime.now(pytz.timezone("America/Santiago")).strftime("%d-%m-%Y_%H-%M")}.db',
            mimetype='application/octet-stream'
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

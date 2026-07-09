from flask import Blueprint, render_template, request, jsonify
from datetime import datetime
import pytz

from db.caja import guardar_cierre_db, obtener_historial_db
from db.fiados import guardar_fiado_db, obtener_fiados_db, saldar_fiado_db
from db.config import obtener_config_db
from db.reportes import generar_reporte_excel
from utils.decorators import login_requerido
from utils.errores import respuesta_error

caja_bp = Blueprint('caja', __name__)

# --- VARIABLE TEMPORAL SOLO PARA EL TICKET ACTUAL ---
cierre_reciente_ticket = {}


@caja_bp.route('/api/guardar_cierre', methods=['POST'])
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
        return respuesta_error(e)

@caja_bp.route('/api/historial')
@login_requerido
def api_historial():
    historial = obtener_historial_db()
    return jsonify({'cierres': historial})

@caja_bp.route('/detalle_cierre')
@login_requerido
def detalle_cierre():
    return render_template('detalle_cierre.html', cierre=cierre_reciente_ticket)

@caja_bp.route('/api/guardar_fiado', methods=['POST'])
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
        return respuesta_error(e)

@caja_bp.route('/api/obtener_fiados')
@login_requerido
def api_obtener_fiados():
    try:
        fiados = obtener_fiados_db()
        return jsonify({"fiados": fiados})
    except Exception as e:
        return jsonify({"fiados": [], "error": str(e)}), 500

@caja_bp.route('/api/saldar_fiado', methods=['POST'])
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
        return respuesta_error(e)

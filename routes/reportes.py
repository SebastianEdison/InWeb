from flask import Blueprint, render_template, jsonify, send_file

from db.reportes import generar_excel_dia, obtener_datos_graficos
from utils.decorators import login_requerido
from utils.errores import respuesta_error

reportes_bp = Blueprint('reportes', __name__)


@reportes_bp.route('/reportes')
@login_requerido
def reportes():
    return render_template('reportes.html')

@reportes_bp.route('/api/excel_dia/<fecha>')
@login_requerido
def api_excel_dia(fecha):
    try:
        excel = generar_excel_dia(fecha)
        return send_file(
            excel,
            as_attachment=True,
            download_name=f'ventas_{fecha}.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return respuesta_error(e)

@reportes_bp.route('/api/datos_graficos')
@login_requerido
def api_datos_graficos():
    try:
        return jsonify(obtener_datos_graficos())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

from flask import jsonify


def respuesta_error(e, mensaje="Ocurrió un error inesperado. Intenta de nuevo."):
    """Para errores no anticipados: el detalle tecnico (str(e)) queda en el log
    (o la consola en desarrollo), pero al frontend solo se le manda un mensaje
    generico en vez de exponer detalles internos (SQL, rutas de archivo, etc)."""
    print(f"Error no manejado: {e}")
    return jsonify({"status": "error", "message": mensaje}), 500

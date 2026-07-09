from flask import Flask
import os, sys, shutil, threading, webbrowser, time, secrets
from datetime import datetime, timedelta
import pytz

from db.conexion import crear_tablas
from routes.auth import auth_bp
from routes.inventario import inventario_bp
from routes.ventas import ventas_bp
from routes.caja import caja_bp
from routes.proveedores import proveedores_bp
from routes.reportes import reportes_bp
from routes.configuracion import configuracion_bp

# rutas según si corre como exe o como script normal
if getattr(sys, 'frozen', False):
    _BASE_DIR   = os.path.dirname(sys.executable)   # carpeta del .exe (datos persistentes)
    _BUNDLE_DIR = sys._MEIPASS                       # carpeta temporal (templates, static, código)
else:
    _BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
    _BUNDLE_DIR = _BASE_DIR

def _cargar_o_crear_secret_key():
    """Genera una secret_key la primera vez y la reutiliza despues, guardada junto a la BD."""
    key_path = os.path.join(_BASE_DIR, 'secret.key')
    if os.path.exists(key_path):
        with open(key_path, 'r') as f:
            key = f.read().strip()
            if key:
                return key
    key = secrets.token_hex(32)
    with open(key_path, 'w') as f:
        f.write(key)
    return key


def create_app():
    app = Flask(
        __name__,
        template_folder=os.path.join(_BUNDLE_DIR, 'templates'),
        static_folder=os.path.join(_BUNDLE_DIR, 'static')
    )
    app.secret_key = _cargar_o_crear_secret_key()
    app.permanent_session_lifetime = timedelta(hours=12)

    app.register_blueprint(auth_bp)
    app.register_blueprint(inventario_bp)
    app.register_blueprint(ventas_bp)
    app.register_blueprint(caja_bp)
    app.register_blueprint(proveedores_bp)
    app.register_blueprint(reportes_bp)
    app.register_blueprint(configuracion_bp)

    return app


# Feature 8: backup automático diario
def hacer_backup_automatico():
    backup_dir = os.path.join(_BASE_DIR, 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    db_path = os.path.join(_BASE_DIR, 'inventario.db')
    tz = pytz.timezone('America/Santiago')
    fecha = datetime.now(tz).strftime('%Y-%m-%d')
    dest = os.path.join(backup_dir, f'backup_{fecha}.db')
    if not os.path.exists(dest):
        shutil.copy2(db_path, dest)
        print(f"Backup automático guardado: {dest}")
    # mantener solo los últimos 7 backups
    archivos = sorted([f for f in os.listdir(backup_dir) if f.endswith('.db')])
    while len(archivos) > 7:
        os.remove(os.path.join(backup_dir, archivos.pop(0)))
    # próximo backup en 24 horas
    timer = threading.Timer(86400, hacer_backup_automatico)
    timer.daemon = True
    timer.start()


def _abrir_navegador():
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')


app = create_app()

if __name__ == '__main__':
    crear_tablas()
    hacer_backup_automatico()
    t = threading.Thread(target=_abrir_navegador, daemon=True)
    t.start()
    app.run(debug=False, host='127.0.0.1', port=5000)

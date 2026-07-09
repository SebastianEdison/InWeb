from functools import wraps
from flask import redirect, url_for, session, flash


def login_requerido(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'usuario_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated

def solo_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('rol') != 'admin':
            flash('Acceso denegado. Se requiere rol administrador.', 'error')
            return redirect(url_for('inventario.index'))
        return f(*args, **kwargs)
    return decorated

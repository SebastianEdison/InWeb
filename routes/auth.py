from flask import Blueprint, render_template, request, redirect, jsonify, url_for, flash, session

from db.usuarios import verificar_usuario, crear_usuario, obtener_usuarios
from utils.decorators import login_requerido, solo_admin

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if 'usuario_id' in session:
        return redirect(url_for('inventario.index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        usuario = verificar_usuario(username, password)

        if usuario:
            session.permanent = True
            session['usuario_id'] = usuario['id']
            session['username']   = usuario['username']
            session['nombre']     = usuario['nombre']
            session['rol']        = usuario['rol']
            return redirect(url_for('inventario.index'))
        else:
            flash('Usuario o contraseña incorrectos', 'error')

    return render_template('login.html')

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))

@auth_bp.route('/api/usuarios', methods=['GET'])
@login_requerido
@solo_admin
def api_usuarios():
    usuarios = obtener_usuarios()
    return jsonify({'usuarios': usuarios})

@auth_bp.route('/api/crear_usuario', methods=['POST'])
@login_requerido
@solo_admin
def api_crear_usuario():
    try:
        data     = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        nombre   = data.get('nombre', '').strip()
        rol      = data.get('rol', 'empleado')

        if not username or not password or not nombre:
            return jsonify({"status": "error", "message": "Todos los campos son obligatorios"}), 400

        exito, mensaje = crear_usuario(username, password, nombre, rol)
        if exito:
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "error", "message": mensaje}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

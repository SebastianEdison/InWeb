from flask import Blueprint, render_template, request, redirect, jsonify, url_for, flash, session

from db.usuarios import (
    verificar_usuario, crear_usuario, obtener_usuarios,
    cambiar_estado_usuario, contar_admins_activos, resetear_password_admin,
)
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

@auth_bp.route('/api/desactivar_usuario', methods=['POST'])
@login_requerido
@solo_admin
def api_desactivar_usuario():
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')

        if not usuario_id:
            return jsonify({"status": "error", "message": "ID inválido"}), 400

        if usuario_id == session['usuario_id']:
            return jsonify({"status": "error", "message": "No puedes desactivar tu propia cuenta"}), 400

        objetivo = next((u for u in obtener_usuarios() if u['id'] == usuario_id), None)
        if not objetivo:
            return jsonify({"status": "error", "message": "Usuario no encontrado"}), 404

        if objetivo['rol'] == 'admin' and objetivo['activo'] and contar_admins_activos() <= 1:
            return jsonify({"status": "error", "message": "No puedes desactivar al único administrador activo"}), 400

        exito, mensaje = cambiar_estado_usuario(usuario_id, activo=False)
        return jsonify({"status": "success" if exito else "error", "message": mensaje})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@auth_bp.route('/api/reactivar_usuario', methods=['POST'])
@login_requerido
@solo_admin
def api_reactivar_usuario():
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')

        if not usuario_id:
            return jsonify({"status": "error", "message": "ID inválido"}), 400

        exito, mensaje = cambiar_estado_usuario(usuario_id, activo=True)
        return jsonify({"status": "success" if exito else "error", "message": mensaje})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@auth_bp.route('/api/resetear_password', methods=['POST'])
@login_requerido
@solo_admin
def api_resetear_password():
    try:
        data           = request.get_json()
        usuario_id     = data.get('usuario_id')
        password_nueva = data.get('password_nueva', '').strip()

        if not usuario_id or not password_nueva:
            return jsonify({"status": "error", "message": "Datos inválidos"}), 400
        if len(password_nueva) < 4:
            return jsonify({"status": "error", "message": "La contraseña debe tener al menos 4 caracteres"}), 400

        exito, mensaje = resetear_password_admin(usuario_id, password_nueva)
        if exito:
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": mensaje}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

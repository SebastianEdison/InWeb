import hashlib
from werkzeug.security import generate_password_hash, check_password_hash
from .conexion import conectar


def _es_hash_antiguo(hash_guardado):
    """Los hashes viejos son sha256 sin sal: 64 caracteres hex, sin ':' (formato de werkzeug)."""
    return hash_guardado is not None and ':' not in hash_guardado

def verificar_usuario(username, password):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, nombre, rol, password
        FROM usuarios
        WHERE username = ? AND activo = 1
    """, (username,))
    usuario = cursor.fetchone()

    if not usuario:
        conn.close()
        return None

    hash_guardado = usuario['password']

    if _es_hash_antiguo(hash_guardado):
        if hashlib.sha256(password.encode()).hexdigest() != hash_guardado:
            conn.close()
            return None
        # Login correcto con hash antiguo: se migra a uno seguro con sal, sin pedirle nada al usuario
        nuevo_hash = generate_password_hash(password)
        cursor.execute("UPDATE usuarios SET password = ? WHERE id = ?", (nuevo_hash, usuario['id']))
        conn.commit()
    else:
        if not check_password_hash(hash_guardado, password):
            conn.close()
            return None

    conn.close()
    return {'id': usuario['id'], 'username': usuario['username'], 'nombre': usuario['nombre'], 'rol': usuario['rol']}

def crear_usuario(username, password, nombre, rol='empleado'):
    conn = conectar()
    cursor = conn.cursor()
    try:
        password_hash = generate_password_hash(password)
        cursor.execute("""
            INSERT INTO usuarios (username, password, nombre, rol)
            VALUES (?, ?, ?, ?)
        """, (username, password_hash, nombre, rol))
        conn.commit()
        return True, "Usuario creado"
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

def obtener_usuarios():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, nombre, rol, activo FROM usuarios ORDER BY id")
    columnas = [c[0] for c in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

def contar_admins_activos():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM usuarios WHERE rol = 'admin' AND activo = 1")
    total = cursor.fetchone()[0]
    conn.close()
    return total

def cambiar_estado_usuario(usuario_id, activo):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET activo = ? WHERE id = ?", (1 if activo else 0, usuario_id))
    conn.commit()
    conn.close()
    return True, "Usuario " + ("reactivado" if activo else "desactivado")

def resetear_password_admin(usuario_id, password_nueva):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM usuarios WHERE id = ?", (usuario_id,))
    if not cursor.fetchone():
        conn.close()
        return False, "Usuario no encontrado"

    hash_nueva = generate_password_hash(password_nueva)
    cursor.execute("UPDATE usuarios SET password = ? WHERE id = ?", (hash_nueva, usuario_id))
    conn.commit()
    conn.close()
    return True, "Contraseña reseteada"

def cambiar_password_db(usuario_id, password_actual, password_nueva):
    conn = conectar()
    cursor = conn.cursor()

    cursor.execute("SELECT password FROM usuarios WHERE id = ?", (usuario_id,))
    fila = cursor.fetchone()
    if not fila:
        conn.close()
        return False, "Usuario no encontrado"

    hash_guardado = fila['password']
    if _es_hash_antiguo(hash_guardado):
        valido = hashlib.sha256(password_actual.encode()).hexdigest() == hash_guardado
    else:
        valido = check_password_hash(hash_guardado, password_actual)

    if not valido:
        conn.close()
        return False, "Contraseña actual incorrecta"

    hash_nueva = generate_password_hash(password_nueva)
    cursor.execute("UPDATE usuarios SET password = ? WHERE id = ?",
                   (hash_nueva, usuario_id))
    conn.commit()
    conn.close()
    return True, "Contraseña actualizada"

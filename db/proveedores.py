from .conexion import conectar


def obtener_proveedores_db():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre")
    columnas = [c[0] for c in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

def guardar_proveedor_db(datos):
    conn = conectar()
    cursor = conn.cursor()
    if datos.get('id'):
        cursor.execute("""
            UPDATE proveedores SET nombre=?, rut=?, telefono=?, email=?, notas=?
            WHERE id=?
        """, (datos['nombre'], datos.get('rut', ''), datos.get('telefono', ''),
              datos.get('email', ''), datos.get('notas', ''), datos['id']))
    else:
        cursor.execute("""
            INSERT INTO proveedores (nombre, rut, telefono, email, notas)
            VALUES (?, ?, ?, ?, ?)
        """, (datos['nombre'], datos.get('rut', ''), datos.get('telefono', ''),
              datos.get('email', ''), datos.get('notas', '')))
    conn.commit()
    conn.close()

def eliminar_proveedor_db(proveedor_id):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE proveedores SET activo = 0 WHERE id = ?", (proveedor_id,))
    conn.commit()
    conn.close()

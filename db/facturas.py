from .conexion import conectar


def guardar_factura_db(datos):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO facturas (numero_factura, proveedor, rut_proveedor, fecha, monto_total, productos, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (datos['numero_factura'], datos['proveedor'], datos['rut_proveedor'],
          datos['fecha'], datos['monto_total'], datos['productos'], datos['estado']))
    conn.commit()
    conn.close()

def obtener_facturas_db():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM facturas ORDER BY id DESC')
    columnas = [c[0] for c in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

def actualizar_estado_factura_db(factura_id, estado):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("UPDATE facturas SET estado = ? WHERE id = ?", (estado, factura_id))
    conn.commit()
    conn.close()

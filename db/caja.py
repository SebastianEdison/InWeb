from .conexion import conectar


def guardar_cierre_db(datos):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cierres (fecha, efectivo, tarjeta, otros, fiados, total, turno)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        datos['fecha'], datos['efectivo'], datos['tarjeta'],
        datos['otros'], datos['fiados'], datos['total'], 'Único'
    ))
    conn.commit()
    conn.close()

def obtener_historial_db():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM cierres ORDER BY id DESC')
    columnas = [column[0] for column in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

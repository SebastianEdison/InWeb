from datetime import datetime
from .conexion import conectar


def guardar_fiado_db(nombre, monto, detalle):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO fiados (nombre_cliente, monto_total, monto_pagado, fecha, estado, detalle)
        VALUES (?, ?, 0, ?, 'pendiente', ?)
    ''', (nombre, monto, datetime.now().strftime('%d-%m-%Y %H:%M'), detalle))
    conn.commit()
    conn.close()

def obtener_fiados_db():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM fiados ORDER BY id DESC")
    columnas = [c[0] for c in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

def saldar_fiado_db(fiado_id, monto_pago):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT monto_total, monto_pagado FROM fiados WHERE id = ?", (fiado_id,))
    fiado = cursor.fetchone()
    if not fiado:
        conn.close()
        return False, "Fiado no encontrado"

    nuevo_pagado = fiado['monto_pagado'] + monto_pago
    estado = 'pagado' if nuevo_pagado >= fiado['monto_total'] else 'parcial'

    cursor.execute("""
        UPDATE fiados SET monto_pagado = ?, estado = ? WHERE id = ?
    """, (nuevo_pagado, estado, fiado_id))
    conn.commit()
    conn.close()
    return True, estado

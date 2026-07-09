from .conexion import conectar


def obtener_config_db():
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute('SELECT clave, valor FROM configuracion')
    config = {row[0]: row[1] for row in cursor.fetchall()}
    conn.close()
    return config

def guardar_config_db(datos):
    conn = conectar()
    cursor = conn.cursor()
    for clave, valor in datos.items():
        cursor.execute("""
            INSERT OR REPLACE INTO configuracion (clave, valor)
            VALUES (?, ?)
        """, (clave, valor))
    conn.commit()
    conn.close()

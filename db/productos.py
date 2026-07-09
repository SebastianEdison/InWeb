import sqlite3
from .conexion import conectar


def agregar_producto(codigo, nombre, precio, costo, stock, unidad='Unidad', fecha_vencimiento=None, stock_minimo=0, categoria='General'):
    conexion = conectar()
    conexion.row_factory = sqlite3.Row
    cursor = conexion.cursor()

    try:
        cursor.execute("SELECT id, stock, fecha_vencimiento FROM productos WHERE codigo_barra = ?", (codigo,))
        existente = cursor.fetchone()

        if existente:
            id_producto = existente['id']
            stock_actual = existente['stock']
            nuevo_total = stock_actual + int(stock)

            # Al reponer stock puede llegar un lote con otra fecha de vencimiento. Como solo
            # guardamos una fecha por producto (no por lote), nos quedamos con la mas proxima
            # de las dos: es la que hay que vender/alertar primero, sin importar en que lote este.
            fecha_anterior = existente['fecha_vencimiento']
            if fecha_anterior and fecha_vencimiento:
                fecha_final = min(fecha_anterior, fecha_vencimiento)
            else:
                fecha_final = fecha_vencimiento or fecha_anterior

            # activo=1 por si el codigo pertenecia a un producto eliminado (soft-delete): revive en vez
            # de quedar invisible para siempre, ya que codigo_barra es UNIQUE y no se puede duplicar.
            cursor.execute("""
                UPDATE productos
                SET nombre=?, precio_venta=?, costo=?, stock=?, unidad=?, fecha_vencimiento=?, stock_minimo=?, categoria=?, activo=1
                WHERE id=?
            """, (nombre, precio, costo, nuevo_total, unidad, fecha_final, stock_minimo, categoria, id_producto))
            print(f"Producto '{nombre}' actualizado. Nuevo stock: {nuevo_total}")

        else:
            cursor.execute("""
                INSERT INTO productos (codigo_barra, nombre, precio_venta, costo, stock, unidad, fecha_vencimiento, stock_minimo, categoria)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (codigo, nombre, precio, costo, stock, unidad, fecha_vencimiento, stock_minimo, categoria))
            print(f"Nuevo producto '{nombre}' registrado")

        conexion.commit()

    except sqlite3.Error as e:
        conexion.rollback()
        print(f"Error al procesar producto: {e}")
    finally:
        conexion.close()

def obtener_productos(nombre_buscar=None, categoria=None):
    conexion = conectar()
    conexion.row_factory = sqlite3.Row
    cursor = conexion.cursor()

    try:
        condiciones = ["activo = 1"]
        params = []

        if nombre_buscar:
            condiciones.append("(nombre LIKE ? OR codigo_barra LIKE ?)")
            param = f"%{nombre_buscar}%"
            params.extend([param, param])

        if categoria:
            condiciones.append("categoria = ?")
            params.append(categoria)

        sql = "SELECT * FROM productos WHERE " + " AND ".join(condiciones)

        cursor.execute(sql, params)
        resultados = cursor.fetchall()
        return resultados

    except sqlite3.Error as e:
        print(f"Error en la consulta: {e}")
        return []

    finally:
        if conexion:
            conexion.close()

def obtener_producto_por_id(id_p):
    conexion = conectar()
    cursor = conexion.cursor()
    cursor.execute("SELECT * FROM productos WHERE id = ?", (id_p,))
    producto = cursor.fetchone()
    conexion.close()
    return producto

def buscar_producto_por_codigo(codigo):
    conexion = None
    try:
        conexion = conectar()
        print("Base de datos conectada")
        cursor = conexion.cursor()
        #se ejecuta la consulta
        cursor.execute(
            "SELECT * FROM productos WHERE codigo_barra = ?",
            (codigo,)
        )
        #fetchone() devuelve una tupla si existe, o None si no existe
        producto = cursor.fetchone()

        return producto
    except sqlite3.Error as e:
        print(f"Error al buscar el producto: {e}")
        return None # Devolvemos None para indicar que hubo un fallo

    finally:
        if conexion:
            conexion.close()

def modificar_stock(producto_id, cantidad_cambio, motivo=None):
    conexion = None
    try:
        conexion = conectar()
        cursor = conexion.cursor()

        # verificamos stock actual y nombre
        cursor.execute("SELECT stock, nombre FROM productos WHERE id = ?", (producto_id,))
        resultado = cursor.fetchone()

        if not resultado:
            return False, "Producto no existe"

        stock_actual = resultado[0]
        nombre_prod = resultado[1]
        nuevo_stock = stock_actual + cantidad_cambio

        if nuevo_stock < 0:
            return False, f"Error: Solo hay {stock_actual} unidades de {nombre_prod}."

        cursor.execute("UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id))

        tipo_mov = "ENTRADA" if cantidad_cambio > 0 else "VENTA"
        cursor.execute("""
            INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo)
            VALUES (?, ?, ?, ?)
        """, (producto_id, tipo_mov, abs(cantidad_cambio), motivo))

        conexion.commit()
        print(f"Stock de {nombre_prod} actualizado: {nuevo_stock} unidades.")
        return True, "Éxito"

    except sqlite3.Error as e:
        if conexion: conexion.rollback()
        return False, f"Error DB: {e}"
    finally:
        if conexion: conexion.close()

def actualizar_producto(id_p, nombre, precio, costo, stock, unidad='Unidad', fecha_vencimiento=None, stock_minimo=0, categoria='General'):
    conexion = conectar()
    cursor = conexion.cursor()
    try:
        cursor.execute("""
            UPDATE productos
            SET nombre=?, precio_venta=?, costo=?, stock=?, unidad=?, fecha_vencimiento=?, stock_minimo=?, categoria=?
            WHERE id=?
        """, (nombre, precio, costo, stock, unidad, fecha_vencimiento, stock_minimo, categoria, id_p))
        conexion.commit()
        return True
    except sqlite3.Error as e:
        print(f"Error al actualizar: {e}")
        return False
    finally:
        conexion.close()

def eliminar_producto(id_recibido):
    # Soft-delete: si el producto tiene ventas o movimientos de stock en su historial,
    # borrarlo de verdad dejaria esos registros huerfanos y desaparecerian de reportes pasados.
    conexion = conectar()
    cursor = conexion.cursor()

    cursor.execute("UPDATE productos SET activo = 0 WHERE id = ?", (id_recibido,))

    conexion.commit()
    conexion.close()

def obtener_productos_muertos_db(dias=60):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT p.id, p.nombre, p.codigo_barra, p.stock,
               MAX(m.fecha) as ultima_venta
        FROM productos p
        LEFT JOIN movimientos_stock m
            ON p.id = m.producto_id AND m.tipo = 'VENTA'
        WHERE p.activo = 1 AND p.stock > 0
        GROUP BY p.id
        HAVING ultima_venta IS NULL
            OR ultima_venta < datetime('now', '-{dias} days')
        ORDER BY ultima_venta ASC
    """)
    columnas = [c[0] for c in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

def obtener_productos_por_vencer(dias=7):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, nombre, codigo_barra, stock, fecha_vencimiento
        FROM productos
        WHERE fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento != ''
        AND DATE(fecha_vencimiento) <= DATE('now', '+' || ? || ' days')
        AND DATE(fecha_vencimiento) >= DATE('now')
        AND activo = 1
        ORDER BY fecha_vencimiento ASC
    """, (dias,))
    columnas = [c[0] for c in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

def obtener_historial_stock_db(limite=100):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT m.id, m.tipo, m.cantidad, m.fecha, m.motivo,
               p.nombre as producto_nombre, p.codigo_barra
        FROM movimientos_stock m
        JOIN productos p ON p.id = m.producto_id
        ORDER BY m.id DESC
        LIMIT ?
    """, (limite,))
    columnas = [c[0] for c in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados

def ajuste_manual_stock_db(producto_id, cantidad, motivo='Ajuste manual'):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT stock, nombre FROM productos WHERE id = ?", (producto_id,))
    p = cursor.fetchone()
    if not p:
        conn.close()
        return False, "Producto no encontrado"
    nuevo_stock = p['stock'] + cantidad
    if nuevo_stock < 0:
        conn.close()
        return False, f"Stock insuficiente. Stock actual: {p['stock']}"
    cursor.execute("UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id))
    tipo = 'ENTRADA' if cantidad > 0 else 'SALIDA'
    cursor.execute("INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)",
                   (producto_id, tipo, abs(cantidad), motivo))
    conn.commit()
    conn.close()
    return True, f"Stock actualizado: {nuevo_stock}"

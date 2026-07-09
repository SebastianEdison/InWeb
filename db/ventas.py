import pytz
from datetime import datetime
from .conexion import conectar


def registrar_venta(carrito, metodo_pago="Efectivo", forzar=False, descuento=0):
    conexion = None
    try:
        conexion = conectar()
        cursor = conexion.cursor()

        # 1. VALIDACIÓN: el producto debe existir siempre; el stock solo se exige si no se fuerza la venta
        for item in carrito:
            cursor.execute("SELECT stock, nombre FROM productos WHERE id = ?", (item['id'],))
            producto = cursor.fetchone()

            if not producto:
                return False, f"El producto con ID {item['id']} no existe."

            if not forzar and producto['stock'] < item['cantidad']:
                return False, f"Stock insuficiente para {producto['nombre']}. Solo quedan {producto['stock']}."

        # 2. CALCULAR TOTAL
        total_venta = sum(item['cantidad'] * item['precio'] for item in carrito)

        # 3. INSERTAR CABECERA (Ventas)
        tz_chile = pytz.timezone('America/Santiago')
        fecha_chile = datetime.now(tz_chile).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT INTO ventas (total, metodo_pago, fecha, descuento) VALUES (?, ?, ?, ?)",
                (total_venta, metodo_pago, fecha_chile, descuento))
        venta_id = cursor.lastrowid

        # 4. PROCESAR PRODUCTOS
        for item in carrito:
            subtotal = item['cantidad'] * item['precio']

            # Detalle de venta
            cursor.execute("""
                INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?)
            """, (venta_id, item['id'], item['cantidad'], item['precio'], subtotal))

            # DESCUENTO DE STOCK. No baja de 0 (hay un CHECK(stock >= 0) en la tabla):
            # con venta forzada puede venderse mas de lo que hay, pero el stock queda en 0, no negativo.
            cursor.execute("UPDATE productos SET stock = MAX(stock - ?, 0) WHERE id = ?",
                           (item['cantidad'], item['id']))

            # Registro en Kardex (Movimientos)
            cursor.execute("""
                INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo)
                VALUES (?, 'VENTA', ?, NULL)
            """, (item['id'], item['cantidad']))

        # 5. COMMIT FINAL (Solo se guarda si nada falló arriba)
        conexion.commit()
        print(f"Venta #{venta_id} registrada con exito (${total_venta})")
        return True, venta_id

    except Exception as e:
        if conexion:
            conexion.rollback() # Si hay error de sistema, deshace todo
        print(f"Error al registrar la venta: {e}")
        return False, str(e)

    finally:
        if conexion:
            conexion.close()

def anular_venta_db(venta_id):
    conn = conectar()
    cursor = conn.cursor()
    cursor.execute("SELECT anulada FROM ventas WHERE id = ?", (venta_id,))
    v = cursor.fetchone()
    if not v or v['anulada']:
        conn.close()
        return False, "Venta no encontrada o ya anulada"
    cursor.execute("SELECT producto_id, cantidad FROM detalle_venta WHERE venta_id = ?", (venta_id,))
    items = cursor.fetchall()
    for item in items:
        cursor.execute("UPDATE productos SET stock = stock + ? WHERE id = ?", (item['cantidad'], item['producto_id']))
        cursor.execute("INSERT INTO movimientos_stock (producto_id, tipo, cantidad, motivo) VALUES (?, 'ANULACION', ?, 'Anulación venta #' || ?)",
                       (item['producto_id'], item['cantidad'], venta_id))
    cursor.execute("UPDATE ventas SET anulada = 1 WHERE id = ?", (venta_id,))
    conn.commit()
    conn.close()
    return True, "Venta anulada"

def obtener_ventas_por_dia(fecha=None):
    conn = conectar()
    cursor = conn.cursor()

    # Los totales no cuentan ventas anuladas (no es plata que realmente entro), pero el dia
    # sigue apareciendo aunque todas sus ventas se hayan anulado, y la lista de mas abajo
    # las incluye igual para que se vean tachadas en pantalla.
    sql_dias = """
        SELECT
            DATE(fecha) as dia,
            SUM(CASE WHEN anulada = 0 THEN 1 ELSE 0 END) as total_ventas,
            SUM(CASE WHEN anulada = 0 THEN total ELSE 0 END) as total_dia,
            SUM(CASE WHEN anulada = 0 AND metodo_pago = 'efectivo' THEN total ELSE 0 END) as efectivo,
            SUM(CASE WHEN anulada = 0 AND metodo_pago = 'tarjeta' THEN total ELSE 0 END) as tarjeta,
            SUM(CASE WHEN anulada = 0 AND metodo_pago = 'otros' THEN total ELSE 0 END) as otros
        FROM ventas
    """
    if fecha:
        cursor.execute(sql_dias + " WHERE DATE(fecha) = ? GROUP BY DATE(fecha) ORDER BY dia DESC", (fecha,))
    else:
        cursor.execute(sql_dias + " GROUP BY DATE(fecha) ORDER BY dia DESC")

    dias = [dict(row) for row in cursor.fetchall()]

    # Para cada día, traer el detalle de cada venta
    for dia in dias:
        cursor.execute("""
            SELECT v.id, v.fecha, v.total, v.metodo_pago, v.descuento, v.anulada
            FROM ventas v
            WHERE DATE(v.fecha) = ?
            ORDER BY v.fecha DESC
        """, (dia['dia'],))
        ventas = [dict(row) for row in cursor.fetchall()]

        # Para cada venta, traer sus productos
        for venta in ventas:
            cursor.execute("""
                SELECT p.nombre, dv.cantidad, dv.precio_unitario, dv.subtotal
                FROM detalle_venta dv
                JOIN productos p ON p.id = dv.producto_id
                WHERE dv.venta_id = ?
            """, (venta['id'],))
            venta['productos'] = [dict(row) for row in cursor.fetchall()]

        dia['ventas'] = ventas

    conn.close()
    return dias

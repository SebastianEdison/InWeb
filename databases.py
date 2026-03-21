import sqlite3

def conectar():
    conexion =sqlite3.connect("inventario.db")
    conexion.row_factory =sqlite3.Row
    #print("Base de datos conectada")
    return conexion

def crear_tablas():

    conexion = conectar()
    print("Base de datos conectada")
    cursor = conexion.cursor()
    print("Cursor creado")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    codigo_barra TEXT UNIQUE,
                    nombre TEXT NOT NULL,
                    precio_venta REAL NOT NULL,
                    costo REAL,
                    stock INTEGER DEFAULT 0 CHECK(stock >= 0) ,
                    activo INTEGER DEFAULT 1,
                    unidad TEXT DEFAULT 'Unidad'
                    );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ventas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                    total REAL NOT NULL,
                    metodo_pago TEXT
                    );   
    """)

    cursor.execute("""                                
        CREATE TABLE IF NOT EXISTS detalle_venta(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id INTEGER NOT NULL,
                producto_id INTEGER NOT NULL,
                cantidad INTEGER NOT NULL,
                precio_unitario REAL NOT NULL,
                subtotal REAL NOT NULL,
                FOREIGN KEY (venta_id)REFERENCES ventas(id),
                FOREIGN KEY (producto_id) REFERENCES productos(id)
                );
    """)
                
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS movimientos_stock(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                producto_id INTEGER,
                tipo TEXT,
                cantidad INTEGER,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (producto_id) REFERENCES productos(id)
                );
    """)
    # NUEVA TABLA DE CIERRES
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cierres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT,
            efectivo INTEGER,
            tarjeta INTEGER,
            otros INTEGER,
            fiados INTEGER,
            total INTEGER,
            turno TEXT
        )
    ''')

    conexion.commit()
    conexion.close()

def agregar_producto(codigo, nombre, precio, costo, stock, unidad='Unidad'):
    conexion = conectar()
    # Usamos Row para poder acceder por nombre de columna como hiciste en tu código
    conexion.row_factory = sqlite3.Row 
    cursor = conexion.cursor()
    
    try:
        # 1. Verificamos si existe
        cursor.execute("SELECT id, stock FROM productos WHERE codigo_barra = ?", (codigo,))
        existente = cursor.fetchone()

        if existente:
            # 2. SI EXISTE: Actualizamos datos y sumamos stock
            id_producto = existente['id']
            stock_actual = existente['stock']
            nuevo_total = stock_actual + int(stock)
            
            cursor.execute("""
                UPDATE productos 
                SET nombre = ?, precio_venta = ?, costo = ?, stock = ?, unidad = ?
                WHERE id = ?
            """, (nombre, precio, costo, nuevo_total, unidad, id_producto))
            print(f"✅ Producto '{nombre}' actualizado ({unidad}). Nuevo stock: {nuevo_total}")
            
        else:
            # 3. SI NO EXISTE: Insertamos con la nueva columna 'unidad'
            cursor.execute("""
                INSERT INTO productos (codigo_barra, nombre, precio_venta, costo, stock, unidad)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (codigo, nombre, precio, costo, stock, unidad))
            print(f"✨ Nuevo producto '{nombre}' registrado como {unidad}")

        conexion.commit()

    except sqlite3.Error as e:
        conexion.rollback()
        print(f"❌ Error al procesar producto: {e}")
    finally:
        conexion.close()
            
def obtener_productos(nombre_buscar=None):
    conexion = conectar()
    conexion.row_factory =sqlite3.Row
    cursor = conexion.cursor()

    try:
        if nombre_buscar:
            param =f"%{nombre_buscar}%"
            #Buscamos por nombre o por codigo de baara con LIKE            
            sql= "SELECT * FROM productos WHERE (nombre LIKE ? or codigo_barra LIKE ?)"            
            cursor.execute(sql,(param, param))
        
        else:
            sql ="SELECT * FROM productos"
            cursor.execute(sql)
        
        resultados = cursor.fetchall()
        return resultados
    
    except sqlite3.Error as e:
        print(f"Error en la consulta: {e}")
        return[]
    
    finally:
        if conexion:
            conexion.close()

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

def modificar_stock(producto_id, cantidad_cambio):
    conexion = None
    try:
        conexion = conectar()
        cursor = conexion.cursor()

        # 1. Verificamos stock actual y nombre
        cursor.execute("SELECT stock, nombre FROM productos WHERE id = ?", (producto_id,))
        resultado = cursor.fetchone()
        
        if not resultado:
            return False, "Producto no existe"

        stock_actual = resultado[0]
        nombre_prod = resultado[1]
        nuevo_stock = stock_actual + cantidad_cambio

        # 2. Protección: No permitir stock negativo
        if nuevo_stock < 0:
            return False, f"Error: Solo hay {stock_actual} unidades de {nombre_prod}."

        # 3. Actualizamos la tabla de productos
        cursor.execute("UPDATE productos SET stock = ? WHERE id = ?", (nuevo_stock, producto_id))
        
        # 4. Registramos el movimiento en la tabla movimientos_stock (Kardex)
        tipo_mov = "ENTRADA" if cantidad_cambio > 0 else "VENTA"
        cursor.execute("""
            INSERT INTO movimientos_stock (producto_id, tipo, cantidad)
            VALUES (?, ?, ?)
        """, (producto_id, tipo_mov, abs(cantidad_cambio)))

        conexion.commit()
        print(f"Stock de {nombre_prod} actualizado: {nuevo_stock} unidades.")
        return True, "Éxito"
        
    except sqlite3.Error as e:
        if conexion: conexion.rollback()
        return False, f"Error DB: {e}"
    finally:
        if conexion: conexion.close()

def registrar_venta(carrito, metodo_pago="Efectivo"):
    conexion = None
    try:
        conexion = conectar()
        cursor = conexion.cursor()

        # 1. VALIDACIÓN: Revisar si hay stock para TODO el carrito antes de empezar
        for item in carrito:
            cursor.execute("SELECT stock, nombre FROM productos WHERE id = ?", (item['id'],))
            producto = cursor.fetchone()
            
            if not producto:
                return False, f"El producto con ID {item['id']} no existe."
            
            # Si lo que quiere vender es mayor a lo que hay, cancelamos
            if producto['stock'] < item['cantidad']:
                return False, f"Stock insuficiente para {producto['nombre']}. Solo quedan {producto['stock']}."

        # 2. CALCULAR TOTAL
        total_venta = sum(item['cantidad'] * item['precio'] for item in carrito)

        # 3. INSERTAR CABECERA (Ventas)
        cursor.execute("INSERT INTO ventas (total, metodo_pago) VALUES (?, ?)", 
                       (total_venta, metodo_pago))
        venta_id = cursor.lastrowid 

        # 4. PROCESAR PRODUCTOS
        for item in carrito:
            subtotal = item['cantidad'] * item['precio']

            # Detalle de venta
            cursor.execute("""
                INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?)
            """, (venta_id, item['id'], item['cantidad'], item['precio'], subtotal))

            # DESCUENTO DE STOCK (Aquí es donde se hacía el negativo antes)
            cursor.execute("UPDATE productos SET stock = stock - ? WHERE id = ?",
                           (item['cantidad'], item['id']))
            
            # Registro en Kardex (Movimientos)
            cursor.execute("""
                INSERT INTO movimientos_stock (producto_id, tipo, cantidad)
                VALUES (?, 'VENTA', ?)
            """, (item['id'], item['cantidad']))

        # 5. COMMIT FINAL (Solo se guarda si nada falló arriba)
        conexion.commit()
        print(f"✅ Venta #{venta_id} registrada con éxito (${total_venta})")
        return True, venta_id

    except Exception as e:
        if conexion:
            conexion.rollback() # Si hay error de sistema, deshace todo
        print(f"❌ Error al registrar la venta: {e}")
        return False, str(e)
        
    finally: 
        if conexion:
            conexion.close()

def probar_sistema():
    print("--- INICIANDO PRUEBAS DEL SISTEMA ---")
    crear_tablas()

    # 1. Agregar productos (solo si no existen)
    print("\n[1] Preparando productos...")
    agregar_producto('780001', 'Leche entera 1L', 1500, 1000, 50)
    agregar_producto('780002', 'Pan de molde', 2200, 1500, 20)

    # 2. Buscar un producto para obtener su ID real
    prod = buscar_producto_por_codigo('780001')
    prod2 = buscar_producto_por_codigo('780002')

    if prod and prod2:
        # 3. Probar la nueva función de MODIFICAR STOCK (Reposición)
        print(f"\n[2] Reponiendo 10 unidades de {prod[2]}...")
        modificar_stock(prod[0], 10) # Suma 10

        # 4. Probar la REGISTRAR VENTA (Carrito)
        print("\n[3] Simulando una venta de carrito...")
        mi_carrito = [
            {'id': prod[0], 'cantidad': 2, 'precio': prod[3]},  # 2 Leches
            {'id': prod2[0], 'cantidad': 1, 'precio': prod2[3]} # 1 Pan
        ]
        
        # Probamos venta con Tarjeta (para ver que guarde el método)
        exito, venta_id = registrar_venta(mi_carrito, "Tarjeta")

        if exito:
            print(f"¡Venta #{venta_id} completada!")
            # Verificar stock final de la leche
            final = buscar_producto_por_codigo('780001')
            print(f"Stock final de {final[2]}: {final[5]} (Empezó en 50, +10 reposición, -2 venta = 58)")

    print("\n --- PRUEBAS FINALIZADAS ---")

def actualizar_producto(id_p, nombre, precio, costo, stock):
    conexion = conectar()
    cursor = conexion.cursor()
    try:
        cursor.execute("""
            UPDATE productos 
            SET nombre = ?, precio_venta = ?, costo = ?, stock = ?
            WHERE id = ?
        """, (nombre, precio, costo, stock, id_p))
        conexion.commit()
        return True
    except sqlite3.Error as e:
        print(f"Error al actualizar: {e}")
        return False
    finally:
        conexion.close()

def eliminar_producto(id_recibido):
    # Usa TU función de conexión (ejemplo: conectar_db o get_db)
    conexion = conectar() 
    cursor = conexion.cursor()
    
    # IMPORTANTE: Usa el nombre de tu tabla y de tu columna ID
    # Si tu tabla se llama 'mercaderia', cámbialo aquí
    cursor.execute("DELETE FROM productos WHERE id = ?", (id_recibido,))
    
    conexion.commit()
    conexion.close()

# Añade estas funciones al final del archivo para manejar los datos
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
    # Convertimos a lista de diccionarios para que Flask lo lea fácil
    columnas = [column[0] for column in cursor.description]
    resultados = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    conn.close()
    return resultados
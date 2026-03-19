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
                    activo INTEGER DEFAULT 1
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

    conexion.commit()
    conexion.close()

def agregar_producto(codigo, nombre, precio, costo, stock):
    conexion = conectar()
    cursor = conexion.cursor()
    
    try:
        # 1. Primero verificamos si el producto ya existe por su código de barras
        cursor.execute("SELECT id, stock FROM productos WHERE codigo_barra = ?", (codigo,))
        existente = cursor.fetchone()

        if existente:
            # 2. SI EXISTE: Calculamos el nuevo stock sumando el actual + el nuevo
            id_producto = existente['id']
            stock_actual = existente['stock']
            nuevo_total = stock_actual + int(stock)
            
            # Actualizamos los datos y sumamos el stock
            cursor.execute("""
                UPDATE productos 
                SET nombre = ?, precio_venta = ?, costo = ?, stock = ?
                WHERE id = ?
            """, (nombre, precio, costo, nuevo_total, id_producto))
            print(f"✅ Producto '{nombre}' actualizado. Nuevo stock: {nuevo_total}")
            
        else:
            # 3. SI NO EXISTE: Insertamos el registro nuevo normalmente
            cursor.execute("""
                INSERT INTO productos (codigo_barra, nombre, precio_venta, costo, stock)
                VALUES (?, ?, ?, ?, ?)
            """, (codigo, nombre, precio, costo, stock))
            print(f"✨ Nuevo producto '{nombre}' registrado con éxito")

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
            sql= "SELECT * FROM productos WHERE (nombre LIKE ? or codigo_barra LIKE ?) AND activo =1"            
            cursor.execute(sql,(param, param))
        
        else:
            sql ="SELECT * FROM productos WHERE activo = 1"
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
# Formato: (codigo, nombre, precio_venta, costo_compra, stock)
#agregar_producto('1123459', 'helado', 250, 85, 30)    
#agregar_producto('1123460', 'Cafe', 4500,3800, 24) 
#agregar_producto('1123461', 'mantequilla', 2250, 1800, 20) 
#agregar_producto('1123462', 'yogurt', 400, 270, 12) 
#agregar_producto('1123463', 'Pilas AAA', 800, 650, 12) 
#agregar_producto('1123464', 'Bebida', 1850, 1700, 40) 
#agregar_producto('1123465', 'galletas', 1400, 1100, 2)     
#-----------------------------------------------------------------
# Simulamos que escaneamos dos productos
#mi_carrito = [
#    {'id': 1, 'cantidad': 2, 'precio': 1200}, # 2 Leches
    #{'id': 2, 'cantidad': 1, 'precio': 2200}  # 1 Pan
#]

# Probar venta en Efectivo (por defecto)
#registrar_venta(mi_carrito)

# Probar venta con Tarjeta
#registrar_venta(mi_carrito, "Tarjeta")

# Probar venta con Billetera Digital (Mercado Pago)
#registrar_venta(mi_carrito, "Billetera Digital")


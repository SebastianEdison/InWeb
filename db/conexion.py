import sqlite3
import sys
import os
from werkzeug.security import generate_password_hash


def get_app_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    # sube un nivel: este archivo vive en db/, los datos persistentes van en la raiz del proyecto
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def conectar():
    db_path = os.path.join(get_app_dir(), 'inventario.db')
    conexion = sqlite3.connect(db_path)
    conexion.row_factory = sqlite3.Row
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
                    fecha DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', '-3 hours')),
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
                fecha DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', '-3 hours')),
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
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nombre TEXT NOT NULL,
        rol TEXT DEFAULT 'empleado',
        activo INTEGER DEFAULT 1
    )
    ''')
    # Usuario admin por defecto (solo si no existe)
    cursor.execute("SELECT id FROM usuarios WHERE username = 'admin'")
    if not cursor.fetchone():
            password_hash = generate_password_hash('admin123')
            cursor.execute("""
            INSERT INTO usuarios (username, password, nombre, rol)
                VALUES ('admin', ?, 'Administrador', 'admin')
            """, (password_hash,))
            print("Usuario admin creado: admin / admin123")

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS fiados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre_cliente TEXT NOT NULL,
        monto_total REAL NOT NULL,
        monto_pagado REAL DEFAULT 0,
        fecha TEXT NOT NULL,
        estado TEXT DEFAULT 'pendiente',
        detalle TEXT
    )
    ''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS facturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_factura TEXT NOT NULL,
        proveedor TEXT NOT NULL,
        rut_proveedor TEXT,
        fecha TEXT NOT NULL,
        monto_total REAL NOT NULL,
        productos TEXT,
        estado TEXT DEFAULT 'pendiente'
    )
''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS configuracion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT UNIQUE NOT NULL,
            valor TEXT
        )
    ''')

    # Configuración por defecto
    configs = [
        ('nombre_negocio', 'EL HISTORICO'),
        ('rut_negocio', ''),
        ('telefono_negocio', ''),
        ('aplica_iva', '1'),
    ]
    for clave, valor in configs:
        cursor.execute("""
            INSERT OR IGNORE INTO configuracion (clave, valor)
            VALUES (?, ?)
        """, (clave, valor))
    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN fecha_vencimiento TEXT DEFAULT NULL")
    except:
        pass

    # Feature 1: stock mínimo por producto
    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN stock_minimo INTEGER DEFAULT 0")
    except:
        pass

    # Feature 2: categoría de producto
    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN categoria TEXT DEFAULT 'General'")
    except:
        pass

    # Feature 3: descuento en ventas
    try:
        cursor.execute("ALTER TABLE ventas ADD COLUMN descuento REAL DEFAULT 0")
    except:
        pass

    # Feature 5: anulación de ventas
    try:
        cursor.execute("ALTER TABLE ventas ADD COLUMN anulada INTEGER DEFAULT 0")
    except:
        pass

    # Feature 6: motivo en movimientos de stock
    try:
        cursor.execute("ALTER TABLE movimientos_stock ADD COLUMN motivo TEXT")
    except:
        pass

    # Feature 7: tabla de proveedores
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            rut TEXT,
            telefono TEXT,
            email TEXT,
            notas TEXT,
            activo INTEGER DEFAULT 1
        )
    ''')

    # Feature 9: accesos rapidos en Ventas (favoritos marcados a mano)
    try:
        cursor.execute("ALTER TABLE productos ADD COLUMN favorito INTEGER DEFAULT 0")
    except:
        pass

    conexion.commit()
    conexion.close()

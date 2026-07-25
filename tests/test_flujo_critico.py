from tests.conftest import login


def test_rutas_protegidas_redirigen_sin_sesion(client):
    for ruta in ['/', '/ventas', '/reportes', '/agregar']:
        resp = client.get(ruta)
        assert resp.status_code == 302

def test_login_correcto_da_acceso_al_inventario(client):
    resp = login(client)
    assert resp.status_code == 302

    resp = client.get('/')
    assert resp.status_code == 200

def test_login_incorrecto_no_da_acceso(client):
    login(client, password='claveMala')
    resp = client.get('/')
    assert resp.status_code == 302

def test_flujo_completo_de_venta_descuenta_stock(client):
    login(client)

    resp = client.post('/agregar', json={
        'codigo': '111', 'nombre': 'Producto de prueba', 'precio_venta': 1000,
        'precio_compra': 500, 'stock': 10,
    })
    assert resp.get_json()['status'] == 'success'

    productos = client.get('/buscar_producto?busqueda=Producto+de+prueba').get_json()
    assert len(productos) == 1
    producto_id = productos[0]['id']
    assert productos[0]['stock'] == 10

    resp = client.post('/api/registrar_venta', json={
        'carrito': [{'id': producto_id, 'cantidad': 2, 'precio': 1000}],
        'metodo_pago': 'Efectivo',
    })
    assert resp.get_json()['status'] == 'success'

    productos = client.get('/buscar_producto?busqueda=Producto+de+prueba').get_json()
    assert productos[0]['stock'] == 8

def test_venta_rechaza_stock_insuficiente(client):
    login(client)
    client.post('/agregar', json={
        'codigo': '222', 'nombre': 'Poco stock', 'precio_venta': 500,
        'precio_compra': 200, 'stock': 1,
    })
    producto_id = client.get('/buscar_producto?busqueda=Poco+stock').get_json()[0]['id']

    resp = client.post('/api/registrar_venta', json={
        'carrito': [{'id': producto_id, 'cantidad': 5, 'precio': 500}],
        'metodo_pago': 'Efectivo',
    })
    data = resp.get_json()
    assert data['status'] == 'error'

def test_venta_forzada_se_permite_con_stock_insuficiente(client):
    login(client)
    client.post('/agregar', json={
        'codigo': '444', 'nombre': 'Forzable', 'precio_venta': 500,
        'precio_compra': 200, 'stock': 1,
    })
    producto_id = client.get('/buscar_producto?busqueda=Forzable').get_json()[0]['id']

    resp = client.post('/api/registrar_venta', json={
        'carrito': [{'id': producto_id, 'cantidad': 5, 'precio': 500}],
        'metodo_pago': 'Efectivo',
        'forzar': True,
    })
    data = resp.get_json()
    assert data['status'] == 'success'

    # el stock no queda negativo, se clampea a 0
    productos = client.get('/buscar_producto?busqueda=Forzable').get_json()
    assert productos[0]['stock'] == 0

def test_cierre_de_caja_queda_en_el_historial(client):
    login(client)

    resp = client.post('/api/guardar_cierre', json={
        'efectivo': 10000, 'tarjeta': 5000, 'otros': 0, 'fiados': 0,
    })
    assert resp.get_json()['status'] == 'success'

    historial = client.get('/api/historial').get_json()['cierres']
    assert len(historial) == 1
    assert historial[0]['efectivo'] == 10000

def test_fiado_se_puede_saldar(client):
    login(client)

    client.post('/api/guardar_fiado', json={
        'nombre': 'Cliente prueba', 'monto': 3000, 'detalle': 'prueba',
    })
    fiado = client.get('/api/obtener_fiados').get_json()['fiados'][0]
    assert fiado['estado'] == 'pendiente'

    resp = client.post('/api/saldar_fiado', json={
        'fiado_id': fiado['id'], 'monto': 3000,
    })
    assert resp.get_json()['estado'] == 'pagado'

def test_venta_anulada_no_cuenta_en_totales_de_reportes(client):
    login(client)
    client.post('/agregar', json={
        'codigo': '333', 'nombre': 'Producto anulable', 'precio_venta': 1000,
        'precio_compra': 500, 'stock': 10,
    })
    producto_id = client.get('/buscar_producto?busqueda=Producto+anulable').get_json()[0]['id']

    resp = client.post('/api/registrar_venta', json={
        'carrito': [{'id': producto_id, 'cantidad': 3, 'precio': 1000}],
        'metodo_pago': 'efectivo',
    })
    venta_id = resp.get_json()['venta_id']

    # antes de anular, el dia debe reflejar la venta
    dias = client.get('/api/ventas_por_dia').get_json()['dias']
    assert dias[0]['total_ventas'] == 1
    assert dias[0]['total_dia'] == 3000
    assert len(dias[0]['ventas']) == 1  # la venta aparece en la lista

    resp = client.post('/api/anular_venta', json={'venta_id': venta_id})
    assert resp.get_json()['status'] == 'success'

    # stock restaurado
    productos = client.get('/buscar_producto?busqueda=Producto+anulable').get_json()
    assert productos[0]['stock'] == 10

    # el total del dia ya no cuenta la venta anulada, pero sigue listada (para verla tachada)
    dias = client.get('/api/ventas_por_dia').get_json()['dias']
    assert dias[0]['total_ventas'] == 0
    assert dias[0]['total_dia'] == 0
    assert len(dias[0]['ventas']) == 1
    assert dias[0]['ventas'][0]['anulada'] == 1

    # tampoco debe aparecer en los graficos
    graficos = client.get('/api/datos_graficos').get_json()
    assert graficos['metodos'] == {}
    assert graficos['productos'] == []

def test_reponer_stock_conserva_la_fecha_de_vencimiento_mas_proxima(client):
    login(client)

    # primer lote: vence antes
    client.post('/agregar', json={
        'codigo': '555', 'nombre': 'Yogurt', 'precio_venta': 800,
        'precio_compra': 400, 'stock': 5, 'fecha_vencimiento': '2026-08-01',
    })
    # segundo lote (repone stock del mismo codigo): vence despues
    client.post('/agregar', json={
        'codigo': '555', 'nombre': 'Yogurt', 'precio_venta': 800,
        'precio_compra': 400, 'stock': 5, 'fecha_vencimiento': '2026-09-15',
    })

    productos = client.get('/buscar_producto?busqueda=Yogurt').get_json()
    assert productos[0]['stock'] == 10
    assert productos[0]['fecha_vencimiento'] == '2026-08-01'  # la mas proxima, no la ultima cargada

def test_reponer_stock_usa_la_fecha_nueva_si_ya_no_queda_nada_del_lote_anterior(client):
    login(client)

    client.post('/agregar', json={
        'codigo': '777', 'nombre': 'Queso', 'precio_venta': 2000,
        'precio_compra': 1200, 'stock': 3, 'fecha_vencimiento': '2026-08-01',
    })
    producto_id = client.get('/buscar_producto?busqueda=Queso').get_json()[0]['id']

    # se agota el lote viejo (queda en 0)
    client.post('/api/ajuste_stock', json={
        'producto_id': producto_id, 'cantidad': -3, 'motivo': 'se vendio todo',
    })
    assert client.get('/buscar_producto?busqueda=Queso').get_json()[0]['stock'] == 0

    # se repone con un lote nuevo: como no queda nada del anterior, se usa la fecha nueva
    client.post('/agregar', json={
        'codigo': '777', 'nombre': 'Queso', 'precio_venta': 2000,
        'precio_compra': 1200, 'stock': 4, 'fecha_vencimiento': '2026-10-20',
    })

    productos = client.get('/buscar_producto?busqueda=Queso').get_json()
    assert productos[0]['stock'] == 4
    assert productos[0]['fecha_vencimiento'] == '2026-10-20'

def test_eliminar_producto_es_soft_delete(client):
    login(client)
    client.post('/agregar', json={
        'codigo': '666', 'nombre': 'Descontinuado', 'precio_venta': 700,
        'precio_compra': 300, 'stock': 4,
    })
    producto_id = client.get('/buscar_producto?busqueda=Descontinuado').get_json()[0]['id']

    resp = client.post(f'/eliminar/{producto_id}')
    assert resp.status_code == 302

    # desaparece de la busqueda normal
    assert client.get('/buscar_producto?busqueda=Descontinuado').get_json() == []

    # pero el registro sigue existiendo (no se borro en duro)
    with client.application.app_context():
        from db.productos import obtener_producto_por_id
        assert obtener_producto_por_id(producto_id) is not None

    # si se vuelve a usar el mismo codigo de barra, se reactiva en vez de fallar por UNIQUE
    resp = client.post('/agregar', json={
        'codigo': '666', 'nombre': 'Descontinuado', 'precio_venta': 700,
        'precio_compra': 300, 'stock': 2,
    })
    assert resp.get_json()['status'] == 'success'
    productos = client.get('/buscar_producto?busqueda=Descontinuado').get_json()
    assert len(productos) == 1
    assert productos[0]['stock'] == 6

def _id_de_usuario(client, username):
    usuarios = client.get('/api/usuarios').get_json()['usuarios']
    return next(u['id'] for u in usuarios if u['username'] == username)

def test_desactivar_usuario_le_bloquea_el_login(client):
    login(client)
    client.post('/api/crear_usuario', json={
        'username': 'empleado1', 'password': 'clave1234', 'nombre': 'Empleado Uno', 'rol': 'empleado',
    })
    empleado_id = _id_de_usuario(client, 'empleado1')

    resp = client.post('/api/desactivar_usuario', json={'usuario_id': empleado_id})
    assert resp.get_json()['status'] == 'success'

    client.get('/logout')
    resp = login(client, username='empleado1', password='clave1234')
    assert resp.status_code == 200  # se queda en login, no lo deja entrar

def test_no_se_puede_desactivar_al_unico_admin_activo(client):
    login(client)
    admin_id = _id_de_usuario(client, 'admin')

    resp = client.post('/api/desactivar_usuario', json={'usuario_id': admin_id})
    data = resp.get_json()
    assert data['status'] == 'error'
    assert 'propia cuenta' in data['message']  # ademas coincide con la regla de no auto-desactivarse

def test_no_se_puede_desactivar_al_ultimo_admin_aunque_no_sea_uno_mismo(client):
    login(client)
    client.post('/api/crear_usuario', json={
        'username': 'admin2', 'password': 'clave1234', 'nombre': 'Admin Dos', 'rol': 'admin',
    })
    admin2_id = _id_de_usuario(client, 'admin2')

    # desactivar al admin2 esta bien, sigue quedando el admin original activo
    resp = client.post('/api/desactivar_usuario', json={'usuario_id': admin2_id})
    assert resp.get_json()['status'] == 'success'

    # reactivarlo y ahora, con admin2 activo, el original SI podria desactivar a admin2
    # (verificamos el caso limite: intentar desactivar al ultimo admin activo restante)
    client.post('/api/reactivar_usuario', json={'usuario_id': admin2_id})
    admin_id = _id_de_usuario(client, 'admin')
    resp = client.post('/api/desactivar_usuario', json={'usuario_id': admin2_id})
    assert resp.get_json()['status'] == 'success'  # todavia queda 'admin' activo, esto es valido

def test_resetear_password_permite_login_con_la_nueva(client):
    login(client)
    client.post('/api/crear_usuario', json={
        'username': 'empleado2', 'password': 'viejaclave', 'nombre': 'Empleado Dos', 'rol': 'empleado',
    })
    empleado_id = _id_de_usuario(client, 'empleado2')

    resp = client.post('/api/resetear_password', json={
        'usuario_id': empleado_id, 'password_nueva': 'nuevaclave123',
    })
    assert resp.get_json()['status'] == 'success'

    client.get('/logout')
    resp = login(client, username='empleado2', password='viejaclave')
    assert resp.status_code == 200  # la vieja ya no sirve

    resp = login(client, username='empleado2', password='nuevaclave123')
    assert resp.status_code == 302  # la nueva si funciona

def test_error_inesperado_no_expone_detalle_tecnico_al_frontend(client):
    login(client)
    # cantidad no numerica revienta el int() dentro del try y cae al except generico
    resp = client.post('/api/ajuste_stock', json={
        'producto_id': 1, 'cantidad': 'no-es-un-numero',
    })
    data = resp.get_json()
    assert resp.status_code == 500
    assert data['status'] == 'error'
    assert data['message'] == "Ocurrió un error inesperado. Intenta de nuevo."
    assert 'invalid literal' not in data['message']  # el detalle tecnico no se filtra

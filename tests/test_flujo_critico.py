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

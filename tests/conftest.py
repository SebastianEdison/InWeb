import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from db import conexion
from db import reportes as db_reportes


@pytest.fixture
def client(tmp_path, monkeypatch):
    """Levanta la app contra una base de datos temporal, aislada de inventario.db."""
    monkeypatch.setattr(conexion, 'get_app_dir', lambda: str(tmp_path))
    monkeypatch.setattr(db_reportes, 'get_app_dir', lambda: str(tmp_path))
    conexion.crear_tablas()

    import app as app_module
    flask_app = app_module.create_app()
    flask_app.config['TESTING'] = True

    with flask_app.test_client() as test_client:
        yield test_client


def login(client, username='admin', password='admin123'):
    return client.post('/login', data={'username': username, 'password': password})

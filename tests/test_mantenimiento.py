import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as app_module


def test_limpiar_reportes_viejos_borra_solo_los_antiguos(tmp_path, monkeypatch):
    monkeypatch.setattr(app_module, '_BASE_DIR', str(tmp_path))

    carpeta = tmp_path / 'reportes'
    carpeta.mkdir()

    viejo = carpeta / f"cierre_{(datetime.now() - timedelta(days=200)).strftime('%Y-%m-%d_%H-%M')}.xlsx"
    reciente = carpeta / f"cierre_{(datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d_%H-%M')}.xlsx"
    otro_archivo = carpeta / "notas.txt"
    viejo.write_text('x')
    reciente.write_text('x')
    otro_archivo.write_text('x')

    app_module.limpiar_reportes_viejos()

    assert not viejo.exists()
    assert reciente.exists()
    assert otro_archivo.exists()  # no toca archivos que no son reportes de cierre

def test_limpiar_reportes_viejos_no_falla_si_no_existe_la_carpeta(tmp_path, monkeypatch):
    monkeypatch.setattr(app_module, '_BASE_DIR', str(tmp_path))
    app_module.limpiar_reportes_viejos()  # no debe lanzar excepcion

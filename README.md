# El Histórico — Sistema de Inventario y Ventas

App local de escritorio para gestionar inventario, ventas, caja, fiados, proveedores y reportes de un almacén pequeño. Corre en el navegador pero no necesita internet: la base de datos es un archivo SQLite local (`inventario.db`).

## Estructura del proyecto

```
app.py              -> create_app() (fábrica de la app Flask) + arranque
db/                    -> acceso a datos, un archivo por dominio (productos, ventas, caja, ...)
routes/                 -> rutas Flask (Blueprints), un archivo por dominio
utils/decorators.py      -> login_requerido, solo_admin
templates/                -> vistas (Jinja2)
static/                    -> CSS y JS
tests/                      -> pruebas automatizadas (pytest)
```

## Requisitos

- Python 3.12+ (probado con 3.12.9)
- Windows (para generar el `.exe`; el modo desarrollo corre en cualquier SO)

## Instalación (modo desarrollo)

```
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

## Correr en desarrollo

```
venv\Scripts\python app.py
```

Abre el navegador solo en `http://127.0.0.1:5000`. La primera vez crea `inventario.db` y un usuario admin (`admin` / `admin123` — cámbiala desde Reportes → Configuración apenas entres). También genera `secret.key` (clave de sesión) — no se sube a git, es de esta instalación.

## Correr los tests

```
venv\Scripts\pytest tests/ -v
```

Los tests usan una base de datos temporal aislada, no tocan `inventario.db`.

## Generar el .exe

```
build.bat
```

Genera `dist\ElHistorico\ElHistorico.exe`. Para instalar en otro equipo (por ejemplo el de producción), copia toda la carpeta `dist\ElHistorico\` — el `.exe` necesita los archivos que lo acompañan ahí.

## Datos y respaldos

Todo lo que la app crea en tiempo de ejecución queda junto al `.exe` (o junto a `app.py` en desarrollo), y ninguno se sube a git:

- `inventario.db` — la base de datos.
- `secret.key` — clave de sesión, generada sola.
- `backups/` — copia automática diaria de `inventario.db` (se conservan las últimas 7).
- `reportes/` — Excel de cada cierre de caja.

También se puede descargar un respaldo manual de `inventario.db` desde Reportes → Configuración → Respaldo (requiere rol admin).

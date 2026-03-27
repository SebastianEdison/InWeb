# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('templates', 'templates'),
        ('static',    'static'),
    ],
    hiddenimports=[
        'flask',
        'jinja2',
        'jinja2.ext',
        'werkzeug',
        'werkzeug.serving',
        'werkzeug.routing',
        'click',
        'itsdangerous',
        'openpyxl',
        'openpyxl.cell',
        'openpyxl.cell._writer',
        'openpyxl.styles',
        'openpyxl.utils',
        'openpyxl.writer.excel',
        'openpyxl.reader.excel',
        'pytz',
        'hashlib',
        'sqlite3',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'unittest', 'test', 'xmlrpc'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ElHistorico',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ElHistorico',
)

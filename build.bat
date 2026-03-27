@echo off
chcp 65001 >nul
echo ================================================
echo   Construyendo El Historico...
echo ================================================
echo.

pip install pyinstaller --quiet

echo Compilando...
pyinstaller inventario.spec --clean --noconfirm

echo.
if exist "dist\ElHistorico\ElHistorico.exe" (
    echo ================================================
    echo   LISTO! Ejecutable generado en:
    echo   dist\ElHistorico\ElHistorico.exe
    echo.
    echo   Copia toda la carpeta dist\ElHistorico\
    echo   a cualquier PC con Windows y ejecuta
    echo   ElHistorico.exe
    echo ================================================
) else (
    echo ERROR: No se pudo generar el ejecutable.
    echo Revisa los mensajes de error arriba.
)
echo.
pause

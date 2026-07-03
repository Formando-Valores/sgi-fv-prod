@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Fala para Texto ===
echo.
echo [1] Janela flutuante (overlay) - RECOMENDADO
echo [2] Aplicativo Python (janela normal)
echo [3] Servidor local HTML (abre no navegador)
echo [4] Iniciar overlay com Windows (instalar)
echo [5] Remover inicializacao com Windows
echo.
choice /c 12345 /n /m "Escolha: "
if errorlevel 5 goto remover_startup
if errorlevel 4 goto instalar_startup
if errorlevel 3 goto server
if errorlevel 2 goto python
if errorlevel 1 goto overlay

:overlay
echo.
echo Instalando dependencias...
pip install -r requirements.txt
echo Iniciando overlay...
python overlay.py
pause
exit /b

:python
echo.
echo Instalando dependencias...
pip install -r requirements.txt
echo Iniciando aplicativo Python...
python app.py
pause
exit /b

:server
echo Iniciando servidor local...
python server.py
pause
exit /b

:instalar_startup
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0instalar_iniciar_com_windows.ps1"
pause
exit /b

:remover_startup
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0remover_iniciar_com_windows.ps1"
pause
exit /b

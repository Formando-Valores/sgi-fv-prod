@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "instalar_iniciar_com_windows.ps1"
echo Ja pode fechar esta janela.
timeout /t 5 >nul

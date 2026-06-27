@echo off
title TaskFlow - Gerenciador de Tarefas
cd /d "D:\Projetos IA\OpenCode\tasks"

:: Verifica se Flask esta instalado
python -c "import flask" 2>nul
if %errorlevel% neq 0 (
    echo Instalando Flask...
    pip install flask
)

echo Iniciando TaskFlow em http://localhost:5000
start "" http://localhost:5000
python app.py

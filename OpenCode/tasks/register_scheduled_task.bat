@echo off
title TaskFlow - Registro de Inicializacao Automatica
schtasks /create /sc onstart /delay 0000:15 /tn "TaskFlow" /tr "D:\Projetos IA\OpenCode\tasks\start_tasks.bat" /ru %USERNAME% /rl limited /f
if %errorlevel% equ 0 (
    echo Tarefa agendada criada com sucesso!
    echo O TaskFlow iniciara automaticamente ao ligar o computador.
    echo (com 15 segundos de atraso para aguardar o sistema)
) else (
    echo Falha ao criar tarefa agendada.
    echo Tente executar este script como Administrador.
)
pause

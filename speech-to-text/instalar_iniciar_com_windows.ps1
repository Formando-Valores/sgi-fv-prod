$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonw = (Get-Command pythonw.exe).Source
if (-not $pythonw) { $pythonw = "pythonw.exe" }
$target = "$pythonw"
$args = """$scriptDir\overlay.py"""
$workingDir = "$scriptDir"
$shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\FalaParaTexto.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.Arguments = $args
$shortcut.WorkingDirectory = $workingDir
$shortcut.Description = "Fala para Texto - Overlay Flutuante"
$shortcut.Save()

Write-Output ""
Write-Output "OK - Instalado com sucesso!"
Write-Output "O overlay vai iniciar automaticamente toda vez que o Windows iniciar."
Write-Output ""
Write-Output "Para remover, execute: remover_iniciar_com_windows.ps1"
Write-Output ""

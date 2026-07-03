$shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\FalaParaTexto.lnk"

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Output ""
    Write-Output "OK - Removido da inicializacao do Windows."
    Write-Output ""
} else {
    Write-Output ""
    Write-Output "Nao encontrado: nenhuma entrada de inicializacao para o FalaParaTexto."
    Write-Output ""
}

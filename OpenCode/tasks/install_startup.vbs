Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

startup = WshShell.SpecialFolders("Startup")
shortcut = WshShell.CreateShortcut(startup & "\TaskFlow.lnk")
shortcut.TargetPath = "D:\Projetos IA\OpenCode\tasks\start_tasks.bat"
shortcut.WorkingDirectory = "D:\Projetos IA\OpenCode\tasks"
shortcut.WindowStyle = 7
shortcut.Description = "TaskFlow - Gerenciador de Tarefas"
shortcut.Save

MsgBox "Atalho criado na pasta de inicializacao do Windows!" & vbCrLf & _
       "O TaskFlow iniciara automaticamente ao ligar o computador.", vbInformation, "TaskFlow - Instalado"

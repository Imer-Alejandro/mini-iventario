$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backupRunner = Join-Path $projectRoot "scripts\run-backup.ps1"
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$taskName = "MiniInventario SQLite Backup"

$action = New-ScheduledTaskAction `
  -Execute $powerShell `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $backupRunner) `
  -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"
$principal = New-ScheduledTaskPrincipal `
  -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType S4U `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Description "Crea diariamente una copia local de la base SQLite de Mini Inventario." `
  -Force | Out-Null

Write-Output "Tarea diaria registrada para las 02:00: $taskName"

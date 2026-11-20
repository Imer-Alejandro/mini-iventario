$ErrorActionPreference = "Stop"
$env:NODE_ENV = "production"

$backupScript = Join-Path $PSScriptRoot "backup-database.mjs"
& node $backupScript
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

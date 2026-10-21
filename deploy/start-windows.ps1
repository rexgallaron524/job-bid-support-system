$ErrorActionPreference = 'Stop'
$repoPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repoPath
$nodeExe = (Get-Command node -ErrorAction Stop).Source
& $nodeExe --env-file=.env scripts/migrate.mjs
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Server was not started.' }
$env:NODE_ENV = 'production'
$env:NEXT_TELEMETRY_DISABLED = '1'
& $nodeExe --env-file=.env scripts/start-production.mjs
exit $LASTEXITCODE


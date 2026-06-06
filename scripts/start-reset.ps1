$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-recovery-lib.ps1")

Stop-ProjectNodeProcesses | Out-Null
Clear-NextCache

Set-Location (Get-RecoveryWorkspace)
cmd /c npm run build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

cmd /c npm run start
exit $LASTEXITCODE

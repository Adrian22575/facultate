$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-recovery-lib.ps1")

$stopped = @(Stop-ProjectNodeProcesses)
$remainingListeners = @(Get-ProjectListeners)
$summary = [ordered]@{
  command            = "server:stop"
  mode               = "headless"
  stoppedProcesses   = $stopped
  remainingListeners = $remainingListeners
  generatedAt        = (Get-Date).ToString("o")
}

$summaryPath = Write-RecoverySummary -Summary $summary
$summary | ConvertTo-Json -Depth 8
Write-Host "summary_path=$summaryPath"
exit 0

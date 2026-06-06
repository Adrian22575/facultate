$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-recovery-lib.ps1")

$listeners = @(Get-ProjectListeners)
$probe = Test-AppEndpoints
$errors = Find-KnownRuntimeErrors
$summary = [ordered]@{
  command     = "server:status"
  mode        = "headless"
  listeners   = $listeners
  activePort  = $probe.ActivePort
  probe       = $probe
  logFindings = $errors
  diagnosis   = $errors.Diagnosis
  recommendations = $errors.Recommendations
  generatedAt = (Get-Date).ToString("o")
}

$summaryPath = Write-RecoverySummary -Summary $summary
$safeSummary = ConvertTo-JsonSafeValue -Value $summary
$safeSummary | ConvertTo-Json -Depth 8
Write-Host "summary_path=$summaryPath"

if ($listeners.Count -gt 0) {
  exit 0
}

exit 2

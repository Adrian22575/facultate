$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-recovery-lib.ps1")

$probeStartedAt = Get-Date
$probe = Test-AppEndpoints
$errors = Find-KnownRuntimeErrors -Since $probeStartedAt
$summary = [ordered]@{
  command     = "local:probe"
  mode        = "headless"
  status      = if ($probe.Healthy) { "healthy" } elseif ($probe.ActivePort -and $errors.Diagnosis -eq "next_runtime_cache_corruption") { "runtime_corrupted" } elseif ($probe.ActivePort) { "unhealthy" } else { "unknown" }
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

if ($probe.Healthy) {
  exit 0
}

if (-not $probe.ActivePort) {
  exit 2
}

exit 1

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dev-recovery-lib.ps1")

$steps = New-Object System.Collections.Generic.List[string]
$logs = Get-RecoveryLogPaths

function Complete-Recovery {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Status,
    [Parameter(Mandatory = $true)]
    [int]$ExitCode,
    [Parameter(Mandatory = $true)]
    [object]$InitialProbe,
    [object]$InitialErrors,
    [object]$DevProbe = $null,
    [object]$DevErrors = $null,
    [object]$BuildResult = $null,
    [object]$ProdProbe = $null,
    [object]$ProdErrors = $null
  )

  $summary = [ordered]@{
    command       = "dev:doctor"
    mode          = "headless"
    status        = $Status
    exitCode      = $ExitCode
    workspace     = Get-RecoveryWorkspace
    steps         = @($steps)
    initialProbe  = $InitialProbe
    initialErrors = $InitialErrors
    devProbe      = $DevProbe
    devErrors     = $DevErrors
    buildResult   = $BuildResult
    prodProbe     = $ProdProbe
    prodErrors    = $ProdErrors
    generatedAt   = (Get-Date).ToString("o")
  }

  $summaryPath = Write-RecoverySummary -Summary $summary
  Write-Host $Status
  Write-Host "summary_path=$summaryPath"
  exit $ExitCode
}

$steps.Add("initial_probe")
$initialProbe = Test-AppEndpoints
$initialErrors = Find-KnownRuntimeErrors

if ($initialProbe.Healthy) {
  Complete-Recovery -Status "healthy_dev" -ExitCode 0 -InitialProbe $initialProbe -InitialErrors $initialErrors
}

$steps.Add("dev_reset")
Stop-ProjectNodeProcesses | Out-Null
Clear-NextCache
$devStartTime = Get-Date
$null = Start-DevServer
$devProbe = Wait-ForAppState
$devErrors = Find-KnownRuntimeErrors -LogFiles @($logs.DevStdout, $logs.DevStderr, $logs.Legacy) -Since $devStartTime

if ($devProbe.Healthy -and -not $devErrors.HasKnownErrors) {
  Complete-Recovery -Status "recovered_dev" -ExitCode 0 -InitialProbe $initialProbe -InitialErrors $initialErrors -DevProbe $devProbe -DevErrors $devErrors
}

$steps.Add("prod_fallback")
Stop-ProjectNodeProcesses | Out-Null
Clear-NextCache
$buildResult = Invoke-AppBuild

if (-not $buildResult.Succeeded) {
  Complete-Recovery -Status "manual_investigation_required" -ExitCode 1 -InitialProbe $initialProbe -InitialErrors $initialErrors -DevProbe $devProbe -DevErrors $devErrors -BuildResult $buildResult
}

$prodStartTime = Get-Date
$null = Start-ProdServer
$prodProbe = Wait-ForAppState
$prodErrors = Find-KnownRuntimeErrors -LogFiles @($logs.StartStdout, $logs.StartStderr) -Since $prodStartTime

if ($prodProbe.Healthy -and -not $prodErrors.HasKnownErrors) {
  Complete-Recovery -Status "fallback_prod_ok" -ExitCode 0 -InitialProbe $initialProbe -InitialErrors $initialErrors -DevProbe $devProbe -DevErrors $devErrors -BuildResult $buildResult -ProdProbe $prodProbe -ProdErrors $prodErrors
}

Complete-Recovery -Status "manual_investigation_required" -ExitCode 1 -InitialProbe $initialProbe -InitialErrors $initialErrors -DevProbe $devProbe -DevErrors $devErrors -BuildResult $buildResult -ProdProbe $prodProbe -ProdErrors $prodErrors

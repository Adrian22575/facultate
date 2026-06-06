$ErrorActionPreference = "Stop"

$script:Workspace = Split-Path -Parent $PSScriptRoot
$script:ProjectPorts = @(3000, 3001, 3002)
$script:LogPaths = [ordered]@{
  DevStdout   = Join-Path $script:Workspace "dev-server.log"
  DevStderr   = Join-Path $script:Workspace "dev-server.err.log"
  StartStdout = Join-Path $script:Workspace "start-server.log"
  StartStderr = Join-Path $script:Workspace "start-server.err.log"
  BuildStdout = Join-Path $script:Workspace "build-server.log"
  BuildStderr = Join-Path $script:Workspace "build-server.err.log"
  Legacy      = Join-Path $script:Workspace "server.log"
  Summary     = Join-Path $script:Workspace "recovery-summary.json"
}
$script:KnownRuntimePatterns = @(
  "MODULE_NOT_FOUND",
  "Cannot find module",
  "vendor-chunks",
  "webpack-runtime.js",
  "\./\d+\.js",
  "__webpack_modules__\[moduleId\] is not a function",
  "/_next/static/.+\s404"
)

function Get-RecoveryWorkspace {
  return $script:Workspace
}

function Get-RecoveryLogPaths {
  return [pscustomobject]$script:LogPaths
}

function Get-ProjectListeners {
  param(
    [int[]]$Ports = $script:ProjectPorts
  )

  $listeners = @()
  foreach ($port in $Ports) {
    $connections = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    foreach ($connection in $connections) {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
      $listeners += [pscustomobject]@{
        Port        = $connection.LocalPort
        Address     = $connection.LocalAddress
        ProcessId   = $connection.OwningProcess
        ProcessName = $process.ProcessName
        ProcessPath = $process.Path
      }
    }
  }

  return $listeners |
    Sort-Object Port, ProcessId -Unique
}

function Stop-ProjectNodeProcesses {
  param(
    [int[]]$Ports = $script:ProjectPorts
  )

  $stopped = @()
  $listeners = @(Get-ProjectListeners -Ports $Ports)
  $processIds = $listeners.ProcessId | Sort-Object -Unique

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) {
      continue
    }

    if ($process.ProcessName -notmatch "^node($|\.exe$)") {
      continue
    }

    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      $stopped += [pscustomobject]@{
        ProcessId   = $processId
        ProcessName = $process.ProcessName
      }
    } catch {
      Write-Warning "Nu am putut opri procesul node $processId."
    }
  }

  return $stopped
}

function Clear-NextCache {
  $nextPath = Join-Path $script:Workspace ".next"
  if (Test-Path -LiteralPath $nextPath) {
    Remove-Item -LiteralPath $nextPath -Recurse -Force
  }
}

function Get-NpmCommandPath {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmCommand) {
    return $npmCommand.Source
  }

  $fallback = Join-Path $env:ProgramFiles "nodejs\npm.cmd"
  if (Test-Path -LiteralPath $fallback) {
    return $fallback
  }

  throw "Nu am gasit npm.cmd in PATH sau in Program Files."
}

function Remove-LogFiles {
  param(
    [string[]]$Paths
  )

  foreach ($path in $Paths) {
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
  }
}

function Start-NpmScriptInBackground {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptName,
    [Parameter(Mandatory = $true)]
    [string]$StdoutPath,
    [Parameter(Mandatory = $true)]
    [string]$StderrPath
  )

  Remove-LogFiles -Paths @($StdoutPath, $StderrPath)

  $npmCommand = Get-NpmCommandPath
  $command = ('"{0}" run {1} 1>"{2}" 2>"{3}"' -f $npmCommand, $ScriptName, $StdoutPath, $StderrPath)

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/d /s /c ""$command"""
  $psi.WorkingDirectory = $script:Workspace
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $environmentVariables = $psi.EnvironmentVariables
  if ($null -ne $environmentVariables) {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $cleanPath = @($machinePath, $userPath) -join ";"
    if ($cleanPath) {
      $null = $environmentVariables.Remove("Path")
      $null = $environmentVariables.Remove("PATH")
      $environmentVariables["Path"] = $cleanPath
    }

    foreach ($name in @("ComSpec", "SystemRoot", "TEMP", "TMP", "PATHEXT")) {
      $value = [System.Environment]::GetEnvironmentVariable($name)
      if ($value) {
        $environmentVariables[$name] = $value
      }
    }
  }

  return [System.Diagnostics.Process]::Start($psi)
}

function Start-DevServer {
  $logs = Get-RecoveryLogPaths
  return Start-NpmScriptInBackground -ScriptName "dev" -StdoutPath $logs.DevStdout -StderrPath $logs.DevStderr
}

function Start-ProdServer {
  $logs = Get-RecoveryLogPaths
  return Start-NpmScriptInBackground -ScriptName "start" -StdoutPath $logs.StartStdout -StderrPath $logs.StartStderr
}

function Invoke-AppBuild {
  $logs = Get-RecoveryLogPaths
  Remove-LogFiles -Paths @($logs.BuildStdout, $logs.BuildStderr)

  $npmCommand = Get-NpmCommandPath
  $command = ('"{0}" run build 1>"{1}" 2>"{2}"' -f $npmCommand, $logs.BuildStdout, $logs.BuildStderr)

  & cmd.exe /c $command
  $exitCode = $LASTEXITCODE

  return [pscustomobject]@{
    Succeeded = ($exitCode -eq 0)
    ExitCode  = $exitCode
    Stdout    = $logs.BuildStdout
    Stderr    = $logs.BuildStderr
  }
}

function Invoke-EndpointRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$TimeoutSec = 3
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -MaximumRedirection 0 -TimeoutSec $TimeoutSec
    return [pscustomobject]@{
      Url        = $Url
      StatusCode = [int]$response.StatusCode
      Location   = $response.Headers.Location
      Content    = $response.Content
      Error      = $null
    }
  } catch {
    $response = $_.Exception.Response
    if ($response) {
      $content = $null
      if ($response.GetResponseStream()) {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Dispose()
      }

      return [pscustomobject]@{
        Url        = $Url
        StatusCode = [int]$response.StatusCode
        Location   = $response.Headers.Location
        Content    = $content
        Error      = $null
      }
    }

    return [pscustomobject]@{
      Url        = $Url
      StatusCode = $null
      Location   = $null
      Content    = $null
      Error      = $_.Exception.Message
    }
  }
}

function Test-PortEndpoints {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $baseUrl = "http://127.0.0.1:$Port"
  $root = Invoke-EndpointRequest -Url "$baseUrl/" -TimeoutSec 3
  $login = Invoke-EndpointRequest -Url "$baseUrl/auth/login" -TimeoutSec 3
  $ai = Invoke-EndpointRequest -Url "$baseUrl/ai" -TimeoutSec 3

  $cssPath = $null
  $jsPath = $null
  $cssAsset = $null
  $jsAsset = $null

  if ($login.StatusCode -eq 200 -and $login.Content) {
    $cssMatch = [regex]::Match($login.Content, "/_next/static/css/[^""' ]+")
    $jsMatch = [regex]::Match($login.Content, "/_next/static/chunks/[^""' ]+")

    if ($cssMatch.Success) {
      $cssPath = $cssMatch.Value
      $cssAsset = Invoke-EndpointRequest -Url "$baseUrl$cssPath"
    }

    if ($jsMatch.Success) {
      $jsPath = $jsMatch.Value
      $jsAsset = Invoke-EndpointRequest -Url "$baseUrl$jsPath"
    }
  }

  $healthy =
    $root.StatusCode -in @(200, 303, 307) -and
    $login.StatusCode -eq 200 -and
    $ai.StatusCode -in @(200, 303, 307) -and
    $cssAsset.StatusCode -eq 200 -and
    $jsAsset.StatusCode -eq 200

  return [pscustomobject]@{
    Port       = $Port
    Healthy    = $healthy
    Root       = [pscustomobject]@{ StatusCode = $root.StatusCode; Location = $root.Location; Error = $root.Error }
    AuthLogin  = [pscustomobject]@{ StatusCode = $login.StatusCode; Location = $login.Location; Error = $login.Error }
    AI         = [pscustomobject]@{ StatusCode = $ai.StatusCode; Location = $ai.Location; Error = $ai.Error }
    CssAsset   = [pscustomobject]@{ Path = $cssPath; StatusCode = $cssAsset.StatusCode; Error = $cssAsset.Error }
    JsAsset    = [pscustomobject]@{ Path = $jsPath; StatusCode = $jsAsset.StatusCode; Error = $jsAsset.Error }
  }
}

function Test-AppEndpoints {
  param(
    [int[]]$Ports = $script:ProjectPorts
  )

  $results = @()
  foreach ($port in $Ports) {
    $results += Test-PortEndpoints -Port $port
  }

  $healthyResult = $results | Where-Object { $_.Healthy } | Select-Object -First 1
  $activeResult = $results | Where-Object {
    $_.Root.StatusCode -or $_.AuthLogin.StatusCode -or $_.AI.StatusCode
  } | Select-Object -First 1

  $selected = if ($healthyResult) { $healthyResult } else { $activeResult }

  return [pscustomobject]@{
    Healthy    = [bool]$healthyResult
    ActivePort = if ($selected) { $selected.Port } else { $null }
    Results    = $results
  }
}

function Wait-ForAppState {
  param(
    [int[]]$Ports = $script:ProjectPorts,
    [int]$TimeoutSec = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $lastProbe = $null

  while ((Get-Date) -lt $deadline) {
    $lastProbe = Test-AppEndpoints -Ports $Ports
    if ($lastProbe.Healthy) {
      return $lastProbe
    }

    Start-Sleep -Seconds 2
  }

  return $lastProbe
}

function Find-KnownRuntimeErrors {
  param(
    [string[]]$LogFiles = @(
      $script:LogPaths.DevStdout,
      $script:LogPaths.DevStderr,
      $script:LogPaths.StartStdout,
      $script:LogPaths.StartStderr,
      $script:LogPaths.Legacy
    ),
    [datetime]$Since = [datetime]::MinValue
  )

  $matches = @()
  foreach ($path in $LogFiles) {
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }

    $item = Get-Item -LiteralPath $path
    if ($item.LastWriteTime -lt $Since) {
      continue
    }

    $selectMatches = Select-String -Path $path -Pattern $script:KnownRuntimePatterns -AllMatches -ErrorAction SilentlyContinue
    foreach ($match in $selectMatches) {
      $matches += [pscustomobject]@{
        File = $path
        Line = $match.Line.Trim()
      }
    }
  }

  $joinedLines = ($matches | ForEach-Object { $_.Line }) -join "`n"
  $hasModuleNotFound = $joinedLines -match "MODULE_NOT_FOUND|Cannot find module"
  $hasVendorChunks = $joinedLines -match "vendor-chunks|webpack-runtime\.js|__webpack_modules__\[moduleId\] is not a function"
  $hasStatic404 = $joinedLines -match "/_next/static/.+\s404"
  $affectsAiJobRoute =
    $joinedLines -match "\\app\\ai\\jobs\\\[jobId\]\\page\.js" -or
    $joinedLines -match "page:\s*'/ai/jobs/"
  $affectsAiWorkspace =
    $joinedLines -match "page:\s*'/ai'" -or
    $joinedLines -match "\\app\\ai\\page\.js"

  $diagnosis = if ($hasVendorChunks -or ($hasModuleNotFound -and $hasStatic404)) {
    "next_runtime_cache_corruption"
  } elseif ($hasModuleNotFound) {
    "missing_runtime_module"
  } else {
    "none"
  }

  $recommendations = New-Object System.Collections.Generic.List[string]
  if ($diagnosis -eq "next_runtime_cache_corruption") {
    $recommendations.Add("Ruleaza `npm run dev:reset` pentru a opri procesele node si a sterge `.next`.") | Out-Null
    $recommendations.Add("Daca eroarea reapare dupa compilarea unei rute dinamice, valideaza flow-ul cu `npm run start:reset`.") | Out-Null
  }

  if ($affectsAiJobRoute) {
    $recommendations.Add("Pentru AI Workspace nu este suficient sa verifici doar `/ai`; deschide si `/ai/jobs/[jobId]` dupa un submit real.") | Out-Null
  }

  if ($hasStatic404) {
    $recommendations.Add("Dupa restart confirma si asset-urile `/_next/static/...`, nu doar HTML-ul de pe pagina.") | Out-Null
  }

  return [pscustomobject]@{
    HasKnownErrors        = ($matches.Count -gt 0)
    Matches               = $matches
    Diagnosis             = $diagnosis
    HasModuleNotFound     = $hasModuleNotFound
    HasVendorChunkCorruption = $hasVendorChunks
    HasStaticAsset404     = $hasStatic404
    AffectsAIJobRoute     = $affectsAiJobRoute
    AffectsAIWorkspace    = $affectsAiWorkspace
    Recommendations       = @($recommendations)
  }
}

function ConvertTo-JsonSafeValue {
  param(
    [Parameter(Mandatory = $false)]
    [object]$Value
  )

  if ($null -eq $Value) {
    return $null
  }

  if (
    $Value -is [string] -or
    $Value -is [char] -or
    $Value -is [bool] -or
    $Value -is [byte] -or
    $Value -is [int16] -or
    $Value -is [int32] -or
    $Value -is [int64] -or
    $Value -is [decimal] -or
    $Value -is [double] -or
    $Value -is [single] -or
    $Value -is [datetime]
  ) {
    return $Value
  }

  if ($Value -is [System.Collections.IDictionary]) {
    $result = [ordered]@{}
    foreach ($key in $Value.Keys) {
      $result[[string]$key] = ConvertTo-JsonSafeValue -Value $Value[$key]
    }

    return [pscustomobject]$result
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($item in $Value) {
      $items += ,(ConvertTo-JsonSafeValue -Value $item)
    }

    return $items
  }

  if ($Value.PSObject -and $Value.PSObject.Properties.Count -gt 0) {
    $result = [ordered]@{}
    foreach ($property in $Value.PSObject.Properties) {
      $result[$property.Name] = ConvertTo-JsonSafeValue -Value $property.Value
    }

    return [pscustomobject]$result
  }

  return [string]$Value
}

function Write-RecoverySummary {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Summary,
    [string]$Path = $script:LogPaths.Summary
  )

  $safeSummary = ConvertTo-JsonSafeValue -Value $Summary
  $safeSummary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path
  return $Path
}

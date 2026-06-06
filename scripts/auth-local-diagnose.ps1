$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $workspace ".env.local"

function Read-DotEnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $values = [ordered]@{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $match = [regex]::Match($trimmed, "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$")
    if (-not $match.Success) {
      continue
    }

    $name = $match.Groups[1].Value
    $value = $match.Groups[2].Value.Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$name] = $value
  }

  return $values
}

function Test-UrlValue {
  param(
    [string]$Value
  )

  if (-not $Value) {
    return $false
  }

  return [System.Uri]::IsWellFormedUriString($Value, [System.UriKind]::Absolute)
}

$envValues = Read-DotEnvFile -Path $envPath
$siteUrl = $envValues["NEXT_PUBLIC_SITE_URL"]
$supabaseUrl = $envValues["NEXT_PUBLIC_SUPABASE_URL"]
$publishableKey = $envValues["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
$serviceRoleKey = $envValues["SUPABASE_SERVICE_ROLE_KEY"]

$expectedAppCallback = if ($siteUrl) {
  "$($siteUrl.TrimEnd('/'))/auth/callback"
} else {
  "http://localhost:3000/auth/callback"
}

$expectedGoogleOrigin = if ($siteUrl) {
  try {
    $siteUri = [System.Uri]$siteUrl
    $siteUri.GetLeftPart([System.UriPartial]::Authority)
  } catch {
    "http://localhost:3000"
  }
} else {
  "http://localhost:3000"
}

$expectedSupabaseCallback = if (Test-UrlValue -Value $supabaseUrl) {
  "$($supabaseUrl.TrimEnd('/'))/auth/v1/callback"
} else {
  $null
}

$siteUrlIsLocalhost3000 = $false
if (Test-UrlValue -Value $siteUrl) {
  $siteUri = [System.Uri]$siteUrl
  $siteUrlIsLocalhost3000 =
    $siteUri.Scheme -eq "http" -and
    $siteUri.Host -eq "localhost" -and
    $siteUri.Port -eq 3000
}

$summary = [ordered]@{
  command = "auth:diagnose"
  envFilePresent = (Test-Path -LiteralPath $envPath)
  localEnv = [ordered]@{
    NEXT_PUBLIC_SITE_URL = [ordered]@{
      present = [bool]$siteUrl
      validUrl = Test-UrlValue -Value $siteUrl
      isExpectedLocalhost = $siteUrlIsLocalhost3000
      value = $siteUrl
    }
    NEXT_PUBLIC_SUPABASE_URL = [ordered]@{
      present = [bool]$supabaseUrl
      validUrl = Test-UrlValue -Value $supabaseUrl
      value = $supabaseUrl
    }
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = [ordered]@{
      present = [bool]$publishableKey
    }
    SUPABASE_SERVICE_ROLE_KEY = [ordered]@{
      present = [bool]$serviceRoleKey
    }
  }
  expectedDashboardValues = [ordered]@{
    supabaseSiteUrl = "http://localhost:3000"
    supabaseRedirectUrl = $expectedAppCallback
    googleAuthorizedJavaScriptOrigin = $expectedGoogleOrigin
    googleAuthorizedRedirectUri = $expectedSupabaseCallback
  }
  manualChecks = @(
    "Supabase Authentication > URL Configuration: Site URL trebuie sa fie http://localhost:3000.",
    "Supabase Authentication > URL Configuration: Redirect URLs trebuie sa includa exact $expectedAppCallback.",
    "Supabase Authentication > Providers > Google: providerul trebuie sa fie activ si sa aiba Client ID + Client Secret.",
    "Google Cloud OAuth Client: Authorized JavaScript origins trebuie sa includa $expectedGoogleOrigin.",
    "Google Cloud OAuth Client: Authorized redirect URIs trebuie sa includa callback-ul Supabase: $expectedSupabaseCallback."
  )
  generatedAt = (Get-Date).ToString("o")
}

$summary | ConvertTo-Json -Depth 8

$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-DirectorySummary {
  param([string]$Path)

  $files = Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue
  $size = ($files | Measure-Object Length -Sum).Sum
  [PSCustomObject]@{
    Name = Split-Path $Path -Leaf
    Files = ($files | Measure-Object).Count
    MB = [Math]::Round(($size / 1MB), 2)
  }
}

Write-Host "Workspace: $workspace"
Write-Host ""
Write-Host "Top-level directory sizes:"
Get-ChildItem -LiteralPath $workspace -Directory -Force |
  ForEach-Object { Get-DirectorySummary $_.FullName } |
  Sort-Object MB -Descending |
  Format-Table -AutoSize

Write-Host ""
Write-Host "Root clutter candidates:"
$patterns = @("*.log", "recovery-summary.json", "email-login*.png", "hero-*.png", "full-*.png", "*-check.png")
$matches = foreach ($pattern in $patterns) {
  Get-ChildItem -LiteralPath $workspace -File -Force -Filter $pattern -ErrorAction SilentlyContinue
}

if ($matches) {
  $matches |
    Sort-Object Length -Descending |
    Select-Object Name, @{Name = "KB"; Expression = { [Math]::Round($_.Length / 1KB, 1) } }, LastWriteTime |
    Format-Table -AutoSize
} else {
  Write-Host "No root log/screenshot clutter found."
}

Write-Host ""
Write-Host "Legacy/static candidates:"
$legacy = @("index.html", "materii.html", "subject.html", "study.html", "interactive.html", "test.html", "licenta-exam.html", "assets", "js", "anthropics-skills", "awesome-codex-skills")
foreach ($item in $legacy) {
  $path = Join-Path $workspace $item
  if (Test-Path -LiteralPath $path) {
    $kind = if ((Get-Item -LiteralPath $path).PSIsContainer) { "dir" } else { "file" }
    Write-Host "present [$kind] $item"
  }
}

Write-Host ""
Write-Host "Ignored heavy folders to avoid in normal searches:"
Write-Host "- node_modules/"
Write-Host "- .next/"
Write-Host "- backup/"

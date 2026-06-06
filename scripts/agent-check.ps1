$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$requiredFiles = @(
  "AGENTS.md",
  "README.md",
  "docs/agent-repo-map.md",
  "docs/agent-playbook.md",
  "docs/agent-lessons.md",
  "docs/openai-developers-plugin.md",
  "docs/supabase-plugin.md",
  "docs/workspace-cleanup-2026-06-02.md",
  ".codex/skills/teste-facultate-maintenance/SKILL.md"
)

$missing = @()
foreach ($file in $requiredFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $workspace $file))) {
    $missing += $file
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing required agent files:"
  $missing | ForEach-Object { Write-Host "- $_" }
  exit 1
}

$legacyRootItems = @(
  "index.html",
  "materii.html",
  "subject.html",
  "study.html",
  "interactive.html",
  "test.html",
  "licenta-exam.html",
  "assets",
  "js",
  "anthropics-skills",
  "awesome-codex-skills"
)

$legacyFound = @()
foreach ($item in $legacyRootItems) {
  if (Test-Path -LiteralPath (Join-Path $workspace $item)) {
    $legacyFound += $item
  }
}

if ($legacyFound.Count -gt 0) {
  Write-Host "Legacy or scratch items returned to the repo root:"
  $legacyFound | ForEach-Object { Write-Host "- $_" }
  exit 1
}

$rootClutterPatterns = @("*.log", "recovery-summary.json", "email-login*.png", "hero-*.png", "full-*.png", "*-check.png")
$clutter = foreach ($pattern in $rootClutterPatterns) {
  Get-ChildItem -LiteralPath $workspace -File -Force -Filter $pattern -ErrorAction SilentlyContinue
}

if ($clutter) {
  Write-Host "Root clutter files found:"
  $clutter | ForEach-Object { Write-Host "- $($_.Name)" }
  exit 1
}

$skill = Get-Content -LiteralPath (Join-Path $workspace ".codex/skills/teste-facultate-maintenance/SKILL.md") -Raw
if (-not $skill.StartsWith("---`n")) {
  Write-Host "Local maintenance skill is missing YAML frontmatter."
  exit 1
}

if (-not $skill.Contains("name: teste-facultate-maintenance")) {
  Write-Host "Local maintenance skill has an unexpected name."
  exit 1
}

Write-Host "Agent check passed."

param(
  [string]$Message = "Update FoxPay",
  [string]$Remote = "https://github.com/ceduardox/fxta.git",
  [string]$Branch = "main",
  [switch]$SkipCheck,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$workspaceRoot = Split-Path $projectRoot -Parent
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$preferredPublishRoot = Join-Path $workspaceRoot "_foxpay_publish_$stamp"
$fallbackPublishRoot = Join-Path $projectRoot "_publish_tmp_$stamp"
$publishRoot = $preferredPublishRoot

Write-Host "FoxPay publish"
Write-Host "Source: $projectRoot"
Write-Host "Temp:   $preferredPublishRoot"
Write-Host "Remote: $Remote"
Write-Host "Branch: $Branch"

if (-not $SkipCheck) {
  Push-Location $projectRoot
  try {
    npm.cmd run check
  } finally {
    Pop-Location
  }
}

try {
  New-Item -ItemType Directory -Path $publishRoot | Out-Null
} catch {
  Write-Host "Preferred temp path unavailable. Falling back to: $fallbackPublishRoot"
  $publishRoot = $fallbackPublishRoot
  New-Item -ItemType Directory -Path $publishRoot | Out-Null
}

$excludedDirs = @(
  ".git",
  "node_modules",
  ".cache"
)

Get-ChildItem -LiteralPath $projectRoot -Force | ForEach-Object {
  if ($_.PSIsContainer) {
    if ($excludedDirs -contains $_.Name) { return }
    if ($_.Name -like "_publish_tmp_*") { return }
  }
  if ($_.Name -like "~$*") { return }

  Copy-Item -LiteralPath $_.FullName -Destination $publishRoot -Recurse -Force
}

Push-Location $publishRoot
try {
  git init
  git -c "safe.directory=$($publishRoot -replace '\\','/')" add -A
  git -c "safe.directory=$($publishRoot -replace '\\','/')" commit -m $Message
  git -c "safe.directory=$($publishRoot -replace '\\','/')" branch -M $Branch
  git -c "safe.directory=$($publishRoot -replace '\\','/')" remote add origin $Remote

  if ($NoPush) {
    Write-Host "NoPush enabled. Commit prepared only."
  } else {
    git -c "safe.directory=$($publishRoot -replace '\\','/')" push --force origin $Branch
  }
} finally {
  Pop-Location
}

Write-Host "Done: $publishRoot"

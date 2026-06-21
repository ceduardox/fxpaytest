param(
  [Parameter(Mandatory = $true)]
  [string]$Message,

  [string]$DeployRepo = "C:\tmp\fxta-season-upload-progress",
  [string]$Remote = "https://github.com/ceduardox/fxta.git",
  [string]$Branch = "main",
  [string[]]$Paths = @(),

  [switch]$SkipCheck,
  [switch]$DryRun,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

function Run-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [string]$WorkingDirectory = $DeployRepo
  )
  & git -C $WorkingDirectory @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed"
  }
}

function Copy-AllowedPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  $sourcePath = Join-Path $projectRoot $RelativePath
  $targetPath = Join-Path $DeployRepo $RelativePath

  if (-not (Test-Path -LiteralPath $sourcePath)) {
    return
  }

  $sourceItem = Get-Item -LiteralPath $sourcePath
  $targetParent = Split-Path $targetPath -Parent
  if ($targetParent -and -not (Test-Path -LiteralPath $targetParent)) {
    New-Item -ItemType Directory -Path $targetParent | Out-Null
  }

  if ($sourceItem.PSIsContainer) {
    $deployFull = [System.IO.Path]::GetFullPath($DeployRepo).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $targetFull = [System.IO.Path]::GetFullPath($targetPath)
    if (-not $targetFull.StartsWith($deployFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to replace path outside deploy repo: $targetPath"
    }
    if (Test-Path -LiteralPath $targetPath) {
      Remove-Item -LiteralPath $targetPath -Recurse -Force
    }
  }

  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Recurse -Force
}

function Assert-AllowedPublishPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  $clean = $RelativePath.Replace("\", "/").Trim("/")
  if (-not $clean -or $clean.Contains("..")) {
    throw "Invalid publish path: $RelativePath"
  }

  $allowedExact = @(
    ".env.example",
    ".gitignore",
    "admin.css",
    "admin.html",
    "admin.js",
    "app.js",
    "favicon.png",
    "foxpay-story.html",
    "foxpay-terms.html",
    "index.html",
    "llms.txt",
    "logo.jpg",
    "logo2.jpeg",
    "logo2-meta.jpg",
    "manifest.webmanifest",
    "nixpacks.toml",
    "package.json",
    "package-lock.json",
    "robots.txt",
    "server.js",
    "sitemap.xml",
    "story.css",
    "styles.css",
    "scripts/publish-foxpay-safe.ps1",
    "sw.js"
  )

  $allowedPrefixes = @(
    "images/",
    "onesignal/"
  )

  if ($allowedExact -contains $clean) {
    return $clean
  }

  foreach ($prefix in $allowedPrefixes) {
    if ($clean.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $clean
    }
  }

  throw "Path is not in the publish allowlist: $RelativePath"
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$deployParent = Split-Path $DeployRepo -Parent

Write-Host "FoxPay safe publish"
Write-Host "Source: $projectRoot"
Write-Host "Deploy: $DeployRepo"
Write-Host "Remote: $Remote"
Write-Host "Branch: $Branch"

if (-not $Paths -or $Paths.Count -eq 0) {
  throw "Pass explicit -Paths to publish only intended files, e.g. -Paths app.js,index.html"
}

if (-not $SkipCheck) {
  Push-Location $projectRoot
  try {
    npm.cmd run check
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $DeployRepo)) {
  if (-not (Test-Path -LiteralPath $deployParent)) {
    New-Item -ItemType Directory -Path $deployParent | Out-Null
  }
  & git clone --branch $Branch $Remote $DeployRepo
  if ($LASTEXITCODE -ne 0) {
    throw "git clone failed"
  }
}

Run-Git @("fetch", "origin", $Branch)
Run-Git @("checkout", $Branch)
Run-Git @("pull", "--ff-only", "origin", $Branch)

$dirtyBefore = & git -C $DeployRepo status --porcelain
if ($dirtyBefore) {
  Write-Host "Deploy repo has local changes. Aborting before copy:"
  Write-Host $dirtyBefore
  throw "Deploy repo is dirty. Commit/stash/clean it before publishing."
}

$publishPaths = $Paths |
  ForEach-Object { ([string]$_).Split(",", [System.StringSplitOptions]::RemoveEmptyEntries) } |
  ForEach-Object { Assert-AllowedPublishPath $_ } |
  Select-Object -Unique

Write-Host "Paths:"
$publishPaths | ForEach-Object { Write-Host " - $_" }

foreach ($path in $publishPaths) {
  Copy-AllowedPath $path
}

$changes = & git -C $DeployRepo status --porcelain
if (-not $changes) {
  Write-Host "No changes to publish."
  exit 0
}

Write-Host "Changes to publish:"
Write-Host $changes

if ($DryRun) {
  Run-Git @("diff", "--stat")
  Run-Git @("restore", ".")
  Run-Git @("clean", "-fd")
  Write-Host "DryRun enabled. Nothing was committed or pushed."
  exit 0
}

Run-Git @("add", "-A")
Run-Git @("commit", "-m", $Message)

if ($NoPush) {
  Write-Host "NoPush enabled. Commit prepared but not pushed."
  exit 0
}

Run-Git @("push", "origin", $Branch)
Write-Host "Published successfully."

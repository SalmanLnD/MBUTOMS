# Publish MBUTOMS to GitHub
#
# Prerequisites:
#   1. GitHub CLI installed (winget install GitHub.cli)
#   2. Logged in: gh auth login
#
# Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/publish-to-github.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run 'gh auth login' first, then retry." -ForegroundColor Yellow
  exit 1
}

$repo = "MBUTOMS"
$owner = (gh api user -q .login)

Write-Host "Publishing to https://github.com/$owner/$repo"

$exists = gh repo view "$owner/$repo" 2>$null
if ($LASTEXITCODE -ne 0) {
  gh repo create $repo --public --source=. --remote=origin --description "MBU Training Operations Management System (TOMS)"
} else {
  git remote remove origin 2>$null
  git remote add origin "https://github.com/$owner/$repo.git"
}

git push -u origin main

Write-Host "Done: https://github.com/$owner/$repo" -ForegroundColor Green

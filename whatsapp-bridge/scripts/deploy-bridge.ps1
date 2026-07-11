# Copy bridge config (and optional WhatsApp session) to EC2 and start with PM2.
#
# Usage:
#   cd whatsapp-bridge
#   .\scripts\deploy-bridge.ps1
#   .\scripts\deploy-bridge.ps1 -CopySession   # reuse local .wwebjs_auth (skip QR on server)

param(
  [switch]$CopySession,
  [int]$BootstrapWaitSeconds = 180
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BridgeDir = Split-Path -Parent $ScriptDir
$InstanceMetaPath = Join-Path $BridgeDir ".aws\instance.json"
$EnvPath = Join-Path $BridgeDir ".env"
$SessionPath = Join-Path $BridgeDir ".wwebjs_auth"

if (-not (Test-Path $InstanceMetaPath)) {
  throw "Missing $InstanceMetaPath. Run .\scripts\launch-ec2.ps1 first."
}
if (-not (Test-Path $EnvPath)) {
  throw "Missing $EnvPath. Copy .env.example to .env and configure it first."
}

$meta = Get-Content $InstanceMetaPath -Raw | ConvertFrom-Json
$KeyPath = $meta.keyPath
$RemoteHost = $meta.publicIp
$User = $meta.sshUser
$RemoteBridge = $meta.bridgePath

if (-not (Test-Path $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

$sshOpts = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=NUL")

Write-Host "Waiting up to $BootstrapWaitSeconds seconds for EC2 bootstrap..."
$deadline = (Get-Date).AddSeconds($BootstrapWaitSeconds)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $check = & ssh @sshOpts "${User}@${RemoteHost}" "test -f /var/log/mbutoms-bridge-bootstrap.done && echo ok" 2>$null
    if ($check -match "ok") {
      $ready = $true
      break
    }
  } catch { }
  Write-Host "  Bootstrap still running..."
  Start-Sleep -Seconds 15
}

if (-not $ready) {
  Write-Warning "Bootstrap marker not found yet. Continuing anyway - instance may still be installing packages."
}

Write-Host "Copying .env to server..."
& scp @sshOpts $EnvPath "${User}@${RemoteHost}:${RemoteBridge}/.env"

if ($CopySession) {
  if (-not (Test-Path $SessionPath)) {
    throw "CopySession requested but $SessionPath does not exist. Run list-groups/start locally first."
  }
  Write-Host "Copying WhatsApp session (.wwebjs_auth) to server..."
  & scp @sshOpts -r $SessionPath "${User}@${RemoteHost}:${RemoteBridge}/"
}

$remoteScript = @"
set -e
cd $RemoteBridge
npm install
pm2 delete mbutoms-whatsapp-bridge 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash || true
pm2 status
"@

Write-Host "Starting bridge with PM2..."
& ssh @sshOpts "${User}@${RemoteHost}" $remoteScript

Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
Write-Host "  SSH:  ssh -i `"$KeyPath`" ${User}@${RemoteHost}"
Write-Host "  Logs: ssh -i `"$KeyPath`" ${User}@${RemoteHost} 'pm2 logs mbutoms-whatsapp-bridge'"
Write-Host ""

if (-not $CopySession) {
  Write-Host "Fresh WhatsApp link required:" -ForegroundColor Yellow
  Write-Host "  ssh -i `"$KeyPath`" ${User}@${RemoteHost}"
  Write-Host "  cd $RemoteBridge && pm2 stop mbutoms-whatsapp-bridge && npm start"
  Write-Host "  Scan the QR code, then Ctrl+C and run deploy-bridge.ps1 again (or pm2 start manually)."
}


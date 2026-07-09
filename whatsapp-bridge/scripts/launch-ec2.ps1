# Launch an Ubuntu EC2 instance for the MBUTOMS WhatsApp bridge.
# Prerequisites: AWS CLI installed and configured (aws configure).
#
# Usage:
#   cd whatsapp-bridge
#   .\scripts\launch-ec2.ps1
#   .\scripts\launch-ec2.ps1 -Region ap-south-1 -InstanceType t3.micro

param(
  [string]$Region = "ap-south-1",
  [string]$InstanceType = "t3.micro",
  [string]$KeyName = "mbutoms-whatsapp-bridge",
  [string]$SecurityGroupName = "mbutoms-whatsapp-bridge-sg",
  [int]$VolumeSizeGb = 16
)

$ErrorActionPreference = "Stop"

$Aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
if (-not (Test-Path $Aws)) {
  $Aws = (Get-Command aws -ErrorAction SilentlyContinue).Source
}
if (-not $Aws) {
  throw "AWS CLI not found. Install with: winget install Amazon.AWSCLI"
}

function Invoke-Aws {
  param([string[]]$CliArgs)
  $output = & $Aws @CliArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output | Out-String)
  }
  return $output
}

Write-Host "Checking AWS credentials..."
try {
  $identity = Invoke-Aws @("sts", "get-caller-identity", "--output", "json") | ConvertFrom-Json
  Write-Host "  Account: $($identity.Account)  User/role: $($identity.Arn)"
} catch {
  throw @"
AWS credentials are not configured.

Run:
  aws configure

You need an IAM access key with EC2 permissions (CreateKeyPair, RunInstances, etc.).
See whatsapp-bridge/DEPLOY-AWS.md for the full setup guide.
"@
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BridgeDir = Split-Path -Parent $ScriptDir
$AwsDir = Join-Path $BridgeDir ".aws"
$KeyPath = Join-Path $AwsDir "$KeyName.pem"
$UserDataPath = Join-Path $ScriptDir "ec2-user-data.sh"
$InstanceMetaPath = Join-Path $AwsDir "instance.json"

New-Item -ItemType Directory -Force -Path $AwsDir | Out-Null

if (-not (Test-Path $UserDataPath)) {
  throw "Missing bootstrap script: $UserDataPath"
}

Write-Host "Resolving your public IP for SSH access..."
$MyIp = (Invoke-RestMethod -Uri "https://checkip.amazonaws.com").Trim()
Write-Host "  SSH allowed from: $MyIp/32"

Write-Host "Resolving latest Ubuntu 22.04 AMI in $Region..."
$Ami = (Invoke-Aws @(
  "ssm", "get-parameter",
  "--region", $Region,
  "--name", "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id",
  "--query", "Parameter.Value",
  "--output", "text"
)).Trim()
if (-not $Ami -or $Ami -eq "None") {
  throw "Could not resolve Ubuntu 22.04 AMI in $Region"
}
Write-Host "  AMI: $Ami"

# Key pair
if (-not (Test-Path $KeyPath)) {
  Write-Host "Creating EC2 key pair '$KeyName'..."
  $keyMaterial = Invoke-Aws @(
    "ec2", "create-key-pair",
    "--region", $Region,
    "--key-name", $KeyName,
    "--query", "KeyMaterial",
    "--output", "text"
  )
  $keyMaterial | Out-File -FilePath $KeyPath -Encoding ascii -NoNewline
  icacls $KeyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
  Write-Host "  Saved private key to $KeyPath"
} else {
  Write-Host "Using existing key: $KeyPath"
}

# Security group
$sgId = $null
try {
  $sgId = (Invoke-Aws @(
    "ec2", "describe-security-groups",
    "--region", $Region,
    "--filters", "Name=group-name,Values=$SecurityGroupName",
    "--query", "SecurityGroups[0].GroupId",
    "--output", "text"
  )).Trim()
  if ($sgId -eq "None" -or -not $sgId) { $sgId = $null }
} catch {
  $sgId = $null
}

if (-not $sgId) {
  Write-Host "Creating security group '$SecurityGroupName'..."
  $sgId = (Invoke-Aws @(
    "ec2", "create-security-group",
    "--region", $Region,
    "--group-name", $SecurityGroupName,
    "--description", "SSH for MBUTOMS WhatsApp bridge",
    "--query", "GroupId",
    "--output", "text"
  )).Trim()

  Invoke-Aws @(
    "ec2", "authorize-security-group-ingress",
    "--region", $Region,
    "--group-id", $sgId,
    "--protocol", "tcp",
    "--port", "22",
    "--cidr", "$MyIp/32"
  ) | Out-Null
  Write-Host "  Security group: $sgId (SSH from $MyIp only)"
} else {
  Write-Host "Using existing security group: $sgId"
  # Refresh SSH rule for current IP
  try {
    Invoke-Aws @(
      "ec2", "revoke-security-group-ingress",
      "--region", $Region,
      "--group-id", $sgId,
      "--protocol", "tcp",
      "--port", "22",
      "--cidr", "0.0.0.0/0"
    ) | Out-Null
  } catch { }
  try {
    Invoke-Aws @(
      "ec2", "authorize-security-group-ingress",
      "--region", $Region,
      "--group-id", $sgId,
      "--protocol", "tcp",
      "--port", "22",
      "--cidr", "$MyIp/32"
    ) | Out-Null
  } catch { }
}

Write-Host "Launching $InstanceType instance..."
$userDataRaw = Get-Content -Raw -Path $UserDataPath
$userDataB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($userDataRaw))

$runResult = Invoke-Aws @(
  "ec2", "run-instances",
  "--region", $Region,
  "--image-id", $Ami,
  "--instance-type", $InstanceType,
  "--key-name", $KeyName,
  "--security-group-ids", $sgId,
  "--block-device-mappings", "DeviceName=/dev/sda1,Ebs={VolumeSize=$VolumeSizeGb,VolumeType=gp3}",
  "--user-data", $userDataB64,
  "--tag-specifications", "ResourceType=instance,Tags=[{Key=Name,Value=mbutoms-whatsapp-bridge}]",
  "--query", "Instances[0].InstanceId",
  "--output", "text"
)
$InstanceId = $runResult.Trim()
Write-Host "  InstanceId: $InstanceId"

Write-Host "Waiting for instance to enter 'running' state..."
Invoke-Aws @(
  "ec2", "wait", "instance-running",
  "--region", $Region,
  "--instance-ids", $InstanceId
) | Out-Null

$PublicIp = (Invoke-Aws @(
  "ec2", "describe-instances",
  "--region", $Region,
  "--instance-ids", $InstanceId,
  "--query", "Reservations[0].Instances[0].PublicIpAddress",
  "--output", "text"
)).Trim()

$meta = [ordered]@{
  region       = $Region
  instanceId   = $InstanceId
  publicIp     = $PublicIp
  keyPath      = $KeyPath
  keyName      = $KeyName
  sshUser      = "ubuntu"
  bridgePath   = "/opt/MBUTOMS/whatsapp-bridge"
  launchedAt   = (Get-Date).ToString("o")
}
$meta | ConvertTo-Json | Set-Content -Path $InstanceMetaPath -Encoding UTF8

Write-Host ""
Write-Host "EC2 instance is running." -ForegroundColor Green
Write-Host "  Public IP:  $PublicIp"
Write-Host "  SSH:        ssh -i `"$KeyPath`" ubuntu@$PublicIp"
Write-Host "  Metadata:   $InstanceMetaPath"
Write-Host ""
Write-Host "Bootstrap installs Node, Chromium, and clones the repo (2-5 min)."
Write-Host "Then run:"
Write-Host "  .\scripts\deploy-bridge.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "If this is a fresh WhatsApp session, SSH in and run:"
Write-Host "  cd /opt/MBUTOMS/whatsapp-bridge && npm start"
Write-Host "Scan the QR code, then use pm2 for 24/7 (see DEPLOY-AWS.md)."

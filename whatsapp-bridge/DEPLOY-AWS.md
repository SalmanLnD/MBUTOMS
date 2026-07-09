# Deploy WhatsApp Bridge on AWS EC2

Run the bridge 24/7 on a small EC2 instance instead of your local PC.

## What gets created

| Resource | Purpose |
|----------|---------|
| `t3.micro` Ubuntu 22.04 | Always-on Node + headless Chrome |
| Security group | SSH (port 22) from **your IP only** |
| Key pair | Saved to `whatsapp-bridge/.aws/*.pem` |
| User-data bootstrap | Node 20, Chromium, PM2, git clone |

The bridge only makes **outbound** HTTPS calls to your MBUTOMS API. No public inbound ports besides SSH.

## Prerequisites

1. **AWS account** (free tier eligible for 12 months on new accounts)
2. **IAM access key** with EC2 permissions (`RunInstances`, `CreateKeyPair`, etc.)
3. **AWS CLI** (installed on this machine via `winget install Amazon.AWSCLI`)
4. **MBUTOMS API** webhook secret set on Vercel:
   - `WHATSAPP_WEBHOOK_SECRET` = same value as `WEBHOOK_SECRET` in `whatsapp-bridge/.env`

## Step 1 — Configure AWS CLI (one time)

```powershell
aws configure
```

Enter:

- **AWS Access Key ID** — from IAM console
- **AWS Secret Access Key**
- **Default region** — `ap-south-1` (Mumbai) recommended for India
- **Default output format** — `json`

Verify:

```powershell
aws sts get-caller-identity
```

### Create an IAM access key (if needed)

1. AWS Console → IAM → Users → your user → Security credentials
2. Create access key → CLI use case
3. Attach policy: `AmazonEC2FullAccess` (or a tighter custom policy)

## Step 2 — Prepare local `.env`

In `whatsapp-bridge/.env`:

```env
WEBHOOK_URL=https://mbutoms-api.vercel.app/api/webhooks/whatsapp-punch
WEBHOOK_SECRET=<same as Vercel WHATSAPP_WEBHOOK_SECRET>
GROUP_ID=<your group id from npm run list-groups>
```

## Step 3 — Launch EC2

From PowerShell:

```powershell
cd whatsapp-bridge
.\scripts\launch-ec2.ps1
```

Optional flags:

```powershell
.\scripts\launch-ec2.ps1 -Region ap-south-1 -InstanceType t3.micro
```

This takes 1–2 minutes. Bootstrap on the instance takes another 2–5 minutes.

## Step 4 — Deploy bridge and start PM2

**Option A — Reuse your local WhatsApp session (no new QR scan):**

```powershell
.\scripts\deploy-bridge.ps1 -CopySession
```

Copies `.env` and `.wwebjs_auth/` from your PC to the server.

**Option B — Fresh WhatsApp link on the server:**

```powershell
.\scripts\deploy-bridge.ps1
```

Then SSH in, stop PM2, run `npm start`, scan QR:

```powershell
ssh -i .aws\mbutoms-whatsapp-bridge.pem ubuntu@<PUBLIC_IP>
cd /opt/MBUTOMS/whatsapp-bridge
pm2 stop mbutoms-whatsapp-bridge
npm start
# scan QR, then Ctrl+C
pm2 start index.js --name mbutoms-whatsapp-bridge
pm2 save
```

## Step 5 — Verify

```powershell
ssh -i .aws\mbutoms-whatsapp-bridge.pem ubuntu@<PUBLIC_IP> "pm2 logs mbutoms-whatsapp-bridge --lines 30"
```

Post a test image + OIF caption in the WhatsApp group. You should see:

```
Forwarding punch-in from ...
Recorded: <trainer name> | OIF ...
```

## Useful commands

```powershell
# SSH into instance
ssh -i .aws\mbutoms-whatsapp-bridge.pem ubuntu@<PUBLIC_IP>

# Live logs
pm2 logs mbutoms-whatsapp-bridge

# Restart after .env change
pm2 restart mbutoms-whatsapp-bridge

# Instance metadata (IP, id)
Get-Content .aws\instance.json
```

## Cost notes

- **Free tier:** `t3.micro` ~750 hrs/month for 12 months on new accounts
- **After free tier:** roughly $8–12/month depending on region
- **1 GB RAM** is tight for Chromium — bootstrap adds 2 GB swap

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `NoCredentials` | Run `aws configure` |
| SSH timeout | Your IP changed — re-run `launch-ec2.ps1` (updates security group) or add your new IP in AWS console |
| Bridge 404 on webhook | Set `WHATSAPP_WEBHOOK_SECRET` on **Vercel**, not only local backend |
| Chrome OOM / crash | Upgrade to `t3.small` (2 GB RAM) or add more swap |
| Session lost | Re-scan QR; back up `.wwebjs_auth/` |
| `getChats` hangs | Wait 1–2 min; re-run `npm run list-groups` on server |

## Tear down (stop charges)

```powershell
$meta = Get-Content .aws\instance.json | ConvertFrom-Json
aws ec2 terminate-instances --region $meta.region --instance-ids $meta.instanceId
```

Delete the key pair and security group in the AWS console if no longer needed.

## Files

| File | Purpose |
|------|---------|
| `scripts/launch-ec2.ps1` | Create EC2 + key + security group |
| `scripts/deploy-bridge.ps1` | SCP `.env`, start PM2 |
| `scripts/ec2-user-data.sh` | First-boot install script |
| `.aws/instance.json` | Instance IP and SSH details (gitignored) |
| `.aws/*.pem` | SSH private key (gitignored) |

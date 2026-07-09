# MBUTOMS WhatsApp Punch-In Bridge

Reads punch-in images posted in your trainer WhatsApp group and forwards the
sender's phone number, the OIF number (from the message caption), and the
timestamp to the MBUTOMS attendance webhook. MBUTOMS then maps the punch-in to a
trainer by phone number and records the day's attendance with the OIF.

## How it works

```
Trainer posts image + "OIF 12345" in group
        |
        v
WhatsApp Bridge (this app, runs on an always-on machine)
        |  POST /api/webhooks/whatsapp-punch  (x-webhook-secret)
        v
MBUTOMS API  ->  match trainer by phone  ->  save TrainerDailyAttendance
```

> The bridge must run on an **always-on machine** (office PC, mini-PC, or a small
> VPS). It cannot run on Vercel because it keeps a live WhatsApp session open.
>
> **AWS EC2:** see [DEPLOY-AWS.md](./DEPLOY-AWS.md) for automated setup with
> `scripts/launch-ec2.ps1` and `scripts/deploy-bridge.ps1`.

## Requirements

- Node.js 18+
- A WhatsApp account that is a **member of the punch-in group** (a dedicated
  number is recommended, e.g. a manager/office phone).

## Setup

1. Install dependencies:

   ```bash
   cd whatsapp-bridge
   npm install
   ```

2. Create your config:

   ```bash
   cp .env.example .env
   ```

   Set `WEBHOOK_URL` and `WEBHOOK_SECRET` (the secret must match
   `WHATSAPP_WEBHOOK_SECRET` on the backend).

3. Link WhatsApp and find the group id:

   ```bash
   npm run list-groups
   ```

   Scan the QR code with the group member's WhatsApp
   (WhatsApp → Settings → Linked Devices → Link a Device). The script prints all
   groups and their ids. Copy the correct id into `GROUP_ID` in `.env`.

4. Start the bridge:

   ```bash
   npm start
   ```

   Leave it running. It reconnects automatically and reuses the saved session
   (no need to scan the QR again unless you unlink the device).

## OIF format

By default the OIF is read from the message **caption** using `OIF_REGEX`.
The default matches `OIF 12345`, `OIF-12345`, `oif: 12345/AB`, etc.

If your trainers put the OIF **inside the image** (not the caption), set
`ENABLE_OCR=true`. OCR is slower and less reliable, so caption text is preferred.

## Notes & limits

- Only image messages in the target group are processed. Text-only messages are
  ignored.
- The first punch-in per trainer per day is kept; later images only backfill a
  missing time.
- If a phone number is not saved on any trainer in MBUTOMS, the webhook returns
  `404` and the bridge logs it (add/fix the trainer's phone in MBUTOMS).
- This uses an unofficial WhatsApp automation library. Use a number you control
  and are comfortable automating; heavy automation can risk WhatsApp account
  restrictions.

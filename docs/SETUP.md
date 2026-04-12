# Email Drafts App — Setup Guide

## What This App Does

- **Every weekday at 8:30 AM**: OpenClaw drafts 10 personalized cold emails and writes them as notes on 10 contacts in Attio
- **Anytime**: You log into the web app and click "Send to Telegram" → all 10 drafts are sent to your Telegram for review
- You copy each email and send manually from your own email

---

## Architecture

```
OpenClaw (scheduler)          Web App (Vercel)              Attio (CRM)
       │                            │                            │
  Drafts 10 emails         Reads drafts                  Stores:
  → writes to Attio    →   on contacts              →   contacts + notes
                                                                 │
                                                            Telegram (you)
```

---

## Part 1 — Vercel Setup

### 1. Create the project on Vercel
```bash
cd email-drafts-app
npm i -g vercel
vercel login
vercel --prod
```

### 2. Add environment variables in Vercel dashboard

Go to your project → Settings → Environment Variables and add:

| Variable | Value |
|---|---|
| `ATTIO_API_KEY` | `ed1b79023895fcf8c37083aad62e8f834487ab3bfb0707374f1268779dcf33a4` |
| `AUTH_PASSWORD` | Your chosen password (e.g. `Calgary2026!`) |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |

### 3. Deploy
```bash
vercel --prod
```
Note the deployed URL (e.g. `https://email-drafts-app.vercel.app`)

---

## Part 2 — Attio Setup

### Required fields on Contact records:

**Custom field** (create in Attio):
- `draft_status` — Text or Single Select with options: `pending`, `drafted`, `sent`

**Notes** — are used natively by Attio. No setup needed.

---

## Part 3 — OpenClaw HEARTBEAT

Update your `HEARTBEAT.md` to include the drafting automation. The morning draft generation runs as a scheduled task in OpenClaw, reading from Attio and writing back draft emails as notes.

---

## Part 4 — Telegram

You'll receive a formatted message with all 10 drafts, ready to copy-paste.

---

## Usage

1. **Morning**: OpenClaw drafts 10 emails and stores them in Attio (no action needed from you)
2. **Whenever ready**: Go to `https://your-vercel-url.com`, log in with your password, click **Send to Telegram**
3. **Telegram**: You receive all 10 drafted emails in one message
4. **Send**: Copy each email from Telegram, paste into your email client, send

---

## Troubleshooting

**No drafts showing up on the web app:**
- Run the morning automation manually first to generate drafts
- Check that contacts in Attio have emails

**Vercel deployment fails:**
- Make sure you have a `package.json`, `next.config.js`, and `tsconfig.json` in the root
- Run `npm install` locally first to populate `node_modules`

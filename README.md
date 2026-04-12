# Email Drafts App

Daily cold email drafting tool for Abdul (CRE Broker, Calgary).

## What it does

- **Automated**: Every weekday morning, OpenClaw pulls 10 fresh contacts from Attio and drafts personalized cold emails
- **On-demand delivery**: You click a button on the web app → 10 drafts are sent to your Telegram
- **Simple auth**: Single password protects the web app

## Stack

- **Web app**: Next.js (Vercel)
- **CRM**: Attio
- **Scheduling**: OpenClaw HEARTBEAT
- **Delivery**: Telegram

## Quick Start

```bash
cd email-drafts-app
npm install
vercel --prod
```

Add environment variables in Vercel dashboard:
- `ATTIO_API_KEY`
- `AUTH_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

See `docs/SETUP.md` for full setup instructions.

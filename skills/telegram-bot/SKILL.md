---
name: telegram-bot
description: Send Telegram bot messages or set up Telegram notifications via the Bot API. Use when asked to message a user in Telegram, set up bot tokens/chat IDs, or build scripts to send Telegram alerts.
---

# Telegram Bot Messaging

## Use the project script

Send a one-off message using the project helper (preferred):

```bash
bun /opt/flashblind/scripts/telegram-send.mjs "Your message here"
```

The script reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `/opt/flashblind/.env` (loaded by direnv).

## Use the skill script

If the project script is unavailable, use the skill script:

```bash
/home/codex/.codex/skills/telegram-bot/scripts/send-telegram.sh "Your message here"
```

## Setup checklist

- Ensure `/opt/flashblind/.env` contains `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- Run `direnv allow /opt/flashblind` after edits.
- Test with a short message after setup.

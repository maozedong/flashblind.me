# Scripts

Operational scripts for Flashblind. All scripts are run with Bun unless noted.

- `gsc-submit.mjs` Submit sitemap to Google Search Console
- `bing-submit.mjs` Submit URL to Bing Webmaster Tools
- `ga4-report.mjs` Pull GA4 channel summary
- `ga4-conversions.mjs` Create GA4 conversion events
- `weekly-report.mjs` Generate weekly report (GSC + GA4 + IndexNow)
- `telegram-send.mjs` Send a Telegram bot message
- `send-weekly-report.sh` Cron entry point (sends weekly report to Telegram)

Examples:

```bash
bun /opt/flashblind/scripts/gsc-submit.mjs
bun /opt/flashblind/scripts/bing-submit.mjs
bun /opt/flashblind/scripts/ga4-report.mjs
bun /opt/flashblind/scripts/ga4-conversions.mjs
bun /opt/flashblind/scripts/telegram-send.mjs "Hello"
/opt/flashblind/scripts/send-weekly-report.sh
```

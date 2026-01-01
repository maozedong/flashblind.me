const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error("Usage: bun telegram-send.mjs \"message\"");
  process.exit(1);
}

const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text }),
});

const body = await res.text();
if (!res.ok) {
  console.error("Telegram API error:", res.status, body);
  process.exit(1);
}

console.log("Sent:", text);

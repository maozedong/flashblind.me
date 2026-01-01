const base = process.env.CODEX_MEMORY_URL ?? "http://127.0.0.1:7171";
const args = process.argv.slice(2);

function usage() {
  console.log(`codex-mem <command> [args]

Commands:
  health
  event <type> [json]
  memory <scope> <summary>
  recall <query> [limit]
  state-get <key>
  state-set <key> <json>
  policy-get <key>
  policy-set <key> <value>
  goal <text>
  task <text>
`);
}

async function main() {
  const cmd = args[0];
  if (!cmd) {
    usage();
    process.exit(1);
  }

  if (cmd === "health") {
    const res = await fetch(`${base}/health`);
    console.log(await res.text());
    return;
  }

  if (cmd === "event") {
    const type = args[1];
    if (!type) return usage();
    const payload = args[2] ? JSON.parse(args[2]) : {};
    const res = await fetch(`${base}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, tags: payload.tags ?? [], content: payload.content ?? payload })
    });
    console.log(await res.text());
    return;
  }

  if (cmd === "memory") {
    const scope = args[1];
    const summary = args.slice(2).join(" ");
    if (!scope || !summary) return usage();
    const res = await fetch(`${base}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, summary })
    });
    console.log(await res.text());
    return;
  }

  if (cmd === "recall") {
    const q = args[1];
    if (!q) return usage();
    const limit = args[2] ? Number(args[2]) : 8;
    const res = await fetch(`${base}/recall?q=${encodeURIComponent(q)}&limit=${limit}`);
    console.log(await res.text());
    return;
  }

  if (cmd === "state-get") {
    const key = args[1];
    if (!key) return usage();
    const res = await fetch(`${base}/state/${encodeURIComponent(key)}`);
    console.log(await res.text());
    return;
  }

  if (cmd === "state-set") {
    const key = args[1];
    if (!key || !args[2]) return usage();
    const value = JSON.parse(args[2]);
    const res = await fetch(`${base}/state/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value })
    });
    console.log(await res.text());
    return;
  }

  if (cmd === "policy-get") {
    const key = args[1];
    if (!key) return usage();
    const res = await fetch(`${base}/policy/${encodeURIComponent(key)}`);
    console.log(await res.text());
    return;
  }

  if (cmd === "policy-set") {
    const key = args[1];
    const value = args.slice(2).join(" ");
    if (!key || !value) return usage();
    const res = await fetch(`${base}/policy/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value })
    });
    console.log(await res.text());
    return;
  }

  if (cmd === "goal" || cmd === "task") {
    const text = args.slice(1).join(" ");
    if (!text) return usage();
    const res = await fetch(`${base}/${cmd}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [cmd]: text })
    });
    console.log(await res.text());
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

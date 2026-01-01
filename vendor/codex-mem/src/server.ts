import { Database } from "bun:sqlite";
import { appendFileSync, mkdirSync } from "fs";
import { hostname } from "os";

const DATA_DIR = process.env.DATA_DIR ?? "/var/lib/codex-mem";
const DB_PATH = `${DATA_DIR}/memory.db`;
const LOG_PATH = `${DATA_DIR}/events.jsonl`;
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? "7171");

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
// WAL for speed + durability without heavy fsync costs.
db.exec("PRAGMA journal_mode=WAL;");
db.exec("PRAGMA synchronous=NORMAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS policies (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    scope TEXT NOT NULL,
    summary TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
    USING fts5(summary, content=memories, content_rowid=id);
`);

const seedPersona = {
  name: "Codex-SEO",
  traits: [
    "metrics-driven",
    "fast-iterating",
    "careful with risk",
    "surgical about changes",
    "document-everything"
  ],
  principles: [
    "Ship small experiments quickly and measure impact.",
    "Prefer durable wins over short-term spikes.",
    "Never use cloaking or deceptive SEO tactics.",
    "Log every decision and outcome.",
    "Keep the system reproducible."
  ],
  mission: "Grow flashblind.me traffic and conversions via continuous experiments."
};

const seedPolicies = {
  safety: "No illegal or deceptive SEO practices.",
  operations: "Record key decisions and results in memory."
};

function ensureSeed() {
  const personaRow = db.query("SELECT value FROM state WHERE key = ?").get("persona") as { value?: string } | undefined;
  if (!personaRow?.value) {
    db.query("INSERT INTO state(key, value) VALUES(?, ?)").run("persona", JSON.stringify(seedPersona));
  }
  for (const [key, value] of Object.entries(seedPolicies)) {
    const row = db.query("SELECT value FROM policies WHERE key = ?").get(key) as { value?: string } | undefined;
    if (!row?.value) {
      db.query("INSERT INTO policies(key, value) VALUES(?, ?)").run(key, value);
    }
  }
}

ensureSeed();

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

function badRequest(message: string) {
  return jsonResponse({ ok: false, error: message }, 400);
}

function readBody<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}

const insertState = db.query(
  "INSERT INTO state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
);
const insertPolicy = db.query(
  "INSERT INTO policies(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
);

Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/health" && req.method === "GET") {
      return jsonResponse({ ok: true, host: hostname(), ts: Date.now() });
    }

    if (path === "/event" && req.method === "POST") {
      const body = await readBody<{ type?: string; tags?: string[]; content?: Record<string, unknown> }>(req);
      if (!body?.type) return badRequest("type is required");
      const record = {
        ts: Date.now(),
        type: body.type,
        tags: body.tags ?? [],
        content: body.content ?? {}
      };
      appendFileSync(LOG_PATH, JSON.stringify(record) + "\n");
      return jsonResponse({ ok: true });
    }

    if (path.startsWith("/state/") && (req.method === "GET" || req.method === "POST" || req.method === "PUT")) {
      const key = decodeURIComponent(path.slice(7));
      if (!key) return badRequest("state key required");
      if (req.method === "GET") {
        const row = db.query("SELECT value FROM state WHERE key = ?").get(key) as { value?: string } | undefined;
        return jsonResponse({ key, value: row?.value ? JSON.parse(row.value) : null });
      }
      const payload = await readBody<Record<string, unknown> | { value?: unknown }>(req);
      const value = payload && "value" in payload ? payload.value : payload;
      insertState.run(key, JSON.stringify(value ?? null));
      return jsonResponse({ ok: true });
    }

    if (path.startsWith("/policy/") && (req.method === "GET" || req.method === "POST" || req.method === "PUT")) {
      const key = decodeURIComponent(path.slice(8));
      if (!key) return badRequest("policy key required");
      if (req.method === "GET") {
        const row = db.query("SELECT value FROM policies WHERE key = ?").get(key) as { value?: string } | undefined;
        return jsonResponse({ key, value: row?.value ?? null });
      }
      const payload = await readBody<Record<string, unknown> | { value?: string }>(req);
      const value = payload && "value" in payload ? payload.value : payload;
      insertPolicy.run(key, typeof value === "string" ? value : JSON.stringify(value ?? ""));
      return jsonResponse({ ok: true });
    }

    if (path === "/memory" && req.method === "POST") {
      const body = await readBody<{ scope?: string; summary?: string }>(req);
      if (!body?.summary) return badRequest("summary is required");
      const scope = body.scope ?? "general";
      const ts = Date.now();
      const info = db.query("INSERT INTO memories(ts, scope, summary) VALUES(?, ?, ?)").run(ts, scope, body.summary);
      db.query("INSERT INTO memories_fts(rowid, summary) VALUES(?, ?)").run(info.lastInsertRowid, body.summary);
      return jsonResponse({ ok: true, id: Number(info.lastInsertRowid) });
    }

    if (path === "/recall" && req.method === "GET") {
      const q = url.searchParams.get("q");
      if (!q) return badRequest("q is required");
      const limitRaw = Number(url.searchParams.get("limit") ?? "8");
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 8;
      const rows = db
        .query(
          "SELECT m.id, m.ts, m.scope, m.summary FROM memories_fts f JOIN memories m ON f.rowid=m.id WHERE memories_fts MATCH ? LIMIT ?"
        )
        .all(q, limit) as Array<{ id: number; ts: number; scope: string; summary: string }>;
      return jsonResponse(rows);
    }

    if (path === "/goal" && req.method === "POST") {
      const body = await readBody<{ goal?: string }>(req);
      if (!body?.goal) return badRequest("goal is required");
      const ts = Date.now();
      const info = db.query("INSERT INTO goals(goal, status, created_at) VALUES(?, ?, ?)").run(body.goal, "active", ts);
      return jsonResponse({ ok: true, id: Number(info.lastInsertRowid) });
    }

    if (path === "/task" && req.method === "POST") {
      const body = await readBody<{ task?: string }>(req);
      if (!body?.task) return badRequest("task is required");
      const ts = Date.now();
      const info = db.query("INSERT INTO tasks(task, status, created_at) VALUES(?, ?, ?)").run(body.task, "active", ts);
      return jsonResponse({ ok: true, id: Number(info.lastInsertRowid) });
    }

    return jsonResponse({ ok: false, error: "not found" }, 404);
  }
});

console.log(`codex-mem listening on http://${HOST}:${PORT}`);

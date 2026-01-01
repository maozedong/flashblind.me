---
name: flashblind-memory
description: Use for accessing and writing to the Flashblind memory system (HTTP API at 127.0.0.1:7171). Trigger whenever you need to log actions, recall past decisions, or store summaries.
---

# Flashblind Memory Skill

## What this is
The memory system is an HTTP API, not filesystem paths. Do NOT read `/memory` or `/event` as files.

## Base URL
- http://127.0.0.1:7171

## Always log
- Run start/end
- Major decisions
- Experiment outcomes

## Endpoints
- Health: GET /health
- Log event: POST /event
- Store summary: POST /memory
- Recall: GET /recall?q=...&limit=8
- State read/write: GET /state/{key} / POST /state/{key}

## Curl examples
- Health:
  - curl -s http://127.0.0.1:7171/health
- Log event:
  - curl -s -X POST http://127.0.0.1:7171/event -H "content-type: application/json" -d '{"type":"agent.run.start","tags":["seo"],"content":{"ts":123}}'
- Store summary:
  - curl -s -X POST http://127.0.0.1:7171/memory -H "content-type: application/json" -d '{"scope":"seo","summary":"Changed title tag on homepage; success metric: CTR"}'
- Recall:
  - curl -s "http://127.0.0.1:7171/recall?q=title%20tag&limit=8"

## Local storage (fallback only)
- Event log file: /var/lib/codex-mem/events.jsonl
- SQLite DB: /var/lib/codex-mem/memory.db

Only read these files if the HTTP API is down.

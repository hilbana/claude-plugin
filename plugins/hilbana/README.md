# hilbana

The **all-in-one** Claude Code plugin for [Hilbana](https://app.hilbana.com): one
install gives your agents **persistent memory** and the **human+agent workflow
framework**.

> **Language note:** the commands and skills in this plugin are written in
> **Spanish**. Claude reads them fine and answers you in whatever language you're
> using, so this doesn't affect how you work — but if you open the files to edit
> them, the prose inside is Spanish.

## What you get

- **Hilbana's MCP server auto-registered** (with your API key, via the plugin config).
- **Per-project memory** (an engram replacement):
  - `SessionStart` hook: when you open a repo, it reminds the agent to load prior
    context (`mem_context`) and to save proactively.
  - `SessionEnd` hook: on close, it automatically saves a summary of the session.
  - `/hilbana-memoria-switch` to import your engram history.
- **Per-task token accounting**:
  - `Stop` / `SessionEnd` hooks report the tokens the agent spent and bill them to
    the issue it has claimed. See *Token accounting* below.
- **The human+agent workflow framework** (a *pull* queue): the orchestrator command
  `/hilbana-plan`, plus the cycle prompts `claim_next`, `finish` and `review` — which
  since 2.0.0 are served by Hilbana's own MCP, not by this plugin, so they work in any
  MCP client, with `/hilbana:claim-next`, `/hilbana:finish` and `/hilbana:review` as
  shortcuts. The worker pulls from the queue and stops at *In Review*; the reviewer
  closes.
- **Skills** `hilbana-memoria` (the memory protocol) and `hilbana-mcp` (the MCP tools
  and the queue flows).

Memory is organised by **scope = the name of the repo folder**. It works in **any**
repo, not just projects tracked in Hilbana.

For each command, skill and hook in detail — arguments, the MCP tools they use, the
rules they follow — see **[REFERENCE.md](../../REFERENCE.md)**.

## Requirements

- **Node 18+** on your `PATH` (the hooks run under `node`; `SessionEnd` uses the
  global `fetch`, available from Node 18 on). Without Node the hooks simply don't
  run — your session is unaffected.

## Install

```bash
# 1) Add this repo as a marketplace
/plugin marketplace add hilbana/claude-plugin

# 2) Install the plugin
/plugin install hilbana@hilbana
```

On install you'll be asked for the **configuration** (`userConfig`):

- **`api_key`** (required): create it under *Settings → API keys* in **the workspace
  you work in**. ⚠️ The tools and the memory operate on that key's workspace — use a
  key from the right one or they'll land in another tenant.
- **`base_url`** (optional): leave it **empty** for the default
  `https://app.hilbana.com`. Set it only when self-hosting, and **without `/mcp`**
  (the plugin appends it).

Restart Claude Code and you're set: the MCP is connected, the hooks are live and the
cycle commands are available across all your repos.

## Verify

- `/plugin list` → `hilbana` enabled.
- In a fresh session, check that the memory tools exist (`mem_context`, `mem_save`,
  …). Installed as a plugin they carry the namespaced MCP prefix:
  `mcp__plugin_hilbana_hilbana__mem_*`.
- Smoke test: ask *"load the memory context"* → the agent calls `mem_context` with
  the current repo's scope.

## Token accounting

The plugin measures **how many tokens each task costs** and sends that on its own,
without the agent having to remember anything. That's deliberate: an LLM doesn't know
what it consumes, and if you ask it to report that, it makes it up.

How it works: on every `Stop` (and on session close) the `scripts/usage-report.cjs`
hook streams through the transcript, **deduplicates by `message.id`** — the same
message appears on several JSONL lines, and summing per line inflates the figure by
~80% — groups by model, and posts to `POST /api/agents/usage` only what came after
the last reported segment. **The issue is not sent**: the server decides which task
to bill by looking at which issue you have claimed at that moment (`claim_issue`).
With no claim, the spend is recorded as *unattributed*.

It's silent by design: if the endpoint is down, the key is missing or the transcript
can't be read, it neither breaks nor pollutes your session. The cursor only advances
once the server confirms, so an unsent segment is retried on the next turn rather
than lost.

Dry run: `HILBANA_HOOK_DRYRUN=1` prints the payload instead of sending it.

### The ingest contract (for other agents)

The endpoint is **not specific to Claude Code**: any agent (Codex, Cursor, your own)
can feed it by posting this body with its own `agentName`.

```http
POST /api/agents/usage
Authorization: Bearer hil_<your-api-key>
Content-Type: application/json
```

```json
{
  "sessionId": "stable identifier for the agent's session",
  "agentName": "claude-code",
  "cursor": "id of the last message included in this segment",
  "usage": [
    {
      "model": "claude-opus-4-8",
      "inputTokens": 1788,
      "outputTokens": 391550,
      "cacheReadTokens": 316707004,
      "cacheWriteTokens": 3275984
    }
  ]
}
```

Contract rules:

- **`cursor` is required** and it's what makes the ingest idempotent: replaying the
  same cursor returns `{"accepted": false}` and adds nothing. Send the id of the last
  message you accounted for, and only advance it once the server answers 200.
- **Send segments, not totals**: each post carries the *new* counters since the
  previous cursor; the server accumulates.
- The four counters stay **separate**. Don't collapse them into one: cache reads
  dominate the volume and cost a fraction, so a single total is a misleading number.
  Missing counters count as 0.
- `issueId` and `workspaceId` are **not accepted** in the body: they come from the API
  key and the live claim. That's what stops spend being billed to someone else's task.
- Response: `{ "accepted": true|false, "issueId": string|null, "models": number }`.
- A `read-only` key gets 403; negative counters or a missing `model`, 400.

## Privacy

The plugin contains **no secrets**: your API key lives only in your local
configuration (`userConfig`, marked `sensitive`). The `SessionEnd` hook sends the
summary to your Hilbana via `POST /api/memory`, authenticated with that key.

Dry run for the memory save: `HILBANA_HOOK_DRYRUN=1` makes the hook print the summary
instead of sending it.

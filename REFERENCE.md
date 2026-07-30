# Reference — commands, skills and hooks

The source of truth for what the `hilbana` plugin gives you. Everything below is
generated from the installed files, not from memory: if this page and the plugin ever
disagree, the files win — and that's a bug worth [reporting](https://github.com/hilbana/claude-plugin/issues).

- [At a glance](#at-a-glance)
- [The workflow the commands implement](#the-workflow-the-commands-implement)
- [Commands](#commands)
- [Skills](#skills)
- [Hooks](#hooks)
- [Configuration](#configuration)
- [Tool naming](#tool-naming)

> **Language:** the command and skill bodies are written in **Spanish**. Claude reads
> them fine and replies in whatever language you use, so this doesn't change how you
> work. This reference is in English.

## At a glance

| Component | Type | One-liner |
|-----------|------|-----------|
| [`/hilbana-claim-next`](#hilbana-claim-next) | command | Pull the next agent-ready issue from the queue and start it |
| [`/hilbana-finish`](#hilbana-finish) | command | Close your turn on an issue at **In Review**, with telemetry and memory |
| [`/hilbana-review`](#hilbana-review) | command | Review what's In Review: approve to Done or send back |
| [`/hilbana-plan`](#hilbana-plan) | command | Compile a goal into a DAG of sub-issues and queue the frontier |
| [`/hilbana-trabajar-issue`](#hilbana-trabajar-issue) | command | Work one specific issue end to end (claim → … → release) |
| [`/hilbana-crear-docs`](#hilbana-crear-docs) | command | Bootstrap a project's docs in Hilbana from your repo + an interview |
| [`/hilbana-memoria-switch`](#hilbana-memoria-switch) | command | Move your agent memory from engram to Hilbana |
| [`hilbana-mcp`](#hilbana-mcp) | skill | All 28 MCP tools: when to use each, with examples |
| [`hilbana-memoria`](#hilbana-memoria) | skill | The proactive memory protocol (scope, when to save, what not to) |
| [`SessionStart`](#sessionstart) | hook | Injects the memory protocol and this repo's scope |
| [`Stop`](#stop--sessionend-usage) | hook | Reports token spend, billed to your claimed issue |
| [`SessionEnd`](#sessionend) | hook | Saves a session summary to memory, plus the final token segment |

Skills load themselves when relevant — you don't invoke them. Commands you type.

## The workflow the commands implement

The plugin encodes a **pull** model. The tracker is the work bus; workers don't pick
tasks by hand and never talk to each other. The issue graph is the only channel.

```
/hilbana-plan          goal ──> DAG of sub-issues, frontier marked agentReady
                                            │
                                            ▼
/hilbana-claim-next    worker pulls the next ready leaf (atomic, claimed on serve)
                                            │
                                       … work happens …
                                            │
                                            ▼
/hilbana-finish        verify DoD ──> In Review (never Done) + record_run + mem_save
                                            │
                                            ▼
/hilbana-review        reviewer: Done ✔  or  back to In Progress with feedback
```

Two rules hold the whole thing together:

1. **A worker never closes its own work to Done.** It stops at *In Review*. The gate
   lives in the commands (the role), not in the database.
2. **`record_run` and `release_issue` always run** — including on failure, including
   if you abort. Otherwise the lock dangles and blocks other agents.

`/hilbana-trabajar-issue` is the exception: a single-issue flow that does close to
Done, for when you're driving one task by hand rather than draining a queue.

---

## Commands

### `/hilbana-claim-next`

**Pull the next agent-ready issue and start it.** A pure queue consumer.

| | |
|---|---|
| **Argument** | `[projectId]` — optional. Narrows the queue to one project; empty = all your teams in the active workspace. |
| **MCP tools** | `mem_context`, `next_ready_issue`, `list_workflow_states`, `change_issue_state`, `get_issue`, `list_docs`, `get_doc` |
| **Pairs with** | `/hilbana-finish` |

What it does:

1. Loads memory for the repo's scope, so you don't rediscover conventions.
2. Calls `next_ready_issue`, which returns the first issue that is `agentReady`,
   unlocked, not started, not an epic and **has no open blockers** — ordered by
   priority then FIFO. The queue is atomic (`SELECT … FOR UPDATE SKIP LOCKED`), so two
   workers calling at once never get the same issue, and **it arrives already claimed
   for you**: no extra `claim_issue` needed.
3. Moves it to *In Progress* if the auto-claim didn't already.
4. Reads and shows the `agentContext` (files, verification command, DoD) plus any
   project docs.

Good to know:

- **`null` means the queue is empty.** It exits cleanly; there's no lock to release.
- If you claim explicitly and get a **409**, another agent has it — ask for the next
  one rather than retrying.
- A `blocked_by` that's still open is a **stop signal**: comment and release, don't
  improvise the dependency.

### `/hilbana-finish`

**Close your turn as a worker — at *In Review*, never at Done.**

| | |
|---|---|
| **Argument** | `<ABC-123>` — the issue you're finishing. Defaults to the one you claimed. |
| **MCP tools** | `list_workflow_states`, `change_issue_state`, `record_run`, `mem_save`, `add_comment`, `release_issue` |
| **Pairs with** | `/hilbana-claim-next` |

The sequence, and nothing advances without step 1 passing:

1. **Verify** — run the DoD's verification command (`verifyCommand` / `agentContext`).
   If it fails, don't move the issue to In Review: fix it, or close as a failure.
2. **In Review** — the soft gate. If your board has no such state, it closes to Done
   and says so in the comment.
3. **`record_run`** — always, including `failure`/`cancelled`. Feeds the run history
   and the human-vs-agent metrics. **Don't report tokens here**: the hook measures
   spend from the transcript; hand-estimating it corrupts the data.
4. **`mem_save`** — the durable lesson (a decision, a root cause, a convention).
5. **`add_comment`** — what you did, how you verified it, notes for the reviewer.
6. **`release_issue`** — always, including when you abort.

On failure it still comments, still records the run and still releases; the issue goes
back to *Todo* (or stays In Progress with a clear note on where you got stuck).

The PR is left **unmerged** on purpose — merging is the reviewer's job.

### `/hilbana-review`

**The reviewer.** Takes what workers left In Review and decides.

| | |
|---|---|
| **Argument** | `[ABC-123 \| projectId]` — one issue, or a project to narrow it; empty = the whole In Review queue. |
| **MCP tools** | `list_workflow_states`, `list_issues`, `get_issue`, `list_comments`, `change_issue_state`, `add_comment`, `save_issue` |

1. Find the In Review issues (a `workflow_state` of type `started`).
2. Load the issue: `agentContext` (DoD + verification command), the last `record_run`
   (its `commitRef` is the sha or PR) and the worker's closing comment.
3. Verify: run the command, read the **diff** — does it do what the issue asked and
   **only** that? — and check **every** DoD criterion.
4. Resolve: **Done** with an approval comment, or back to **In Progress** with
   actionable feedback. Optionally `save_issue { agentReady: true }` to return it to
   the queue.

Its rules are worth knowing as a user, because they're what makes reviews auditable:
**leave a comment on both paths**, make returned feedback specific enough to act on
(which criterion failed and how to reproduce it), and **don't rewrite the work
yourself** — small fixes aside, the default is to return it.

### `/hilbana-plan`

**The orchestrator: a goal-to-graph compiler.** Turns an epic, a milestone or a plain
text goal into an executable DAG of sub-issues.

| | |
|---|---|
| **Argument** | `<epic identifier \| milestone id \| goal in plain text>` |
| **MCP tools** | `mem_context`, `list_docs`, `get_doc`, `claim_issue`, `get_issue`, `save_issue`, `link_issues`, `add_comment` |

The framing it works from: **`/plan` is the compiler**, the tracker is the
**scheduler** (`agentReady` + `blocked_by` decide what's runnable now), and the
workers are a **work-stealing pool**. Parallelism equals the width of the DAG's
frontier.

1. **Load context** — memory, plus any project docs (they outrank the command).
2. **Decompose the current milestone**, not the whole epic — hybrid planning, with
   replanning at checkpoints and a human in the loop. Each sub-issue gets a full DoR
   in its `agentContext`: objective in one sentence, relevant files plus **declared
   "touched areas"**, explicit DoD, verification command, dependencies.
3. **Build the DAG** with `link_issues` — **logical dependencies only**.
4. **Queue the frontier**: `agentReady: true` on leaves that have a complete DoR and
   no open blockers.
5. **(Phase 2) Drive waves** of workers in isolated worktrees, then checkpoint.

The distinction that matters most here, and the one people get wrong:

- **Logical dependency** (B needs A's result) → a persisted `blocks` edge.
- **File overlap** (A and B both touch `service.ts`, in no particular order) →
  **mutual exclusion in your scheduler** (different waves), **not** an edge. An edge
  there is a design bug: it implies a permanent dependency and would pull B out of the
  queue even for an independent worker.

Two operational notes: `agentReady: true` **doesn't apply on create** — set it in a
second `save_issue` call; and re-running `/plan` on the same epic **doesn't duplicate
children** (it reads `subIssues`, creates only what's missing and fills DoR gaps).

### `/hilbana-trabajar-issue`

**Work one specific issue end to end**, with live multi-agent coordination.

| | |
|---|---|
| **Argument** | `<ABC-123>` — the issue identifier. Asks if empty. |
| **MCP tools** | `claim_issue`, `get_issue`, `list_docs`, `get_doc`, `list_workflow_states`, `change_issue_state`, `add_comment`, `list_members`, `release_issue` |

`claim_issue` → `get_issue` (+ docs) → *In Progress* → implement, commenting at
milestones → verify the DoD → final state → `release_issue`.

Unlike the worker flow, **this one does close to Done**. Use it when you're driving a
single task deliberately; use `/hilbana-claim-next` + `/hilbana-finish` when you're
draining a queue under the review gate.

It doubles as a tour of the UI: the claim lights up a green 🤖 *"in progress by …"*
badge on the issue card and in the list (synced live by Zero), each `add_comment`
appears in the thread interleaved with `issue_events`, and the badge disappears the
moment you release. A **409** on claim means another agent has it — don't work it.

### `/hilbana-crear-docs`

**Bootstrap a project's documentation in Hilbana**, from your repo plus an interview.

| | |
|---|---|
| **Argument** | `[target project: name or id]` — resolved or created if missing. |
| **MCP tools** | `list_projects`, `save_project`, `list_docs`, `save_doc` |

1. **Read the local context** in priority order: `CLAUDE.md`, `README.md`,
   `package.json` (or equivalent), then the top-level layout and config files.
2. **Interview you about the gaps only** — no fixed questionnaire. If `CLAUDE.md`
   already fixes the stack, it won't ask about the stack.
3. **Resolve or create the project**, and check existing docs so it updates rather
   than duplicates.
4. **Draft in the chat.** It does **not** call `save_doc` until you approve.
5. **Write**, then confirm.

Its guardrails: **don't invent** (only what's in the files or what you confirmed),
**be surgical** (2–3 useful docs beat ten empty templates), and **no secrets** — if a
credential shows up in an env file, it's referenced by variable name, never by value.

### `/hilbana-memoria-switch`

**Move your agent memory from engram to Hilbana.** Guided, non-destructive.

| | |
|---|---|
| **Argument** | `[base url]` — optional, defaults to `https://app.hilbana.com`. |
| **MCP tools** | `mem_save`, `mem_search`, `mem_context` |

The point it makes first: **there's no new MCP server to install.** The memory tools
live in Hilbana's MCP, which this plugin already registers.

1. **Verify** the tools load, with a non-destructive smoke test on the current repo
   (save → search → context).
2. **Run both side by side** during the transition — they're separate stores and don't
   interfere.
3. **Retire engram** when you no longer reach for it: disable its plugin/hook in your
   Claude Code config, and keep `~/.engram/engram.db` until you've migrated what you
   want.
4. **(Optional) Import history** — engram's `project` maps 1:1 to Hilbana's `scope`.

It won't touch engram on its own: disabling a plugin and especially deleting
`engram.db` are shown to you as steps, never executed for you.

---

## Skills

Skills aren't invoked; Claude loads them when the work matches. You'll see them listed
in `/plugin details hilbana@hilbana`.

### `hilbana-mcp`

Reference for **all 28 MCP tools**, grouped by purpose, with when to reach for each
and worked examples. Loads whenever you operate on Hilbana issues, projects, docs,
comments or multi-agent coordination.

| Group | Tools |
|-------|-------|
| **Read** | `get_issue`, `list_issues`, `search_issues`, `list_projects`, `list_comments` |
| **Discovery** (resolve ids before writing) | `list_workflow_states`, `list_members`, `list_labels`, `list_milestones`, `list_cycles` |
| **Context** (project docs) | `list_docs`, `get_doc`, `save_doc` |
| **Write** | `save_issue`, `change_issue_state`, `add_comment`, `link_issues`, `unlink_issues`, `save_project` |
| **Orchestration** (soft lock) | `next_ready_issue`, `claim_issue`, `release_issue`, `record_run` |
| **Memory** | `mem_search`, `mem_context`, `mem_get`, `mem_save`, `mem_session_summary` |

The concepts it makes explicit, and the ones that bite if you don't know them:

- **The `ABC-123` identifier isn't a stored string** — it's `teams.key` +
  `issues.number`. Tools accept it as `id` anyway.
- **Status is a `workflow_state` row.** Names are free-form per team, but logic keys
  off its `type` (backlog/unstarted/started/completed/canceled). To change state you
  need the `stateId`, not the name → `list_workflow_states`.
- **`agentContext`** is the per-issue markdown field written for agents: files,
  verification command, DoD, notes.
- **Your key's scope decides what exists.** A *read-only* key exposes only the read
  tools; a project-scoped key limits every tool to that project.
- **Never invent ids.** Resolve them with the discovery tools first.
- **`dueDate` is epoch milliseconds**, and `null` clears it.

Frequent mistakes it calls out: changing state by name, forgetting `release_issue`
(the issue stays "in progress" and blocks others), and assuming write tools exist when
your key is read-only.

### `hilbana-memoria`

The **proactive memory protocol**: context that survives across sessions, in **any**
repo — not just projects tracked in Hilbana.

The central concept is the **`scope`**: one project/repo, passed on **every** call,
and it's **the name of the repo folder** (`C:\Projects\hilbana` → `scope: "hilbana"`).
Keep it stable or you split the memory in two. Memory is isolated per **workspace**
(your key's), and is independent of `projects`.

| Tool | For |
|------|-----|
| `mem_context` | Recent memories for the scope, no query — what you load on arrival |
| `mem_search` | Full-text search, ranked by relevance + recency |
| `mem_get` | One memory in full, by id |
| `mem_save` | Save one observation |
| `mem_session_summary` | The end-of-session summary |

`type` is one of `decision` · `bug` · `convention` · `discovery` · `preference` ·
`fact` · `note`.

The protocol is **proactive** — it doesn't wait to be asked. Load context on arrival
(or after a compaction), and save **immediately after**: a decision, a fixed bug
(including the root cause), an established convention, a non-obvious gotcha, a user
preference or constraint, or the user confirming/rejecting an approach. Summarise
before signing off.

Its practices are what keep the store useful rather than noisy: **one observation per
`mem_save`** (never a giant dump), reuse `topic_key` to group a theme, and save what
is **not obvious** — the decisions and the why, not what the repo already says
(structure, git history, `CLAUDE.md`).

---

## Hooks

Hooks run in the harness, not in the model, so they cost you no context. All of them
are **silent by design**: a missing key, a dead endpoint or an unreadable transcript
makes them do nothing rather than break your session. They need **Node 18+** on your
`PATH`; without it they just don't run.

### `SessionStart`

`scripts/session-start.cjs` — computes `scope` from the repo folder name and injects
the memory protocol as context, reminding the agent to load prior context and to save
proactively. It doesn't call the MCP (a hook is a shell command); it only injects the
reminder.

### `Stop` / `SessionEnd` (usage)

`scripts/usage-report.cjs` — reports token spend so it can be billed to the task.

It exists as a hook rather than as something the agent reports because **an LLM
doesn't know what it consumes**; asked to report it, it invents a number. The reliable
figure is in the transcript. So on every `Stop` (and again at session close, for the
last segment) the hook streams the transcript, **deduplicates by `message.id`** — the
same message appears on several JSONL lines and summing per line inflates the total by
roughly 80% — groups by model and posts only what's new since the last cursor.

**The issue is never sent.** The server decides what to bill by looking at which issue
your key has claimed at that moment. No claim means the spend lands as *unattributed*.
The cursor only advances on a confirmed 200, so an unsent segment is retried rather
than lost.

### `SessionEnd`

`scripts/session-end.cjs` — summarises the session from the transcript and saves it to
Hilbana's memory via `POST /api/memory`. Deterministic: it runs on close, so the
summary doesn't depend on the agent remembering.

**Dry run for both:** `HILBANA_HOOK_DRYRUN=1` prints the payload instead of sending
it. **Tracing:** `HILBANA_HOOK_LOG=1` (or a path) writes a log — worth knowing,
because a silent hook makes a failure indistinguishable from "nothing to do".

## Configuration

Asked for at install time, stored locally by Claude Code:

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `api_key` | **yes** | — | Created under *Settings → API keys*. Format `hil_…`. Marked `sensitive`. ⚠️ Tools **and memory** operate on this key's workspace — use one from the workspace you actually work in. |
| `base_url` | no | `https://app.hilbana.com` | Only for self-hosting, and **without `/mcp`** (the plugin appends it). |

Environment overrides, useful for debugging and CI: `HILBANA_API_KEY`,
`HILBANA_BASE_URL`, `HILBANA_AGENT_NAME`, `HILBANA_HOOK_DRYRUN`, `HILBANA_HOOK_LOG`.

One caveat worth knowing if you self-host: when the `userConfig` interpolation doesn't
reach a hook, the key is recovered from the plugin's credential store — but
`base_url` isn't a secret and isn't stored there, so it falls back to the default.
Export `HILBANA_BASE_URL` in your environment for a self-hosted deployment.

## Tool naming

Installed as a plugin, the MCP tools are namespaced:

```
mcp__plugin_hilbana_hilbana__<tool>      # e.g. …__mem_context, …__next_ready_issue
```

If you registered the MCP by hand instead, they're `mcp__hilbana__<tool>`. The command
and skill bodies refer to them as `mcp__hilbana__<name>` for readability — same tools.

Verify a fresh install with `/plugin list` (→ `hilbana` enabled) and, in a new
session, check the `mem_*` tools exist. Smoke test: ask *"load the memory context"*.

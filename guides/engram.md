# Hilbana + engram

[engram](https://github.com/Gentleman-Programming/engram) is persistent memory for AI
agents: a single Go binary with a local SQLite database (`~/.engram/engram.db`), an MCP
server and a Claude Code plugin. It's by Gentleman Programming, and it's what many of us
use so the agent doesn't start every session from zero.

Hilbana keeps per-project memory with the same tools (`mem_save`, `mem_search`,
`mem_context`, `mem_session_summary`), but on the server and shared across the
workspace, next to the issues, the task queue and review.

The difference in one sentence:

> engram gives **your agent on your machine** a memory. Hilbana puts it where your
> **teammates and their agents** can see it, next to the board.

You don't have to pick one. This guide covers both: running the two side by side while
you decide, and moving over completely if you want to.

## When each one fits

| You want… | Use |
|---|---|
| Memory that is **only yours**, no account, no server, works offline | **engram** |
| What one agent learns to be known by the **rest of the team** next session | **Hilbana** |
| Memory that follows the project across machines and people with no git steps | **Hilbana** |
| Memory tied to **issues**, with a task queue and review | **Hilbana** |
| Your data in a file you fully control | **engram** |

If you work alone on one machine, engram is enough. Hilbana starts to pay off once
there's more than one person, more than one machine, or when you want memory to live
next to the tasks.

## They're closer than they look

The model is the same, so switching is cheap:

| engram | Hilbana |
|---|---|
| `project` (the project name) | `scope` (the repo folder name) |
| `mem_save`, `mem_search`, `mem_context` | the same three, same names |
| `mem_session_summary` | `mem_session_summary` |
| `topic_key` (a stable key for a topic, used to update it) | `topic_key` groups memories on the same topic; to **replace** one, use `replaces` with the old memory's id |
| `type`: `decision`, `bugfix`, `discovery`… | `type`: `decision`, `bug`, `convention`, `discovery`, `preference`, `fact`, `note` |

One trap: engram's `scope` field is **not** Hilbana's `scope`. The equivalent of
Hilbana's `scope` is engram's `project`.

## Option A · Run both at once

You can have both plugins installed. They're separate stores and don't step on each
other.

```bash
# engram, if you don't have it yet
brew install gentleman-programming/tap/engram
engram setup claude-code

# Hilbana: inside Claude Code
/plugin marketplace add hilbana/claude-plugin
/plugin install hilbana@hilbana
```

With both active, the agent sees **two sets of tools** with the same names and different
prefixes (`mcp__plugin_engram_…` and `mcp__plugin_hilbana_hilbana__…`). Tell it which one
rules for what, or it will end up saving the same thing twice. A reasonable split:

- **Hilbana**: what the team should know (decisions, a bug's root cause, repo
  conventions, gotchas).
- **engram**: what only helps you (how you like to work, personal notes).

This is a way of dividing things up, not a sync. **Nothing moves from engram to Hilbana
or back on its own.**

## Option B · Move to Hilbana

The Hilbana plugin ships a command that walks you through it step by step, without
touching anything of yours unasked:

```text
/hilbana:memoria-switch
```

What it does, and what you can do by hand:

1. **Checks Hilbana works in your repo**: saves a test note, searches for it and loads
   it with `mem_context`. If the loop closes, the switch works.
2. **Run both for a few days.** Keep saving to engram too while you check you recover
   what you need from Hilbana. If something's missing, migrate it or save it again.
3. **Retire the engram plugin** once you no longer reach for it: disable it with
   `claude plugin disable engram@engram` (or from `/plugin`). **Keep `~/.engram/engram.db`** until you've migrated
   what you want; deleting it can't be undone.
4. **(Optional) Import the history.**

### Importing the history

engram exports to JSON:

```bash
engram export engram-export.json
```

In version 1.17.0, the one we tried, `engram export` dumps **all** your projects and doesn't
accept `--project` or `--all`. engram's README describes those options, so newer versions may
support them; check that the file only contains what you expect. Whatever the version, the
same approach works: export everything and keep the `project` you care about.

> Two cautions about the export:
> - **The first argument is always the file name.** `engram export --help` or
>   `engram export --project x` don't print help or filter: they create a file called
>   `--help` or `--project` with all your memories.
> - **That file holds all your projects, personal ones included.** Don't upload it anywhere
>   and delete it when you're done.

Hilbana has no bulk-import command: your agent does the migration by reading the JSON
and calling `mem_save` one observation at a time. Ask it like this:

> Read `engram-export.json` and keep only the observations whose `project` is `milindri`.
> For each one, save it to Hilbana with `mem_save`
> using `scope: "milindri"`, the `title` and `content` joined as the content (`mem_save`
> has no title field), the `type` translated per the table and the same `topic_key`.
> Before writing anything, show me a summary: how many there are per type and which scope
> they'd go to. Skip old `session_summary` entries and anything personal or only true on
> my machine.

A type map that works well:

| engram | Hilbana |
|---|---|
| `decision`, `architecture` | `decision` |
| `bugfix`, `bug`, `solution` | `bug` |
| `convention`, `pattern`, `config` | `convention` |
| `discovery`, `learning` | `discovery` |
| `feedback` | `preference` |
| `project`, `reference` | `fact` |
| `manual`, `milestone`, `session_summary` | `note` |

Two tips before importing:

- **Hilbana memory is visible to the whole workspace.** Check that nothing uploads
  absolute paths, local ports, keys or personal preferences. That's the part most worth
  reading in the preview summary.
- **Don't migrate everything out of habit.** A noisy history makes the agent worse. It's
  often better to import only decisions, bugs with their root cause, and conventions.

## What you gain and what you lose

- **You gain:** memory shared across people and machines, tied to issues and the task
  queue; `replaces` so each fact has a single version.
- **You lose:** working offline with no account, and full control of the file. Hilbana
  keeps memory on its server.
- **Not carried over:** engram's sessions and saved prompts; only the observations.

## Check engram's documentation

engram moves fast. The commands in this guide come from its README and `DOCS.md` at the
time of writing; for anything else, the
[engram repository](https://github.com/Gentleman-Programming/engram) is the source of
truth.

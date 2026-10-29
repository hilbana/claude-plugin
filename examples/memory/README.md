# Memory examples

Hilbana keeps **persistent agent memory** per project, in the same database and the
same MCP server as your issues. These are six realistic examples of what a good memory
looks like, one per `type`. The project (`acme-shop`) is invented; the shape is real.

A memory is one call to `mem_save`:

```json
{
  "scope": "acme-shop",
  "git_remote": "https://github.com/acme/acme-shop.git",
  "type": "decision",
  "topic_key": "pricing",
  "content": "…"
}
```

| Field | What it does |
|-------|--------------|
| `scope` | The project: the **name of the repo folder**. Same repo, same scope, every session. |
| `git_remote` | The `git remote get-url origin` URL, without credentials. It lets a teammate who cloned the repo in a differently named folder land in the same scope. |
| `type` | `decision` · `bug` · `convention` · `discovery` · `preference` · `fact` · `note` |
| `topic_key` | Optional. Groups memories about the same topic so they are easy to find later. |
| `replaces` | Optional. The id of an older memory this one makes obsolete; the old one is deleted in the same step. |

## The examples

| File | Type | What it shows |
|------|------|---------------|
| [01-decision.md](01-decision.md) | `decision` | Save the **why**, not just the what. |
| [02-bug-root-cause.md](02-bug-root-cause.md) | `bug` | Save the root cause of a fix, so nobody re-investigates it. |
| [03-convention.md](03-convention.md) | `convention` | A rule the repo doesn't state anywhere else. |
| [04-discovery.md](04-discovery.md) | `discovery` | A non-obvious gotcha, found the hard way. |
| [05-preference-and-replace.md](05-preference-and-replace.md) | `preference` | A user preference, and how to **replace** a memory instead of contradicting it. |
| [06-session-summary.md](06-session-summary.md) | `note` | The end-of-session summary: goal, results, next steps. |

## Rules of thumb

- **One observation, one `mem_save`.** Atomic memories are searchable; a giant dump isn't.
- **Save what the repo doesn't already say.** Decisions and their reasons, yes. File
  structure, git history or what's in `CLAUDE.md`, no.
- **Memory is shared by the team.** Don't save absolute paths, local ports, machine
  names or personal setup: they only confuse the next person.
- **Never save secrets.** No keys, tokens or passwords, even "temporary" ones.
- **Correct, don't contradict.** If something saved is now wrong, use `replaces`.
- **Search before you save** (`mem_search`) when you suspect it's already there.

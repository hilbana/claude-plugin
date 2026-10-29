# Hilbana + Beads

[Beads](https://github.com/gastownhall/beads) (`bd`) is a distributed graph issue
tracker for AI agents, built on Dolt: it gives **your agent** a persistent, structured
memory of its own work inside a repo. Hilbana is a hosted tracker where **people and
agents share one board**, with claiming, review and a trail of who did what.

They solve neighbouring problems, not the same one:

> Beads gives your agent memory. Hilbana gives your **team** memory, with a board,
> review and traceability.

You can use either alone. This guide is for using both without duplicating work.

> **There is no automatic sync between Beads and Hilbana.** Nothing here moves an issue
> from one to the other by itself. What follows is a way of dividing the work, not an
> integration.

## When to use which

| You want… | Use |
|---|---|
| The **team** to see what's planned, who has it, and what's waiting for review | **Hilbana** issues |
| An agent to **claim** work so two agents don't take the same task | **Hilbana** (`claim_issue`, `next_ready_issue`) |
| Review and approval of what an agent did, with a comment trail | **Hilbana** (`finish` → In Review → `review`) |
| The agent's own **step-by-step plan** inside one task, with dependencies between its steps | **Beads** (`bd create`, `bd dep add`, `bd ready`) |
| Work that lives only in the repo, offline, with no hosted tool involved | **Beads** |
| Facts about the project that **everyone** (and every agent) should know next session | **Hilbana** memory (`mem_save`) |

A simple rule: **the unit the team cares about is a Hilbana issue; the steps an agent
takes to finish it can be Beads tasks.**

## A workflow that uses both

1. **Claim the Hilbana issue** (`/hilbana:claim-next`, or `/hilbana:trabajar-issue ABC-123`).
   Read its description, `agentContext` and definition of done.
2. **Break it down locally, if it's big.** In the repo:

   ```bash
   bd create "Add the CSV export endpoint" -p 1
   bd create "Column picker in the UI" -p 1
   bd dep add <ui-task-id> <endpoint-task-id>   # the UI waits for the endpoint
   bd ready                                      # what has no open blockers
   bd update <id> --claim                        # take one, atomically
   ```

3. **Work.** Close Beads tasks as you finish them (`bd close <id>`). They are the
   agent's scratchpad; nobody else needs to read them.
4. **Close the loop in Hilbana.** `/hilbana:finish` verifies the definition of done,
   leaves the issue in the state your workspace chose, records the run, comments for the
   reviewer and releases the lock. Put the *outcome* in that comment, not the list of
   Beads steps.
5. **Save what's worth keeping** with `mem_save`: the decision and its reason, the root
   cause of a bug, the gotcha. That is what the next agent, and your teammates, will
   need.

## One memory, not two

Both tools can remember things (`bd remember "…"` in Beads, `mem_save` in Hilbana). To
avoid saying everything twice and having the two versions drift apart:

- **Pick one place per kind of fact.** Project knowledge the team shares → Hilbana
  memory. A note only useful to the agent mid-task → Beads.
- Hilbana's memory lives on the server, so it follows the project across machines and
  people without any git step. Beads keeps its data in the repo's `.beads/` folder (Dolt)
  and syncs through git, with `bd dolt push` and `bd dolt pull`.
- When you correct something in Hilbana memory, use `replaces` so there's only one
  version.

## Setting both up for Claude Code

```bash
# Hilbana: plugin (MCP + memory hooks + commands)
/plugin marketplace add hilbana/claude-plugin
/plugin install hilbana@hilbana

# Beads: install and initialise it in the repo
brew install beads          # or: npm install -g @beads/bd
bd init
bd setup claude             # hooks and settings for Claude Code
```

`bd init` can create or update `AGENTS.md`. If you also use the
[starter snippet](../prompts/README.md#8--snippet-for-agentsmd--claudemd), keep the two
sections side by side and make sure they don't contradict each other about where tasks
and memory live.

## Check Beads's own docs

Beads moves fast. Commands, flags and storage details in this guide come from its README
at the time of writing; for anything beyond this, the
[Beads repository](https://github.com/gastownhall/beads) is the source of truth.

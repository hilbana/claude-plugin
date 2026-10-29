# Starter prompts

Prompts to paste into Claude Code (or any MCP client connected to Hilbana) at the
moments that matter. Each one has an English version and a Spanish one; Claude replies
in the language you write in.

> The commands (`/hilbana:…`) come with the [plugin](../README.md). If you connected
> Hilbana as a plain MCP server, the same flows exist as MCP prompts
> (`claim_next`, `finish`, `review`, …) that your client lists under its prompts.

- [1 · First session in a repo](#1--first-session-in-a-repo)
- [2 · Take the next task](#2--take-the-next-task)
- [3 · Work one specific issue](#3--work-one-specific-issue)
- [4 · Plan a goal into issues](#4--plan-a-goal-into-issues)
- [5 · Save what we've learned](#5--save-what-weve-learned)
- [6 · Close the session](#6--close-the-session)
- [7 · Move from engram](#7--move-from-engram)
- [8 · Snippet for `AGENTS.md` / `CLAUDE.md`](#8--snippet-for-agentsmd--claudemd)

---

## 1 · First session in a repo

Loads what earlier sessions learned, so the agent doesn't start from zero.

**EN**

```text
Load this repo's memory with mem_context (scope = the name of this repo's folder, and
pass git_remote). Then, if I tell you a topic, run mem_search on it before touching
anything. Tell me in three lines what you already know about this project.
```

**ES**

```text
Carga la memoria de este repo con mem_context (scope = el nombre de la carpeta del repo,
y pasa git_remote). Después, si te digo un tema, ejecuta mem_search antes de tocar
nada. Dime en tres líneas qué sabes ya de este proyecto.
```

With the plugin installed, a `SessionStart` hook does the reminder for you; this prompt
is for when you want to be explicit or you're using the MCP without the plugin.

## 2 · Take the next task

Pulls the next issue ready for an agent from the queue, already claimed.

```text
/hilbana:claim-next
```

Narrow it to one project with `/hilbana:claim-next <projectId>`. If the queue is empty
it says so and exits cleanly, with nothing locked.

## 3 · Work one specific issue

**EN**

```text
/hilbana:trabajar-issue ABC-123
```

**ES**: igual, con el identificador de tu issue. The command claims the issue, loads its
context, and leaves it in the state your workspace chose when you're done.

## 4 · Plan a goal into issues

Turns a goal into a graph of sub-issues with definitions of done, and queues the ones
that can start now.

**EN**

```text
/hilbana:plan Add CSV export to the reports page, with a column picker and a size limit
```

**ES**

```text
/hilbana:plan Añadir exportación a CSV en la página de informes, con selector de columnas y límite de tamaño
```

You can also pass an epic's identifier (`/hilbana:plan ABC-100`) or a milestone id.
Review the proposed graph before accepting it: it's cheaper to fix a plan than the work
it spawned.

## 5 · Save what we've learned

Use it mid-session, when something worth keeping just happened.

**EN**

```text
Save to memory what we just settled. One mem_save per observation, with the right type
(decision, bug with its root cause, convention, discovery or preference) and the reason,
not only the outcome. Don't save paths, ports or anything that only works on my machine,
and never a secret. If it replaces something already saved, use replaces.
```

**ES**

```text
Guarda en memoria lo que acabamos de acordar. Un mem_save por observación, con el type
correcto (decision, bug con su causa raíz, convention, discovery o preference) y el
porqué, no solo el resultado. No guardes rutas, puertos ni nada que solo valga en mi
máquina, y nunca un secreto. Si sustituye algo ya guardado, usa replaces.
```

See [examples/memory](../examples/memory) for what each type looks like.

## 6 · Close the session

**EN**

```text
Before we stop: if you've claimed an issue, run /hilbana:finish. Otherwise call
mem_session_summary with the goal, what we did, the next steps and the files involved.
Then tell me what's left open.
```

**ES**

```text
Antes de parar: si tienes una issue reclamada, ejecuta /hilbana:finish. Si no, llama a
mem_session_summary con el objetivo, lo que hicimos, los próximos pasos y los archivos
implicados. Y dime qué queda abierto.
```

`/hilbana:finish` verifies the definition of done first, then leaves the issue in its
closing state, records the run, saves memory, comments for the reviewer and releases the
lock. It always releases, failures included.

## 7 · Move from engram

```text
/hilbana:memoria-switch
```

It walks through running engram and Hilbana side by side, moving your history over, and
retiring engram when you're ready.

## 8 · Snippet for `AGENTS.md` / `CLAUDE.md`

For clients without the plugin hooks (Cursor, Codex, …), paste this into the file your
agent reads on start:

```markdown
## Hilbana

- Hilbana is connected as an MCP server. Tasks live there, not in markdown plans.
- At the start of every session, load memory: `mem_context` with `scope` = the name of
  this repo's folder, passing `git_remote` (the `git remote get-url origin` URL, with no
  credentials).
- Before working on an issue, **claim it** (`claim_issue`) and read it fully
  (`get_issue`: description, `agentContext`, `definitionOfDone`, comments). If the claim
  fails because another agent has it, stop and say so.
- Save with `mem_save` right after a decision, a fixed bug (with its root cause), a
  convention or a non-obvious discovery. One observation per call. Never save secrets,
  absolute paths or anything that only works on your machine.
- When you finish an issue: check its definition of done, leave it in the state the
  workspace chose (`agentCloseState`), `record_run`, comment for the reviewer, and
  `release_issue` (always, even on failure).
- Before you stop: `mem_session_summary`.
```

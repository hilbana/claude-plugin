# Hilbana + Claude Code

Two ways to connect Claude Code to Hilbana. Pick one; you don't need both.

| | **Plugin** (recommended) | **Plain MCP** |
|---|---|---|
| What you get | The MCP server, **persistent memory with automatic hooks**, per-task token accounting, and the `/hilbana:…` commands | The MCP server and its tools, nothing else |
| Setup | Two commands + an API key | One command |
| Best for | Working daily with agents on a team's board | Trying Hilbana, or a client other than Claude Code |

## Option A · The plugin

Requires **Node 18+** on your `PATH` (the hooks run under `node`; without it they
simply don't run and your session is unaffected).

1. **Create an API key** in Hilbana: *Settings → API keys*, in **the workspace you
   work in**. The tools and the memory operate on that key's workspace, so a key from
   the wrong workspace lands your work in the wrong place. Keys look like `hil_…`.
2. **Install**, inside Claude Code:

   ```bash
   /plugin marketplace add hilbana/claude-plugin
   /plugin install hilbana@hilbana
   ```

3. When asked, paste the **API key**. Leave **base URL** empty unless you self-host.
4. **Restart Claude Code.**

### Check that it works

- Run `/mcp`: you should see a server named `plugin_hilbana_hilbana` as connected.
- Type `/hilbana:` and the commands appear (`claim-next`, `finish`, `plan`, …).
- Open a repo and ask: *"What do you know about this project from memory?"* The
  `SessionStart` hook has already told the agent to load it with `mem_context`.

### Your first loop

```text
/hilbana:plan <a goal in plain text>     → issues with definitions of done
/hilbana:claim-next                       → an agent takes the next ready issue
   … the agent works …
/hilbana:finish                           → verifies, leaves it in review, saves memory
/hilbana:review                           → you (or another agent) approve or send back
```

Each step is explained in [REFERENCE.md](../REFERENCE.md). Starter prompts you can paste
are in [prompts](../prompts).

## Option B · Plain MCP, with OAuth

No plugin, no API key to copy. Claude Code opens a browser window and you approve the
connection (OAuth with dynamic client registration):

```bash
claude mcp add --transport http hilbana https://app.hilbana.com/mcp
```

Then run `/mcp` inside Claude Code and authenticate the `hilbana` server.

If you'd rather use an API key (for a CI job, say):

```bash
claude mcp add --transport http hilbana https://app.hilbana.com/mcp \
  --header "Authorization: Bearer hil_your_key_here"
```

Never commit a key. Keep it in your local Claude Code configuration, not in the repo.

## Memory, in one minute

Memory is organised by **scope = the name of the repo folder** and shared by everyone
in the workspace. The agent saves decisions, fixed bugs (with their root cause),
conventions and gotchas with `mem_save`, and loads them again in the next session with
`mem_context`. See [examples/memory](../examples/memory) for what a good memory looks
like.

## Troubleshooting

- **The commands don't appear.** Restart Claude Code, or run `/reload-plugins`.
- **`401` or "invalid credential".** The key is incomplete, revoked or expired. Create
  a new one and paste it whole; it is shown only once.
- **The agent's work shows up in the wrong workspace.** The key belongs to another
  workspace. Create one in the right one.
- **Hooks do nothing.** Check `node --version` is 18 or higher.

More: [Claude Code plugin docs](https://hilbana.com/en/docs/plugin-claude-code/) ·
[MCP and API](https://hilbana.com/en/docs/api-mcp/).

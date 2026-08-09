# Hilbana plugin for Claude Code

Official marketplace for the **`hilbana`** plugin for [Claude Code](https://claude.com/claude-code):
persistent per-project agent memory, the human+agent workflow framework, and
[Hilbana](https://app.hilbana.com)'s MCP server auto-registered.

> **Language note:** the commands and skills are written in **Spanish**. They work
> fine whatever language you talk to Claude in — Claude reads them and replies in
> yours — but if you plan to edit them, expect Spanish prose inside.

## Install

```bash
/plugin marketplace add hilbana/claude-plugin
/plugin install hilbana@hilbana
```

Restart Claude Code. On install you'll be asked for your Hilbana **API key**
(format `hil_…`, created under *Settings → API keys* in your workspace) and,
optionally, a **base URL** if you self-host.

## Documentation

- **[REFERENCE.md](REFERENCE.md)** — every command, skill and hook in detail: what
  each one does, its arguments, the MCP tools it uses and the rules it follows. The
  source of truth if you're using the plugin day to day.
- [Plugin README](plugins/hilbana/README.md) — what's included, requirements,
  verification, token accounting and privacy.
- [CHANGELOG](CHANGELOG.md) — what changed in each version.

## What's in here

```
.claude-plugin/marketplace.json   the marketplace (a single entry: hilbana)
plugins/hilbana/                  the plugin: commands, skills, hooks, scripts, MCP
```

## Contributing

Before pushing, run the validator:

```bash
node scripts/validate-plugin.mjs
```

CI runs it on every push and PR, and again as a gate before publishing a release. It
guards the failure mode that bit us once: Claude Code **silently** drops a component
whose frontmatter doesn't parse, so a stray `:` in a `description` can remove a
command with nothing failing anywhere. Hence the rule it enforces — `description` and
`argument-hint` are **always double-quoted** — plus checks on the manifests, the hook
script paths, `node --check` on the hooks, and `REFERENCE.md` staying in sync with the
files.

## Releases

Versions are published as [releases](https://github.com/hilbana/claude-plugin/releases)
and recorded in the [CHANGELOG](CHANGELOG.md). To hear about new ones, set the repo
to **Watch → Custom → Releases**: Claude Code doesn't notify you on its own, it only
surfaces an update when you open `/plugin`.

To update:

```bash
/plugin marketplace update hilbana
/plugin install hilbana@hilbana
```

Then restart Claude Code (or run `/reload-plugins`).

### What counts as patch, minor or major

The `version` field in `plugin.json` is the source of truth: change it on `main` and
the release publishes itself.

| Change | Bump |
|--------|------|
| Fix to a command, skill or hook that doesn't change how you use it | **patch** (1.3.0 → 1.3.1) |
| New command, skill or hook; new opt-in behaviour | **minor** (1.3.0 → 1.4.0) |
| Renaming or removing a command/skill, changing the name or meaning of a `userConfig` field, or anything that forces users to touch their setup | **major** (1.3.0 → 2.0.0) |

A plugin has no API to break, but it does have muscle memory: if someone has
`/hilbana-plan` in their fingers and it disappears, that's a major. That rule is
what made the 2.0.0 release a major: the cycle commands moved to the MCP server.

## Privacy

The plugin contains **no secrets**. Your API key lives only in your local Claude Code
configuration (`userConfig`, marked `sensitive`) and is never published here.

## License

[MIT](LICENSE)

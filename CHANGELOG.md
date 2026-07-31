# Changelog

Notable changes to the `hilbana` plugin. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows the
criteria in the [README](README.md#what-counts-as-patch-minor-or-major).

## [1.4.1] — 2026-07-31

### Added

- **`save_milestone` in the `hilbana-mcp` skill** (30 tools, was 29). Milestones
  could only be created from the UI, so planning an epic from an agent meant asking
  a human to create them and hand over the ids. The tool creates (`projectId` +
  `name`) and updates (`name`, `description`, `targetDate`; `null` clears). It does
  not move a milestone between projects and does not delete — deleting drags the
  assigned issues along and stays UI-only.

### Documented

- **`save_issue`'s `milestoneId`** now says out loud what it does: it puts the issue
  in a milestone of the **same** project (`null` takes it out). Two traps the skill
  now warns about: a milestone from another project is rejected, and changing
  `projectId` clears the milestone unless you pass a new one in the same call.

## [1.4.0] — 2026-07-30

### Added

- **Custom fields in the `hilbana-mcp` skill** (29 tools, was 28). A workspace can
  define its own fields — client, amount, delivery date, invoiced… — and agents can
  now read and write them:
  - `list_custom_fields` joins the discovery group: it returns each field's `id`,
    `name` and `type` (archived ones only with `includeArchived: true`).
  - `save_issue` takes a `customFields: { "<fieldId>": value }` map on create and on
    update; `null` clears a value (which is not the same as `0` or `false`).
  - `get_issue` returns the values already resolved, with name and type, so there is
    no need to cross-reference `list_custom_fields` just to read them.
  - The skill documents the value each `type` expects (epoch ms for `date`, a member
    id for `member`…) and warns that the type is validated against the definition:
    a string in a `number` field fails loudly instead of being stored wrong.
- **Searching by custom fields in `search_issues`.** It is now full-text over the
  text fields too, and it takes `customFields: [{fieldId, op, value}]` to narrow by
  value, combined in AND with the text query (`query: ""` makes it a filtered list).
  The skill documents the operators per type — `empty` means *no value*, so a
  checkbox set to `false` is not `empty` — and notes that results carry each issue's
  `customFields`, so there is no need to fetch them one by one afterwards.

## [1.3.2] — 2026-07-30

### Added

- **CI validation** (`scripts/validate-plugin.mjs`, run by the `Validate` workflow on
  every push and PR, and as a gate before any release). It exists because of the
  1.2.0 bug: Claude Code drops a component with broken frontmatter **silently**, so
  the only way to catch it is to check before publishing. It enforces that
  `description` and `argument-hint` are always double-quoted — a blunt rule that
  kills the whole class of failure instead of guessing when a bare scalar is unsafe —
  and also checks: frontmatter present and parseable, `description` required, no
  unescaped inner quotes, a skill's `name` matching its folder, semver in
  `plugin.json`, all four JSON manifests parsing, hooks pointing at scripts that
  exist, `node --check` on every `.cjs`, marketplace entries resolving to a real
  plugin with a matching name, the current version having a CHANGELOG entry, and
  `REFERENCE.md` neither missing a component nor documenting one that no longer
  exists.

## [1.3.1] — 2026-07-30

### Added

- **`REFERENCE.md`** — full reference for the seven commands, two skills and three
  hooks: what each does, its arguments, the MCP tools it uses and the rules it
  follows, plus the workflow they implement, the configuration fields and the tool
  naming. Linked from both READMEs.

### Fixed

- The `hilbana-mcp` skill claimed **26** MCP tools; the MCP exposes **28**, which is
  also what the skill's own groups added up to. Corrected.

## [1.3.0] — 2026-07-30

### Changed

- Public-facing text is now in **English**: both READMEs, this changelog, the
  marketplace and plugin manifests, the `userConfig` labels shown at install time,
  and every command/skill `description` and `argument-hint`.
- The body of the commands and skills stays in **Spanish** on purpose. Those files
  are prompts that steer how agents behave, full of precise caveats; a mechanical
  translation would risk changing behaviour in ways no test would catch. The
  Spanish is flagged in the manifests and the README so nobody is surprised.

## [1.2.0] — 2026-07-30

### Added

- The plugin now lives in its own public repository, `hilbana/claude-plugin`. It used
  to sit inside the private application repo, which meant nobody outside could
  complete the documented install.
- `LICENSE` (MIT), which `plugin.json` already declared.

### Fixed

- **`/hilbana-finish` and `/hilbana-review` were never loading.** Their frontmatter
  `description` contained `: ` in a plain scalar (`del framework: verifica`,
  `y decide: cierra`), which opens a mapping in YAML and breaks parsing. Claude Code
  loaded 7 of the 9 components, and the two missing ones were exactly half of the
  framework cycle: the worker had no way to finish and the reviewer didn't exist.
- The `SessionStart` hook told the agent its tools were prefixed
  `mcp__plugin_hilbana-memory_hilbana__…`, inherited from the deprecated
  `hilbana-memory` plugin. The real prefix is `mcp__plugin_hilbana_hilbana__…`, so
  the memory reminder pointed at tools that didn't exist, every session.
- The API key format in `plugin.json` said `mil_…`; it is **`hil_…`**. The same typo
  was in the `hilbana-mcp` skill.
- Five references to `/hilbana-mcp-install`, a command that doesn't exist.
- `/hilbana-plan` told the agent to `get_doc` a UUID from a private workspace, which
  no external user could open. It now uses plain `list_docs` + `get_doc`.

### Changed

- Docs and examples no longer carry internal references: example identifiers are
  generic (`ABC-123`) and the memory `scope` is described as the repo folder name.

## [1.1.0] — 2026-07-27

### Added

- Per-task token accounting: `Stop`/`SessionEnd` hooks that read the transcript,
  deduplicate by `message.id` and report to `POST /api/agents/usage`.

### Fixed

- The hooks started with an empty API key whenever the `userConfig` interpolation
  didn't arrive (reproduced on Windows). They now fall back to the plugin's
  credential store; without it, neither token reporting nor memory saving ever ran —
  and did so silently.

## [1.0.0]

### Added

- The all-in-one plugin, consolidating the former `hilbana-memory` and
  `hilbana-agents` into one: MCP auto-registered, per-project memory with load/save
  hooks, the cycle commands, and the `hilbana-mcp` and `hilbana-memoria` skills.

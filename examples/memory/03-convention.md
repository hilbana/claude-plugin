# 03 · A convention the repo doesn't state

**Type:** `convention` · **When to save it:** when you establish or discover a pattern
that a newcomer would otherwise break.

```json
{
  "scope": "acme-shop",
  "type": "convention",
  "topic_key": "migrations",
  "content": "Database changes go through generated migrations only (`pnpm db:generate`), never hand-edited SQL, except for triggers and statement ordering that the generator can't express. The schema file is the single source of truth: if you change the model, change it there and regenerate. A migration the schema doesn't reflect will be rejected in review."
}
```

## Why this is a good memory

- It states the **rule and its exceptions** in a few lines.
- It tells the agent **where the truth lives** (the schema file), which prevents the
  classic "edit the database by hand" drift.
- It is the kind of thing that sits in someone's head and never in a README.

## What would make it a bad one

- *"We use TypeScript."* The repo already says so.
- Conventions that only apply to you. If it's a personal habit, it's a `preference`.

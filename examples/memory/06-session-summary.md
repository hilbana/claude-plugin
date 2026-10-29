# 06 · The end-of-session summary

**Tool:** `mem_session_summary` · **When to call it:** before saying "done", at the end
of every working session.

```json
{
  "scope": "acme-shop",
  "git_remote": "https://github.com/acme/acme-shop.git",
  "summary": "Goal: stop duplicate orders on retried payments.\n\nDone:\n- Found the cause: the payment webhook handler wasn't idempotent (saved as a bug memory).\n- Added a unique constraint on orders.provider_payment_id and an upsert in the handler; tests green.\n- Deployed to staging; two retried payments produced one order each.\n\nNext steps:\n- Backfill: find existing duplicate orders (same provider_payment_id) and merge them.\n- Add an alert when the handler sees a replayed event.\n\nFiles: src/payments/webhook.ts, migrations/0042_orders_unique_payment.sql"
}
```

## Why this is a good memory

- **Goal, done, next steps, files.** The four things the next session needs to pick up
  the thread without re-reading the whole conversation.
- **Next steps are concrete.** Someone (you tomorrow, or a teammate's agent) can start
  from the list.
- It links to the detailed memories ("saved as a bug memory") instead of repeating them.

## How it fits with the other memories

A session summary is the **index**; the `decision`, `bug`, `convention` and `discovery`
memories saved during the session are the **content**. Save those as they happen, not
at the end: at the end you'll forget half of them.

With the Hilbana plugin installed, a `SessionEnd` hook saves a summary automatically if
you forget, and a `SessionStart` hook reminds the agent to load context
(`mem_context`) when you open the repo.

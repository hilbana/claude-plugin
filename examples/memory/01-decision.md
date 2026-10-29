# 01 · A decision, with its reason

**Type:** `decision` · **When to save it:** right after the team (or you and the user)
settles something that isn't obvious from the code.

```json
{
  "scope": "acme-shop",
  "type": "decision",
  "topic_key": "pricing",
  "content": "Prices are stored in integer cents, never as floats, and converted only at the edge (API serialisation and the UI). Reason: the 2026-03 refund bug came from summing floats across line items. Do not add a `price` decimal column; use `price_cents`."
}
```

## Why this is a good memory

- It records **the reason** ("the refund bug came from summing floats"), which is the
  part nobody can reconstruct from the code later.
- It says **what not to do** (`price` decimal column), so the next agent doesn't
  "improve" it back.
- It is one decision, with a `topic_key` so related memories group together.

## What would make it a bad one

- *"We use cents."* No reason, no consequence: it can't be defended or revisited.
- Pasting the whole discussion. Save the conclusion and the one-line why.

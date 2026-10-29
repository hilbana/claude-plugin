# 02 · A fixed bug, with its root cause

**Type:** `bug` · **When to save it:** right after you fix something, while you still
know exactly why it broke.

```json
{
  "scope": "acme-shop",
  "type": "bug",
  "topic_key": "checkout",
  "content": "Checkout showed a double charge for retried payments. Root cause: the payment provider retries webhooks, and `handlePaymentSucceeded` was not idempotent, so each retry created a new order row. Fix: unique constraint on `orders.provider_payment_id` and an upsert in the handler (commit a1b2c3d). Symptom to recognise next time: two orders with the same total a few seconds apart."
}
```

## Why this is a good memory

- **Root cause, not just the fix.** The commit already says *what* changed; only the
  memory keeps *why it happened*.
- **The symptom to recognise.** A future agent searching "double charge" or "two
  orders" will find it before opening a new investigation.
- It points at the commit instead of copying the diff.

## What would make it a bad one

- *"Fixed the checkout bug."* Nothing to learn from.
- A stack trace dump. Keep the cause in a sentence; link the commit for the detail.

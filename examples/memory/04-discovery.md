# 04 · A non-obvious discovery (a gotcha)

**Type:** `discovery` · **When to save it:** when something cost you time because it
behaved differently from what you'd expect.

```json
{
  "scope": "acme-shop",
  "type": "discovery",
  "topic_key": "deploys",
  "content": "Adding an environment variable to the secrets file is NOT enough: the container only receives variables listed in the `environment:` block of docker-compose.prod.yml. Symptom: the variable is set in the secrets file but `printenv` inside the container is empty. Always verify with `docker exec <api> printenv VAR` after a deploy."
}
```

## Why this is a good memory

- It records the **symptom** ("set in the file, empty in the container"), which is how
  the problem will present itself the next time.
- It includes **how to verify**, so the next agent can confirm in one command.
- It saves an hour of "why isn't my variable arriving?" for everyone who touches deploys.

## What would make it a bad one

- *"Env vars are tricky."* No symptom, no check.
- A discovery that is already in the official docs of a tool. Save what's specific to
  **your** setup.

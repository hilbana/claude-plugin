# 05 · A preference, and replacing a memory instead of contradicting it

**Type:** `preference` · **When to save it:** when the user tells you how they want
things done, or rejects an approach.

## Saving the preference

```json
{
  "scope": "acme-shop",
  "type": "preference",
  "topic_key": "workflow",
  "content": "The user wants small, atomic commits with the message format `ACME-123: what changed`. Never squash a branch without asking. For anything touching the data model, present the plan before editing."
}
```

## Changing your mind later: `replaces`

Two weeks later the user says squashing is fine for feature branches. Don't save a
second memory that contradicts the first; **replace** it, using the id returned by
`mem_search` or `mem_context`:

```json
{
  "scope": "acme-shop",
  "type": "preference",
  "topic_key": "workflow",
  "replaces": "<id of the old memory>",
  "content": "The user wants small, atomic commits with the message format `ACME-123: what changed`. Squashing feature branches on merge is fine; squashing anything else needs a question first. For anything touching the data model, present the plan before editing."
}
```

The old memory is deleted in the same step, so there is only one version and it can't
contradict itself.

## Why this matters

- Two memories that disagree make the next agent guess which one is current.
- Memory in Hilbana is shared by the team. A preference about **you** (how you like to
  work) belongs in **your** workspace; one about the project belongs in the project's.

## What would make it a bad one

- A preference with no scope: *"keep it short"*. Short about what? To whom?

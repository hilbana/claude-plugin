---
description: "Shortcut for the review prompt: take Hilbana issues sitting In Review, check them against the DoD and either close to Done or send back with actionable feedback."
argument-hint: "[ABC-123 | projectId]  (one issue or a project; empty = the whole In Review queue)"
---

# /hilbana:review — revisar lo que está En revisión

Atajo del prompt **`review`** que sirve el MCP de Hilbana, para no teclear
`/mcp__plugin_hilbana_hilbana__review`. El protocolo canónico llega en las
`instructions` del servidor; esto solo lo dispara.

Objetivo: `$ARGUMENTS` (una issue, un proyecto, o vacío = toda la cola).

Eres el **revisor**: un worker dejó su trabajo En revisión y no lo cerró.

1. **Encuentra** las issues En revisión (`workflow_state` de type `started`).
2. **Carga** la issue: `get_issue` + `list_comments`, el `verifyCommand`, la DoD y el
   último run (su `commitRef` es el sha o PR).
3. **Verifica de verdad**: ejecuta el comando **y** lee el diff — ¿hace lo que la
   issue pide y **solo** eso? ¿se cumple **cada** criterio del Done?
4. **Resuelve**: Done con comentario de aprobación, o de vuelta a In Progress con
   feedback accionable (qué criterio falla y cómo reproducirlo).

Deja rastro en **ambos** caminos, y no reescribas tú el trabajo: salvo arreglos
pequeños, el patrón es devolver.

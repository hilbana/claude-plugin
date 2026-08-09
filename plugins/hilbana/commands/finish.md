---
description: "Shortcut for the finish prompt: close your turn on a Hilbana issue at In Review (never Done), with record_run, mem_save, a comment for the reviewer and release_issue."
argument-hint: "<ABC-123>  (issue you're finishing; empty = the one you claimed)"
---

# /hilbana:finish — cerrar el turno como worker

Atajo del prompt **`finish`** que sirve el MCP de Hilbana, para no teclear
`/mcp__plugin_hilbana_hilbana__finish`. El protocolo canónico y su detalle llegan en
las `instructions` del servidor; esto solo lo dispara.

Issue: `$ARGUMENTS` (si va vacío, la que tengas reclamada).

Cierra el turno **según el protocolo del framework**, en este orden:

1. **Verifica** el `verifyCommand` de la issue. Sin verde no avanza nada.
2. **Déjala En revisión**, nunca en Done: cerrar es del revisor.
3. **`record_run`** siempre — también en fallo. Sin `tokenCost`: lo mide el hook.
4. **`mem_save`** de lo durable que hayas aprendido.
5. **`add_comment`** para quien revise: qué quedó y cómo lo verificaste.
6. **`release_issue`** siempre, también si abortas.

Si no lograste la DoD: no la dejes En revisión — devuélvela con un comentario que
diga dónde te atascaste, y aun así haz `record_run` (`failure`) y `release_issue`.

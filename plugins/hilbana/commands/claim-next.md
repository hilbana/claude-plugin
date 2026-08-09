---
description: "Shortcut for the claim_next prompt: pull the next agent-ready issue from Hilbana's queue, already claimed, and load its context to start working."
argument-hint: "[projectId]  (narrows the queue to one project; empty = all your teams)"
---

# /hilbana:claim-next — tirar de la cola

Atajo del prompt **`claim_next`** que sirve el MCP de Hilbana, para no teclear
`/mcp__plugin_hilbana_hilbana__claim_next`. El protocolo canónico llega en las
`instructions` del servidor; esto solo lo dispara.

Proyecto: `$ARGUMENTS` (si va vacío, todos tus teams del workspace activo).

Eres un **worker**: no eliges la issue a mano, tiras de la cola.

1. **`mem_context`** con el scope del repo, para no redescubrir convenciones.
2. **`next_ready_issue`** — atómica, y te la entrega **ya reclamada**. Si devuelve
   `null`, la cola está vacía: dilo y sal limpio.
3. **In Progress** si no quedó ya en un estado `started`.
4. **`get_issue`** y muestra el `agentContext`, la DoD y el `verifyCommand` antes de
   empezar. Un `blocked_by` abierto es señal de PARAR: comenta y libera.

Al terminar, cierra con **`/hilbana:finish`**.

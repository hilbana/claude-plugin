---
description: "Pull the next agent-ready issue from Hilbana's queue: next_ready_issue claims it atomically, moves it to In Progress and shows its agentContext/DoD so you can start. A pure queue consumer — no picking issues by hand."
argument-hint: "[optional projectId]  (project UUID to narrow the queue; empty = all your teams)"
---

# Reclamar la siguiente issue lista de Hilbana

Eres un **worker**: no eliges la issue a mano, **tiras de la cola**. El tracker es
el bus de trabajo (framework humano + agente); tú eres un consumidor *pull*. Este
command hace: `next_ready_issue` → `claim_issue` → `change_issue_state` (In
Progress) → `get_issue` para leer el contexto. Al terminar el trabajo, cierra con
`/hilbana-finish`.

Las tools son `mcp__hilbana__<nombre>`; si necesitas el detalle de cada una, carga
la skill **hilbana-mcp**. Si no ves las tools del MCP, revisa la configuración del
plugin (`api_key`) y reinicia Claude Code.

`$ARGUMENTS` es un `projectId` **opcional**: si viene, acota la cola a ese proyecto;
si viene vacío, tira de todos tus teams del workspace activo.

## Antes de empezar (recomendado)

Carga la memoria del scope para no repetir errores ni redescubrir convenciones:

```
mem_context { "scope": "<nombre de la carpeta del repo>" }
```

## Paso 1 — Pedir la siguiente issue lista (pull atómico)

```
next_ready_issue { "projectId": "$ARGUMENTS" }   // omite projectId si va vacío
```

- Devuelve la primera issue **`agentReady`**, **sin lock** (`agentWorkingBy` nulo),
  **no empezada** (backlog/unstarted), **no épica** y **sin blockers abiertos**,
  en orden prioridad + FIFO. La cola es atómica (`SELECT … FOR UPDATE
  SKIP LOCKED`): dos workers que llamen a la vez **no** se llevan la misma issue.
- **La devuelve YA reclamada para ti** (setea `agentWorkingBy` en la misma
  transacción). Es decir, `next_ready_issue` reclama al servir: no hace falta un
  `claim_issue` extra sobre la misma issue.
- **Si devuelve `null` → la cola está vacía.** Informa "no hay issues listas para
  agente" y **sal limpio** (no hay nada que reclamar ni liberar).

## Paso 2 — Confirmar el claim y arrancar

La cola te la entrega desbloqueada y reclamada. Aun así, comprueba el resultado:

- Si `next_ready_issue` devolvió una issue, **ya tienes el lock** (`agentWorkingBy`
  = tú). El badge verde 🤖 "en curso" aparece al instante en la ficha y el listado.
- En el caso poco común de que quieras reclamar explícitamente (p. ej. la obtuviste
  por otra vía), usa `claim_issue { "id": "<id>" }`; si da **409**, ya la tiene otro
  agente → vuelve al Paso 1 para pedir la **siguiente** (la cola saltará la que ya
  esté reclamada).

Muévela a **In Progress** (descubre el estado por su `type`):

```
list_workflow_states                       // elige el stateId cuyo type sea "started" (In Progress)
change_issue_state { "id": "<id>", "stateId": "<In Progress>" }
```

> Nota: `next_ready_issue` suele dejar la issue ya en un estado `started` al
> reclamarla (auto-claim). Si `get_issue` muestra `stateType: "started"`, no hace
> falta volver a cambiarla. Si sigue en backlog/unstarted, muévela tú.

## Paso 3 — Cargar el contexto para trabajar

```
get_issue { "id": "<id>" }
```

Lee de la respuesta y **muéstralo** para arrancar:

- **`agentContext`** — archivos relevantes, comando de verificación, definición de
  **Done** (DoD), notas.
- **`description`** (markdown) — el objetivo y los criterios.
- **relaciones** — `blocked_by` / `blocks` / `relates`. La cola ya filtra blockers
  abiertos; si aun así ves un `blocked_by` sin resolver, **para**,
  coméntalo y libera (no improvises la dependencia).

Carga también el contexto de proyecto si lo necesitas (specs, decisiones,
runbooks):

```
list_docs { "projectId": "<projectId de la issue>" }   // projectId sale de get_issue
get_doc  { "id": "<doc relevante>" }
```

## Y ahora, a trabajar

Implementa **solo** lo que pide el `agentContext` (alcance de la issue). Comenta los
hitos con `add_comment`, verifica con el comando de la DoD, y cuando termines cierra
con **`/hilbana-finish`** (deja la issue en *In Review* para el revisor, registra el
run y libera el lock — el worker **no** cierra su propio trabajo a Done).

## Flujo en una línea

`mem_context` → `next_ready_issue` (reclama al servir) → `change_issue_state` (In
Progress) → `get_issue` (agentContext/DoD) → trabajar → `/hilbana-finish`.

## Si algo va mal

- **Cola vacía** (`null`) → informa y sal; no hay lock que soltar.
- **409 al reclamar explícito** → la tiene otro agente; pide la siguiente con
  `next_ready_issue`.
- **`blocked_by` sin resolver** (la cola no debería servirlas) → para, comenta y
  `release_issue`.
- **Abortas a media** → libera con `release_issue` para no dejar el badge colgado.

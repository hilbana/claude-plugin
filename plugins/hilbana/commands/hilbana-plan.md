---
description: "The orchestrator of the human+agent framework. Compiles a goal (epic or milestone) into a DAG of sub-issues with a complete DoR, queues the frontier by setting agentReady, and (phase 2) drives workers in waves inside isolated worktrees until it's done. /plan is a goal-to-graph compiler; the tracker is the scheduler; the workers are a work-stealing pool."
argument-hint: "<epic identifier | milestone id | goal in plain text>"
---

# /hilbana-plan — el orquestador

Vas a compilar `$ARGUMENTS` (una épica, un milestone, o un objetivo en
texto) en un **grafo de sub-issues ejecutable** por los workers de Hilbana, y
opcionalmente **dirigir** su ejecución.

Si tu proyecto tiene docs de metodología o de diseño en Hilbana, **léelos antes de
empezar** (`list_docs` + `get_doc`): mandan sobre lo que dice este command.

Las tools son `mcp__hilbana__<nombre>`; carga la skill **hilbana-mcp** si necesitas
el detalle. Los workers que lances usan `/hilbana-claim-next` + `/hilbana-finish`.

## Encuadre (no lo pierdas de vista)

- **`/plan` = compilador**: objetivo → grafo de tareas con buenas specs.
- **El tracker = scheduler**: `agentReady` + `blocked_by` deciden qué es ejecutable
  *ahora*.
- **Los workers = pool work-stealing**: cada uno roba la siguiente hoja lista, sin
  coordinarse con los demás. El grafo de issues es el **único** bus.
- **Anchura del paralelismo = la frontera del DAG**: cuántas hojas listas hay a la
  vez.

Todo el valor está en producir un buen grafo con buenas specs. Escatimar en la DoR
de cada hoja es lo que hace que un worker "no haga lo que se esperaba".

## Paso 0 — Cargar contexto

```
mem_context { "scope": "<nombre de la carpeta del repo>" }
list_docs { "projectId": "<projectId del objetivo>" }   // specs, decisiones, metodología
get_doc   { "id": "<doc relevante>" }
```

Si `$ARGUMENTS` es una épica, `claim_issue` de la épica y `get_issue` para su
contexto. Lee el código relevante antes de descomponer (no planifiques a ciegas).

## Paso 1 — Descomponer el HITO actual

Planificación **híbrida por hitos**: descompón el hito actual (no toda la épica de
golpe), los workers lo drenan, y **re-planificas en checkpoints** con el humano en
el bucle. Por cada sub-issue, escribe una **DoR completa** en su `agentContext`:

1. **Objetivo** en una frase.
2. **Áreas / archivos** relevantes — y **declara las "áreas tocadas"** (para detectar
   solapes; ver Paso 3). Decláralas a mano.
3. **DoD** explícita (qué es "hecho").
4. **Comando de verificación** (`pnpm typecheck`/`build`/`test:*`).
5. **Dependencias** (`blocked_by`) si las hay.

```
save_issue { "parentId": "<épica>", "teamId": "<...>", "projectId": "<...>",
             "title": "...", "description": "...", "agentContext": "objetivo · áreas/archivos · DoD · comando de verificación",
             "priority": "high" }
```

> **Gotcha conocido:** al **crear** una issue, `agentReady: true` NO se aplica en el
> mismo `save_issue`. Márcalo en una **segunda** llamada:
> `save_issue { "id": "<nueva>", "agentReady": true }` — y solo cuando la hoja
> cumpla DoR y no tenga blockers abiertos (ver Paso 4).

## Paso 2 — Montar el DAG (dependencias LÓGICAS)

Solo las dependencias **lógicas reales** (B necesita el resultado de A) van como
aristas persistidas:

```
link_issues { "fromIssueId": "<B>", "toIssueId": "<A>", "type": "blocked_by" }
```

(`blocked_by` se persiste como `blocks` invertido.)
`link_issues` **no** saca las issues de Backlog (respeta el estado explícito), así
que puedes armar todo el grafo sin arrancar nada.

## Paso 3 — Matiz clave: dependencia lógica ≠ solape de ficheros

- **Dependencia lógica** (orden real) → **arista `blocks` persistida**. Gatea la cola
  de verdad y sobrevive a re-planes.
- **Solape de ficheros** (A y B tocan `service.ts` sin orden lógico) → **exclusión
  mutua en TU scheduler** (van en oleadas distintas), **NO** una arista `blocks`. Una
  arista aquí sería un bug de diseño: implica dependencia permanente y sacaría a B de
  la cola incluso para un worker independiente.

Regla: usa las "áreas tocadas" declaradas para no meter en la **misma oleada** dos
hojas que escriben el mismo fichero. El orden entre ellas es arbitrario.

## Paso 4 — Encolar la frontera

Marca `agentReady: true` (segunda llamada `save_issue`, ver gotcha) **solo** en las
hojas que: (a) tienen DoR completa **y** (b) no tienen `blocked_by` abiertos. Esas
entran en la cola. La cola ya filtra por su cuenta las que tienen blockers sin
resolver, pero el `agentReady` lo marcas tú.

Comenta el **plan** en la épica (`add_comment`) para dejar rastro humano.

## Paso 5 — (Fase 2) Dirigir la ejecución en oleadas

El orquestador-con-sub-agents **es literalmente Workflow/Agent de Claude Code**: el
runtime ya existe, el estado lo pone el MCP. Lee la frontera lista del MCP y haz
fan-out:

1. **Planifica OLEADAS:** agrupa las hojas listas que **NO solapan** en áreas.
2. Por cada oleada, lanza N sub-agents worker con **`isolation: 'worktree'`** (uno
   por issue, con tope de concurrencia). Cada worker corre el contrato cerrado:
   ```
   claim_issue → get_issue → change_state In Progress → implementar en el worktree →
   verificar (comando DoR) → commit + PR → change_state In Review →
   record_run(success, commitRef) → mem_save → release_issue
   ```
   En fallo: comenta el porqué + `record_run(failure)` + devuelve a Todo + `release_issue`.
3. **Espera** a que la oleada aterrice (In Review); recoge `{ issue, estado, rama/PR,
   follow-ups, notas }`.
4. **CHECKPOINT de hito:** incorpora descubrimientos, gestiona fallos, re-planifica el
   siguiente hito (vuelve al Paso 1). El humano revisa los PRs de la oleada entre
   hitos.

Reglas de oro: los workers **nunca se hablan entre sí**; el grafo es la verdad. Cada
worker deja su trabajo en **In Review** (gate blando) — lo mergea la
revisión (`/hilbana-review` o el humano), no el worker.

## Idempotencia (imprescindible para el modo híbrido)

Re-ejecutar `/plan` sobre la misma épica **NO duplica hijos**: primero `get_issue`
de la épica y mira `subIssues`; crea solo los que falten, rellena huecos de DoR y
re-encola la frontera. Nunca dupliques una sub-issue existente por título.

## Manejo de fallos

- **Worker falla (verify KO)** → issue a Todo con comentario; en el checkpoint decides
  re-scope, re-lanzar o **escalar al humano**.
- **Worker descubre un prerequisito** → crea un blocker, lo enlaza (`blocked_by`); su
  issue se vuelve no-lista sola.
- **Colisión en el merge** pese a las áreas declaradas → PRs pequeños + merge
  secuencial en la revisión + reintento del que pierda el merge.

## Flujo en una línea

`mem_context` + `get_doc` → descomponer hito (sub-issues + DoR) → `link_issues`
(deps lógicas) → `agentReady` a la frontera → (fase 2) oleadas de workers en
worktrees → checkpoint → repetir hasta cerrar la épica.

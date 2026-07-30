---
description: El revisor del framework humano+agente. Toma issues de Hilbana en «En revisión», verifica el trabajo contra la DoD (comando de verificación + commit/PR del record_run) y decide: cierra a Done si cumple, o la devuelve a In Progress con feedback accionable. Cierra el ciclo abierto por /hilbana-finish.
argument-hint: "[ABC-123 | projectId]  (issue concreta a revisar, o proyecto para acotar; vacío = todas las de «En revisión»)"
---

# /hilbana-review — revisar el trabajo dejado «En revisión»

Eres el **revisor** (contraparte del gate de revisión): un worker dejó su trabajo en
**«En revisión»** con `/hilbana-finish` y **no** lo cerró a Done. Tú lo compruebas
contra la DoD y decides: **Done** (aprobar) o **devolver** a In Progress con
feedback. El worker nunca cierra su propio trabajo; el cierre lo haces tú (o un
humano).

Las tools son `mcp__hilbana__<nombre>`; carga la skill **hilbana-mcp** si necesitas
el detalle.

`$ARGUMENTS`: el identificador de una issue concreta a revisar, o un `projectId`
para acotar; si va
vacío, revisa la cola de «En revisión».

## Paso 1 — Encontrar issues «En revisión»

El estado «En revisión» es un `workflow_state` de tipo `started` (gate blando).
Descúbrelo y lista lo que hay pendiente de revisar:

```
list_workflow_states                 // localiza el stateId de "In Review" / "En revisión"
list_issues { }                      // (o { projectId }); filtra por ese stateId en el resultado
```

> Si el estado «En revisión» **no existe** en el tablero, no hay cola de revisión:
> los workers cierran a Done directamente. Avísalo y para.

## Paso 2 — Cargar el contexto de la issue elegida

```
get_issue { "id": "ABC-123" }
list_comments { "issueId": "ABC-123" }   // el resumen que dejó el worker para ti
```

Lee: **`agentContext`** (la DoD y el **comando de verificación** / `verifyCommand`),
la `description`, el último **`record_run`** (result + `commitRef` = sha/PR) y el
comentario de cierre del worker. Eso es lo que vas a verificar.

## Paso 3 — Verificar contra la DoD

- Ejecuta el **comando de verificación** de la DoD (`pnpm typecheck`/`build`/`test:*`).
- Revisa el **commit/PR** (`commitRef` del `record_run`): que el diff haga lo que la
  issue pide y **solo** eso (alcance), sin romper nada adyacente.
- Comprueba que se cumple **cada** criterio del **Done** de la issue.

## Paso 4 — Resolver

**Aprobar** (cumple la DoD):
```
list_workflow_states                                   // stateId de "Done" (type completed)
change_issue_state { "id": "ABC-123", "stateId": "<Done>" }
add_comment { "issueId": "ABC-123", "body": "✅ Aprobado. Verificado con <comando> (OK) y revisado el PR/commit <ref>. Cierro a Done." }
```
(Si hay un PR asociado, mergéalo antes o dilo en el comentario para que lo mergee
quien corresponda.)

**Devolver** (no cumple):
```
list_workflow_states                                   // stateId de "In Progress" (type started)
change_issue_state { "id": "ABC-123", "stateId": "<In Progress>" }
add_comment { "issueId": "ABC-123", "body": "↩️ Devuelta. Falta: <qué, accionable>. La verificación <comando> falló en <detalle> / el criterio <X> del Done no se cumple." }
```
Opcional: si quieres que vuelva a la cola para que la retome un worker,
`save_issue { "id": "ABC-123", "agentReady": true }` (marca la cola sin arrancarla).

## Reglas

- **Deja rastro en AMBOS caminos** (apruebas o devuelves): un `add_comment` que diga
  qué verificaste y por qué. La revisión tiene que ser auditable.
- **Feedback accionable al devolver**: no «no funciona», sino qué criterio falla y
  cómo reproducirlo. El worker que la retome debe saber exactamente qué arreglar.
- **No reescribas tú el trabajo**: si es un arreglo pequeño puedes hacerlo, pero el
  patrón por defecto es devolver con feedback y que lo complete un worker.

## Flujo en una línea

listar «En revisión» → `get_issue` + `list_comments` → verificar (comando + PR) →
**Done** (+comentario de aprobación) **ó** In Progress (+feedback accionable).

---
description: "Work a Hilbana issue end to end with live multi-agent coordination (claim → context → work+comment+change state → release), showing the badges as they appear in the UI."
argument-hint: "<ABC-123>  (issue identifier)"
---

# Trabajar una issue de Hilbana con un agente

Vas a llevar la issue `$ARGUMENTS` de Hilbana de principio a fin usando el MCP,
**coordinándote con otros agentes en vivo** (lock blando) y dejando rastro visible
en la UI. Las tools son `mcp__hilbana__<nombre>`; si necesitas el detalle de cada
una, carga la skill **hilbana-mcp**.

`$ARGUMENTS` es el identificador de la issue. Si viene vacío, pregunta al usuario por
él antes de seguir. Úsalo como `id` en todas las llamadas.

## Reglas

- **No te saltes el `claim`/`release`.** El claim es lo que enciende el badge "en
  curso" y evita que otro agente trabaje la misma issue. Si tomas el lock, tienes
  que liberarlo al acabar (o si abortas).
- **Respeta el alcance de la issue.** Lee la descripción y el `agentContext`; no
  salgas de ahí. Si una dependencia no está hecha, para y avisa (comenta y, si hace
  falta, escala) en vez de improvisarla.
- **Deja rastro.** Comenta el progreso y los hallazgos; mueve el estado conforme
  avanzas. La gracia de este flujo es que se ve en tiempo real.

## Paso 1 — Reclamar la issue (enciende el badge)

```
claim_issue { "id": "ABC-123" }
```

- Setea `agentWorkingBy` = tu usuario y `agentWorkingSince` = ahora. Se sincroniza
  por Zero, así que la UI y los demás agentes lo ven **al instante**.
- **Si falla con 409**: ya la está trabajando OTRO agente. No insistas: avísalo al
  usuario y proponle otra issue (o espera y reintenta).
- Para comprobar antes quién la tiene, puedes leer `agentWorking` con `get_issue`.

> **Compruébalo en la UI**: en la **ficha** de la issue y en el **listado** aparece
> ahora un badge verde con icono de robot y tu nombre — tooltip *"En curso por
> &lt;tu nombre&gt;"*. Mientras esté el lock, ahí sigue.

## Paso 2 — Cargar el contexto

```
get_issue { "id": "ABC-123" }
```

Lee de la respuesta: `description` (markdown), **`agentContext`** (archivos
relevantes, comando de verificación, definición de **Done**, notas), estado,
prioridad, asignado, `dueDate`, labels, sub-issues, comentarios previos, actividad
y **relaciones** (`blocks` / `blocked_by` / `relates`). Si hay `blocked_by` sin
resolver, esa es tu primera señal de stop.

Carga también el contexto a nivel de proyecto (especificaciones, decisiones,
runbooks):

```
list_docs { "projectId": "<projectId de la issue>" }   // projectId sale de get_issue
get_doc  { "id": "<doc relevante>" }
```

## Paso 3 — Trabajar dejando rastro en vivo

1. **Mueve la issue a "en progreso"** (descubre el estado primero):
   ```
   list_workflow_states            // elige el stateId cuyo type sea "started"
   change_issue_state { "id": "ABC-123", "stateId": "<In Progress>" }
   ```
2. **Implementa** según `agentContext` (toca solo lo que la issue pide).
3. **Comenta el progreso** en hitos relevantes (no en cada micro-paso):
   ```
   add_comment { "issueId": "ABC-123", "body": "Hecho X. Encontrado Y. Siguiente Z." }
   ```
   Admite markdown y menciones `@[Nombre](user:UUID)` (resuelve el UUID con
   `list_members`).
4. **Verifica** con el comando de Done del `agentContext` antes de cerrar.

## Paso 4 — Cerrar y liberar (apaga el badge)

1. Mueve la issue al estado final:
   ```
   change_issue_state { "id": "ABC-123", "stateId": "<Done / completed>" }
   ```
2. Comentario de cierre con el resultado y cómo se verificó:
   ```
   add_comment { "issueId": "ABC-123", "body": "Done: <qué quedó> · Verificado con <comando>." }
   ```
3. **Libera el lock**:
   ```
   release_issue { "id": "ABC-123" }
   ```
   Limpia `agentWorkingBy`/`agentWorkingSince`. Solo quien reclamó (o un admin)
   puede liberar (si no, 403).

> **Compruébalo en la UI**: el badge verde "en curso" **desaparece** de la ficha y
> del listado en cuanto liberas.

## Cómo verlo en la UI (resumen)

- **Ficha de la issue** (`/issues/...`): tras `claim_issue`, junto al chip del
  identificador `ABC-123` sale el badge verde 🤖 *"En curso por &lt;agente&gt;"*;
  desaparece tras `release_issue`.
- **Listado de issues**: la fila muestra el mismo badge verde con el nombre del
  agente (no es una columna toggleable, es un lock operativo). Aparece/desaparece
  con claim/release y se actualiza solo (Zero).
- **Comentarios**: cada `add_comment` se ve al momento en el hilo/actividad de la
  ficha, intercalado cronológicamente con los `issue_events` (cambios de estado,
  asignado, etc.).
- **Cambios de estado**: cada `change_issue_state` mueve la issue de columna/estado
  y queda registrado en la actividad.
- **Vista "Mi trabajo"** (entrada diaria): el dueño ve sus issues; las que estén
  reclamadas por un agente lucen el mismo badge "en curso", útil para ver de un
  vistazo qué está tocando un agente ahora mismo.

## Flujo en una línea

`claim_issue` → `get_issue` (+ `list_docs`/`get_doc`) → `change_issue_state` (In
Progress) → trabajar + `add_comment` → verificar Done → `change_issue_state`
(Done) → `release_issue`.

## Si algo te bloquea

- **409 en claim** → la tiene otro agente; no la trabajes.
- **`blocked_by` sin resolver** → para, coméntalo, no improvises la dependencia.
- **Spec ambigua** → pregunta antes de asumir; deja la duda en un `add_comment`.
- **Abortas a media** → libera igualmente con `release_issue` para no dejar el badge
  colgado bloqueando a otros.

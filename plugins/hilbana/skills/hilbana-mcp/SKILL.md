---
name: hilbana-mcp
description: "How to drive Hilbana's MCP (self-hosted, Linear-style project tracker). All 30 tools grouped into read / discovery / context / write / orchestration / memory, with when to reach for each and worked examples. Use it whenever you touch Hilbana issues, projects, docs, comments or multi-agent coordination through the mcp__hilbana__* tools. Written in Spanish."
---

# Utilidades del MCP de Hilbana

Hilbana expone su modelo (issues, projects, docs, comentarios, coordinación
multi-agente) por MCP sobre HTTP (30 tools), autenticado con una API key
(`Authorization: Bearer hil_<...>`). El plugin registra el MCP por ti; si no ves
las tools, revisa la `api_key` en la configuración del plugin y reinicia Claude
Code.

Las tools se llaman `mcp__hilbana__<nombre>` (aquí las nombro por `<nombre>`).

## Conceptos que conviene tener claros

- **Identificador `ABC-123`**: NO es un string suelto; sale de `teams.key` +
  `issues.number`. Lo aceptan `get_issue`, `save_issue`, etc. como `id`.
- **Estado = workflow state**: el "status" es una fila de `workflow_states` (nombre
  libre por team), pero la lógica se calcula por su `type`
  (backlog/unstarted/started/completed/canceled). Para cambiar de estado necesitas
  el `stateId`, no el nombre → `list_workflow_states`.
- **`agentContext`**: campo markdown por issue pensado para agentes (archivos
  relevantes, comando de verificación, definición de Done, notas). Se lee con
  `get_issue` y se escribe/edita con `save_issue`.
- **Scope de la key**: si la key es *read-only* solo existen las tools de lectura;
  si está *acotada a un proyecto*, todas las tools quedan limitadas a ese proyecto.
- **Antes de escribir, descubre IDs**: `save_issue`/`change_issue_state` necesitan
  IDs (stateId, assigneeId, labelId, projectId, milestoneId, cycleId). Resuélvelos
  con las tools de descubrimiento; no inventes IDs.

---

## 1) Lectura — consultar el trabajo

| Tool | Para qué | Cuándo |
|------|----------|--------|
| `get_issue` | Contexto **completo** de UNA issue en una sola llamada | Es la tool estrella: úsala al empezar con cualquier issue |
| `list_issues` | Lista issues (filtros opcionales `teamId`/`projectId`) | Panorámica de un team/proyecto |
| `search_issues` | Full-text (identificador, título, descripción, comentarios y campos de texto) + filtros por campo personalizado | Encontrar una issue por palabra clave o acotar por el valor de un campo |
| `list_projects` | Lista projects visibles | Resolver el `projectId`, prueba de humo |
| `list_comments` | Hilo de comentarios de una issue (cronológico) | Leer la discusión sin todo el contexto de `get_issue` |

`get_issue` devuelve mucho: identificador, título, descripción, **agentContext**,
estado, prioridad, asignado, `dueDate`, labels, milestone, cycle, sub-issues,
comentarios, actividad (`issue_events`), adjuntos, relaciones
(blocks/blocked_by/relates) y el lock de trabajo en curso (`agentWorking`,
`agentWorkingBy`, `agentWorkingSince`).

**Ejemplo — arrancar una tarea:**
```
get_issue { "id": "ABC-123" }
// lee description + agentContext (archivos, comando de verificación, Done)
```

**Ejemplo — buscar:**
```
search_issues { "query": "webhooks salientes", "limit": 10 }
```

`search_issues` también **acota por el valor de un campo personalizado** (ver §2),
en AND con la query textual. Con `query: ""` es un listado filtrado. Cada resultado
trae además `customFields` con los valores de esa issue, así que no hace falta
pedirlas una a una después.

```
search_issues {
  "query": "",
  "customFields": [{ "fieldId": "<f2>", "op": "gt", "value": 500 }]
}
// las issues con Importe > 500, con sus campos ya resueltos
```

Operadores por tipo (el `fieldId` sale de `list_custom_fields`):

| Tipo | Operadores | `value` |
|------|-----------|---------|
| `checkbox` | `isTrue`, `isFalse`, `empty` | — |
| `member` | `is`, `isNot`, `empty` | userId |
| `number` | `eq`, `gt`, `lt`, `empty` | número |
| `date` | `before`, `after`, `between`, `empty` | epoch ms (`between` usa `value2`) |
| `text` | `contains`, `empty` | texto |

`empty` es **sin valor**, no "falso": un checkbox en `false` no es `empty`. Un
`fieldId` que no existe da error, no un filtro ignorado en silencio.

---

## 2) Descubrimiento — resolver IDs antes de escribir

Sin estado, no escribes. Estas 6 tools convierten "nombres humanos" en IDs.

| Tool | Devuelve | Lo necesitas para |
|------|----------|-------------------|
| `list_workflow_states` | estados (id, nombre, **type**, team) | `stateId` en `save_issue` / `change_issue_state` |
| `list_members` | miembros (id, nombre, email) | `assigneeId` |
| `list_labels` | labels (id, nombre, color) | `labelIds` / `addLabelIds` / `removeLabelIds` |
| `list_milestones` | milestones (id, nombre, proyecto) | `milestoneId` |
| `list_cycles` | cycles (id, número, proyecto, fechas) | asignar issue a un cycle |
| `list_custom_fields` | campos personalizados del workspace (id, nombre, **type**, orden) | el mapa `customFields` de `save_issue` |

**Patrón típico (crear issue):**
```
list_projects            -> projectId
list_workflow_states     -> stateId del estado "Todo"/"Backlog" (mira el type)
list_members             -> assigneeId (opcional)
list_labels              -> labelIds (opcional)
list_custom_fields       -> fieldId de cada campo propio del workspace (opcional)
// y ya tienes todo para save_issue
```

### Campos personalizados

Un workspace puede definir sus propios campos (cliente, importe, fecha de entrega,
facturado…) desde Ajustes. **Son del workspace, no del proyecto**: un workspace
puede tener diez y otro ninguno. Cinco tipos, y cada uno espera un valor distinto:

| `type` | Valor que espera | Ejemplo |
|--------|------------------|---------|
| `text` | string | `"Acme S.L."` |
| `number` | número (admite decimales y negativos) | `-1234.56` |
| `date` | epoch ms | `1789423200000` |
| `checkbox` | booleano | `true` |
| `member` | id de un miembro del workspace | `"<userId>"` |

- `list_custom_fields` te da los `id`. Por defecto **no** incluye los archivados
  (`includeArchived: true` si los quieres ver).
- Se escriben con `save_issue` y el mapa `customFields: { "<fieldId>": valor }`,
  tanto al crear como al actualizar. **`null` borra el valor** (que no es lo mismo
  que `0` o `false`: es "sin rellenar").
- `get_issue` los devuelve en `customFields`, ya resueltos y con su nombre y tipo,
  así que no tienes que cruzar con `list_custom_fields` para leerlos.
- El tipo se valida **contra la definición**: meter un texto en un campo `number`
  falla con un error claro en vez de guardarse torcido. No adivines el tipo, léelo
  de `list_custom_fields`.
- Para **buscar** por ellos, `search_issues` (ver §1): full-text sobre los campos de
  texto y filtros `customFields: [{fieldId, op, value}]` para el resto.

```
list_custom_fields
// -> [{ "id": "<f1>", "name": "Cliente", "type": "text" },
//     { "id": "<f2>", "name": "Importe", "type": "number" }]

save_issue {
  "id": "ABC-123",
  "customFields": { "<f1>": "Acme S.L.", "<f2>": -1234.56 }
}

save_issue { "id": "ABC-123", "customFields": { "<f1>": null } }   // borra el valor
```

---

## 3) Contexto — documentos de proyecto

Docs de proyecto en markdown: especificaciones, decisiones, runbooks que el agente
lee/escribe. Complementan el `agentContext` por-issue con contexto a nivel de
proyecto.

| Tool | Para qué |
|------|----------|
| `list_docs` | Lista docs (id, título, projectId, position); `projectId` opcional para filtrar |
| `get_doc` | Lee un doc completo (título, body markdown, projectId, fechas) |
| `save_doc` | Crea (sin `id`, `projectId` obligatorio) o actualiza (con `id`) un doc |

**Ejemplo — registrar una decisión de diseño:**
```
list_projects                                 -> projectId
save_doc { "projectId": "<id>", "title": "Decisiones de auth",
           "body": "# Auth\n\n- Sesiones cortadas por sessions_valid_from..." }
```

---

## 4) Escritura — crear y editar trabajo

(No existen si la key es read-only.)

| Tool | Para qué | Notas |
|------|----------|-------|
| `save_issue` | Crea (sin `id`) o actualiza (con `id`) una issue | Sin `id`: `teamId`+`title`+`stateId` obligatorios. Admite `description`, `agentContext`, `assigneeId`, `projectId`, `milestoneId`, `dueDate` (epoch ms), `parentId` (sub-issue), `labelIds`. En update: `addLabelIds`/`removeLabelIds`, `dueDate:null` limpia. `customFields` escribe campos personalizados (ver §2) |
| `change_issue_state` | Mueve una issue de estado | Setea started_at/completed_at/canceled_at según el `type` del nuevo estado |
| `add_comment` | Comenta una issue (markdown) | Admite menciones `@[Nombre](user:UUID)`; autoría = usuario de la key |
| `link_issues` | Relaciona dos issues | `type`: `blocks` / `blocked_by` / `relates`. Idempotente |
| `unlink_issues` | Borra una relación por `relationId` | El `relationId` sale de `get_issue`/`link_issues` |
| `save_project` | Crea un project | Falla si la key está acotada a un proyecto |
| `save_milestone` | Crea (sin `id`) o actualiza (con `id`) un milestone | Al crear: `projectId`+`name`. Edita `name`/`description`/`targetDate` (epoch ms, `null` limpia). NO mueve el milestone de proyecto y NO borra (borrar es solo por UI). Para meterle issues: `save_issue` con `milestoneId` |

**Ejemplo — crear una issue completa para otro agente:**
```
save_issue {
  "teamId": "<team>", "title": "Migrar adjuntos a MinIO",
  "stateId": "<estado Todo>", "projectId": "<proj>",
  "priority": "high", "assigneeId": "<user>",
  "description": "## Objetivo\nSubida de ficheros <=3MB...",
  "agentContext": "Archivos: src/api/attachments.ts.\nVerificar: pnpm test:attachments.\nDone: e2e put/get/delete OK.",
  "labelIds": ["<label backend>"],
  "dueDate": 1750000000000
}
```

**Ejemplo — avanzar de estado + dejar nota:**
```
list_workflow_states                          -> stateId de "In Progress"
change_issue_state { "id": "ABC-123", "stateId": "<id>" }
add_comment { "issueId": "ABC-123", "body": "Empezando: monto la skill y el command." }
```

**Ejemplo — marcar dependencia:**
```
link_issues { "fromIssueId": "ABC-124", "toIssueId": "ABC-123", "type": "blocked_by" }
```

---

## 5) Orquestación — coordinación multi-agente (lock blando)

Cuando varios agentes trabajan a la vez, evita que se pisen. Es un lock **blando**
(distinto del `assignee`): "estoy trabajando esto AHORA". La UI y los demás agentes
lo ven al instante vía `get_issue` (`agentWorking*`).

| Tool | Para qué | Comportamiento |
|------|----------|----------------|
| `next_ready_issue` | **Tirar de la cola**: pide la siguiente issue lista para agente y la reclama de forma atómica | Devuelve la primera issue `agentReady` sin lock ni blockers abiertos (o `null` si la cola está vacía). **La entrega YA reclamada para ti** (no hace falta `claim_issue` después). `projectId` opcional para acotar. Ver "La cola pull" abajo |
| `claim_issue` | Tomar una issue concreta (elegida a mano) para indicar que la trabajas ahora | **Falla (409)** si ya la tiene OTRO agente. Setea agentWorkingBy = tú, agentWorkingSince = ahora |
| `release_issue` | Soltarla al terminar/parar | Solo quien la tomó (o un admin) puede liberar (si no, 403) |
| `record_run` | Registrar el resultado de tu ejecución sobre la issue (historial de runs + métricas de agentes) | `issueId` oblig.; opcionales `result` (`success`/`failure`/`cancelled`), `summary`, `commitRef`, `startedAt`/`finishedAt` (epoch ms). Atribuido al usuario de la key. **No informes tokens**: el consumo lo mide solo el hook del plugin desde el transcript; estimarlo a mano falsea el dato |

Llama a `record_run` **siempre al terminar** (también con `failure`/`cancelled` si
no lo lograste): es lo que puebla el historial de runs de la ficha y las métricas
de agentes. Es independiente del feed de actividad humano.

Comprueba el lock antes de reclamar leyendo `agentWorking` con `get_issue` si
quieres evitar el error.

### La cola *pull* — `next_ready_issue` + `agentReady`

El modelo del **framework de trabajo humano + agente** es *pull*: el worker no
elige la issue a mano, **tira de la cola**. El tracker es el bus de trabajo.

**`next_ready_issue`** es la cola atómica lista-para-agente. Devuelve la primera
issue que cumple **todo**:
- `agentReady = true` (marcada como lista para ejecutar),
- **sin lock** (`agentWorkingBy IS NULL`),
- **no empezada** (estado backlog/unstarted) y **no épica** (issue-padre),
- **sin blockers abiertos** (ningún `blocked_by` en estado no-resuelto; resuelto =
  Done o Cancelada),

en orden **prioridad + FIFO por creación**, con `SELECT … FOR UPDATE SKIP LOCKED`:
dos workers que llamen a la vez **no** se llevan la misma issue. La entrega **ya
reclamada** para ti (setea el lock en la misma transacción) → no necesitas un
`claim_issue` extra. Devuelve `null` si la cola está vacía.

**`agentReady`** es el flag que mete una issue en la cola. Se marca/desmarca con
`save_issue` **sin cambiar el estado** (respeta el estado explícito, no arranca la
issue):
```
save_issue { "id": "ABC-124", "agentReady": true }    // encola (cuando tiene DoR y sin blockers)
```
> **Gotcha:** al **crear** una issue, `agentReady: true` en el mismo `save_issue`
> NO se aplica; márcalo en una **segunda** llamada `save_issue { id, agentReady:true }`.

**Patrón recomendado — worker que tira de la cola (pull + gate de revisión):**
```
mem_context { "scope": "mi-repo" }           // carga memoria del scope
next_ready_issue { }                          // (o { projectId }); null -> cola vacía, parar
// la issue vuelve YA reclamada e In Progress (auto-claim)
get_issue { "id": "<devuelta>" }              // lee agentContext: archivos, verificación, DoD
// ...trabajas en rama; add_comment en hitos...
// verificas con el comando de la DoR
change_issue_state { "id": "<id>", "stateId": "<In Review>" }   // NO a Done: el worker no cierra su trabajo
record_run { "issueId": "<id>", "result": "success",
             "summary": "qué hiciste y cómo lo verificaste", "commitRef": "<sha/PR>" }
mem_save { "scope": "mi-repo", "type": "decision", "content": "..." }
release_issue { "id": "<id>" }                // siempre libera, también en fallo
```

El worker deja la issue en **En revisión** (gate blando) — **no** la
cierra a Done; eso lo hace el **revisor** (el prompt `review` o un humano), que
aprueba a Done o la devuelve a In Progress. Mientras el estado "En revisión" no
exista en un tablero, se cierra a Done como antes.

Estos loops están envueltos en los **prompts que sirve el propio MCP**: `claim_next`
(tira de la cola y arranca), `finish` (deja En revisión + `record_run` + `mem_save` +
libera) y `review` (el revisor cierra o devuelve). En Claude Code se invocan como
`/mcp__<servidor>__<nombre>`. El orquestador `/hilbana-plan` sigue siendo un command
de este plugin.

---

## 6) Memoria — contexto persistente entre sesiones (reemplazo de engram)

Memoria de agentes por **scope** (repo/carpeta) en la misma DB de Hilbana:
decisiones, bugs, convenciones, descubrimientos y resúmenes de sesión que
sobreviven entre sesiones, en **cualquier** repo. El `scope` lo pasa el cliente
como **nombre del proyecto** (el de la carpeta del repo, p.ej. `hilbana`, igual
que engram). Aislada por **workspace** (independiente de `projects`).

| Tool | Para qué | Notas |
|------|----------|-------|
| `mem_search` | Buscar memoria por full-text (relevancia + recencia) | `query`, `scope`, `limit?`; devuelve `snippet`+`score` |
| `mem_context` | Memorias recientes del scope (sin query) | Para cargar contexto al arrancar |
| `mem_get` | Una memoria completa por id (sin truncar) | Acotada al workspace |
| `mem_save` | Guardar una observación | `content`, `type`, `scope`; `topic_key?`/`session_id?`/`metadata?`. No existe si la key es read-only |
| `mem_session_summary` | Resumen de fin de sesión | `scope`, `summary`; es un `mem_save` type=`note`, topic_key=`session-summary` |

`type`: `decision`/`bug`/`convention`/`discovery`/`preference`/`fact`/`note`.

El **protocolo de uso proactivo** (cuándo guardar/recuperar, cómo derivar el
scope, convivencia y switch desde engram) está en la skill **`hilbana-memoria`** y
el command **`/hilbana-memoria-switch`**. Resumen:
```
mem_context { "scope": "hilbana" }              // al arrancar
mem_save    { "scope": "...", "type": "decision", "content": "..." }  // tras decidir/arreglar/descubrir
mem_session_summary { "scope": "...", "summary": "..." }       // al cerrar
```

---

## Flujo completo de un agente (pull + gate de revisión)

El worker es un **consumidor puro de la cola**: tira, trabaja, deja En revisión y
libera. No cierra su propio trabajo a Done — eso lo hace el revisor.

```
1. mem_context { scope }               // carga memoria del scope al arrancar
2. next_ready_issue { }                // cola pull: la siguiente lista, YA reclamada. null -> parar
   // (¿issue concreta a mano? claim_issue { id }; si 409, elige otra)
3. get_issue { id }                    // descripción + agentContext (archivos, verificación, DoD) + blocked_by
4. change_issue_state -> In Progress   // si no vino ya en 'started' por el auto-claim (list_workflow_states -> stateId)
5. ...implementas en rama según agentContext (solo el alcance de la issue)...
6. add_comment { issueId, body }       // deja rastro en hitos
7. // verificas con el comando de la DoR (obligatorio; nada avanza sin pasarlo)
   change_issue_state -> In Review      // gate blando; NO a Done
8. record_run { issueId, result, summary, commitRef }   // siempre, también en fallo
   mem_save { scope, type, content }    // decisiones/bugs/convenciones durables
9. release_issue { id }                // libera el lock, siempre (también si abortas)
```

El **revisor** (el prompt `review` o un humano) toma las issues En revisión, verifica
contra la DoD y las cierra a **Done** o las devuelve a **In Progress** con un
comentario. Nota: si el estado "En revisión" no existe en tu tablero, el worker
cierra a Done en el paso 7.

## Errores frecuentes

- **Inventar IDs**: usa siempre las tools de descubrimiento; un `stateId`/`labelId`
  inexistente falla.
- **Cambiar de estado por nombre**: `change_issue_state` quiere `stateId`, no el
  texto del estado.
- **No liberar**: si haces `claim_issue` y no `release_issue`, la issue queda
  "en curso" y bloquea a otros agentes.
- **Tools de escritura ausentes**: si no ves `save_issue` y compañía, tu key es
  *read-only* — pide una key con escritura.
- **`dueDate`**: es epoch en **milisegundos**; `null` lo limpia.
- **Milestone de otro proyecto**: el `milestoneId` de una issue tiene que ser del
  **mismo** proyecto; si no, `save_issue` falla.
- **Mover de proyecto borra el milestone**: cambiar `projectId` limpia el
  `milestoneId` salvo que mandes uno nuevo en la misma llamada.

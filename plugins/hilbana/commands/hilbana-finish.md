---
description: Cierra el trabajo de un worker sobre una issue de Hilbana respetando el gate de revisión del framework: verifica contra la DoD, deja la issue En revisión (NUNCA la cierra a Done — eso lo hace el revisor), registra el run (record_run), guarda el aprendizaje (mem_save), comenta para el revisor y suelta el lock. Encaja detrás de /hilbana-claim-next.
argument-hint: "<ABC-123>  (identificador de la issue que estás terminando; por defecto la que reclamaste)"
---

# /hilbana-finish — cerrar como worker (parar en «En revisión»)

Acabas de implementar el trabajo de `$ARGUMENTS`. Este command lo **cierra bien**
según el framework humano+agente: el worker **no cierra su propio trabajo a Done**;
lo deja en **«En revisión»** para que un revisor (`/hilbana-review` o un humano) lo
apruebe o lo devuelva. Antes deja rastro (telemetría + memoria) y **suelta el lock**.

Las tools son `mcp__hilbana__<nombre>`; carga la skill **hilbana-mcp** si necesitas
el detalle. Este command es la otra mitad de **`/hilbana-claim-next`**.

`$ARGUMENTS` es el identificador de la issue que estás terminando (la que
reclamaste). Si va vacío,
usa la issue que tienes en curso.

## Regla de oro

- **Nunca cierres tu propio trabajo a Done.** El worker termina en **En revisión**.
- **`record_run` SIEMPRE** — también si fallaste (`failure`/`cancelled`).
- **`release_issue` SIEMPRE** — también si abortas, para no dejar el lock colgado.

## Paso 1 — Verificar (obligatorio, nada avanza sin verde)

Ejecuta el **comando de verificación** de la DoD (está en el `agentContext` /
`verifyCommand` de la issue: `pnpm typecheck`, `pnpm build`, `pnpm test:*`…). Si no
pasa, **no** dejes la issue En revisión: arréglalo, o trátalo como cierre en fallo
(ver «Si fallaste» abajo).

## Paso 2 — Dejar la issue En revisión (gate blando)

Descubre el estado por su nombre y muévela ahí:

```
list_workflow_states                 // busca el estado llamado "In Review" / "En revisión" (type started)
change_issue_state { "id": "ABC-123", "stateId": "<In Review>" }
```

> **Gate blando:** la app NO impide físicamente ir a Done; la obligatoriedad de
> parar aquí vive en este command (el rol), no en la BD.
>
> **Si el estado «En revisión» NO existe** en el tablero de tu workspace, cierra a
> **Done** y avísalo en el comentario. En cuanto exista, este command para en
> «En revisión».

## Paso 3 — Telemetría: `record_run` (siempre)

```
record_run {
  "issueId": "ABC-123",
  "result": "success",                 // o "failure" / "cancelled"
  "summary": "Qué hiciste y cómo lo verificaste (comando + resultado).",
  "commitRef": "<sha del commit o URL del PR>"
}
```
Puebla el historial de runs de la ficha y las métricas humano-vs-agente. No lo
saltes: es lo que deja constancia máquina-legible de tu ejecución.

## Paso 4 — Memoria: `mem_save` del aprendizaje

Guarda lo durable (decisión de diseño, causa raíz de un bug, convención,
descubrimiento) en el scope del repo — sobrevive entre sesiones:

```
mem_save {
  "scope": "mi-repo",
  "type": "decision",                  // decision|bug|convention|discovery|preference|fact|note
  "content": "Qué se decidió/encontró y por qué. Con archivo:línea si aplica."
}
```

## Paso 5 — Comentario para el revisor

```
add_comment {
  "issueId": "ABC-123",
  "body": "✅ Listo para revisión. Qué quedó · verificado con <comando> · PR/commit <ref>. Notas para el revisor."
}
```

## Paso 6 — Soltar el lock (siempre)

```
release_issue { "id": "ABC-123" }     // limpia agentWorkingBy/Since; el badge "en curso" desaparece
```

## Si fallaste (no lograste la DoD)

No dejes la issue En revisión: devuélvela a **Todo** (o déjala En progreso con un
comentario claro de dónde te atascaste), y aun así:
```
add_comment { "issueId": "ABC-123", "body": "⚠️ No completado: <qué falla / dónde me atasqué>." }
record_run { "issueId": "ABC-123", "result": "failure", "summary": "Qué intenté y por qué no pasó la verificación." }
release_issue { "id": "ABC-123" }
```

## Flujo en una línea

verificar (DoD) → `change_issue_state` (**En revisión**) → `record_run` (siempre) →
`mem_save` → `add_comment` (para el revisor) → `release_issue` (siempre).

El PR queda **sin mergear**: lo revisa/mergea `/hilbana-review` o un humano, que
cierra la issue a Done. El worker no lo hace.

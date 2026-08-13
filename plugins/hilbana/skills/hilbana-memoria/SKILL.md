---
name: hilbana-memoria
description: "Persistent agent memory in Hilbana (an engram replacement). The proactive protocol for saving, searching and reloading per-project context through the mcp__hilbana__mem_* tools (mem_save/mem_search/mem_context/mem_get/mem_session_summary). Use it ALWAYS when working in a repo and you want decisions, bugs, conventions and discoveries to survive across sessions — in ANY repo, not just projects tracked in Hilbana. Written in Spanish."
---

# Memoria de agentes con Hilbana

Hilbana guarda **memoria persistente de agentes** (estilo engram) en su misma
base de datos, expuesta por el **mismo MCP** que ya usas para issues/projects.
Sirve para que el contexto de un repo sobreviva entre sesiones: decisiones,
bugs (con causa raíz), convenciones, descubrimientos y resúmenes de sesión.

El plugin registra el MCP de Hilbana por ti. Para migrar desde engram, mira
**`/hilbana:memoria-switch`**.

Las tools son `mcp__hilbana__mem_*` (aquí por `<nombre>`). **No hay tool ni
servidor nuevo que instalar**: viven en el MCP de Hilbana ya registrado.

## El concepto clave: el `scope`

La memoria se organiza por **scope** = un proyecto/repo. **El scope lo decides
tú (el cliente) y lo pasas en CADA llamada.** Es el **nombre del proyecto**, igual
que engram nombra sus proyectos:

- Usa el **nombre de la carpeta del repo** (el basename de su raíz). Ej. el repo en
  `C:\Proyectos\hilbana` → `scope: "hilbana"`. Es texto simple, sin barras ni
  protocolo, estable entre máquinas.

Usa SIEMPRE la misma `scope` para el mismo proyecto (si no, partes la memoria). Al
guardar puedes enriquecer el registro del scope con `scope_name`, `git_remote` y
`root_path` — opcionales, solo diagnóstico.

> **Aislamiento:** la memoria está acotada al **workspace**. El scope de la key
> (si está acotada a un proyecto) NO aplica a la memoria: es independiente de
> `projects`. Dos repos distintos = dos scopes distintos; el mismo scope en otro
> workspace es otra memoria.
>
> **Con varios workspaces al alcance** (la key llega a todos aquellos de los que
> eres miembro): se **guarda** en el workspace de la issue que tengas reclamada —
> y si no hay ninguna, en tu workspace por defecto —, y se **lee** del por
> defecto salvo que pases `workspaceId`. La respuesta de `mem_save` dice dónde
> quedó. Lo que sea sobre TI (cómo trabajas, tus preferencias) mándalo a tu
> workspace con `workspaceId`, o lo verá el equipo para el que estés trabajando.

## Las 5 tools

| Tool | Para qué | Args |
|------|----------|------|
| `mem_search` | Buscar memoria por full-text (relevancia + recencia) | `query`, `scope`, `limit?` |
| `mem_context` | Cargar las memorias recientes del scope (sin query) | `scope`, `limit?` |
| `mem_get` | Leer una memoria completa por id (sin truncar) | `id` |
| `mem_save` | Guardar una observación | `content`, `type`, `scope`, `topic_key?`, `session_id?`, `metadata?`, (`scope_name?`/`git_remote?`/`root_path?`) |
| `mem_session_summary` | Resumen de fin de sesión (objetivo/logros/próximos pasos) | `scope`, `summary`, `session_id?` |

`type` (categoría de la observación): `decision` · `bug` · `convention` ·
`discovery` · `preference` · `fact` · `note`.

`mem_search`/`mem_context` devuelven cada memoria con sus campos; `mem_search`
añade `snippet` (con `<mark>…</mark>`) y `score`. `mem_save`/`mem_session_summary`
y `mem_get`/`mem_search` no existen como escritura si tu key es **read-only**
(las de lectura sí).

## Protocolo — cuándo llamar a cada una (PROACTIVO)

No esperes a que te lo pidan.

**Al ARRANCAR en un repo** (o tras una compactación):
```
mem_context { "scope": "hilbana", "limit": 25 }
// y, si vas a tocar un tema concreto:
mem_search  { "scope": "hilbana", "query": "webhooks salientes" }
```

**GUARDA `mem_save` inmediatamente después de** (igual que el protocolo de engram):
- una **decisión** (arquitectura, convención, workflow, elección de herramienta),
- un **bug arreglado** (incluye la causa raíz),
- una **convención** o patrón establecido (naming, estructura, enfoque),
- un **descubrimiento** o gotcha no obvio,
- una **preferencia/constraint** del usuario,
- el usuario confirma una recomendación ("dale", "sí, esa") o rechaza un enfoque.

```
mem_save {
  "scope": "hilbana",
  "type": "decision",
  "content": "El identificador ABC-123 no se guarda como string: es teams.key + issues.number, incrementado en la MISMA transacción.",
  "topic_key": "modelo-datos"
}
```

**Al CERRAR la sesión** (antes de decir "listo"):
```
mem_session_summary {
  "scope": "hilbana",
  "summary": "Objetivo: ... | Logros: ... | Próximos pasos: ... | Archivos: ..."
}
```

## Buenas prácticas

- **Una observación = un `mem_save`** (atómica), no un volcado gigante.
- Reusa `topic_key` para agrupar memorias del mismo tema (facilita recuperarlas).
- Guarda lo **no obvio** (las decisiones y el porqué), no lo que el repo ya dice
  (estructura, historial de git, lo que está en CLAUDE.md).
- Mantén la `scope` estable. Ante la duda, `mem_search` antes de `mem_save` para
  no duplicar.
- `mem_search` ordena por relevancia + recencia; si buscas "lo último" sin
  término, usa `mem_context`.

## Errores frecuentes

- **Cambiar la `scope` entre sesiones** del mismo repo → memoria partida. Usa
  siempre el mismo nombre de proyecto (el de la carpeta del repo).
- **No pasar `scope`**: es obligatorio en todas las tools de memoria.
- **`mem_save` ausente**: si no ves la tool, tu key es *read-only* — pide una con
  escritura.
- Esperar a que el usuario pida "guarda esto": el protocolo es **proactivo**.

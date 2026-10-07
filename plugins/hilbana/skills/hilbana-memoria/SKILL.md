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
- Y pasa **`git_remote`** (la URL de `git remote get-url origin`, sin credenciales)
  en `mem_context`, `mem_search`, `mem_save` y `mem_session_summary`. Con él,
  Hilbana reconoce el repo: si otra persona lo clonó en una carpeta con otro
  nombre, los dos caen en el mismo scope y compartís memoria. Si tu carpeta ya
  tenía scope propio sin repo, al guardar se fusiona en el del repo.
- **Excepción: `.hilbana/scope`.** Si el repo tiene ese fichero, su primera línea
  es el scope y **no** pases `git_remote`: el fichero manda (sirve para un repo
  sin remote o para partir un monorepo en varios scopes).

El hook de inicio de sesión del plugin ya te da el scope y el `git_remote` que
tocan. Usa SIEMPRE la misma `scope` para el mismo proyecto (si no, partes la
memoria). Al guardar puedes enriquecer el registro del scope con `scope_name` y
`root_path` — opcionales, solo diagnóstico.

> **Aislamiento:** la memoria está acotada al **workspace**: el mismo scope en
> otro workspace es otra memoria, y dos repos distintos son dos scopes. Dentro
> del workspace, **una key acotada a un proyecto** solo lee y escribe los scopes
> de ese proyecto (los que crea nacen atados a él), y un invitado solo ve los de
> sus proyectos. Los scopes creados con una key sin acotar son de todo el
> workspace y los ven solo los miembros plenos.
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
| `mem_search` | Buscar memoria por full-text (relevancia + recencia) | `query`, `scope`, `git_remote?`, `limit?` |
| `mem_context` | Cargar las memorias recientes del scope (sin query) | `scope`, `git_remote?`, `limit?` |
| `mem_get` | Leer una memoria completa por id (sin truncar) | `id` |
| `mem_save` | Guardar una observación | `content`, `type`, `scope`, `git_remote?`, `topic_key?`, `replaces?`, `session_id?`, `metadata?`, (`scope_name?`/`root_path?`) |
| `mem_session_summary` | Resumen de fin de sesión (objetivo/logros/próximos pasos) | `scope`, `summary`, `git_remote?`, `session_id?` |

Cada memoria vuelve con `authorName`: quién la guardó (el dueño de la key). Con
varias personas en el mismo scope, si dos memorias chocan, mira quién escribió
cada una.

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
  Agrupa, no sustituye: guardar con el mismo `topic_key` añade otra memoria.
- **Para corregir algo ya guardado, sustitúyelo**: `mem_save { …, "replaces": "<id>" }`
  con el id de la memoria vieja (de este mismo scope; lo sacas de `mem_search` o
  `mem_context`). La vieja se borra en el mismo paso. No dejes dos versiones que
  se contradicen.
- **La memoria la comparte el equipo.** No guardes lo que solo vale en tu máquina:
  rutas absolutas, puertos locales, nombres de máquina, tu configuración
  personal. A otra persona le confunde, y la ruta en la que trabajas ya la sabes.
- Guarda lo **no obvio** (las decisiones y el porqué), no lo que el repo ya dice
  (estructura, historial de git, lo que está en CLAUDE.md).
- Mantén la `scope` estable. Ante la duda, `mem_search` antes de `mem_save` para
  no duplicar.
- `mem_search` ordena por relevancia + recencia; si buscas "lo último" sin
  término, usa `mem_context`.

## Errores frecuentes

- **Cambiar la `scope` entre sesiones** del mismo repo → memoria partida. Usa
  siempre el mismo nombre de proyecto (el de la carpeta del repo) y pasa
  `git_remote`: así el repo se reconoce aunque la carpeta cambie.
- **Pasar `git_remote` con credenciales** (`https://usuario:token@…`): quítalas;
  Hilbana no las guarda, pero tampoco deberían salir de tu máquina.
- **No pasar `scope`**: es obligatorio en todas las tools de memoria.
- **`mem_save` ausente**: si no ves la tool, tu key es *read-only* — pide una con
  escritura.
- Esperar a que el usuario pida "guarda esto": el protocolo es **proactivo**.

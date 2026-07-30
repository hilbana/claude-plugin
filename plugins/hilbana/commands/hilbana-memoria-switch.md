---
description: Guía el switch desde engram a la memoria de Hilbana (mismo MCP, tools mem_*). Convivencia, configuración en ~/.claude y retirada de engram. Lo prueba en el repo actual.
argument-hint: "[url-base opcional, p.ej. https://app.hilbana.com]"
---

# Switch desde engram a la memoria de Hilbana

Vas a ayudar al usuario a **dejar de depender de engram** apuntando la memoria de
agentes a **Hilbana**, que ya guarda memoria persistente por repo en el **mismo
MCP** que usa para issues/projects (tools `mcp__hilbana__mem_*`).

`$ARGUMENTS` puede traer la URL base; si viene vacío, usa `https://app.hilbana.com`.

## Idea central (díselo primero)

- **No hay servidor MCP nuevo que instalar.** Las tools de memoria
  (`mem_save`/`mem_search`/`mem_context`/`mem_get`/`mem_session_summary`) viven en
  el MCP de Hilbana, que el plugin registra por ti.
- El "modo de uso" (cuándo guardar/recuperar, cómo derivar el `scope` del repo) lo
  define la skill **`hilbana-memoria`**. Cárgala en una sesión nueva.
- Funciona en **cualquier repo**, no solo en proyectos del gestor Hilbana.

## Paso 1 — Verificar que el MCP responde y las tools de memoria cargan

1. `/plugin list` → `hilbana` habilitado, y el MCP `hilbana` conectado. Si no,
   revisa la `api_key` del plugin y reinicia Claude Code.
2. En una sesión nueva, comprueba que existen las tools `mcp__hilbana__mem_*`.
   Prueba de humo no destructiva (repo actual):
   - deriva la `scope` del repo: el **nombre del proyecto** (el de la carpeta del
     repo, p.ej. `hilbana`), igual que engram nombra sus proyectos.
   - `mem_save { scope, type:"note", content:"switch test <fecha/hora>" }`
   - `mem_search { scope, query:"switch test" }` → debe devolver lo guardado.
   - `mem_context { scope }` → debe listarlo entre las recientes.

   Si el ciclo guarda y recupera, **el switch funciona en este repo**.

## Paso 2 — Convivencia engram ↔ Hilbana (transición sin perder nada)

Durante la transición pueden estar **los dos activos a la vez** (engram por su
hook/plugin, Hilbana por su MCP). No se pisan: son almacenes distintos. Estrategia
recomendada:

- **Escribe en ambos** un tiempo (o al menos sigue guardando en Hilbana lo nuevo)
  mientras te aseguras de que recuperas bien desde Hilbana.
- Antes de cada tarea, recupera de Hilbana con `mem_context`/`mem_search`. Si
  echas de menos algo que estaba en engram, lo migras (Paso 4) o lo re-guardas.
- Cuando lleves varios días recuperando todo lo que necesitas desde Hilbana sin
  recurrir a engram, pasa a la retirada (Paso 3).

## Paso 3 — Retirar engram (cuando ya no lo necesites)

engram se activa por un **plugin/hook** de Claude Code (un `SessionStart` que
inyecta el protocolo y registra las tools `mem_*` de engram). Para retirarlo:

1. Quita/inhabilita el **plugin de engram** en tu config de Claude Code (el que
   añade el hook `SessionStart` y las tools `mcp__plugin_engram_*`). Revisa
   `~/.claude` (settings y plugins) y deshabilítalo ahí.
2. Conserva el fichero `~/.engram/engram.db` hasta haber migrado lo que quieras
   (Paso 4). Borrarlo es irreversible.
3. Deja activa la skill **`hilbana-memoria`** para que el protocolo de memoria lo
   cubra Hilbana.

> No toques nada de engram sin confirmación del usuario: desactivar un plugin y,
> sobre todo, borrar `engram.db` son acciones del usuario. Tú **muestras** los
> pasos; no desinstales por tu cuenta.

## Paso 4 — (Opcional) Importar memorias históricas de engram

engram guarda en SQLite (`~/.engram/engram.db`, tabla de observaciones). Si merece
la pena conservar el histórico:

- Plantea al usuario un import puntual: leer las observaciones de `engram.db` y
  re-guardarlas con `mem_save` en Hilbana. El mapeo es **1:1**: el `project` de
  engram ES la `scope` de Hilbana (ambos son el nombre del proyecto).
- Hazlo **best-effort y revisable**: agrupa por proyecto, respeta `type`/`topic`
  cuando existan, y enseña un resumen (cuántas, a qué scope) antes de escribir.
- Si el histórico no aporta, **sáltatelo**: lo importante es que de aquí en
  adelante la memoria viva en Hilbana.

## Cierre

Cuando el Paso 1 esté verde en un repo real y el usuario sepa cómo convivir/retirar
engram, el switch está hecho: a partir de ahora **guarda y recupera memoria por
Hilbana** siguiendo la skill `hilbana-memoria`.

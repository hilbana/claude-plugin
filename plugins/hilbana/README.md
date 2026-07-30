# hilbana

Plugin **todo-en-uno** de Claude Code para [Hilbana](https://app.hilbana.com): con
una sola instalación tus agentes tienen **memoria persistente** y el **framework de
trabajo humano + agente**.

## Qué trae

- **MCP de Hilbana auto-registrado** (con tu API key vía la config del plugin).
- **Memoria por proyecto** (reemplazo de engram):
  - Hook `SessionStart`: al abrir un repo, recuerda cargar el contexto previo
    (`mem_context`) y guardar proactivamente.
  - Hook `SessionEnd`: al cerrar la sesión, guarda automáticamente un resumen de lo
    trabajado.
  - Command `/hilbana-memoria-switch` para importar tu histórico de engram.
- **Contabilidad de tokens por tarea**:
  - Hook `Stop` / `SessionEnd`: reporta automáticamente los tokens que ha gastado el
    agente y los imputa a la issue que tiene reclamada. Ver *Consumo de tokens* abajo.
- **Framework de trabajo humano + agente** (cola *pull*): los commands del ciclo
  `/hilbana-claim-next`, `/hilbana-finish`, `/hilbana-plan`, `/hilbana-review`. El
  worker tira de la cola y deja *En revisión*; el revisor cierra.
- **Skills** `hilbana-memoria` (protocolo de memoria) y `hilbana-mcp` (las tools del
  MCP y los flujos de la cola).

La memoria se organiza por **scope = el nombre de la carpeta del repo**. Funciona en
**cualquier** repo, no solo en proyectos del gestor.

## Requisitos

- **Node 18+** en el `PATH` (los hooks corren con `node`; el `SessionEnd` usa
  `fetch` global, disponible desde Node 18). Sin Node los hooks no se ejecutan,
  pero la sesión no se rompe.

## Instalación

```bash
# 1) Añade este repo como marketplace
/plugin marketplace add hilbana/claude-plugin

# 2) Instala el plugin
/plugin install hilbana@hilbana
```

Al instalar te pedirá la **configuración** (`userConfig`):

- **`api_key`** (obligatoria): créala en *Ajustes → API keys* del **workspace que
  uses**. ⚠️ Las tools y la memoria operan sobre el workspace de esta key; usa una
  del workspace correcto o caerán en otro tenant.
- **`base_url`** (opcional): déjala **vacía** para el default `https://app.hilbana.com`.
  Ponla solo en self-hosted, **sin `/mcp`** (el plugin lo añade).

Reinicia Claude Code y listo: el MCP queda conectado, los hooks activos y los
commands del ciclo disponibles en todos tus repos.

## Verificación

- `/plugin list` → `hilbana` habilitado.
- En una sesión nueva, comprueba que existen las tools de memoria
  (`mem_context`, `mem_save`, …). Con el plugin llevan el prefijo del servidor MCP
  namespaced: `mcp__plugin_hilbana_hilbana__mem_*`.
- Prueba: *"carga el contexto de memoria"* → el agente llama `mem_context` con el
  scope del repo actual.

## Consumo de tokens

El plugin mide **cuántos tokens cuesta cada tarea** y lo manda solo, sin que el
agente tenga que acordarse de nada. Es deliberado: un LLM no sabe lo que consume, y
si se le pide que lo reporte se lo inventa.

Cómo funciona: en cada `Stop` (y al cerrar la sesión) el hook
`scripts/usage-report.cjs` recorre el transcript en streaming, **deduplica por
`message.id`** —el mismo mensaje aparece en varias líneas del JSONL, y sumar por
línea infla la cifra ~80%—, agrupa por modelo y manda a `POST /api/agents/usage`
solo lo posterior al último tramo enviado. **La issue no se manda**: el servidor
decide a qué tarea imputarlo mirando qué issue tienes reclamada en ese momento
(`claim_issue`). Sin claim, el gasto queda como *consumo no imputado*.

Es silencioso por diseño: si el endpoint está caído, la key falta o el transcript no
se puede leer, no rompe ni ensucia tu sesión. El cursor solo avanza cuando el
servidor confirma, así que un tramo no enviado se reintenta en el siguiente turno y
no se pierde.

Modo prueba: `HILBANA_HOOK_DRYRUN=1` imprime el payload en vez de enviarlo.

### Contrato de la ingesta (para otros agentes)

El endpoint **no es específico de Claude Code**: cualquier agente (Codex, Cursor, uno
propio) puede alimentarlo mandando este cuerpo con su propio `agentName`.

```http
POST /api/agents/usage
Authorization: Bearer hil_<tu-api-key>
Content-Type: application/json
```

```json
{
  "sessionId": "identificador estable de la sesión del agente",
  "agentName": "claude-code",
  "cursor": "id del último mensaje incluido en este tramo",
  "usage": [
    {
      "model": "claude-opus-4-8",
      "inputTokens": 1788,
      "outputTokens": 391550,
      "cacheReadTokens": 316707004,
      "cacheWriteTokens": 3275984
    }
  ]
}
```

Reglas del contrato:

- **`cursor` es obligatorio** y es lo que hace la ingesta idempotente: reenviar el
  mismo cursor responde `{"accepted": false}` y no suma nada. Manda como cursor el id
  del último mensaje que has contabilizado, y avánzalo solo cuando el servidor
  responda 200.
- **Manda tramos, no totales**: cada envío son los contadores *nuevos* desde el
  cursor anterior; el servidor acumula.
- Los cuatro contadores van **separados**. No los sumes en uno: las lecturas de caché
  dominan el volumen y cuestan una fracción, así que un total único es una cifra
  engañosa. Los ausentes cuentan como 0.
- `issueId` y `workspaceId` **no se aceptan** en el cuerpo: salen de la API key y del
  claim vivo. Es lo que impide imputar gasto a una tarea ajena.
- Respuesta: `{ "accepted": true|false, "issueId": string|null, "models": number }`.
- Una key `read-only` recibe 403; contadores negativos o sin `model`, 400.

## Privacidad

El plugin **no contiene secretos**: tu API key vive solo en tu configuración local
(`userConfig`, marcada `sensitive`). El hook `SessionEnd` envía el resumen a tu
Hilbana vía `POST /api/memory` autenticado con esa key.

Modo prueba del guardado: `HILBANA_HOOK_DRYRUN=1` hace que el hook imprima el
resumen en vez de enviarlo.

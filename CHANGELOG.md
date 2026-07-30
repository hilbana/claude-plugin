# Changelog

Todas las versiones relevantes del plugin `hilbana`. Formato
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado
[semántico](#qué-cuenta-como-patch-minor-o-major) según el criterio del README.

## [1.2.0] — 2026-07-30

### Añadido

- El plugin se publica en su propio repo público, `hilbana/claude-plugin`. Antes
  vivía en el repo privado de la app, así que la instalación documentada no la podía
  completar nadie de fuera.
- `LICENSE` (MIT), que `plugin.json` ya declaraba.

### Corregido

- **`/hilbana-finish` y `/hilbana-review` no se cargaban.** Su `description` de
  frontmatter contenía `: ` en un escalar plano (`del framework: verifica`,
  `y decide: cierra`), que en YAML abre un mapping y rompe el parseo. Claude Code
  cargaba 7 de los 9 componentes, y los dos que faltaban eran justo la mitad del
  ciclo del framework: el worker no tenía cómo cerrar y el revisor no existía.
- El hook `SessionStart` anunciaba al agente el prefijo de tools
  `mcp__plugin_hilbana-memory_hilbana__…`, heredado del plugin deprecado
  `hilbana-memory`. El real es `mcp__plugin_hilbana_hilbana__…`, así que el
  recordatorio de memoria apuntaba a tools inexistentes en cada sesión.
- El formato de la API key en `plugin.json` decía `mil_…`; es **`hil_…`**. La misma
  errata estaba en la skill `hilbana-mcp`.
- Cinco referencias al command `/hilbana-mcp-install`, que no existe.
- `/hilbana-plan` mandaba leer un `get_doc` por UUID de un workspace privado: un
  usuario externo no podía abrirlo. Ahora usa `list_docs` + `get_doc` genéricos.

### Cambiado

- Documentación y ejemplos sin referencias internas: identificadores de ejemplo
  genéricos (`ABC-123`) y el `scope` de memoria descrito como el nombre de la
  carpeta del repo.
- README con los comandos de instalación del repo público.

## [1.1.0] — 2026-07-27

### Añadido

- Contabilidad de tokens por tarea: hooks `Stop`/`SessionEnd` que leen el
  transcript, deduplican por `message.id` y reportan a `POST /api/agents/usage`.

### Corregido

- Los hooks arrancaban con la API key vacía cuando la interpolación de `userConfig`
  no llegaba (verificado en Windows). Ahora hay respaldo desde el store de
  credenciales del plugin; sin él, ni el reporte de tokens ni el guardado de memoria
  llegaban a ejecutarse, y en silencio.

## [1.0.0]

### Añadido

- Plugin todo-en-uno: consolida los antiguos `hilbana-memory` y `hilbana-agents` en
  uno solo. MCP auto-registrado, memoria por proyecto con hooks de carga y guardado,
  los commands del ciclo y las skills `hilbana-mcp` y `hilbana-memoria`.

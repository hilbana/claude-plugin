# Hilbana + Beads

[Beads](https://github.com/gastownhall/beads) (`bd`) es un gestor de issues en grafo y
distribuido para agentes de IA, construido sobre Dolt: da a **tu agente** una memoria
persistente y estructurada de su propio trabajo dentro de un repo. Hilbana es un gestor
alojado donde **personas y agentes comparten un tablero**, con reclamo de tareas,
revisión y un rastro de quién hizo qué.

Resuelven problemas vecinos, no el mismo:

> Beads le da memoria a tu agente. Hilbana le da memoria a tu **equipo**, con tablero,
> revisión y trazabilidad.

Puedes usar cualquiera de los dos solo. Esta guía es para usar los dos sin duplicar
trabajo.

> **No hay sincronización automática entre Beads y Hilbana.** Nada de lo que sigue mueve
> una issue de uno a otro por sí solo. Es una forma de repartir el trabajo, no una
> integración.

## Cuándo usar cada uno

| Quieres… | Usa |
|---|---|
| Que el **equipo** vea qué hay planificado, quién lo lleva y qué espera revisión | Issues de **Hilbana** |
| Que un agente **reclame** una tarea para que dos agentes no cojan la misma | **Hilbana** (`claim_issue`, `next_ready_issue`) |
| Revisar y aprobar lo que hizo un agente, con rastro de comentarios | **Hilbana** (`finish` → En revisión → `review`) |
| El **plan paso a paso** del propio agente dentro de una tarea, con dependencias entre sus pasos | **Beads** (`bd create`, `bd dep add`, `bd ready`) |
| Trabajo que vive solo en el repo, sin conexión, sin herramienta alojada | **Beads** |
| Hechos del proyecto que **todos** (y cada agente) deben conocer en la próxima sesión | Memoria de **Hilbana** (`mem_save`) |

Regla simple: **la unidad que le importa al equipo es una issue de Hilbana; los pasos
que da un agente para terminarla pueden ser tareas de Beads.**

## Un flujo que usa los dos

1. **Reclama la issue de Hilbana** (`/hilbana:claim-next`, o `/hilbana:trabajar-issue ABC-123`).
   Lee su descripción, el `agentContext` y la definición de hecho.
2. **Desglósala en local, si es grande.** En el repo:

   ```bash
   bd create "Añadir el endpoint de exportación CSV" -p 1
   bd create "Selector de columnas en la UI" -p 1
   bd dep add <id-tarea-ui> <id-tarea-endpoint>   # la UI espera al endpoint
   bd ready                                        # lo que no tiene bloqueos abiertos
   bd update <id> --claim                          # coge una, de forma atómica
   ```

3. **Trabaja.** Cierra las tareas de Beads según las termines (`bd close <id>`). Son el
   borrador del agente; nadie más necesita leerlas.
4. **Cierra el ciclo en Hilbana.** `/hilbana:finish` verifica la definición de hecho, deja
   la issue en el estado que eligió tu workspace, registra la ejecución, comenta para el
   revisor y libera el bloqueo. Pon en ese comentario el *resultado*, no la lista de
   pasos de Beads.
5. **Guarda lo que merece la pena** con `mem_save`: la decisión y su porqué, la causa
   raíz de un bug, la trampa. Es lo que necesitarán el próximo agente y tus compañeros.

## Una memoria, no dos

Las dos herramientas pueden recordar cosas (`bd remember "…"` en Beads, `mem_save` en
Hilbana). Para no decirlo todo dos veces y que las versiones se separen:

- **Elige un sitio por tipo de hecho.** Conocimiento del proyecto que comparte el equipo
  → memoria de Hilbana. Una nota que solo le sirve al agente a mitad de tarea → Beads.
- La memoria de Hilbana vive en el servidor, así que acompaña al proyecto entre máquinas
  y personas sin ningún paso de git. Beads guarda sus datos en la carpeta `.beads/` del
  repo (Dolt) y sincroniza por git, con `bd dolt push` y `bd dolt pull`.
- Al corregir algo en la memoria de Hilbana, usa `replaces` para que quede una sola
  versión.

## Configurar los dos para Claude Code

```bash
# Hilbana: plugin (MCP + hooks de memoria + comandos)
/plugin marketplace add hilbana/claude-plugin
/plugin install hilbana@hilbana

# Beads: instálalo e inicialízalo en el repo
brew install beads          # o: npm install -g @beads/bd
bd init
bd setup claude             # hooks y ajustes para Claude Code
```

`bd init` puede crear o actualizar `AGENTS.md`. Si usas también el
[fragmento de inicio](../prompts/README.md#8--snippet-for-agentsmd--claudemd), deja las
dos secciones juntas y comprueba que no se contradicen sobre dónde viven las tareas y la
memoria.

## Consulta la documentación de Beads

Beads evoluciona rápido. Los comandos, opciones y detalles de almacenamiento de esta guía
salen de su README en el momento de escribirla; para cualquier otra cosa, el
[repositorio de Beads](https://github.com/gastownhall/beads) es la fuente de verdad.

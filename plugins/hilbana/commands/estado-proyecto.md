---
description: "Shortcut for the estado_proyecto prompt: the project manager's daily report for a Hilbana project — Team tab figures, who did what each day, the team's decisions, what's waiting for an answer and what's next, as a visual panel."
argument-hint: "<project> [period]  (e.g. WEBS desde ayer; empty = ask)"
---

# /hilbana:estado-proyecto — el parte del proyecto

Atajo del prompt **`estado_proyecto`** que sirve el MCP de Hilbana, para no teclear
`/mcp__plugin_hilbana_hilbana__estado_proyecto`. El detalle vive en el prompt;
esto solo lo dispara.

Proyecto y periodo: `$ARGUMENTS` (si va vacío, pregunta el proyecto; el periodo por
defecto es desde el último parte).

1. **Cifras**: `project_team_stats` del proyecto y el periodo. Son las de la pestaña
   Equipo: úsalas tal cual, no las recalcules contando issues.
2. **Parte anterior y decisiones**: `list_docs` + `get_doc` del doc «Parte del
   proyecto» (qué cambió) y del doc «Decisiones» (`D-012 · fecha · autor · estado ·
   texto · origen`).
3. **Lo cualitativo**: `list_comments` de las tareas de la actividad: qué deja hecho
   cada una, las decisiones de su sección «Decisiones:» (cruzadas con el doc: cuáles
   chocan con una aceptada y cuáles son nuevas), lo que espera respuesta y lo que
   encontró la revisión.
4. **El panel** (artefacto visual si puedes): titular, lo urgente hoy, KPIs con ritmo y
   fin previsto, tabla por días, por persona, avance por milestone, decisiones y lo
   siguiente. Tareas siempre por su identificador.
5. **Decisiones**: propón y espera su sí. Rechazar = `change_issue_state` atrás +
   `add_comment` (al asignado le llega «te devolvió una tarea»); avisar =
   `send_message`; aceptar = `add_comment` + línea nueva en el doc «Decisiones».
6. **Guarda** el parte con `save_doc` («Parte del proyecto», actualizando el que hay).

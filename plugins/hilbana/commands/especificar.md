---
description: "Shortcut for the especificar prompt: turn a Hilbana project's decisions into specs (one «Spec · …» doc per area), have them checked against the decisions by a second review, and then plan tasks linked to them."
argument-hint: "<project> [area]  (empty = ask)"
---

# /hilbana:especificar — de las decisiones a las specs

Atajo del prompt **`especificar`** que sirve el MCP de Hilbana. El detalle vive en el
prompt; esto solo lo dispara.

Proyecto y área: `$ARGUMENTS` (si va vacío, pregunta el proyecto; sin área, todas).

1. **Contexto**: doc «Decisiones» (sin él, para: primero hay que decidir), specs que ya
   haya y el código relevante.
2. **Índice**: propón las áreas (una spec cada una) y qué decisiones cubren; espera el sí.
3. **Escribe** cada spec con `save_doc` («Spec · <área>»): objetivo, alcance y lo que
   queda fuera, comportamiento con casos, reglas, datos y permisos, criterios de
   aceptación verificables y las decisiones de las que sale (D-012). Lo que falte,
   como pregunta abierta.
4. **Segunda revisión** contra las decisiones (otro agente si puedes lanzarlo): huecos,
   contradicciones, criterios no verificables.
5. **Aprobación** de la persona; lo que cambie va al doc «Decisiones» y a la spec.
6. **Planifica** con `/hilbana:plan`: cada tarea enlaza su spec y saca la DoD de sus
   criterios.

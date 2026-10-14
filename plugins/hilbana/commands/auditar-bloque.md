---
description: "Shortcut for the auditar_bloque prompt: audit a closed block (parent issue or milestone) of a Hilbana project against its specs, DoD and decisions, comment the findings and offer to send back what doesn't pass."
argument-hint: "<parent issue | milestone>  (e.g. WEBS-12; empty = ask)"
---

# /hilbana:auditar-bloque — auditar un bloque cerrado

Atajo del prompt **`auditar_bloque`** que sirve el MCP de Hilbana. El detalle vive en
el prompt; esto solo lo dispara.

Bloque: `$ARGUMENTS` (una tarea padre o un milestone; si va vacío, pregunta).

1. **Delimita** el bloque: sub-tareas de la padre, a cualquier nivel, o las tareas del
   milestone. Audita las cerradas o en revisión; lista aparte las que siguen abiertas.
2. **Referencia** de cada tarea: description, agentContext, DoD, verifyCommand, su doc
   «Spec · …», el doc «Decisiones» y el comentario de cierre.
3. **Revisa de verdad**: ejecuta el verifyCommand, mira el commit o PR del último run,
   repasa la DoD y la spec criterio a criterio y comprueba que no contradice ninguna
   decisión aceptada. No te fíes del comentario de cierre.
4. **Clasifica** los hallazgos: bloqueante, mayor o menor.
5. **Enseña** la tabla y **propón**, esperando el sí: devolver con comentario
   accionable lo que no pasa (al asignado le llega «te devolvió una tarea»), comentar
   los menores y dejar un resumen en la tarea padre. No reescribas el trabajo.

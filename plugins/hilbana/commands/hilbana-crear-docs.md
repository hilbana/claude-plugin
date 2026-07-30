---
description: "Bootstrap a project's documentation in Hilbana — reads CLAUDE.md and the local context, interviews the user and writes the initial docs with save_doc (always after review)."
argument-hint: "[target project: Hilbana project name or id; if missing, one is picked or created]"
---

# Crear los docs iniciales de un proyecto en Hilbana

Vas a generar la **documentación de partida** de un proyecto y alojarla en Hilbana
como docs de proyecto. La fuente es el **proyecto local** (su `CLAUDE.md` y demás
contexto) más una **entrevista** al usuario para rellenar lo que el código no dice.
Las tools son `mcp__hilbana__<nombre>`; si necesitas el detalle de cada una, carga
la skill **hilbana-mcp**.

`$ARGUMENTS` puede traer el proyecto destino (nombre o id del project de Hilbana).
Si viene vacío, lo resuelves en el Paso 3.

## Reglas (de CLAUDE.md, no las saltes)

- **No inventes.** Documenta solo lo que esté en los ficheros o lo que el usuario te
  confirme en la entrevista. Si algo no está claro, pregunta; no rellenes huecos a
  ojo.
- **Borrador antes de escribir.** NO llames a `save_doc` hasta que el usuario apruebe
  el contenido. Primero enseñas el markdown aquí en el chat; iteras; luego vuelcas.
- **Quirúrgico.** Escribe los docs que el proyecto necesita, no un manual genérico.
  Mejor 2-3 docs útiles que diez plantillas vacías.
- **Sin secretos.** Nada de keys, tokens ni credenciales en los docs. Si aparecen en
  ficheros de entorno, refiérete a ellos por nombre de variable, no por valor.

## Paso 1 — Leer el contexto local

Lee, si existen, en este orden de prioridad:

1. **`CLAUDE.md`** (raíz y/o subcarpetas) — directrices, stack, modelo de datos,
   workflow. Es la fuente principal.
2. **`README.md`** — propósito, cómo se levanta, comandos.
3. **`package.json`** / manifiesto equivalente — stack real, scripts, dependencias.
4. La **estructura de carpetas** de primer nivel (qué módulos hay) y ficheros de
   config relevantes (`docker-compose.yml`, `*.config.*`, `.env.example` por sus
   nombres de variable).

Resume para ti: de qué va el proyecto, stack, cómo se arranca, qué decisiones ya
están tomadas. Eso es lo que NO tendrás que preguntar.

## Paso 2 — Entrevistar al usuario (adaptado a lo leído)

Con lo del Paso 1, haz **solo las preguntas que el contexto no resuelve**. No sueltes
un cuestionario fijo: si el `CLAUDE.md` ya fija el stack, no preguntes el stack.
Cubre los huecos que veas, normalmente entre estos:

- **Objetivo y alcance**: qué resuelve, qué entra y qué queda fuera (no-objetivos).
- **Usuarios / contexto de uso**: quién lo usa y para qué.
- **Decisiones aún abiertas**: lo que el código no fija todavía (hosting, integraciones,
  prioridades).
- **Convenciones** no escritas: naming, ramas/commits, estilo, definición de "hecho".
- **Restricciones**: plazos, presupuesto, infra, cumplimiento.

Hazlas en tandas cortas y concretas; si una respuesta abre otra duda, repregunta.
Para una entrevista cómoda, puedes usar preguntas de opción múltiple.

## Paso 3 — Resolver el proyecto destino en Hilbana

```
list_projects
```

- Si `$ARGUMENTS` trae un nombre/id, cásalo con la lista y confírmalo con el usuario.
- Si no hay coincidencia o `$ARGUMENTS` vino vacío: pregunta al usuario si usar uno
  existente o **crear uno nuevo**. Para crearlo:
  ```
  save_project { "name": "<nombre>", "description": "<una línea>" }
  ```
  Quédate con el `projectId` resultante.
- Mira qué docs hay ya para no duplicar:
  ```
  list_docs { "projectId": "<projectId>" }
  ```
  Si ya existe un doc del mismo tema, propón **actualizarlo** (pasando su `id` a
  `save_doc`) en vez de crear otro.

## Paso 4 — Proponer el borrador (en el chat, NO en Hilbana todavía)

Presenta en markdown los docs que propones. Como guía de qué docs tienen sentido al
arrancar (ajusta a lo que el proyecto pida — no fuerces todos):

- **Visión / alcance** — qué es, para quién, objetivos y no-objetivos.
- **Arquitectura y stack** — piezas, stack y, sobre todo, las **decisiones con su
  porqué** (lo que un agente no debe re-litigar).
- **Convenciones** — naming, estructura, ramas/commits, estilo, definición de "hecho".
- **Runbook / cómo se levanta y despliega** — comandos, entornos, variables (por
  nombre).
- **Glosario / reglas de negocio** — términos del dominio y reglas que no se negocian.

Para cada doc propón un **título** y el cuerpo. Pide al usuario que confirme o corrija.
Itera hasta que dé el OK.

## Paso 5 — Escribir en Hilbana (solo tras aprobación)

Por cada doc aprobado:

```
save_doc { "projectId": "<projectId>", "title": "<título>", "body": "<markdown>" }
```

(Para actualizar uno existente, incluye su `id`.) Tras escribir, confirma:

```
list_docs { "projectId": "<projectId>" }
```

> **Compruébalo en la UI**: en el proyecto, pestaña **Docs** (`/projects/$id/docs`,
> atajo de teclado `4`) aparecen los docs creados, editables con el editor markdown.

## Paso 6 — Cierre

- Resume al usuario qué docs quedaron creados/actualizados y dónde verlos.
- Sugiere el siguiente paso natural: **descomponer el proyecto en tareas** (issues con
  su `agentContext` y dependencias). Si quiere, eso se trabaja con `save_issue` /
  `link_issues`; cada issue luego se ejecuta con `/hilbana-trabajar-issue`.

## Flujo en una línea

leer `CLAUDE.md` + contexto local → entrevistar (solo los huecos) → resolver/crear
project (`list_projects` / `save_project`) → **borrador en el chat** → aprobar →
`save_doc` → verificar en la pestaña Docs.

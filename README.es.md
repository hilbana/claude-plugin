# Plugin de Hilbana para Claude Code

Marketplace oficial del plugin **`hilbana`** para [Claude Code](https://claude.com/claude-code):
memoria persistente de agentes por proyecto, el marco de trabajo humano + agente y el
servidor MCP de [Hilbana](https://app.hilbana.com) registrado automáticamente.

> **Nota sobre el idioma:** los comandos y las skills están escritos en **español**.
> Funcionan igual hables con Claude en el idioma que hables (Claude los lee y responde
> en el tuyo). La referencia detallada ([REFERENCE.md](REFERENCE.md)) está en inglés.

🇬🇧 **English:** [README.md](README.md)

## Instalación

```bash
/plugin marketplace add hilbana/claude-plugin
/plugin install hilbana@hilbana
```

Reinicia Claude Code. Al instalar te pedirá tu **API key** de Hilbana (formato `hil_…`,
se crea en *Ajustes → API keys* de tu workspace) y, opcionalmente, una **URL base** si
alojas Hilbana tú mismo.

Hace falta **Node 18+** en tu `PATH`: los hooks se ejecutan con `node`. Sin él, los hooks
simplemente no corren y tu sesión no se ve afectada.

## Documentación

- **[REFERENCE.md](REFERENCE.md)** (en inglés): cada comando, skill y hook al detalle,
  con sus argumentos, las herramientas MCP que usan y las reglas que siguen. Es la fuente
  de verdad si usas el plugin a diario.
- [README del plugin](plugins/hilbana/README.md): qué incluye, requisitos, verificación,
  contabilidad de tokens y privacidad.
- [CHANGELOG](CHANGELOG.md): qué cambió en cada versión.

## Guías, ejemplos y prompts

- **[Hilbana + Claude Code](guides/claude-code.es.md)**: el plugin o una conexión MCP a
  secas, cómo comprobar que funciona y tu primer ciclo. ([English](guides/claude-code.md))
- **[Hilbana + Beads](guides/beads.es.md)**: usar Beads para el plan propio del agente e
  Hilbana para el tablero del equipo y la memoria compartida, sin duplicar trabajo.
  ([English](guides/beads.md))
- **[Hilbana + engram](guides/engram.es.md)**: usar las dos a la vez o pasar tu memoria de
  engram a Hilbana, con el mapa de tipos y un prompt de importación.
  ([English](guides/engram.md))
- **[Ejemplos de memoria](examples/memory)** (en inglés): seis memorias realistas, una por
  tipo, con lo que hace buena o mala a cada una.
- **[Prompts de inicio](prompts/README.md)**: prompts para pegar en los momentos que
  importan y un fragmento para `AGENTS.md` / `CLAUDE.md`. En inglés y en español.

## Qué hay aquí

```
.claude-plugin/marketplace.json   el marketplace (una sola entrada: hilbana)
plugins/hilbana/                  el plugin: comandos, skills, hooks, scripts, MCP
guides/                           Hilbana + Claude Code, Hilbana + Beads, Hilbana + engram (es, en)
examples/memory/                  seis memorias de ejemplo, una por tipo
prompts/                          prompts de inicio y un fragmento de AGENTS.md (es, en)
```

Hilbana es un producto alojado y su código **no** es de código abierto. Este repositorio
contiene lo que ejecutas en tu propia máquina.

## Cómo contribuir

Antes de subir cambios, ejecuta el validador:

```bash
node scripts/validate-plugin.mjs
```

La integración continua lo ejecuta en cada push y PR, y otra vez como puerta antes de
publicar una versión. Protege contra un fallo que ya nos pasó: Claude Code descarta **en
silencio** un componente cuyo frontmatter no se puede interpretar, así que un `:` suelto
en un `description` puede quitar un comando sin que falle nada. De ahí la regla que
impone: `description` y `argument-hint` van **siempre entre comillas dobles**.

## Versiones

Las versiones se publican como [releases](https://github.com/hilbana/claude-plugin/releases)
y quedan en el [CHANGELOG](CHANGELOG.md). Para enterarte de las nuevas, pon el repo en
**Watch → Custom → Releases**: Claude Code no avisa por sí solo, solo muestra una
actualización cuando abres `/plugin`.

Para actualizar:

```bash
/plugin marketplace update hilbana
/plugin install hilbana@hilbana
```

Después reinicia Claude Code (o ejecuta `/reload-plugins`).

## Privacidad

El plugin **no contiene secretos**. Tu API key vive solo en la configuración local de
Claude Code (`userConfig`, marcada como `sensitive`) y nunca se publica aquí.

## Licencia

[MIT](LICENSE)

# Plugin de Hilbana para Claude Code

Marketplace oficial del plugin **`hilbana`** para [Claude Code](https://claude.com/claude-code):
memoria persistente de agentes por proyecto, el framework de trabajo humano + agente
y el MCP de [Hilbana](https://app.hilbana.com) auto-registrado.

## Instalación

```bash
/plugin marketplace add hilbana/claude-plugin
/plugin install hilbana@hilbana
```

Reinicia Claude Code. Al instalar te pedirá tu **API key** de Hilbana (formato
`hil_…`, se crea en *Ajustes → API keys* de tu workspace) y, opcionalmente, la
**URL base** si tienes una instalación self-hosted.

El detalle completo —qué trae, requisitos, verificación, contabilidad de tokens y
privacidad— está en el [README del plugin](plugins/hilbana/README.md).

## Contenido

```
.claude-plugin/marketplace.json   el marketplace (una sola entrada: hilbana)
plugins/hilbana/                  el plugin: commands, skills, hooks, scripts, MCP
```

## Versiones

Las versiones se publican como [releases](https://github.com/hilbana/claude-plugin/releases)
y se anotan en el [CHANGELOG](CHANGELOG.md). Para enterarte de las nuevas, pon el
repo en **Watch → Custom → Releases**: Claude Code no avisa por su cuenta, solo
muestra la actualización cuando abres `/plugin`.

Para actualizar:

```bash
/plugin marketplace update hilbana
/plugin install hilbana@hilbana
```

Y reinicia Claude Code (o `/reload-plugins`).

### Qué cuenta como patch, minor o major

La `version` de `plugin.json` es la fuente: al cambiarla en `main` se publica la
release sola. Criterio:

| Cambio | Salto |
|--------|-------|
| Arreglo en un command, skill o hook sin cambiar cómo se usa | **patch** (1.2.0 → 1.2.1) |
| Command, skill o hook nuevo; comportamiento nuevo opcional | **minor** (1.2.0 → 1.3.0) |
| Renombrar o quitar un command/skill, cambiar el nombre o el significado de un `userConfig`, o cualquier cosa que obligue al usuario a tocar su configuración | **major** (1.2.0 → 2.0.0) |

Un plugin no tiene API que romper, pero sí memoria muscular: si alguien tiene
`/hilbana-finish` en los dedos y desaparece, eso es un major.

## Privacidad

El plugin **no contiene secretos**: tu API key vive solo en tu configuración local
de Claude Code (`userConfig`, marcada `sensitive`) y nunca se publica aquí.

## Licencia

[MIT](LICENSE)

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

## Privacidad

El plugin **no contiene secretos**: tu API key vive solo en tu configuración local
de Claude Code (`userConfig`, marcada `sensitive`) y nunca se publica aquí.

## Licencia

[MIT](LICENSE)

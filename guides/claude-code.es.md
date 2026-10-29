# Hilbana + Claude Code

Dos formas de conectar Claude Code con Hilbana. Elige una; no necesitas las dos.

| | **Plugin** (recomendado) | **MCP a secas** |
|---|---|---|
| Qué obtienes | El servidor MCP, **memoria persistente con hooks automáticos**, contabilidad de tokens por tarea y los comandos `/hilbana:…` | El servidor MCP y sus herramientas, nada más |
| Instalación | Dos comandos y una API key | Un comando |
| Para quién | Trabajar a diario con agentes sobre el tablero de un equipo | Probar Hilbana, o un cliente distinto de Claude Code |

## Opción A · El plugin

Necesita **Node 18+** en tu `PATH` (los hooks se ejecutan con `node`; sin él
simplemente no corren y tu sesión no se ve afectada).

1. **Crea una API key** en Hilbana: *Ajustes → API keys*, en **el workspace en el que
   trabajas**. Las herramientas y la memoria operan sobre el workspace de esa key, así
   que una key de otro workspace deja tu trabajo en el sitio equivocado. Las keys
   tienen la forma `hil_…`.
2. **Instala**, dentro de Claude Code:

   ```bash
   /plugin marketplace add hilbana/claude-plugin
   /plugin install hilbana@hilbana
   ```

3. Cuando te lo pida, pega la **API key**. Deja la **URL base** vacía salvo que la
   alojes tú.
4. **Reinicia Claude Code.**

### Comprueba que funciona

- Ejecuta `/mcp`: debe aparecer un servidor llamado `plugin_hilbana_hilbana` conectado.
- Escribe `/hilbana:` y salen los comandos (`claim-next`, `finish`, `plan`, …).
- Abre un repo y pregunta: *«¿Qué sabes de este proyecto por la memoria?»* El hook
  `SessionStart` ya le ha dicho al agente que la cargue con `mem_context`.

### Tu primer ciclo

```text
/hilbana:plan <un objetivo en texto libre>   → issues con definición de hecho
/hilbana:claim-next                           → un agente coge la siguiente lista
   … el agente trabaja …
/hilbana:finish                               → verifica, la deja en revisión, guarda memoria
/hilbana:review                               → tú (u otro agente) aprueba o devuelve
```

Cada paso está explicado en [REFERENCE.md](../REFERENCE.md) (en inglés). Los prompts de
inicio para pegar están en [prompts](../prompts).

## Opción B · MCP a secas, con OAuth

Sin plugin y sin API key que copiar. Claude Code abre una ventana del navegador y tú
apruebas la conexión (OAuth con registro dinámico de clientes):

```bash
claude mcp add --transport http hilbana https://app.hilbana.com/mcp
```

Después ejecuta `/mcp` dentro de Claude Code y autentica el servidor `hilbana`.

Si prefieres una API key (para un trabajo de CI, por ejemplo):

```bash
claude mcp add --transport http hilbana https://app.hilbana.com/mcp \
  --header "Authorization: Bearer hil_tu_clave_aqui"
```

No subas nunca una key al repo. Guárdala en tu configuración local de Claude Code.

## La memoria, en un minuto

La memoria se organiza por **scope = el nombre de la carpeta del repo** y la comparte
todo el workspace. El agente guarda decisiones, bugs resueltos (con su causa raíz),
convenciones y trampas con `mem_save`, y las vuelve a cargar en la sesión siguiente con
`mem_context`. En [examples/memory](../examples/memory) tienes cómo es una buena memoria.

## Si algo falla

- **No salen los comandos.** Reinicia Claude Code, o ejecuta `/reload-plugins`.
- **`401` o «credencial inválida».** La key está incompleta, revocada o caducada. Crea
  otra y pégala entera: solo se muestra una vez.
- **El trabajo del agente aparece en otro workspace.** La key es de otro workspace.
  Crea una en el correcto.
- **Los hooks no hacen nada.** Comprueba que `node --version` sea 18 o superior.

Más: [documentación del plugin de Claude Code](https://hilbana.com/docs/plugin-claude-code/) ·
[MCP y API](https://hilbana.com/docs/api-mcp/).

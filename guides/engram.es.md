# Hilbana + engram

[engram](https://github.com/Gentleman-Programming/engram) es una memoria persistente
para agentes de IA: un único binario en Go, con una base SQLite local (`~/.engram/engram.db`),
un servidor MCP y un plugin para Claude Code. Es de Gentleman Programming y es lo que
muchos usamos para que el agente no empiece cada sesión de cero.

Hilbana guarda memoria por proyecto con las mismas herramientas (`mem_save`,
`mem_search`, `mem_context`, `mem_session_summary`), pero en el servidor y compartida por
el workspace, junto a las issues, la cola de tareas y la revisión.

La diferencia, en una frase:

> engram le da memoria a **tu agente en tu máquina**. Hilbana la pone donde la ven tus
> **compañeros y sus agentes**, al lado del tablero.

No hace falta elegir a la fuerza. Esta guía cubre las dos cosas: usar las dos a la vez
mientras te decides, y pasarte del todo si quieres.

## Cuándo te conviene cada una

| Quieres… | Usa |
|---|---|
| Memoria **solo tuya**, sin cuenta ni servidor, que funciona sin conexión | **engram** |
| Que lo que aprende un agente lo sepa el **resto del equipo** en su próxima sesión | **Hilbana** |
| Que la memoria acompañe al proyecto entre máquinas y personas sin pasos de git | **Hilbana** |
| Memoria enlazada a **issues**, con cola de tareas y revisión | **Hilbana** |
| Tener los datos en un fichero que controlas del todo | **engram** |

Si trabajas solo y en una máquina, engram te basta. Hilbana empieza a merecer la pena
cuando hay más de una persona, más de una máquina, o cuando quieres que la memoria
viva junto a las tareas.

## Se parecen más de lo que parece

El modelo es el mismo, así que el cambio cuesta poco:

| engram | Hilbana |
|---|---|
| `project` (el nombre del proyecto) | `scope` (el nombre de la carpeta del repo) |
| `mem_save`, `mem_search`, `mem_context` | las mismas tres, con el mismo nombre |
| `mem_session_summary` | `mem_session_summary` |
| `topic_key` (clave estable de un tema, sirve para actualizarlo) | `topic_key` agrupa memorias del mismo tema; para **sustituir** una, `replaces` con el id de la anterior |
| `type`: `decision`, `bugfix`, `discovery`… | `type`: `decision`, `bug`, `convention`, `discovery`, `preference`, `fact`, `note` |

Una trampa: el campo `scope` de engram **no** es el `scope` de Hilbana. El equivalente
del `scope` de Hilbana es el `project` de engram.

## Opción A · Usar las dos a la vez

Puedes tener los dos plugins instalados. Son almacenes distintos y no se pisan.

```bash
# engram, si aún no lo tienes
brew install gentleman-programming/tap/engram
engram setup claude-code

# Hilbana: dentro de Claude Code
/plugin marketplace add hilbana/claude-plugin
/plugin install hilbana@hilbana
```

Con los dos activos, el agente ve **dos juegos de herramientas** con el mismo nombre y
distinto prefijo (`mcp__plugin_engram_…` y `mcp__plugin_hilbana_hilbana__…`). Dile cuál
manda para cada cosa, o acabará guardando lo mismo dos veces. Una regla razonable:

- **Hilbana**: lo que el equipo debe saber (decisiones, causa raíz de un bug,
  convenciones del repo, trampas).
- **engram**: lo que solo te sirve a ti (cómo prefieres trabajar, notas personales).

Esto es una forma de repartir, no una sincronización. **Nada pasa solo de engram a
Hilbana ni al revés.**

## Opción B · Pasarte a Hilbana

El plugin de Hilbana trae un comando que te acompaña paso a paso, sin tocar nada tuyo
sin preguntar:

```text
/hilbana:memoria-switch
```

Lo que hace, y lo que puedes hacer tú a mano:

1. **Comprueba que Hilbana funciona en tu repo**: guarda una nota de prueba, la busca y
   la recupera con `mem_context`. Si el ciclo cierra, el cambio ya va.
2. **Convivencia unos días.** Sigue guardando también en engram mientras compruebas que
   recuperas bien desde Hilbana. Si echas algo en falta, lo migras o lo vuelves a guardar.
3. **Retira el plugin de engram** cuando ya no lo uses: desactívalo con
   `claude plugin disable engram@engram` (o desde `/plugin`). **Conserva `~/.engram/engram.db`** hasta haber migrado lo que
   quieras; borrarlo no se deshace.
4. **(Opcional) Importa el histórico.**

### Importar el histórico

engram exporta a JSON:

```bash
engram export engram-export.json
```

En la versión 1.17.0 que probamos, `engram export` vuelca **todos** tus proyectos y no admite
`--project` ni `--all`. El README de engram describe esas opciones, así que en versiones
más recientes quizá funcionen; comprueba que el fichero solo trae lo que esperas. Con
cualquier versión sirve lo mismo: exportar todo y quedarte con el `project` que te interesa.

> Dos cuidados con el export:
> - **El primer argumento es siempre el nombre del fichero.** `engram export --help` o
>   `engram export --project x` no muestran ayuda ni filtran: crean un fichero llamado
>   `--help` o `--project` con todas tus memorias.
> - **Ese fichero tiene todos tus proyectos, también los personales.** No lo subas a ningún
>   sitio y bórralo cuando termines.

No hay un comando de importación masiva en Hilbana: la migración la hace tu agente,
leyendo el JSON y llamando a `mem_save` observación a observación. Pídeselo así:

> Lee `engram-export.json` y quédate solo con las observaciones cuyo `project` sea
> `milindri`. Para cada una, guárdala en Hilbana con `mem_save`
> con `scope: "milindri"`, el `title` y el `content` juntos como contenido (`mem_save` no
> tiene campo de título), el `type` traducido según la tabla y el mismo `topic_key`.
> Antes de escribir nada,
> enséñame un resumen: cuántas hay por tipo y a qué scope irían. Salta las de tipo
> `session_summary` antiguas y todo lo que sea personal o solo valga en mi máquina.

Mapa de tipos que funciona bien:

| engram | Hilbana |
|---|---|
| `decision`, `architecture` | `decision` |
| `bugfix`, `bug`, `solution` | `bug` |
| `convention`, `pattern`, `config` | `convention` |
| `discovery`, `learning` | `discovery` |
| `feedback` | `preference` |
| `project`, `reference` | `fact` |
| `manual`, `milestone`, `session_summary` | `note` |

Dos consejos antes de importar:

- **La memoria de Hilbana la ve todo el workspace.** Revisa que no suba rutas absolutas,
  puertos locales, claves ni preferencias personales. Es la parte que más conviene mirar
  en el resumen previo.
- **No migres todo por inercia.** Un histórico con ruido hace peor al agente. Muchas
  veces compensa importar solo decisiones, bugs con su causa raíz y convenciones.

## Qué ganas y qué pierdes

- **Ganas:** memoria compartida entre personas y máquinas, enlazada a issues y a la cola
  de tareas; `replaces` para que quede una sola versión de cada hecho.
- **Pierdes:** funcionar sin conexión y sin cuenta, y el control total del fichero.
  Hilbana guarda la memoria en su servidor.
- **No se traspasa:** las sesiones y los prompts guardados de engram; solo las
  observaciones.

## Consulta la documentación de engram

engram evoluciona rápido. Los comandos de esta guía salen de su README y de su
`DOCS.md` en el momento de escribirla; para cualquier otra cosa, el
[repositorio de engram](https://github.com/Gentleman-Programming/engram) es la fuente de
verdad.

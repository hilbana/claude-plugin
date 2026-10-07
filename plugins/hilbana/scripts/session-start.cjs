#!/usr/bin/env node
// Hook SessionStart del plugin: inyecta el protocolo de memoria
// de Hilbana (reemplazo de engram). Calcula el scope y el git remote del repo
// (ver repo-scope.cjs) y recuerda al agente cargar/guardar memoria por las tools
// mcp__hilbana__mem_*. No llama al MCP (un hook es un shell command); solo
// inyecta el recordatorio como contexto.
const { resolveRepoScope } = require("./repo-scope.cjs");

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => finish(input));

function finish(raw) {
  let cwd = process.cwd();
  try {
    const j = JSON.parse(raw || "{}");
    if (j && typeof j.cwd === "string" && j.cwd) cwd = j.cwd;
  } catch (_) {
    /* stdin no-JSON: usamos process.cwd() */
  }
  const { scope, gitRemote, source } = resolveRepoScope(cwd);

  // Los argumentos de identidad que el agente repite en cada llamada.
  const id = gitRemote
    ? `"scope": "${scope}", "git_remote": "${gitRemote}"`
    : `"scope": "${scope}"`;
  const origen =
    source === "file"
      ? `(fijado en .hilbana/scope del repo; no pases git_remote)`
      : source === "remote"
        ? `(el nombre de la carpeta) y git_remote "${gitRemote}": pásalos los dos en cada tool mem_*; ` +
          `con el remote compartes memoria con quien clonó este repo en otra carpeta`
        : `(el nombre de la carpeta del repo)`;

  const ctx =
    `MEMORIA HILBANA — protocolo activo (reemplazo de engram). ` +
    `Scope de este proyecto: "${scope}" ${origen}. ` +
    `Usa las tools de memoria del servidor MCP de Hilbana (mem_context, mem_search, mem_save, ` +
    `mem_session_summary); el prefijo exacto depende de cómo esté registrado el MCP en tu cliente ` +
    `(con este plugin instalado son mcp__plugin_hilbana_hilbana__…; si registraste el MCP a mano, mcp__hilbana__…). ` +
    `Al ARRANCAR, carga el contexto de sesiones previas: ` +
    `mem_context { ${id} } (y mem_search para un tema concreto). ` +
    `Guarda con mem_save { ${id}, "type", "content" } lo que le ahorraría trabajo a una sesión futura: ` +
    `decisiones, bugs con su causa raíz, convenciones, descubrimientos y preferencias del usuario. ` +
    `La memoria la comparte el equipo: NO guardes lo que solo vale en tu máquina (rutas absolutas, ` +
    `puertos locales, nombres de máquina, tu configuración personal). Si algo guardado quedó obsoleto, ` +
    `sustitúyelo con mem_save { …, "replaces": "<id de la vieja>" } en vez de dejar dos versiones que se contradicen. ` +
    `Al CERRAR la sesión, antes de decir "listo": ` +
    `mem_session_summary { ${id}, "summary": "objetivo/logros/próximos pasos" }. ` +
    `type debe ser uno de: decision | bug | convention | discovery | preference | fact | note.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: ctx,
      },
    }),
  );
}

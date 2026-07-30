#!/usr/bin/env node
// Hook SessionStart del plugin: inyecta el protocolo de memoria
// de Hilbana (reemplazo de engram). Calcula el scope = nombre de la carpeta del
// repo y recuerda al agente cargar/guardar memoria por las tools
// mcp__hilbana__mem_*. No llama al MCP (un hook es un shell command); solo
// inyecta el recordatorio como contexto.
const path = require("path");

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
  const scope = path.basename(cwd.replace(/[\\/]+$/, "")) || "default";

  const ctx =
    `MEMORIA HILBANA — protocolo activo (reemplazo de engram). ` +
    `Scope de este proyecto: "${scope}" (el nombre de la carpeta del repo). ` +
    `Usa las tools de memoria del servidor MCP de Hilbana (mem_context, mem_search, mem_save, ` +
    `mem_session_summary); el prefijo exacto depende de cómo esté registrado el MCP en tu cliente ` +
    `(con este plugin instalado son mcp__plugin_hilbana_hilbana__…; si registraste el MCP a mano, mcp__hilbana__…). ` +
    `Al ARRANCAR, carga el contexto de sesiones previas: ` +
    `mem_context { "scope": "${scope}" } (y mem_search para un tema concreto). ` +
    `GUARDA PROACTIVAMENTE con mem_save { "scope": "${scope}", "type", "content" } ` +
    `tras cada decisión, bug (con causa raíz), convención, descubrimiento o preferencia del usuario — ` +
    `sin esperar a que te lo pidan. ` +
    `Al CERRAR la sesión, antes de decir "listo": ` +
    `mem_session_summary { "scope": "${scope}", "summary": "objetivo/logros/próximos pasos" }. ` +
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

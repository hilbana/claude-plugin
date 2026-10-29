// Configuración compartida de los hooks del plugin.
//
// POR QUÉ NO SE USA `env` EN hooks.json: la interpolación `${user_config.api_key}` en el
// bloque `env` de un hook NO llega (verificado en Windows con Claude Code 2.1.312: el
// hook arranca con la variable vacía). Lo que sí llega, y es la vía documentada, es
// `CLAUDE_PLUGIN_OPTION_<KEY>`: Claude Code exporta cada valor de `userConfig` al
// proceso del hook, también los marcados `sensitive`. Esa es la fuente de la clave.
//
// Hasta la 2.15.0 había un respaldo que leía el fichero de secretos de Claude Code
// en la carpeta de usuario. Se ha quitado: el hook solo lee lo que Claude
// Code le entrega para ESTE plugin y no abre ningún fichero de credenciales.
//
// Los hooks son silenciosos por diseño (no pueden romper la sesión del usuario): sin
// clave no hacen nada (opt-in).

const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_BASE_URL = "https://app.hilbana.com";

/**
 * Devuelve { apiKey, baseUrl }. `apiKey` vacía = el hook no debe hacer nada.
 * Orden: HILBANA_API_KEY (manual, p. ej. CI) y después la opción del plugin.
 *
 * OJO con self-hosted: una opción sin valor guardado no se exporta, así que `baseUrl`
 * cae al default; quien use una instalación propia la pone en `userConfig.base_url`
 * (llega por CLAUDE_PLUGIN_OPTION_BASE_URL) o exporta HILBANA_BASE_URL.
 */
function resolveConfig() {
  const apiKey = (process.env.HILBANA_API_KEY || process.env.CLAUDE_PLUGIN_OPTION_API_KEY || "").trim();
  const baseUrl = (process.env.HILBANA_BASE_URL || process.env.CLAUDE_PLUGIN_OPTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

/**
 * Traza opt-in a fichero. Los hooks tienen que ser silenciosos, así que sin esto un
 * fallo es indistinguible de "no había nada que hacer" — y depurarlo obliga a parchear
 * a mano la copia instalada del script. Se activa con HILBANA_HOOK_LOG=<ruta> (o =1
 * para el default en el temporal del sistema).
 */
function makeTracer(prefix) {
  const raw = process.env.HILBANA_HOOK_LOG;
  if (!raw) return () => {};
  const file =
    raw === "1" || raw.toLowerCase() === "true"
      ? path.join(os.tmpdir(), "hilbana-hooks.log")
      : raw;
  return (msg) => {
    try {
      fs.appendFileSync(file, `${new Date().toISOString()} [${prefix}] ${msg}\n`);
    } catch {
      // ni la traza puede romper el hook
    }
  };
}

module.exports = { resolveConfig, makeTracer, DEFAULT_BASE_URL };

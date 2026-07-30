// Configuración compartida de los hooks del plugin.
//
// POR QUÉ EXISTE ESTE FICHERO: los hooks reciben la API key por `env` desde el
// userConfig (`"HILBANA_API_KEY": "${user_config.api_key}"` en hooks.json), pero esa
// interpolación NO siempre llega: verificado el 2026-07-27 en Windows con el plugin
// 1.1.0 instalado, el hook arranca con la variable VACÍA. Como los hooks son
// silenciosos por diseño (no pueden romper la sesión del usuario), el efecto era que
// no hacían nada y sin dejar rastro: el reporte de tokens no llegaba nunca, y el
// guardado automático de memoria de `session-end.cjs` llevaba roto lo mismo sin que
// nadie lo notara.
//
// Así que el env es la fuente preferente y, si viene vacío, se lee la key del fichero
// de credenciales donde Claude Code guarda los secretos del plugin.
const fs = require("fs");
const os = require("os");
const path = require("path");

const PLUGIN_ID = "hilbana@hilbana";
const DEFAULT_BASE_URL = "https://app.hilbana.com";

/** La key del plugin en el store de secretos de Claude Code, o "" si no está. */
function apiKeyFromCredentials() {
  try {
    const p = path.join(os.homedir(), ".claude", ".credentials.json");
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    const v = j?.pluginSecrets?.[PLUGIN_ID]?.api_key;
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

/**
 * Devuelve { apiKey, baseUrl }. `apiKey` vacía = el hook no debe hacer nada (opt-in).
 *
 * OJO con self-hosted: si el env no se interpola, `baseUrl` cae al default. No hay
 * dónde leerla (no es un secreto y no queda en .credentials.json), así que quien use
 * una instalación propia debe exportar HILBANA_BASE_URL en el entorno.
 */
function resolveConfig() {
  const apiKey = (process.env.HILBANA_API_KEY || "").trim() || apiKeyFromCredentials();
  const baseUrl = (process.env.HILBANA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
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

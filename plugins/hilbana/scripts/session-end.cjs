#!/usr/bin/env node
// Hook SessionEnd del plugin: al cerrar la sesión, resume lo
// trabajado a partir del transcript y lo GUARDA en la memoria de Hilbana
// (reemplazo del guardado automático de engram). Determinista: corre al cerrar.
//
// La API key y la URL llegan por env desde el userConfig del plugin
// (HILBANA_API_KEY / HILBANA_BASE_URL). scope = nombre de la carpeta del repo.
// Silencioso ante cualquier error (no rompe el cierre).
//
// Dry-run: con HILBANA_HOOK_DRYRUN=1 imprime el payload en vez de enviarlo.
const fs = require("fs");
const path = require("path");
const { resolveConfig, makeTracer } = require("./plugin-config.cjs");

// La key sale del env (userConfig) y, si esa interpolación no llega, del
// store de credenciales del plugin. Sin ese respaldo este hook NUNCA guardaba: la
// variable llegaba vacía y el `if (!API_KEY) return` de abajo lo cortaba en silencio.
// Ver plugin-config.cjs.
const { apiKey: API_KEY, baseUrl: BASE_URL } = resolveConfig();
const API_URL = `${BASE_URL}/api/memory`;
const trace = makeTracer("memoria");
const MAX_PEDIDO = 600;
const MAX_RESULTADO = 1800;
const MAX_FICHEROS = 40;

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => void main(input));

function parseTranscript(p) {
  try {
    return fs
      .readFileSync(p, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Mensajes REALES del humano (descarta tool_results e inyecciones del harness).
function userTexts(t) {
  const out = [];
  for (const line of t) {
    if (line.type !== "user") continue;
    const c = line.message?.content;
    let text = "";
    if (typeof c === "string") text = c;
    else if (Array.isArray(c)) {
      if (c.some((b) => b.type === "tool_result")) continue;
      text = c.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    }
    text = (text || "").trim();
    if (!text) continue;
    if (/^<(command-|local-command|system-reminder|task-notification|user-prompt)/.test(text)) continue;
    if (text.includes("<command-name>") || text.includes("<local-command-stdout>")) continue;
    out.push(text.replace(/\s+/g, " ").trim());
  }
  return out;
}

function lastAssistantText(t) {
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i].type !== "assistant") continue;
    const c = t[i].message?.content;
    if (Array.isArray(c)) {
      const txt = c.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (txt) return txt;
    }
  }
  return "";
}

function editedFiles(t) {
  const files = new Set();
  for (const line of t) {
    if (line.type !== "assistant") continue;
    const c = line.message?.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type === "tool_use" && ["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(b.name)) {
        const fp = b.input?.file_path;
        if (fp) files.add(path.basename(String(fp)));
      }
    }
  }
  return [...files];
}

const trunc = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);

async function main(raw) {
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {}
  const cwd = typeof data.cwd === "string" && data.cwd ? data.cwd : process.cwd();
  const scope = path.basename(cwd.replace(/[\\/]+$/, "")) || "default";
  const tpath = data.transcript_path;
  if (!tpath) return;

  const t = parseTranscript(tpath);
  const prompts = userTexts(t);
  const files = editedFiles(t);
  const closing = lastAssistantText(t);

  const sustancial = files.length > 0 || prompts.length >= 2;
  if (prompts.length === 0 || !sustancial) return;

  const parts = [`## Sesión (${scope})`, "", `**Pedido:** ${trunc(prompts[0], MAX_PEDIDO)}`];
  if (files.length) parts.push("", `**Ficheros tocados:** ${files.slice(0, MAX_FICHEROS).join(", ")}`);
  if (closing) parts.push("", `**Resultado (cierre):** ${trunc(closing, MAX_RESULTADO)}`);

  const payload = {
    scope,
    scope_name: scope,
    type: "note",
    topic_key: "session-summary",
    content: parts.join("\n"),
    session_id: typeof data.session_id === "string" ? data.session_id : undefined,
  };

  if (process.env.HILBANA_HOOK_DRYRUN === "1") {
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    return;
  }
  if (!API_KEY) {
    trace("sin API key: no guardo nada (opt-in)");
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(payload),
    });
    trace(`POST ${res.status}`);
  } catch (e) {
    // silencioso: el cierre de la sesión nunca debe fallar por esto
    trace(`fallo de red: ${e && e.message}`);
  }
}

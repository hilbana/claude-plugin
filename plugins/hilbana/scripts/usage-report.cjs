#!/usr/bin/env node
// Reporta a Hilbana los tokens que ha gastado el agente,
// para que el consumo quede imputado a la issue que se está trabajando.
//
// POR QUÉ UN HOOK Y NO EL PROPIO AGENTE: un LLM no sabe lo que consume; si se le
// pide que lo reporte, se lo inventa. El dato fiable está en el transcript, y este
// hook lo lee y lo manda solo. El agente no llama a nada.
//
// CÓMO: en cada Stop (y en SessionEnd, para el último tramo) recorre el transcript,
// deduplica por `message.id`, agrupa por modelo, y manda a POST /api/agents/usage
// SOLO lo posterior al último mensaje ya enviado. El servidor decide a qué issue
// imputarlo mirando el claim vivo de la API key: aquí no se adivina nada.
//
// La API key y la URL llegan por env desde el userConfig del plugin
// (HILBANA_API_KEY / HILBANA_BASE_URL). Sin key, el hook no hace nada (opt-in).
// Silencioso ante cualquier error: esto corre en el camino crítico del usuario y
// jamás puede romper ni ensuciar su sesión.
//
// Dry-run: con HILBANA_HOOK_DRYRUN=1 imprime el payload en vez de enviarlo.
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { resolveConfig, makeTracer } = require("./plugin-config.cjs");

// La key viene del env (userConfig) y, si esa interpolación no llega, del store de
// credenciales del plugin. Ver plugin-config.cjs: sin ese respaldo el hook arrancaba
// con la key vacía y se callaba, así que no reportaba nada nunca.
const { apiKey: API_KEY, baseUrl: BASE_URL } = resolveConfig();
const API_URL = `${BASE_URL}/api/agents/usage`;
const AGENT_NAME = process.env.HILBANA_AGENT_NAME || "claude-code";
const trace = makeTracer("usage");

// Un fichero de cursor POR SESIÓN, no un JSON compartido: dos sesiones que cierran
// turno a la vez no se pisan al escribir.
const CURSOR_DIR = path.join(os.homedir(), ".claude", "hilbana-usage");
const CURSOR_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => void main(input));

const cursorFile = (sessionId) =>
  path.join(CURSOR_DIR, `${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);

function readCursor(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(cursorFile(sessionId), "utf8")).cursor || null;
  } catch {
    return null;
  }
}

function writeCursor(sessionId, cursor) {
  try {
    fs.mkdirSync(CURSOR_DIR, { recursive: true });
    fs.writeFileSync(cursorFile(sessionId), JSON.stringify({ cursor, at: Date.now() }));
  } catch {
    // si no se puede persistir, el siguiente Stop reenviará: el servidor es
    // idempotente por cursor, así que como mucho se repite una llamada inútil.
  }
}

// Borra cursores de sesiones viejas para no acumular basura indefinidamente.
function pruneCursors() {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(CURSOR_DIR)) {
      const p = path.join(CURSOR_DIR, f);
      try {
        if (now - fs.statSync(p).mtimeMs > CURSOR_TTL_MS) fs.unlinkSync(p);
      } catch {}
    }
  } catch {}
}

/**
 * Lee el transcript en STREAMING (línea a línea, sin cargarlo entero: son ficheros
 * de decenas de MB y esto corre en el camino crítico) y devuelve los mensajes de
 * asistente con `usage`, EN ORDEN y deduplicados por `message.id`.
 *
 * La deduplicación es el paso crítico: el mismo mensaje aparece en varias líneas
 * del JSONL (un evento por bloque de contenido). En un transcript real de este
 * repo, de 1.604 líneas con `usage` solo 892 eran ids distintos — sumar por línea
 * infla la cifra un 80%.
 *
 * Los mensajes de subagentes (Task) van al MISMO transcript, así que se cuentan
 * solos: su consumo es consumo de la tarea.
 */
async function readMessages(transcriptPath) {
  const out = [];
  const seen = new Set();
  const rl = readline.createInterface({
    input: fs.createReadStream(transcriptPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue; // línea a medio escribir: la recogerá el siguiente Stop
    }
    if (o.type !== "assistant") continue;
    const m = o.message;
    const u = m && m.usage;
    if (!u || !m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({
      id: m.id,
      model: m.model || "unknown",
      inputTokens: u.input_tokens || 0,
      outputTokens: u.output_tokens || 0,
      cacheReadTokens: u.cache_read_input_tokens || 0,
      cacheWriteTokens: u.cache_creation_input_tokens || 0,
    });
  }
  return out;
}

/**
 * Suma por modelo los mensajes del tramo, descartando los modelos que no consumieron
 * nada. Claude Code emite mensajes sintéticos (`model: "<synthetic>"`, avisos e
 * interrupciones del harness) con `usage` a cero: sin este filtro se crea una fila de
 * consumo con todo a cero que no aporta nada y ensucia los cortes por modelo, donde
 * aparecería "<synthetic>" como si fuera un modelo más.
 */
function groupByModel(messages) {
  const acc = new Map();
  for (const m of messages) {
    const prev =
      acc.get(m.model) ||
      { model: m.model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    prev.inputTokens += m.inputTokens;
    prev.outputTokens += m.outputTokens;
    prev.cacheReadTokens += m.cacheReadTokens;
    prev.cacheWriteTokens += m.cacheWriteTokens;
    acc.set(m.model, prev);
  }
  return [...acc.values()].filter(
    (e) =>
      e.inputTokens + e.outputTokens + e.cacheReadTokens + e.cacheWriteTokens > 0
  );
}

async function main(raw) {
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {}

  const sessionId = typeof data.session_id === "string" ? data.session_id : "";
  const transcriptPath = typeof data.transcript_path === "string" ? data.transcript_path : "";
  if (!sessionId || !transcriptPath) {
    trace("sin session_id o transcript_path en stdin");
    return;
  }
  if (!API_KEY && process.env.HILBANA_HOOK_DRYRUN !== "1") {
    trace("sin API key: no hago nada (opt-in)");
    return; // opt-in
  }

  let messages;
  try {
    messages = await readMessages(transcriptPath);
  } catch (e) {
    trace(`transcript ilegible: ${e && e.message}`);
    return; // transcript ilegible: no es asunto nuestro romper la sesión
  }
  if (messages.length === 0) {
    trace("el transcript no tiene mensajes con usage");
    return;
  }

  // Solo lo POSTERIOR al último mensaje ya enviado. Si el cursor guardado no
  // aparece en el transcript (sesión reanudada, fichero rotado), se manda todo:
  // es preferible a perder el consumo, y el servidor descarta el reenvío exacto.
  const saved = readCursor(sessionId);
  let delta = messages;
  if (saved) {
    const idx = messages.findIndex((m) => m.id === saved);
    if (idx >= 0) delta = messages.slice(idx + 1);
  }
  if (delta.length === 0) {
    trace("nada nuevo desde el último envío");
    return; // dos Stop seguidos no suman nada
  }

  const cursor = delta[delta.length - 1].id;
  const usage = groupByModel(delta);
  trace(
    `delta=${delta.length} de ${messages.length} mensajes, ${usage.length} modelo(s)`
  );

  if (process.env.HILBANA_HOOK_DRYRUN === "1") {
    process.stdout.write(
      JSON.stringify({ sessionId, agentName: AGENT_NAME, cursor, usage }, null, 2) + "\n"
    );
    return;
  }

  // Todo el tramo era consumo cero (mensajes sintéticos del harness): no hay nada que
  // enviar, pero el cursor SÍ avanza. Si no, cada turno reintentaría el mismo tramo y
  // el servidor lo rechazaría con 400 por venir sin entradas.
  if (usage.length === 0) {
    trace("el tramo no consumió tokens; avanzo el cursor sin enviar");
    writeCursor(sessionId, cursor);
    return;
  }

  const payload = { sessionId, agentName: AGENT_NAME, cursor, usage };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(payload),
    });
    trace(`POST ${res.status}`);
    // El cursor avanza SOLO si el servidor aceptó: si el endpoint está caído, el
    // tramo se reintenta en el siguiente Stop y no se pierde nada.
    if (res.ok) {
      writeCursor(sessionId, cursor);
      pruneCursors();
    }
  } catch (e) {
    // silencioso a propósito: la sesión del agente nunca falla por telemetría
    trace(`fallo de red: ${e && e.message}`);
  }
}

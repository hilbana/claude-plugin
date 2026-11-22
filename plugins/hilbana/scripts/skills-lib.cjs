// Skills del workspace (DRAPPS-2780): instalar, actualizar y quitar en local las
// skills que el equipo publica en Hilbana, y avisar de versiones nuevas.
//
// Reglas que no se saltan:
//  - NADA se escribe sin un PLAN previo que enumera cada fichero que se va a
//    escribir, dependencias incluidas. Una skill puede traer scripts que se
//    ejecutan en esta máquina, y una dependencia la puede haber publicado otra
//    persona. El plan tiene un id (huella de lo que se va a escribir) y `apply`
//    solo escribe si el id sigue siendo el del plan que se enseñó.
//  - Lo que no instaló este plugin no se toca: una carpeta con el mismo nombre
//    que no está en el registro se respeta, y si era una dependencia la
//    instalación se detiene.
//  - Si la persona editó una skill instalada, actualizar no la pisa sin que lo
//    elija (conservar lo local u sobrescribir, con copia de seguridad).
//  - Los hooks son silenciosos: sin red, sin API key o con el servidor caído
//    no rompen la sesión.
//
// Node 18+, CommonJS, sin dependencias. Rutas con `path` y `os.homedir()`: vale
// igual en Windows, macOS y Linux.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { resolveConfig } = require("./plugin-config.cjs");

const RUNNABLE_EXT = new Set([
  ".sh", ".bash", ".zsh", ".fish", ".py", ".js", ".cjs", ".mjs", ".ts", ".ps1", ".bat", ".cmd", ".rb", ".pl", ".php",
]);

/** Contexto: credencial, URL y carpetas. Las carpetas se pueden mover con env (tests). */
function makeContext(over = {}) {
  const { apiKey, baseUrl } = resolveConfig();
  const home = os.homedir();
  return {
    apiKey,
    baseUrl,
    // La carpeta personal de skills de Claude Code: valen en todos los repos.
    skillsDir: process.env.HILBANA_SKILLS_DIR || path.join(home, ".claude", "skills"),
    stateDir: process.env.HILBANA_SKILLS_STATE || path.join(home, ".claude", "hilbana-skills"),
    timeoutMs: 20000,
    ...over,
  };
}

class SkillsError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Red                                                                 */
/* ------------------------------------------------------------------ */

async function http(ctx, method, urlPath, body) {
  if (!ctx.apiKey) throw new SkillsError("No hay API key de Hilbana configurada (opción api_key del plugin o HILBANA_API_KEY).");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ctx.timeoutMs);
  try {
    const res = await fetch(`${ctx.baseUrl}${urlPath}`, {
      method,
      headers: {
        authorization: `Bearer ${ctx.apiKey}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* sin cuerpo */
    }
    return { status: res.status, json };
  } catch (e) {
    throw new SkillsError(`No se pudo contactar con Hilbana (${ctx.baseUrl}): ${e && e.name === "AbortError" ? "tiempo de espera agotado" : e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(ctx, urlPath) {
  const r = await http(ctx, "GET", urlPath);
  if (r.status < 200 || r.status >= 300) {
    throw new SkillsError(`Hilbana respondió ${r.status}${r.json && r.json.error ? `: ${r.json.error}` : ""}`, r.status === 404 ? 4 : 1);
  }
  return r.json;
}

/* ------------------------------------------------------------------ */
/* Registro local                                                      */
/* ------------------------------------------------------------------ */

const registryFile = (ctx) => path.join(ctx.stateDir, "registry.json");

function readRegistry(ctx) {
  try {
    const j = JSON.parse(fs.readFileSync(registryFile(ctx), "utf8"));
    return { skills: j.skills || {}, pendingReports: j.pendingReports || [] };
  } catch {
    return { skills: {}, pendingReports: [] };
  }
}

function writeRegistry(ctx, reg) {
  fs.mkdirSync(ctx.stateDir, { recursive: true });
  const tmp = `${registryFile(ctx)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, ...reg }, null, 2));
  fs.renameSync(tmp, registryFile(ctx));
}

/* ------------------------------------------------------------------ */
/* Ficheros                                                            */
/* ------------------------------------------------------------------ */

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

function bytesOf(file) {
  return file.encoding === "base64" ? Buffer.from(file.content || "", "base64") : Buffer.from(file.content || "", "utf8");
}

/** ¿Se ejecutaría en esta máquina? (script por extensión, carpeta scripts/ o shebang). */
function isRunnable(rel, buf) {
  if (RUNNABLE_EXT.has(path.extname(rel).toLowerCase())) return true;
  if (/^(scripts|bin)\//i.test(rel)) return true;
  return buf.length > 2 && buf[0] === 0x23 && buf[1] === 0x21; // #!
}

/** Ruta relativa segura: nada de salirse de la carpeta de la skill. */
function safeRel(rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\0") || rel.includes("\\") || rel.startsWith("/")) return null;
  const parts = rel.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  return parts.join("/");
}

/** Ficheros que hay ahora en la carpeta de una skill: { rel: sha256 }. */
function scanDir(dir) {
  const out = {};
  const walk = (d, prefix) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full, rel);
      else if (ent.isFile()) out[rel] = sha256(fs.readFileSync(full));
    }
  };
  if (fs.existsSync(dir)) walk(dir, "");
  return out;
}

/** Diferencias entre lo que dejó el plugin y lo que hay ahora (lo que la persona tocó). */
function localChanges(entry, dir) {
  const now = scanDir(dir);
  const changes = [];
  for (const [rel, sum] of Object.entries(entry.files || {})) {
    if (!(rel in now)) changes.push(`${rel} (borrado)`);
    else if (now[rel] !== sum) changes.push(`${rel} (modificado)`);
  }
  for (const rel of Object.keys(now)) if (!(rel in (entry.files || {}))) changes.push(`${rel} (añadido)`);
  return changes;
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

/**
 * Baja una versión y la convierte en un paso del plan comparándola con lo que hay.
 * `reason`: por qué se instala (`chosen` | `dependency`).
 */
async function stepFor(ctx, reg, ws, name, reason, version) {
  const dl = await getJson(ctx, `/api/skills/${ws.id}/${encodeURIComponent(name)}/versions/${version || "latest"}/download`).catch((e) => {
    if (e.code === 4) return null;
    throw e;
  });
  if (!dl) return { name, workspace: ws, action: "blocked", blocked: "no tiene ninguna versión publicada todavía" };

  const files = new Map();
  for (const f of dl.files) {
    const rel = safeRel(f.path);
    if (!rel) throw new SkillsError(`La skill «${name}» trae una ruta no válida («${f.path}»): no se instala.`);
    files.set(rel, bytesOf(f));
  }
  const dir = path.join(ctx.skillsDir, name);
  const entry = reg.skills[name];
  const step = {
    name,
    workspace: ws,
    reason,
    toVersion: dl.version.number,
    contentHash: dl.version.contentHash,
    notes: dl.version.notes,
    publishedByName: dl.version.publishedByName,
    deps: dl.dependencies.map((d) => d.name),
    resolvedDeps: dl.resolvedDependencies.map((d) => d.name),
    files: { add: [], change: [], remove: [], unchanged: 0 },
    localChanges: [],
    // Para escribir: no sale en el plan que se enseña.
    payload: files,
  };

  const exists = fs.existsSync(dir);
  if (exists && !entry) {
    // Una carpeta que no instaló este plugin: no se toca nunca.
    return { ...step, action: "blocked", blocked: `ya existe la carpeta «${dir}» y no la instaló este plugin: no se sobrescribe` };
  }
  if (entry && entry.workspaceId !== ws.id) {
    return { ...step, action: "blocked", blocked: `ya hay una skill «${name}» instalada desde otro workspace («${entry.workspaceName}»): quítala antes o elige ese workspace` };
  }

  if (entry && exists) {
    step.fromVersion = entry.version;
    step.localChanges = localChanges(entry, dir);
    if (entry.version === dl.version.number && entry.contentHash === dl.version.contentHash) {
      const nothing = { add: [], change: [], remove: [], unchanged: files.size };
      // Ya estaba (como dependencia) y ahora la quiere la persona: no hay que escribir
      // nada, solo recordar que es suya para que quitar otra skill no se la lleve.
      if (reason === "chosen" && entry.reason !== "chosen") return { ...step, action: "promote", files: nothing };
      return { ...step, action: "skip", files: nothing };
    }
  }
  const prev = entry && exists ? entry.files : {};
  for (const [rel, buf] of files) {
    const info = { path: rel, bytes: buf.length, runnable: isRunnable(rel, buf) };
    if (!(rel in prev)) step.files.add.push(info);
    else if (prev[rel] !== sha256(buf)) step.files.change.push(info);
    else step.files.unchanged++;
  }
  for (const rel of Object.keys(prev)) if (!files.has(rel)) step.files.remove.push({ path: rel });
  step.action = entry && exists ? "update" : "install";
  return step;
}

/** Huella de lo que se va a escribir: si cambia entre el plan y apply, apply se niega. */
function planId(steps) {
  const h = crypto.createHash("sha256");
  for (const s of steps) {
    h.update(`${s.action}|${s.workspace && s.workspace.id}|${s.name}|${s.toVersion || ""}|${s.contentHash || ""}|${s.blocked || ""}\n`);
  }
  return h.digest("hex").slice(0, 16);
}

function publicPlan(kind, steps, extra = {}) {
  const blocked = steps.filter((s) => s.action === "blocked").map((s) => ({ name: s.name, reason: s.blocked }));
  return {
    kind,
    planId: planId(steps),
    canApply: blocked.length === 0 && steps.some((s) => s.action !== "skip"),
    blocked,
    steps: steps.map(({ payload, ...s }) => s),
    ...extra,
  };
}

async function findInCatalog(ctx, name, workspace) {
  const cat = await getJson(ctx, "/api/skills/catalog");
  const hits = [];
  for (const w of cat.workspaces) {
    for (const s of w.skills) {
      if (s.name === name && (!workspace || w.workspace.id === workspace || w.workspace.name.toLowerCase() === String(workspace).toLowerCase())) {
        hits.push({ ws: w.workspace, skill: s });
      }
    }
  }
  if (!hits.length) throw new SkillsError(`No hay ninguna skill «${name}»${workspace ? ` en el workspace «${workspace}»` : " en tus workspaces"}. Mira /hilbana:skills list.`, 4);
  if (hits.length > 1) {
    throw new SkillsError(
      `«${name}» existe en varios de tus workspaces (${hits.map((h) => h.ws.name).join(", ")}): indica cuál con --workspace <nombre>. No se elige en silencio.`,
      5,
    );
  }
  return hits[0];
}

async function buildInstall(ctx, name, opts = {}) {
  const reg = readRegistry(ctx);
  const { ws } = await findInCatalog(ctx, name, opts.workspace);
  const root = await stepFor(ctx, reg, ws, name, "chosen");
  if (root.action === "blocked") return { steps: [root], ws };
  const steps = [];
  // Las dependencias primero, en el orden en que hay que instalarlas.
  for (const dep of root.resolvedDeps) {
    const asChosen = reg.skills[dep] && reg.skills[dep].reason === "chosen";
    steps.push(await stepFor(ctx, reg, ws, dep, asChosen ? "chosen" : "dependency"));
  }
  steps.push(root);
  return { steps, ws };
}

function installPlan(name, steps) {
  const out = publicPlan("install", steps);
  // Si una dependencia choca, la instalación entera se detiene y lo explica.
  if (steps.some((s) => s.action === "blocked" && s.name !== name)) {
    out.blocked = out.blocked.map((x) => ({ ...x, reason: `${x.reason} (es una dependencia de «${name}», así que no se instala nada)` }));
    out.canApply = false;
  }
  return out;
}

async function planInstall(ctx, name, opts = {}) {
  return installPlan(name, (await buildInstall(ctx, name, opts)).steps);
}

async function buildUpdate(ctx, name) {
  const reg = readRegistry(ctx);
  const m = await getJson(ctx, "/api/skills/manifest");
  const steps = [];
  for (const e of m.skills) {
    if (name && e.name !== name) continue;
    if (e.conflict) {
      steps.push({ name: e.name, workspace: e.workspace, action: "blocked", blocked: "hay otra skill con ese nombre en otro de tus workspaces: instálala a mano con --workspace" });
      continue;
    }
    if (e.state === "unpublished") continue;
    const step = await stepFor(ctx, reg, e.workspace, e.name, e.reason);
    if (step.action !== "skip") steps.push(step);
  }
  if (name && !steps.length && !m.skills.some((e) => e.name === name)) {
    throw new SkillsError(`«${name}» no está entre las skills que te corresponden: instálala con /hilbana:skills install ${name}.`, 4);
  }
  // Lo que el servidor dice que ya no corresponde (borrada o que nadie necesita).
  for (const r of m.remove || []) {
    if (name && r.name !== name) continue;
    const entry = reg.skills[r.name];
    if (!entry || entry.workspaceId !== r.workspace.id) continue;
    steps.push(removalStep(ctx, entry, r.reason === "deleted" ? "la skill ya no existe en Hilbana" : "ninguna skill instalada la necesita"));
  }
  return { steps, conflicts: m.conflicts || [] };
}

async function planUpdate(ctx, name) {
  const { steps, conflicts } = await buildUpdate(ctx, name);
  return publicPlan("update", steps, { conflicts });
}

function removalStep(ctx, entry, why) {
  const dir = path.join(ctx.skillsDir, entry.name);
  const changes = fs.existsSync(dir) ? localChanges(entry, dir) : [];
  return {
    name: entry.name,
    workspace: { id: entry.workspaceId, name: entry.workspaceName },
    action: "remove",
    reason: entry.reason,
    fromVersion: entry.version,
    why,
    files: { add: [], change: [], remove: Object.keys(entry.files || {}).map((p) => ({ path: p })), unchanged: 0 },
    localChanges: changes,
  };
}

function buildRemove(ctx, name) {
  const reg = readRegistry(ctx);
  const entry = reg.skills[name];
  if (!entry) throw new SkillsError(`«${name}» no la instaló este plugin (o ya no está): no se toca.`, 4);
  const remaining = { ...reg.skills };
  delete remaining[name];
  // Qué sigue haciendo falta: lo elegido y, transitivamente, lo que necesita.
  const needed = new Set();
  const visit = (n) => {
    if (needed.has(n) || !remaining[n]) return;
    needed.add(n);
    for (const d of remaining[n].deps || []) visit(d);
  };
  for (const e of Object.values(remaining)) if (e.reason === "chosen") visit(e.name);
  const steps = [removalStep(ctx, entry, "la quitas tú")];
  for (const e of Object.values(remaining)) {
    if (e.reason === "dependency" && !needed.has(e.name)) steps.push(removalStep(ctx, e, `era dependencia de «${name}» y ninguna otra instalada la necesita`));
  }
  return { steps, entry };
}

async function planRemove(ctx, name) {
  return publicPlan("remove", buildRemove(ctx, name).steps, { rootName: name });
}

/* ------------------------------------------------------------------ */
/* Aplicar                                                             */
/* ------------------------------------------------------------------ */

function backupDir(ctx, name, dir) {
  const dest = path.join(ctx.stateDir, "backups", `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(dir, dest, { recursive: true });
  return dest;
}

function writeSkill(ctx, step) {
  const dir = path.join(ctx.skillsDir, step.name);
  const tmp = path.join(ctx.skillsDir, `.hilbana-tmp-${step.name}-${process.pid}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const written = {};
  for (const [rel, buf] of step.payload) {
    const dest = path.join(tmp, ...rel.split("/"));
    if (!path.resolve(dest).startsWith(path.resolve(tmp) + path.sep)) throw new SkillsError(`Ruta fuera de la carpeta de la skill: ${rel}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    written[rel] = sha256(buf);
  }
  // Se cambia de un golpe: o queda la versión vieja entera o la nueva entera.
  const old = `${dir}.hilbana-old`;
  fs.rmSync(old, { recursive: true, force: true });
  if (fs.existsSync(dir)) fs.renameSync(dir, old);
  try {
    fs.renameSync(tmp, dir);
  } catch (e) {
    if (fs.existsSync(old)) fs.renameSync(old, dir);
    throw e;
  }
  fs.rmSync(old, { recursive: true, force: true });
  return written;
}

/**
 * Ejecuta un plan. `expectedPlanId` es el del plan que se enseñó. Elecciones sobre
 * cambios locales: `keepLocal` (no tocar esa skill) y `overwriteLocal` (copia de
 * seguridad y sobrescribir/borrar). Una skill con cambios locales que no esté en
 * ninguna de las dos listas hace que se niegue.
 */
async function applyPlan(ctx, plan, steps, expectedPlanId, choices = {}) {
  if (!expectedPlanId || expectedPlanId !== plan.planId) {
    throw new SkillsError("Lo que se iba a escribir ha cambiado desde el plan que se enseñó (¿se ha publicado otra versión?). Pide el plan otra vez y revísalo antes de aplicar.", 6);
  }
  if (plan.blocked.length) throw new SkillsError(`No se puede aplicar: ${plan.blocked.map((b) => `${b.name}: ${b.reason}`).join("; ")}`, 3);
  const keep = new Set(choices.keepLocal || []);
  const over = new Set(choices.overwriteLocal || []);
  const pending = steps.filter((s) => s.localChanges && s.localChanges.length && !keep.has(s.name) && !over.has(s.name) && s.action !== "skip");
  if (pending.length) {
    throw new SkillsError(
      `Hay cambios locales sin resolver en: ${pending.map((s) => s.name).join(", ")}. Elige --keep-local <nombre> (no se toca) o --overwrite-local <nombre> (copia de seguridad y se sobrescribe).`,
      7,
    );
  }

  const reg = readRegistry(ctx);
  const done = [];
  const reports = [];
  fs.mkdirSync(ctx.skillsDir, { recursive: true });

  for (const step of steps) {
    if (step.action === "skip") continue;
    const dir = path.join(ctx.skillsDir, step.name);
    if (step.localChanges && step.localChanges.length && keep.has(step.name)) {
      done.push({ name: step.name, result: "conservada (cambios locales)" });
      continue;
    }
    let backup = null;
    if (step.localChanges && step.localChanges.length && over.has(step.name) && fs.existsSync(dir)) backup = backupDir(ctx, step.name, dir);

    if (step.action === "promote") {
      reg.skills[step.name].reason = "chosen";
      done.push({ name: step.name, result: "pasa a elegida por ti" });
      writeRegistry(ctx, reg);
      continue;
    }
    if (step.action === "remove") {
      fs.rmSync(dir, { recursive: true, force: true });
      delete reg.skills[step.name];
      reports.push({ workspaceId: step.workspace.id, name: step.name, version: null });
      done.push({ name: step.name, result: "retirada", backup });
    } else {
      const files = writeSkill(ctx, step);
      reg.skills[step.name] = {
        name: step.name,
        workspaceId: step.workspace.id,
        workspaceName: step.workspace.name,
        version: step.toVersion,
        contentHash: step.contentHash,
        reason: step.reason,
        deps: step.deps,
        files,
        installedAt: new Date().toISOString(),
      };
      reports.push({ workspaceId: step.workspace.id, name: step.name, version: step.toVersion, hash: step.contentHash });
      done.push({ name: step.name, result: step.action === "install" ? "instalada" : "actualizada", version: step.toVersion, backup });
    }
    writeRegistry(ctx, reg);
  }

  // Lo que el servidor ya conoce como elegido/quitado (solo en install/remove de una skill).
  if (choices.choice) {
    await http(ctx, "POST", "/api/skills/choice", choices.choice).catch(() => null);
  }
  reg.pendingReports = [...(reg.pendingReports || []), ...reports];
  const flushed = await flushReports(ctx, reg);
  writeRegistry(ctx, reg);
  return { applied: done, reported: flushed };
}

/** Confirma al servidor lo dejado en disco. Si falla, queda pendiente para la próxima. */
async function flushReports(ctx, reg) {
  if (!reg.pendingReports.length) return true;
  try {
    const r = await http(ctx, "POST", "/api/skills/installed", { installs: reg.pendingReports });
    if (r.status >= 200 && r.status < 300) {
      reg.pendingReports = [];
      return true;
    }
  } catch {
    /* sin red: se reintenta en la próxima */
  }
  return false;
}

async function install(ctx, name, opts = {}) {
  const { steps, ws } = await buildInstall(ctx, name, opts);
  return applyPlan(ctx, installPlan(name, steps), steps, opts.plan, { ...opts, choice: { workspaceId: ws.id, skill: name, chosen: true } });
}

async function update(ctx, name, opts = {}) {
  const { steps, conflicts } = await buildUpdate(ctx, name);
  return applyPlan(ctx, publicPlan("update", steps, { conflicts }), steps, opts.plan, opts);
}

async function remove(ctx, name, opts = {}) {
  const { steps, entry } = buildRemove(ctx, name);
  return applyPlan(ctx, publicPlan("remove", steps, { rootName: name }), steps, opts.plan, {
    ...opts,
    choice: { workspaceId: entry.workspaceId, skill: name, chosen: false },
  });
}

/* ------------------------------------------------------------------ */
/* Listar y avisar                                                     */
/* ------------------------------------------------------------------ */

async function list(ctx) {
  const reg = readRegistry(ctx);
  const cat = await getJson(ctx, "/api/skills/catalog");
  const seen = new Set();
  const workspaces = cat.workspaces.map((w) => ({
    workspace: w.workspace,
    skills: w.skills.map((s) => {
      const local = reg.skills[s.name];
      const mine = local && local.workspaceId === w.workspace.id ? local : null;
      if (mine) seen.add(s.name);
      return {
        name: s.name,
        description: s.description,
        latestVersion: s.latestVersion,
        installedVersion: mine ? mine.version : null,
        reason: mine ? mine.reason : s.chosen ? "chosen (pendiente de instalar)" : null,
        updateAvailable: !!mine && s.latestVersion !== null && s.latestVersion !== mine.version,
        localChanges: mine ? localChanges(mine, path.join(ctx.skillsDir, s.name)).length > 0 : false,
      };
    }),
  }));
  const orphans = Object.values(reg.skills)
    .filter((e) => !seen.has(e.name))
    .map((e) => ({ name: e.name, workspace: e.workspaceName, installedVersion: e.version, note: "ya no está publicada en Hilbana (o perdiste el acceso)" }));
  return { skillsDir: ctx.skillsDir, workspaces, installedNotInCatalog: orphans };
}

/**
 * Para el hook de inicio de sesión: una línea con lo nuevo, o "". NO instala nada.
 * Silencioso ante cualquier fallo.
 */
async function checkNotice(ctx) {
  if (!ctx.apiKey) return "";
  let m;
  try {
    const r = await http(ctx, "GET", "/api/skills/manifest");
    if (r.status !== 200 || !r.json) return "";
    m = r.json;
  } catch {
    return "";
  }
  const parts = [];
  for (const s of m.skills || []) {
    if (s.state === "update") {
      const note = s.notes ? ` («${String(s.notes).replace(/\s+/g, " ").slice(0, 120)}»)` : "";
      parts.push(`${s.name} v${s.installedVersion}→v${s.latestVersion}${note}`);
    } else if (s.state === "new") {
      parts.push(`${s.name} v${s.latestVersion} (${s.reason === "dependency" ? "dependencia nueva" : "pendiente de instalar"})`);
    }
  }
  const gone = (m.remove || []).length;
  if (!parts.length && !gone) return "";
  const head = parts.length ? `Hay novedades en las skills del workspace: ${parts.slice(0, 5).join("; ")}${parts.length > 5 ? `; y ${parts.length - 5} más` : ""}.` : "";
  const tail = gone ? ` ${gone} skill(s) instalada(s) ya no corresponden.` : "";
  return (
    `SKILLS DEL WORKSPACE (Hilbana): ${head}${tail} Díselo al usuario en UNA línea y que decida: se actualiza con /hilbana:skills update. ` +
    `NO instales ni actualices nada por tu cuenta y no leas ni ejecutes su contenido.`
  );
}

module.exports = {
  makeContext,
  SkillsError,
  list,
  planInstall,
  planUpdate,
  planRemove,
  install,
  update,
  remove,
  checkNotice,
  // para los tests
  readRegistry,
  localChanges,
  sha256,
};

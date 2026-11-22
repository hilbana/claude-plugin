#!/usr/bin/env node
// Prueba de las skills del workspace del plugin (DRAPPS-2780) contra un servidor
// de mentira que habla el mismo protocolo que Hilbana: /api/skills/manifest,
// /catalog, /choice, /installed y la descarga de versiones.
//
// Comprueba lo que no puede romperse: nada se escribe sin plan, el plan enseña
// todo (dependencias incluidas), una carpeta ajena no se toca, lo editado en
// local no se pisa sin elegir, quitar una skill retira sus dependencias sin
// uso, el hook avisa sin instalar y sin red no hace ruido.
//
// Uso: node scripts/test-skills.mjs   (sin dependencias; vale en Windows, macOS y Linux)
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(raiz, "plugins/hilbana/scripts/skills-cli.cjs");
const HOOK = path.join(raiz, "plugins/hilbana/scripts/session-start.cjs");

const results = [];
const check = (n, ok) => results.push(`${ok ? "OK  " : "FALLA"} ${n}`);

/* ---------------- servidor de mentira ---------------- */
const WS = { id: "11111111-1111-1111-1111-111111111111", name: "WS Uno" };
const KEY = "hil_test_secret";
const state = { skills: new Map(), reports: [], choices: [], manifestCalls: 0 };

const hash = (o) => crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex");
function publish(name, { md, files = [], deps = [], notes = "" }) {
  const s = state.skills.get(name) || { name, versions: [], chosen: false, installed: null, description: `skill ${name}` };
  const all = [{ path: "SKILL.md", content: md, encoding: "utf8" }, ...files];
  s.versions.push({ number: s.versions.length + 1, files: all, deps, notes, contentHash: hash([all, deps]) });
  state.skills.set(name, s);
}
const latest = (s) => s.versions[s.versions.length - 1];
function closure(roots) {
  const out = [];
  const seen = new Set();
  const visit = (n) => {
    if (seen.has(n)) return;
    seen.add(n);
    const s = state.skills.get(n);
    for (const d of (s && s.versions.length ? latest(s).deps : [])) visit(d);
    out.push(n);
  };
  for (const r of roots) for (const d of latest(state.skills.get(r)).deps) visit(d);
  return out;
}
function manifest() {
  const chosen = [...state.skills.values()].filter((s) => s.chosen && s.versions.length).map((s) => s.name);
  const need = new Map(chosen.map((n) => [n, { reason: "chosen", by: [] }]));
  for (const c of chosen) for (const d of closure([c])) if (!need.has(d)) need.set(d, { reason: "dependency", by: [c] });
  const skills = [...need].map(([n, w]) => {
    const s = state.skills.get(n);
    const v = s.versions.length ? latest(s) : null;
    const inst = s.installed;
    return {
      workspace: WS, id: n, name: n, description: s.description, latestVersion: v && v.number, contentHash: v && v.contentHash,
      notes: v ? v.notes : "", publishedAt: Date.now(), reason: w.reason, requiredBy: w.by, installedVersion: inst, installedHash: null,
      state: !v ? "unpublished" : inst === null ? "new" : inst !== v.number ? "update" : "current", conflict: false,
    };
  });
  const remove = [...state.skills.values()].filter((s) => s.installed !== null && !need.has(s.name)).map((s) => ({ workspace: WS, name: s.name, installedVersion: s.installed, reason: "not-needed" }));
  return { generatedAt: Date.now(), skills, remove, conflicts: [] };
}

const server = http.createServer((req, res) => {
  const send = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.headers.authorization !== `Bearer ${KEY}`) return send(401, { error: "unauthorized" });
  const url = new URL(req.url, "http://x");
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/api/skills/manifest") { state.manifestCalls++; return send(200, manifest()); }
    if (url.pathname === "/api/skills/catalog") {
      return send(200, { workspaces: [{ workspace: WS, skills: [...state.skills.values()].map((s) => ({
        id: s.name, name: s.name, description: s.description, latestVersion: s.versions.length ? latest(s).number : null, publishedAt: 1, chosen: s.chosen, installedVersion: s.installed })) }] });
    }
    const dl = url.pathname.match(/^\/api\/skills\/([^/]+)\/([^/]+)\/versions\/([^/]+)\/download$/);
    if (dl) {
      const s = state.skills.get(decodeURIComponent(dl[2]));
      if (!s || !s.versions.length) return send(404, { error: "sin versión" });
      const v = dl[3] === "latest" ? latest(s) : s.versions[Number(dl[3]) - 1];
      const dep = (n) => ({ id: n, name: n, latestVersion: latest(state.skills.get(n)).number, contentHash: latest(state.skills.get(n)).contentHash });
      return send(200, {
        skill: { id: s.name, name: s.name }, version: { number: v.number, notes: v.notes, contentHash: v.contentHash, publishedByName: "Ana" },
        files: v.files.map((f) => ({ ...f, size: f.content.length, sha256: "" })),
        dependencies: v.deps.map(dep), resolvedDependencies: closure([s.name]).map(dep),
      });
    }
    if (url.pathname === "/api/skills/choice") { state.choices.push(body); state.skills.get(body.skill).chosen = body.chosen; return send(200, { ok: true }); }
    if (url.pathname === "/api/skills/installed") {
      state.reports.push(...body.installs);
      for (const r of body.installs) state.skills.get(r.name).installed = r.version;
      return send(200, { updated: body.installs.length, errors: [] });
    }
    send(404, { error: "no" });
  });
});

/* ---------------- utilidades ---------------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hilbana-skills-test-"));
const skillsDir = path.join(tmp, "skills");
const stateDir = path.join(tmp, "state");
let port;

const run = (script, args, env = {}, input) =>
  new Promise((resolve) => {
    const p = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, HILBANA_API_KEY: KEY, HILBANA_BASE_URL: `http://127.0.0.1:${port}`, HILBANA_SKILLS_DIR: skillsDir, HILBANA_SKILLS_STATE: stateDir, CLAUDE_PLUGIN_OPTION_API_KEY: "", ...env },
    });
    let out = "", err = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    if (input !== undefined) p.stdin.end(input); else p.stdin.end();
    p.on("close", (code) => resolve({ code, out, err, json: (() => { try { return JSON.parse(out); } catch { return null; } })() }));
  });
const cli = (...args) => run(CLI, args);
const exists = (...p) => fs.existsSync(path.join(skillsDir, ...p));
const read = (...p) => fs.readFileSync(path.join(skillsDir, ...p), "utf8");

async function main() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  port = server.address().port;

  publish("c", { md: "# c v1", files: [{ path: "refs/c.md", content: "ref de c", encoding: "utf8" }] });
  publish("b", { md: "# b v1", deps: ["c"], files: [{ path: "scripts/run.sh", content: "#!/bin/sh\necho b\n", encoding: "utf8" }] });
  publish("a", { md: "# a v1", deps: ["b"], notes: "primera de a", files: [{ path: "img/logo.bin", content: Buffer.from([1, 2, 3, 255]).toString("base64"), encoding: "base64" }] });
  publish("sola", { md: "# sola v1" });

  /* ---------------- listar ---------------- */
  const l0 = await cli("list");
  check("list: enseña las skills del workspace y que ninguna está instalada",
    l0.code === 0 && l0.json.workspaces[0].skills.length === 4 && l0.json.workspaces[0].skills.every((s) => s.installedVersion === null));

  /* ---------------- plan de instalación: no escribe nada ---------------- */
  const p1 = await cli("plan", "install", "a");
  check("el plan no escribe nada en disco", p1.code === 0 && !fs.existsSync(skillsDir));
  check("el plan enseña la skill Y sus dependencias, en orden de instalación", p1.json.steps.map((s) => s.name).join() === "c,b,a");
  const stepB = p1.json.steps.find((s) => s.name === "b");
  check("…cada una con sus ficheros, marcando los que se ejecutarían",
    stepB.files.add.some((f) => f.path === "scripts/run.sh" && f.runnable === true) && stepB.files.add.some((f) => f.path === "SKILL.md" && f.runnable === false));
  check("…y por qué está cada una (elegida / dependencia)", p1.json.steps.map((s) => s.reason).join() === "dependency,dependency,chosen");
  check("el plan no filtra el contenido de los ficheros", !JSON.stringify(p1.json).includes("echo b"));
  check("sin plan no se aplica", (await cli("apply", "install", "a")).code === 6 && !fs.existsSync(skillsDir));
  check("con un plan que no es el visto no se aplica", (await cli("apply", "install", "a", "--plan", "deadbeef")).code === 6);

  /* ---------------- instalar ---------------- */
  const i1 = await cli("apply", "install", "a", "--plan", p1.json.planId);
  check("instalar deja en disco la skill y sus dependencias", i1.code === 0 && exists("a", "SKILL.md") && exists("b", "scripts", "run.sh") && exists("c", "refs", "c.md"));
  check("el contenido es el publicado (texto y binario)", read("b", "scripts", "run.sh") === "#!/bin/sh\necho b\n" &&
    [...fs.readFileSync(path.join(skillsDir, "a", "img", "logo.bin"))].join() === "1,2,3,255");
  check("se confirma al servidor la versión instalada de las tres", state.reports.filter((r) => r.version === 1).map((r) => r.name).sort().join() === "a,b,c");
  check("se marca la skill como elegida en el servidor", state.choices.some((c) => c.skill === "a" && c.chosen === true));
  const reg = JSON.parse(fs.readFileSync(path.join(stateDir, "registry.json"), "utf8"));
  check("el registro local anota workspace, versión, huella, motivo y ficheros",
    reg.skills.a.reason === "chosen" && reg.skills.c.reason === "dependency" && reg.skills.a.version === 1 && reg.skills.a.workspaceId === WS.id && /^[0-9a-f]{64}$/.test(reg.skills.a.contentHash) && reg.skills.b.files["scripts/run.sh"]);
  check("instalar otra vez no cambia nada (todo «skip»)", (await cli("plan", "install", "a")).json.steps.every((s) => s.action === "skip"));

  /* ---------------- aviso al abrir sesión ---------------- */
  const h0 = await run(HOOK, [], {}, JSON.stringify({ cwd: tmp }));
  check("sin novedades el hook no añade nada de skills", !JSON.parse(h0.out).hookSpecificOutput.additionalContext.includes("SKILLS DEL WORKSPACE"));
  publish("a", { md: "# a v2", deps: ["b"], notes: "arreglado el logo", files: [] });
  const before = fs.readFileSync(path.join(skillsDir, "a", "SKILL.md"), "utf8");
  const h1 = await run(HOOK, [], {}, JSON.stringify({ cwd: tmp }));
  const ctx1 = JSON.parse(h1.out).hookSpecificOutput.additionalContext;
  check("con una versión nueva, el hook avisa con nombre, versión y nota", /SKILLS DEL WORKSPACE/.test(ctx1) && /a v1→v2/.test(ctx1) && /arreglado el logo/.test(ctx1));
  check("…y dice que no se instale nada solo", /NO instales ni actualices/.test(ctx1));
  check("…y no cambia nada en disco", read("a", "SKILL.md") === before);
  check("el hook sigue incluyendo la memoria", /MEMORIA HILBANA/.test(ctx1));

  /* ---------------- actualizar ---------------- */
  publish("b", { md: "# b v2", deps: ["c", "sola"], notes: "b usa sola", files: [{ path: "scripts/run.sh", content: "#!/bin/sh\necho b2\n", encoding: "utf8" }] });
  const u1 = await cli("plan", "update");
  const ua = u1.json.steps.find((s) => s.name === "a");
  const ub = u1.json.steps.find((s) => s.name === "b");
  const us = u1.json.steps.find((s) => s.name === "sola");
  check("el plan de actualizar enseña qué cambia: versión, nota y ficheros", ua.fromVersion === 1 && ua.toVersion === 2 && ua.notes === "arreglado el logo" && ua.files.remove.some((f) => f.path === "img/logo.bin"));
  check("…y las dependencias nuevas que entran", us && us.action === "install" && us.reason === "dependency" && ub.files.change.some((f) => f.path === "scripts/run.sh"));
  check("planificar no cambia nada en disco", read("a", "SKILL.md") === before && !exists("sola"));

  // Cambio local en b: no se pisa sin elegir.
  fs.writeFileSync(path.join(skillsDir, "b", "scripts", "run.sh"), "#!/bin/sh\necho MIO\n");
  const u2 = await cli("plan", "update");
  check("el plan avisa de los cambios locales", u2.json.steps.find((s) => s.name === "b").localChanges.some((x) => /run\.sh \(modificado\)/.test(x)));
  const noElige = await cli("apply", "update", "--plan", u2.json.planId);
  check("actualizar no pisa lo editado en local sin que se elija", noElige.code === 7 && read("b", "scripts", "run.sh") === "#!/bin/sh\necho MIO\n" && read("a", "SKILL.md") === before);
  const keep = await cli("apply", "update", "--plan", u2.json.planId, "--keep-local", "b");
  check("conservar lo local: b no se toca, el resto sí", keep.code === 0 && read("b", "scripts", "run.sh") === "#!/bin/sh\necho MIO\n" && read("a", "SKILL.md") === "# a v2" && exists("sola", "SKILL.md"));
  const u3 = await cli("plan", "update", "b");
  const over = await cli("apply", "update", "b", "--plan", u3.json.planId, "--overwrite-local", "b");
  check("sobrescribir: se actualiza b y queda copia de seguridad de lo local",
    over.code === 0 && read("b", "scripts", "run.sh") === "#!/bin/sh\necho b2\n" &&
    over.json.applied[0].backup && fs.readFileSync(path.join(over.json.applied[0].backup, "scripts", "run.sh"), "utf8") === "#!/bin/sh\necho MIO\n");
  check("tras actualizar el servidor conoce las versiones nuevas", state.skills.get("a").installed === 2 && state.skills.get("b").installed === 2);

  // Si se publica otra versión entre el plan y apply, apply se niega.
  publish("c", { md: "# c v2", notes: "c2" });
  const uPlan = await cli("plan", "update");
  publish("c", { md: "# c v3", notes: "c3" });
  check("si cambia lo publicado entre el plan y apply, apply se niega", (await cli("apply", "update", "--plan", uPlan.json.planId)).code === 6);
  const uPlan2 = await cli("plan", "update");
  check("…y con el plan nuevo funciona", (await cli("apply", "update", "--plan", uPlan2.json.planId)).code === 0 && read("c", "SKILL.md") === "# c v3");

  /* ---------------- carpeta ajena ---------------- */
  fs.mkdirSync(path.join(skillsDir, "ajena"), { recursive: true });
  fs.writeFileSync(path.join(skillsDir, "ajena", "SKILL.md"), "# mía, no de Hilbana");
  publish("ajena", { md: "# ajena de Hilbana" });
  const pa = await cli("plan", "install", "ajena");
  check("una carpeta con ese nombre que no instaló el plugin bloquea el plan", pa.json.canApply === false && /no la instaló este plugin/.test(pa.json.blocked[0].reason));
  check("…y no se sobrescribe aunque se intente aplicar", (await cli("apply", "install", "ajena", "--plan", pa.json.planId)).code === 3 && read("ajena", "SKILL.md") === "# mía, no de Hilbana");
  // Dependencia ajena: la instalación entera se detiene.
  publish("usa-ajena", { md: "# usa-ajena", deps: ["ajena"] });
  const pd = await cli("plan", "install", "usa-ajena");
  const dd = await cli("apply", "install", "usa-ajena", "--plan", pd.json.planId);
  check("si la carpeta ajena era una dependencia, no se instala nada y se explica",
    pd.json.canApply === false && /dependencia de «usa-ajena»/.test(pd.json.blocked[0].reason) && dd.code === 3 && !exists("usa-ajena"));

  /* ---------------- quitar ---------------- */
  // sola quedó como dependencia de b. Se instala c a mano (elegida) para que se conserve.
  await cli("apply", "install", "c", "--plan", (await cli("plan", "install", "c")).json.planId);
  const rp = await cli("plan", "remove", "a");
  check("quitar a retira b y sola (nadie más las necesita) pero conserva c (la eligió él)",
    rp.json.steps.map((s) => s.name).sort().join() === "a,b,sola" && rp.json.steps.every((s) => s.action === "remove"));
  check("el plan de quitar no borra nada", exists("a") && exists("b") && exists("sola"));
  const rr = await cli("apply", "remove", "a", "--plan", rp.json.planId);
  check("quitar borra a, b y sola y deja c", rr.code === 0 && !exists("a") && !exists("b") && !exists("sola") && exists("c", "SKILL.md"));
  check("el servidor sabe que se quitó y confirma las retiradas",
    state.choices.some((c) => c.skill === "a" && c.chosen === false) && state.reports.some((r) => r.name === "b" && r.version === null));
  check("el registro ya no tiene a, b ni sola, y c sigue como elegida",
    (() => { const r = JSON.parse(fs.readFileSync(path.join(stateDir, "registry.json"), "utf8")); return !r.skills.a && !r.skills.b && !r.skills.sola && r.skills.c.reason === "chosen"; })());
  check("quitar lo que el plugin no instaló da error y no toca nada", (await cli("plan", "remove", "ajena")).code === 4 && exists("ajena", "SKILL.md"));
  check("la carpeta ajena sigue intacta al final", read("ajena", "SKILL.md") === "# mía, no de Hilbana");

  /* ---------------- sin red / sin clave ---------------- */
  const sinKey = await run(HOOK, [], { HILBANA_API_KEY: "" }, JSON.stringify({ cwd: tmp }));
  check("sin API key el hook arranca sin ruido", sinKey.code === 0 && sinKey.err === "" && JSON.parse(sinKey.out).hookSpecificOutput.additionalContext.includes("MEMORIA HILBANA"));
  const t0 = Date.now();
  const sinRed = await run(HOOK, [], { HILBANA_BASE_URL: "http://127.0.0.1:9" }, JSON.stringify({ cwd: tmp }));
  check("sin red el hook arranca igual, rápido y sin errores visibles",
    sinRed.code === 0 && sinRed.err === "" && JSON.parse(sinRed.out).hookSpecificOutput.additionalContext.includes("MEMORIA HILBANA") && Date.now() - t0 < 5000);
  check("el CLI sin red falla con un mensaje claro", (await run(CLI, ["list"], { HILBANA_BASE_URL: "http://127.0.0.1:9" })).err.includes("No se pudo contactar"));

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(results.join("\n"));
  const fails = results.filter((r) => r.startsWith("FALLA")).length;
  console.log(`\n${results.length - fails}/${results.length} OK`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(results.join("\n"));
  console.error(e);
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});

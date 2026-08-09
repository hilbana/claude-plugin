#!/usr/bin/env node
// Validates the plugin before it reaches anyone's Claude Code.
//
// WHY THIS EXISTS: `/hilbana-finish` and `/hilbana-review` silently failed to load
// for months. Their frontmatter `description` contained ": " in an unquoted scalar,
// which opens a mapping in YAML and breaks parsing — and Claude Code drops a
// component with broken frontmatter without saying a word. Nothing failed, nothing
// warned; half the framework cycle was simply missing.
//
// So rather than trying to guess when a bare scalar is dangerous, this enforces the
// blunt rule: `description` and `argument-hint` are ALWAYS double-quoted. That kills
// the whole class of bug (colons, #, leading [ { * & ! | > % @, trailing colon)
// without reimplementing a YAML parser badly.
//
// It also checks the things that rot quietly: manifests that stop parsing, hooks
// pointing at scripts that moved, and REFERENCE.md drifting out of sync with the
// files it claims to describe.
//
// Usage: node scripts/validate-plugin.mjs   (exit 1 on any error)

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const errores = [];
const avisos = [];
const fallo = (fichero, msg) => errores.push({ fichero, msg });
const aviso = (fichero, msg) => avisos.push({ fichero, msg });

const leer = (p) => readFileSync(join(raiz, p), "utf8");
const hay = (p) => existsSync(join(raiz, p));
const dirs = (p) =>
  hay(p) ? readdirSync(join(raiz, p)).filter((d) => statSync(join(raiz, p, d)).isDirectory()) : [];

// ── Frontmatter ────────────────────────────────────────────────────────────────

/** Devuelve las líneas del bloque frontmatter, o null si no hay bloque válido. */
function frontmatter(texto, fichero) {
  const lineas = texto.split(/\r?\n/);
  if (lineas[0] !== "---") {
    fallo(fichero, "no empieza con `---`: sin frontmatter, Claude Code no carga el componente");
    return null;
  }
  const cierre = lineas.indexOf("---", 1);
  if (cierre === -1) {
    fallo(fichero, "el frontmatter no se cierra con `---`");
    return null;
  }
  return lineas.slice(1, cierre);
}

/** Las claves que deben ir entrecomilladas siempre, y por qué. */
const CLAVES_ENTRECOMILLADAS = ["description", "argument-hint"];

function validarCampo(fichero, clave, valor) {
  if (valor.trim() === "") {
    fallo(fichero, `\`${clave}\` está vacía`);
    return;
  }
  const entrecomillada = valor.startsWith('"') && valor.endsWith('"') && valor.length > 1;
  if (!entrecomillada) {
    // El fallo histórico: un ": " suelto rompe el YAML entero.
    const motivo = /:\s/.test(valor)
      ? 'contiene ": ", que en YAML abre un mapping y ROMPE el frontmatter'
      : "debe ir entre comillas dobles (convención del repo: elimina toda la clase de fallo)";
    fallo(fichero, `\`${clave}\` sin entrecomillar y ${motivo}`);
    return;
  }
  const interior = valor.slice(1, -1);
  if (/(^|[^\\])"/.test(interior)) {
    fallo(fichero, `\`${clave}\` tiene comillas dobles internas sin escapar: el valor se corta ahí`);
  }
}

function validarComponente(ruta, { requiereName }) {
  const texto = leer(ruta);
  const lineas = frontmatter(texto, ruta);
  if (!lineas) return null;

  const campos = {};
  for (const linea of lineas) {
    if (linea.trim() === "" || linea.startsWith("#")) continue;
    const m = linea.match(/^([A-Za-z][\w-]*):\s?(.*)$/);
    if (!m) {
      fallo(ruta, `línea de frontmatter no parseable: ${JSON.stringify(linea)}`);
      continue;
    }
    if (campos[m[1]] !== undefined) fallo(ruta, `clave \`${m[1]}\` duplicada en el frontmatter`);
    campos[m[1]] = m[2];
  }

  if (campos.description === undefined) fallo(ruta, "falta `description` (obligatoria)");
  for (const clave of CLAVES_ENTRECOMILLADAS) {
    if (campos[clave] !== undefined) validarCampo(ruta, clave, campos[clave]);
  }

  if (requiereName) {
    const esperado = basename(dirname(ruta));
    if (campos.name === undefined) fallo(ruta, "falta `name` (obligatoria en una skill)");
    else if (campos.name.replace(/^["']|["']$/g, "") !== esperado)
      fallo(ruta, `\`name\` es "${campos.name}" pero su carpeta es "${esperado}": deben coincidir`);
  }
  return campos;
}

// ── Recorrido del árbol ────────────────────────────────────────────────────────

const componentes = { commands: [], skills: [] };

for (const plugin of dirs("plugins")) {
  const base = `plugins/${plugin}`;

  // Manifiesto del plugin
  const manifiesto = `${base}/.claude-plugin/plugin.json`;
  let json = null;
  if (!hay(manifiesto)) fallo(base, "falta `.claude-plugin/plugin.json`");
  else {
    try {
      json = JSON.parse(leer(manifiesto));
      if (json.name !== plugin)
        fallo(manifiesto, `\`name\` es "${json.name}" pero la carpeta es "${plugin}"`);
      if (!/^\d+\.\d+\.\d+$/.test(json.version || ""))
        fallo(manifiesto, `\`version\` no es semver: ${JSON.stringify(json.version)}`);
    } catch (e) {
      fallo(manifiesto, `no es JSON válido: ${e.message}`);
    }
  }

  // Commands
  const dirCommands = join(raiz, base, "commands");
  if (existsSync(dirCommands)) {
    for (const f of readdirSync(dirCommands).filter((f) => f.endsWith(".md"))) {
      const ruta = `${base}/commands/${f}`;
      validarComponente(ruta, { requiereName: false });
      componentes.commands.push(basename(f, ".md"));
    }
  }

  // Skills
  for (const skill of dirs(`${base}/skills`)) {
    const ruta = `${base}/skills/${skill}/SKILL.md`;
    if (!hay(ruta)) {
      fallo(`${base}/skills/${skill}`, "falta SKILL.md");
      continue;
    }
    validarComponente(ruta, { requiereName: true });
    componentes.skills.push(skill);
  }

  // Hooks: cada script referenciado tiene que existir
  const hooks = `${base}/hooks/hooks.json`;
  if (hay(hooks)) {
    let h = null;
    try {
      h = JSON.parse(leer(hooks));
    } catch (e) {
      fallo(hooks, `no es JSON válido: ${e.message}`);
    }
    if (h) {
      const refs = new Set(JSON.stringify(h).match(/scripts\/[\w-]+\.cjs/g) || []);
      for (const ref of refs)
        if (!hay(`${base}/${ref}`)) fallo(hooks, `apunta a \`${ref}\`, que no existe`);
      if (refs.size === 0) aviso(hooks, "no referencia ningún script");
    }
  }

  // MCP
  const mcp = `${base}/.mcp.json`;
  if (hay(mcp)) {
    try {
      JSON.parse(leer(mcp));
    } catch (e) {
      fallo(mcp, `no es JSON válido: ${e.message}`);
    }
  }

  // Sintaxis de los scripts
  const dirScripts = join(raiz, base, "scripts");
  if (existsSync(dirScripts)) {
    for (const f of readdirSync(dirScripts).filter((f) => f.endsWith(".cjs"))) {
      try {
        execFileSync(process.execPath, ["--check", join(dirScripts, f)], { stdio: "pipe" });
      } catch (e) {
        fallo(`${base}/scripts/${f}`, `no pasa \`node --check\`: ${String(e.stderr).trim().split("\n")[0]}`);
      }
    }
  }
}

// ── Marketplace ────────────────────────────────────────────────────────────────

const mkt = ".claude-plugin/marketplace.json";
if (!hay(mkt)) fallo(mkt, "no existe: sin él nadie puede añadir el marketplace");
else {
  try {
    const m = JSON.parse(leer(mkt));
    for (const p of m.plugins || []) {
      const fuente = p.source?.replace(/^\.\//, "");
      if (!fuente) {
        fallo(mkt, `la entrada "${p.name}" no declara \`source\``);
        continue;
      }
      if (!hay(`${fuente}/.claude-plugin/plugin.json`))
        fallo(mkt, `la entrada "${p.name}" apunta a \`${p.source}\`, que no tiene plugin.json`);
      else {
        const nombreReal = JSON.parse(leer(`${fuente}/.claude-plugin/plugin.json`)).name;
        if (nombreReal !== p.name)
          fallo(mkt, `la entrada se llama "${p.name}" pero el plugin de \`${p.source}\` es "${nombreReal}"`);
      }
    }
  } catch (e) {
    fallo(mkt, `no es JSON válido: ${e.message}`);
  }
}

// ── REFERENCE.md y CHANGELOG: que no se desvíen de los ficheros ────────────────

if (hay("REFERENCE.md")) {
  const ref = leer("REFERENCE.md");
  // Claude Code antepone el nombre del plugin a sus commands (`/hilbana:finish`), así
  // que la forma con namespace vale igual que la desnuda: documentar `/finish` a secas
  // sería documentar algo que el usuario no puede teclear.
  for (const c of componentes.commands)
    if (!ref.includes(`/${c}`) && !ref.includes(`/hilbana:${c}`))
      fallo("REFERENCE.md", `no documenta el command \`/hilbana:${c}\``);
  for (const s of componentes.skills)
    if (!ref.includes(s)) fallo("REFERENCE.md", `no documenta la skill \`${s}\``);
  // Y al revés: que no prometa commands que ya no existen.
  for (const mencion of new Set(ref.match(/\/hilbana-[\w-]+/g) || []))
    if (!componentes.commands.includes(mencion.slice(1)))
      fallo("REFERENCE.md", `documenta \`${mencion}\`, que no existe en el árbol`);
} else aviso("REFERENCE.md", "no existe");

if (hay("CHANGELOG.md") && hay("plugins/hilbana/.claude-plugin/plugin.json")) {
  const v = JSON.parse(leer("plugins/hilbana/.claude-plugin/plugin.json")).version;
  if (v && !leer("CHANGELOG.md").includes(`## [${v}]`))
    fallo("CHANGELOG.md", `no tiene entrada para la versión ${v} (la release saldría sin notas)`);
}

// ── Informe ────────────────────────────────────────────────────────────────────

const total = componentes.commands.length + componentes.skills.length;
console.log(
  `Validado: ${componentes.commands.length} commands, ${componentes.skills.length} skills (${total} componentes).`,
);

for (const a of avisos) console.log(`aviso  ${a.fichero}: ${a.msg}`);

if (errores.length) {
  console.error(`\n${errores.length} error(es):\n`);
  for (const e of errores) console.error(`  ✗ ${e.fichero}\n      ${e.msg}`);
  console.error("");
  process.exit(1);
}
console.log("Todo correcto.");

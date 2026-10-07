// Qué scope de memoria usa este repo y con qué git remote se identifica. Lo
// comparten los hooks SessionStart (lo inyecta en el protocolo) y SessionEnd (lo
// manda al guardar el resumen), para que nunca calculen cosas distintas.
//
// Orden:
//   1. `.hilbana/scope` en el repo (o en la carpeta): su primera línea es el
//      scope y NO se manda remote. Es la forma de fijar el scope a mano, y al ir
//      versionado lo hereda todo el equipo.
//   2. Si no, el scope es el nombre de la carpeta y el remote el de `origin`.
//      Con el remote, Hilbana junta en un mismo scope los clones del mismo repo
//      aunque cada persona lo tenga en una carpeta con otro nombre.
//   3. Sin git o sin remote, solo la carpeta, como antes.
//
// Silencioso: cualquier fallo de git deja el remote en null, nunca rompe el hook.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function git(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
      windowsHide: true,
    }).trim();
  } catch {
    return "";
  }
}

function readScopeFile(dir) {
  try {
    const line = fs
      .readFileSync(path.join(dir, ".hilbana", "scope"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    return line || null;
  } catch {
    return null;
  }
}

// Las credenciales de una URL https (user:token@) no salen nunca de la máquina.
function stripCredentials(url) {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@/]*@/i, "$1");
}

function resolveRepoScope(cwd) {
  const folder = path.basename(cwd.replace(/[\\/]+$/, "")) || "default";
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);

  const fromFile = readScopeFile(cwd) || (root ? readScopeFile(root) : null);
  if (fromFile) return { scope: fromFile, gitRemote: null, source: "file" };

  const remote = root ? git(cwd, ["remote", "get-url", "origin"]) : "";
  return {
    scope: folder,
    gitRemote: remote ? stripCredentials(remote) : null,
    source: remote ? "remote" : "folder",
  };
}

module.exports = { resolveRepoScope, stripCredentials };

#!/usr/bin/env node
// CLI de las skills del workspace. Lo ejecuta el agente desde /hilbana:skills;
// todo sale en JSON para que lo presente. Nunca escribe sin un plan:
//
//   skills-cli.cjs list
//   skills-cli.cjs plan   install <nombre> [--workspace <nombre|id>]
//   skills-cli.cjs apply  install <nombre> --plan <id> [--workspace …] [--keep-local a,b] [--overwrite-local a,b]
//   skills-cli.cjs plan   update  [<nombre>]
//   skills-cli.cjs apply  update  [<nombre>] --plan <id> [--keep-local …] [--overwrite-local …]
//   skills-cli.cjs plan   remove  <nombre>
//   skills-cli.cjs apply  remove  <nombre> --plan <id> [--overwrite-local <nombre,…>]
//
// Códigos de salida: 0 bien · 1 error · 3 plan bloqueado · 4 no existe · 5 nombre en
// varios workspaces · 6 el plan ya no es el que se enseñó · 7 cambios locales sin resolver.
const lib = require("./skills-lib.cjs");

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

const csv = (v) => (typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);

async function main() {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const ctx = lib.makeContext();
  const [cmd, kind, name] = pos;
  const opts = {
    workspace: typeof flags.workspace === "string" ? flags.workspace : undefined,
    plan: typeof flags.plan === "string" ? flags.plan : undefined,
    keepLocal: csv(flags["keep-local"]),
    overwriteLocal: csv(flags["overwrite-local"]),
  };

  let out;
  if (cmd === "list") {
    out = await lib.list(ctx);
  } else if (cmd === "plan" || cmd === "apply") {
    const apply = cmd === "apply";
    if (kind === "install") {
      if (!name) throw new lib.SkillsError("Falta el nombre de la skill.");
      out = apply ? await lib.install(ctx, name, opts) : await lib.planInstall(ctx, name, opts);
    } else if (kind === "update") {
      out = apply ? await lib.update(ctx, name, opts) : await lib.planUpdate(ctx, name);
    } else if (kind === "remove") {
      if (!name) throw new lib.SkillsError("Falta el nombre de la skill.");
      out = apply ? await lib.remove(ctx, name, opts) : await lib.planRemove(ctx, name);
    } else {
      throw new lib.SkillsError("Uso: plan|apply install|update|remove [nombre]");
    }
  } else {
    throw new lib.SkillsError("Uso: list | plan|apply install|update|remove [nombre]");
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((e) => {
  const code = e && typeof e.code === "number" ? e.code : 1;
  process.stderr.write(JSON.stringify({ error: String((e && e.message) || e), code }) + "\n");
  process.exit(code);
});

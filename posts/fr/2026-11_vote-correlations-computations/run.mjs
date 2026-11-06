// Exécute dans Node le notebook de calcul (source.js, dans ce dossier) et écrit ses résultats dans
// posts/data/2026-11_vote-correlations/precomputed.json, lu par le billet 2026-11_vote-correlations.
// Les cellules JavaScript sont mises bout à bout ; les imports du CDN sont remplacés par les paquets
// installés, et les fichiers du dépôt sont lus sur le disque plutôt que sur GitHub.
//
// Run: node posts/fr/2026-11_vote-correlations-computations/run.mjs
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const OUTPUT = `${repository}posts/data/2026-11_vote-correlations/precomputed.json`;
const REMOTE = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/";
const PACKAGES = { "d3@7": "d3", "@tangent.to/ds@0.16": "@tangent.to/ds" };

let code = "", inside = false;
for (const line of readFileSync(here("source.js"), "utf-8").split("\n")) {
  if (line.startsWith("// %% ")) { inside = line.startsWith("// %% [javascript]"); code += "\n;\n"; continue; }
  if (inside) code += line + "\n";
}
for (const [cdn, name] of Object.entries(PACKAGES)) code = code.replaceAll(`"https://cdn.jsdelivr.net/npm/${cdn}/+esm"`, `"${name}"`);
// d3.csv d'une URL du dépôt : lecture du fichier local.
code = `import { readFileSync as __read } from "node:fs";\nconst __local = (url) => ${JSON.stringify(repository)} + url.replace(${JSON.stringify(REMOTE)}, "");\n` +
  code.replace(/await d3\.csv\(([A-Z_]+), d3\.autoType\)/g, "d3.csvParse(__read(__local($1), \"utf-8\"), d3.autoType)");
code += `\nimport("node:fs").then((fs) => fs.writeFileSync(${JSON.stringify(OUTPUT)}, JSON.stringify(results)));\n`;

writeFileSync(here(".run-temp.mjs"), code);
try { await import(`./.run-temp.mjs?${Date.now()}`); } finally { rmSync(here(".run-temp.mjs")); }
console.log(`${OUTPUT} écrit`);

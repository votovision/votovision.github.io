// Exécute dans Node le notebook de calcul du billet sur le profil des sections de vote
// (posts/fr/2026-11_vote-correlations-calculs/source.js) et écrit ses résultats dans
// posts/data/2026-11_vote-correlations/precalculs.json, lu par le billet.
// Les cellules JavaScript sont mises bout à bout ; les imports du CDN sont remplacés par les
// paquets installés, et les fichiers du dépôt sont lus sur le disque plutôt que sur GitHub.
//
// Run: node scripts/executer-calculs.mjs
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const SOURCE = "posts/fr/2026-11_vote-correlations-calculs/source.js";
const SORTIE = "posts/data/2026-11_vote-correlations/precalculs.json";
const DEPOT = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/";
const PAQUETS = { "d3@7": "d3", "@observablehq/plot@0.6": "@observablehq/plot", "@tangent.to/ds@0.16": "@tangent.to/ds" };

let code = "", dedans = false;
for (const l of readFileSync(SOURCE, "utf-8").split("\n")) {
  if (l.startsWith("// %% ")) { dedans = l.startsWith("// %% [javascript]"); code += "\n;\n"; continue; }
  if (dedans) code += l + "\n";
}
for (const [cdn, paquet] of Object.entries(PAQUETS)) code = code.replaceAll(`"https://cdn.jsdelivr.net/npm/${cdn}/+esm"`, `"${paquet}"`);
// d3.csv / d3.json d'une URL du dépôt : lecture du fichier local.
code = `import { readFileSync as __lire } from "node:fs";\nconst __local = (u) => u.replace(${JSON.stringify(DEPOT)}, "");\n` + code
  .replace(/await d3\.csv\(([A-Z_]+), d3\.autoType\)/g, "d3.csvParse(__lire(__local($1), \"utf-8\"), d3.autoType)")
  .replace(/await d3\.json\(([A-Z_]+)\)/g, "JSON.parse(__lire(__local($1), \"utf-8\"))");
code += `\nimport("node:fs").then((fs) => fs.writeFileSync(${JSON.stringify(SORTIE)}, JSON.stringify(resultats)));\n`;

const TEMP = "scripts/.calculs-temp.mjs";
writeFileSync(TEMP, code);
try { await import(`./.calculs-temp.mjs?${Date.now()}`); } finally { rmSync(TEMP); }
console.log(`${SORTIE} écrit`);

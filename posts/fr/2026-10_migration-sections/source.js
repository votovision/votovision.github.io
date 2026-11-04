// ---
// title: Québec : d'où viennent les sections de vote
// id: migration-sections
// date: 2026-10-15
// ---

// %% [markdown]
// À écrire : introduction. Idées et chiffres disponibles dans les cellules suivantes (`matrice`, `retention`).
//
// - Une section de vote : quelques centaines d'électeurs voisins (au plus 475), une seule boîte le jour du scrutin. Les résultats par section sont publiés par Élections Québec.
// - Le diagramme classe chaque section de 2022 selon le parti arrivé premier en 2018 (résultats de 2018 transposés sur le découpage de 2022) et en 2022.
// - Seulement le vote du jour du scrutin : le vote par anticipation (environ 40 % des votes en 2022) n'est pas ventilé par section.

// %% [javascript] #collapse-cell
// charger les packages
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const sankeyMod = await import("https://cdn.jsdelivr.net/npm/d3-sankey@0.12/+esm");

// élections comparées : les résultats de DE sont transposés sur les sections de VERS
const DE = 2022, VERS = 2026;
const URL_DONNEES = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-10_migration-sections/sections_2022_2026.csv";

// partis : ordre d'affichage, libellé, couleur
const partis = [
  { code: "CAQ", nom: "CAQ", couleur: "#6EC9F5" },
  { code: "LIB", nom: "PLQ", couleur: "#E01020" },
  { code: "PQ", nom: "PQ", couleur: "#2B50C8" },
  { code: "QS", nom: "QS", couleur: "#F28C28" },
  { code: "PCQ", nom: "PCQ", couleur: "#10275A" },
  { code: "AUTRES", nom: "Autres", couleur: "#8B887A" },
];
const parti = Object.fromEntries(partis.map((p) => [p.code, p]));

// palette et typographie (hors couleurs de partis)
const ENCRE = "#2A2E24";
const GRIS = "#8B887A";
const F_TEXTE = "'Inter Tight', 'Segoe UI', sans-serif";
const fmt = new Intl.NumberFormat("fr-CA");
const pct = (x) => `${Math.round(x * 100)} %`;

// une ligne par section de VERS ; on garde celles qui ont un premier aux deux élections
const toutes = await d3.csv(URL_DONNEES, d3.autoType);
const sections = toutes.filter((d) => d[`${DE}_gagnant`] && d[`${VERS}_gagnant`]);
const exclues = toutes.length - sections.length;
({ sections: sections.length, exclues });

// %% [javascript] #collapse-cell
// matrice des premiers : lignes = parti premier en DE, colonnes = parti premier en VERS (nombre de sections)
const compte = d3.rollup(sections, (v) => v.length, (d) => d[`${DE}_gagnant`], (d) => d[`${VERS}_gagnant`]);
const n = (a, b) => compte.get(a)?.get(b) ?? 0;
const matrice = partis.map((a) => ({
  [`Premier en ${DE}`]: a.nom,
  ...Object.fromEntries(partis.map((b) => [b.nom, n(a.code, b.code)])),
  Total: d3.sum(partis, (b) => n(a.code, b.code)),
}));
matrice

// %% [javascript] #collapse-cell
// rétention : pour chaque parti, sections où il était premier en DE, part conservée en VERS, principale destination des sections perdues
const retention = partis.map((a) => {
  const total = d3.sum(partis, (b) => n(a.code, b.code));
  const perdues = partis.filter((b) => b.code !== a.code).map((b) => ({ vers: b.nom, sections: n(a.code, b.code) })).sort((x, y) => y.sections - x.sections);
  return {
    Parti: a.nom,
    [`Sections ${DE}`]: total,
    [`Sections ${VERS}`]: d3.sum(partis, (b) => n(b.code, a.code)),
    Conservées: total ? pct(n(a.code, a.code) / total) : "",
    "Première destination": perdues[0] && perdues[0].sections ? `${perdues[0].vers} (${pct(perdues[0].sections / total)})` : "",
  };
});
retention

// %% [markdown]
// À écrire : lecture du diagramme. Inviter à cliquer sur un parti.

// %% [javascript] #collapse-cell
// Diagramme : à gauche, le parti premier dans la section en DE ; à droite, en VERS ; épaisseur des flux, nombre de sections.
// Un clic sur un parti met ses flux en évidence (d'où viennent ses sections, où elles vont) et estompe les autres ;
// les libellés de l'autre colonne donnent alors la part des sections du parti choisi. Un second clic, ou un clic hors
// des nœuds, rétablit l'ensemble.
const L = 760, H = 480, MARGE = 170, HAUT = 28;

const liens = [];
for (const a of partis) for (const b of partis) {
  const v = n(a.code, b.code);
  if (v) liens.push({ source: `${DE}-${a.code}`, target: `${VERS}-${b.code}`, value: v });
}
// un parti sans aucune section une année (PCQ en 2018) n'a pas de nœud cette année-là
const noeuds = [
  ...partis.map((p) => ({ id: `${DE}-${p.code}`, code: p.code, annee: DE })),
  ...partis.map((p) => ({ id: `${VERS}-${p.code}`, code: p.code, annee: VERS })),
].filter((d) => liens.some((l) => l.source === d.id || l.target === d.id));
const gen = sankeyMod.sankey().nodeId((d) => d.id).nodeWidth(12).nodePadding(14).nodeSort(null).linkSort(null)
  .extent([[MARGE, HAUT], [L - MARGE, H - 10]]);
const graphe = gen({ nodes: noeuds.map((d) => ({ ...d })), links: liens.map((d) => ({ ...d })) });

const svg = d3.create("svg").attr("viewBox", [0, 0, L, H]).attr("width", L).attr("height", H)
  .style("max-width", "100%").style("height", "auto").style("font-family", F_TEXTE).style("font-size", "13px");

// fond cliquable : rétablit l'ensemble
svg.append("rect").attr("width", L).attr("height", H).attr("fill", "transparent").on("click", () => choisir(null));

// en-têtes de colonnes
svg.append("text").attr("x", MARGE - 8).attr("y", 14).attr("text-anchor", "end").attr("fill", GRIS).text(`Premier en ${DE}`);
svg.append("text").attr("x", L - MARGE + 8).attr("y", 14).attr("text-anchor", "start").attr("fill", GRIS).text(`Premier en ${VERS}`);

const gLiens = svg.append("g").attr("fill", "none").selectAll("path").data(graphe.links).join("path")
  .attr("d", sankeyMod.sankeyLinkHorizontal())
  .attr("stroke", (d) => parti[d.source.code].couleur)
  .attr("stroke-width", (d) => Math.max(1, d.width))
  .style("mix-blend-mode", "multiply");
gLiens.append("title").text((d) => {
  const deA = d3.sum(graphe.links.filter((l) => l.source.id === d.source.id), (l) => l.value);
  const versB = d3.sum(graphe.links.filter((l) => l.target.id === d.target.id), (l) => l.value);
  return `${parti[d.source.code].nom} ${DE} → ${parti[d.target.code].nom} ${VERS} : ${fmt.format(d.value)} sections\n` +
    `${pct(d.value / deA)} des sections ${parti[d.source.code].nom} de ${DE} ; ${pct(d.value / versB)} des sections ${parti[d.target.code].nom} de ${VERS}`;
});

const gNoeuds = svg.append("g").selectAll("rect").data(graphe.nodes).join("rect")
  .attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(1, d.y1 - d.y0))
  .attr("fill", (d) => parti[d.code].couleur).style("cursor", "pointer")
  .on("click", (e, d) => { e.stopPropagation(); choisir(d.id); });

const gLibelles = svg.append("g").selectAll("text").data(graphe.nodes).join("text")
  .attr("x", (d) => d.annee === DE ? d.x0 - 8 : d.x1 + 8).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em")
  .attr("text-anchor", (d) => d.annee === DE ? "end" : "start").attr("fill", ENCRE).style("cursor", "pointer")
  .on("click", (e, d) => { e.stopPropagation(); choisir(d.id); });

let choisi = null;
function libelle(d) {
  const total = d.value;
  if (choisi && choisi !== d.id) {
    const c = graphe.nodes.find((x) => x.id === choisi);
    if (c.annee !== d.annee) {
      const flux = graphe.links.find((l) => (l.source.id === choisi && l.target.id === d.id) || (l.target.id === choisi && l.source.id === d.id));
      const v = flux ? flux.value : 0;
      return `${parti[d.code].nom} · ${fmt.format(v)} (${pct(v / c.value)})`;
    }
  }
  return `${parti[d.code].nom} · ${fmt.format(total)}`;
}
function choisir(id) {
  choisi = choisi === id ? null : id;
  const lie = (l) => !choisi || l.source.id === choisi || l.target.id === choisi;
  gLiens.transition().duration(250).attr("stroke-opacity", (l) => !choisi ? 0.45 : lie(l) ? 0.8 : 0.06);
  gNoeuds.transition().duration(250).attr("fill-opacity", (d) => !choisi || d.id === choisi || graphe.links.some((l) => lie(l) && (l.source.id === d.id || l.target.id === d.id)) ? 1 : 0.3);
  gLibelles.text(libelle).attr("font-weight", (d) => d.id === choisi ? 600 : 400)
    .attr("fill", (d) => !choisi || d.id === choisi || graphe.links.some((l) => lie(l) && (l.source.id === d.id || l.target.id === d.id)) ? ENCRE : GRIS);
}
choisir(null);
svg.node()

// %% [markdown]
// *Chaque section de vote de 2022 est classée selon le parti arrivé premier le jour du scrutin en 2018 (à gauche, résultats de 2018 transposés sur le découpage de 2022) et en 2022 (à droite). Épaisseur : nombre de sections. Vote par anticipation exclu. Cliquer sur un parti pour suivre ses sections.*

// %% [markdown]
// À écrire : ce que le diagramme montre (voir `retention`), puis les limites : vote du jour du scrutin seulement, transposition par recouvrement de surface, sections d'établissement et bureaux regroupés au bureau du directeur du scrutin exclus (`exclues`).

// %% [markdown]
// Sources : Élections Québec, résultats par bureau de vote des élections générales du 1er octobre 2018 et du 3 octobre 2022, et polygones des sections de vote de 2018 et de 2022 (données ouvertes, [donnees.electionsquebec.qc.ca](https://donnees.electionsquebec.qc.ca/)). Transposition de 2018 sur les sections de 2022 : Votovision, [votovision/data](https://github.com/votovision/data), `sources/transposition_sections_qc.ts` ; table par section dans le dossier `data/` de ce billet.

// ---
// title: Quebec - Vote migration
// id: vote-migration
// date: 2026-11-04
// translation: /fr/posts/2026-11_migration-sections/
// ---

// %% [markdown]
// Votes migrated between 2022 and 2026. The vote is of course secret, but polling divisions let us answer the question *who went where?* at the finest possible resolution.
//
// Each polling station has its polling division, and the data of each division are public [1]. Only the votes cast on election day are counted, and remote or advance votes are not part of these data. To visualize the migration of votes, what better than a Sankey diagram?
//
// In each polling division, we select the party that came first in 2022, then in 2026, and we check the migration.

// %% [javascript] #collapse-cell
// load the packages
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const sankeyMod = await import("https://cdn.jsdelivr.net/npm/d3-sankey@0.12/+esm");

// elections compared: the results of DE are transposed onto the divisions of VERS
const DE = 2022, VERS = 2026;
const URL_DONNEES = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_migration-sections/sections_2022_2026.csv";

// parties: display order, label, colour
const partis = [
  { code: "CAQ", nom: "CAQ", couleur: "#6EC9F5" },
  { code: "LIB", nom: "QLP", couleur: "#E01020" },
  { code: "PQ", nom: "PQ", couleur: "#2B50C8" },
  { code: "QS", nom: "QS", couleur: "#F28C28" },
  { code: "PCQ", nom: "CPQ", couleur: "#10275A" },
  { code: "AUTRES", nom: "Others", couleur: "#8B887A" },
];
const parti = Object.fromEntries(partis.map((p) => [p.code, p]));

// palette and typography (party colours aside)
const ENCRE = "#2A2E24";
const GRIS = "#8B887A";
const F_TEXTE = "'Inter Tight', 'Segoe UI', sans-serif";
const fmt = new Intl.NumberFormat("en-CA");
const pct = (x) => `${Math.round(x * 100)}%`;

// one row per division of VERS; keep those with a first-place party in both elections
const toutes = await d3.csv(URL_DONNEES, d3.autoType);
const sections = toutes.filter((d) => d[`${DE}_gagnant`] && d[`${VERS}_gagnant`]);
const compte = d3.rollup(sections, (v) => v.length, (d) => d[`${DE}_gagnant`], (d) => d[`${VERS}_gagnant`]);
const n = (a, b) => compte.get(a)?.get(b) ?? 0;

// Diagram: on the left, the party first in the division in DE; on the right, in VERS; flow width, number of divisions. Clicking a party highlights its flows (where its divisions come from, where they go) and fades the others; the labels of the other column then give the share of the chosen party's divisions. A second click, or a click outside the nodes, restores everything.
const L = 960, H = 480, MARGE = 120, HAUT = 28;

const liens = [];
for (const a of partis) for (const b of partis) {
  const v = n(a.code, b.code);
  if (v) liens.push({ source: `${DE}-${a.code}`, target: `${VERS}-${b.code}`, value: v });
}
// a party first in no division in a given year has no node that year
const noeuds = [
  ...partis.map((p) => ({ id: `${DE}-${p.code}`, code: p.code, annee: DE })),
  ...partis.map((p) => ({ id: `${VERS}-${p.code}`, code: p.code, annee: VERS })),
].filter((d) => liens.some((l) => l.source === d.id || l.target === d.id));
const gen = sankeyMod.sankey().nodeId((d) => d.id).nodeWidth(12).nodePadding(14).nodeSort(null).linkSort(null)
  .extent([[MARGE, HAUT], [L - MARGE, H - 10]]);
const graphe = gen({ nodes: noeuds.map((d) => ({ ...d })), links: liens.map((d) => ({ ...d })) });

const svg = d3.create("svg").attr("viewBox", [0, 0, L, H]).attr("width", L).attr("height", H)
  .style("max-width", "100%").style("height", "auto").style("font-family", F_TEXTE).style("font-size", "13px");

// clickable background: restores everything
svg.append("rect").attr("width", L).attr("height", H).attr("fill", "transparent").on("click", () => choisir(null));

// column headers
svg.append("text").attr("x", MARGE - 8).attr("y", 14).attr("text-anchor", "end").attr("fill", GRIS).text(`First in ${DE}`);
svg.append("text").attr("x", L - MARGE + 8).attr("y", 14).attr("text-anchor", "start").attr("fill", GRIS).text(`First in ${VERS}`);

const gLiens = svg.append("g").attr("fill", "none").selectAll("path").data(graphe.links).join("path")
  .attr("d", sankeyMod.sankeyLinkHorizontal())
  .attr("stroke", (d) => parti[d.source.code].couleur)
  .attr("stroke-width", (d) => Math.max(1, d.width))
  .style("mix-blend-mode", "multiply");
gLiens.append("title").text((d) => {
  const deA = d3.sum(graphe.links.filter((l) => l.source.id === d.source.id), (l) => l.value);
  const versB = d3.sum(graphe.links.filter((l) => l.target.id === d.target.id), (l) => l.value);
  return `${parti[d.source.code].nom} ${DE} → ${parti[d.target.code].nom} ${VERS}: ${fmt.format(d.value)} divisions\n` +
    `${pct(d.value / deA)} of ${parti[d.source.code].nom}'s ${DE} divisions; ${pct(d.value / versB)} of ${parti[d.target.code].nom}'s ${VERS} divisions`;
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
// *Each 2026 polling division is classified by the party that came first on election day in 2022 (left, 2022 results transposed onto the 2026 boundaries) and in 2026 (right). Advance voting excluded. Click on a party to highlight it.*

// %% [markdown]
// The percentages are proportions of polling divisions. In this case, the **CAQ** went from 9,994 polling divisions to 88. The CAQ's migrations show a dispersion toward the PQ, the CPQ and the QLP. The core of the **QLP** vote was kept almost entirely, setting aside the thin strands that migrated to the PQ, the CPQ and QS. The small core of the **PQ** also held firm, its gains coming mostly from the CAQ. **QS** lost some of its vigour to the QLP and, to a lesser extent, to the PQ, and picked up almost nothing elsewhere. The **CPQ** also kept its faithful, and was fed mostly by the CAQ.

// %% [markdown]
// ### Notes
//
// [1] Sources: Élections Québec, results by polling station of the general elections of 3 October 2022 and 5 October 2026, and polling division polygons of 2022 and 2026 (open data, [donnees.electionsquebec.qc.ca](https://donnees.electionsquebec.qc.ca/)). Transposition of 2022 onto the 2026 divisions: Votovision, [votovision/data](https://github.com/votovision/data), `sources/transposition_sections_qc.ts`; table by division in the `data/` folder of this post.

// %% [javascript]
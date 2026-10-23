// ---
// title: Quebec: the electoral distortion of 2026
// id: electoral-distortion
// date: 2026-10-15
// author: Essi Parent
// translation: /fr/posts/2026-10_mode-de-scrutin/
// ---

// %% [markdown]
// > The calculations in this post can be [reproduced on tangent/note](https://note.tangent.to/gh/votovision/votovision.github.io/posts/en/2026-10_electoral-distortion/source.js).
//
// *CAQ: 0*. Not 0% of the vote, but 0 candidates elected. No conspiracy here, nothing but the expected result of the governments are elected in Quebec: *first past the post*, one member per riding. Here is how elections work in Quebec.
//
// 1. you vote in your riding, with an *x* beside the name of the person you choose
// 1. that's it.
//
// Your vote doesn't go beyond your riding (well, almost; we will come back to that). Most candidates are tied to a party, and the party with the most members forms the government. A party is a private organization authorized by the Chief Electoral Officer of Quebec. You form a party, there are rules on how you raise money and how you spend it. Once the results are official, the lieutenant governor, the King's representative, invites the person who can win the confidence of the National Assembly to form the government. That is normally the leader of the party with the most members elected (the winning *caucus*). The party's members chose that person, not the voters. They stay premier as long as the Assembly keeps its confidence in them (with a minority government, they need the support of other parties), and pick their ministers among the members (in practice, among their gang). Normally, we have a clear idea of who will be chosen. But no, you do not choose who will be premier. You only choose the person who will represent your riding: your vote stops there.
//
// A party can therefore [get 13% of the valid votes](https://www.electionsquebec.qc.ca/resultats-et-statistiques/) without electing a single member: CAQ 0 with 13%. It can also squeak through just about everywhere, get 28% of the valid vote, and form the government with 60 members out of the 127 available positions (the *seats*): that is the PQ in 2026. It can also come close everywhere and form a large majority of 72% of the *seats* with 41% of the vote: that was the CAQ in 2022.
//
// Not everyone has the right to vote, not everyone who has it votes, and (a result of the electoral system) those who vote are not necessarily well represented.

// %% [javascript] #collapse-cell
// load the packages
const Plot = await import("https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm");
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const sankeyMod = await import("https://cdn.jsdelivr.net/npm/d3-sankey@0.12/+esm");

// constants
const TOTAL_SIEGES = 127;
const INSCRITS = 6495984;
const VOTES_EXERCES = 4345868;
const VOTES_VALIDES = 4282420;
const POPULATION = 9030000; // ISQ, population on 1 January 2026 (Le bilan démographique du Québec, 2026 edition)

// results
const partis = [
  { parti: "PQ",  votesN: 1199895, sieges: 60, couleur: "#2B50C8" },
  { parti: "QLP", votesN: 1037008, sieges: 39, couleur: "#E01020" },
  { parti: "CPQ", votesN: 885122,  sieges: 19, couleur: "#10275A" },
  { parti: "CAQ", votesN: 571513,  sieges: 0,  couleur: "#6EC9F5" },
  { parti: "QS",  votesN: 532169,  sieges: 9,  couleur: "#F28C28" },
];

// --- palette and typography of the chart (party colours aside) ---
const ENCRE = "#2A2E24";        // leaf-tinted ink, no pure black
const GRIS = "#8B887A";         // secondary text, warm
const GRIS_FONCE = "#5E5B50";   // absolute numbers set on the bands
const VERT_NOEUD = "#9FBA85";   // funnel
const VERT_FLUX = "#E3EDD3";
const SORTIE_FLUX = "#ECE8E1";  // paper grey of the exits
const SORTIE_NOEUD = "#C8C2B8";
const F_TEXTE = "'Inter Tight', 'Segoe UI', sans-serif";

// Setting: horizontal position of the seats column
const X_SIEGES = 820;

const NON_INSCRITS = "No right to vote or not registered";
const couleurParti = Object.fromEntries(partis.map((p) => [p.parti, p.couleur]));
const autresN = VOTES_VALIDES - partis.reduce((s, p) => s + p.votesN, 0);
const partisSankey = [...partis, { parti: "Others", votesN: autresN, sieges: 0, couleur: GRIS }];

const noeudsSankey = [
  "Quebec pop.", "Registered electors", "Ballots cast", "Valid votes",
  NON_INSCRITS, "Abstention", "Rejected ballots",
  ...partisSankey.map((p) => p.parti),
].map((name) => ({ name }));
const idxSankey = Object.fromEntries(noeudsSankey.map((n, i) => [n.name, i]));
const liensSankey = [
  ["Quebec pop.", "Registered electors", INSCRITS],
  ["Quebec pop.", NON_INSCRITS, POPULATION - INSCRITS],
  ["Registered electors", "Ballots cast", VOTES_EXERCES],
  ["Registered electors", "Abstention", INSCRITS - VOTES_EXERCES],
  ["Ballots cast", "Valid votes", VOTES_VALIDES],
  ["Ballots cast", "Rejected ballots", VOTES_EXERCES - VOTES_VALIDES],
  ...partisSankey.map((p) => ["Valid votes", p.parti, p.votesN]),
].map(([s, t, v]) => ({ source: idxSankey[s], target: idxSankey[t], value: v }));

const sankeyGen = sankeyMod.sankey().nodeWidth(8).nodePadding(16)
  .nodeSort(null) // keep the declared order: parties from strongest to weakest
  .extent([[0, 30], [640, 470]]);
const sankeyLayout = sankeyGen({ nodes: noeudsSankey.map((d) => ({ ...d })), links: liensSankey });

// x positions of the columns: the first three tightened
const xColonnes = [0, 80, 160, 300, 640];
for (const n of sankeyLayout.nodes) {
  n.x0 = xColonnes[n.layer];
  n.x1 = n.x0 + sankeyGen.nodeWidth();
}

const gris = new Set([NON_INSCRITS, "Abstention", "Rejected ballots"]);
const couleurNoeud = (name) =>
  gris.has(name) ? SORTIE_NOEUD : couleurParti[name] ?? (name === "Others" ? SORTIE_NOEUD : VERT_NOEUD);
const valeurM = (v) => (v / 1e6).toFixed(2) + " M";

const svgSankey = d3.create("svg")
  .attr("font-family", F_TEXTE).attr("font-size", 12);
svgSankey.append("style").text(
  "@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600&display=swap');"
);

// flows
svgSankey.append("g").selectAll("path").data(sankeyLayout.links).join("path")
  .attr("d", sankeyMod.sankeyLinkHorizontal())
  .attr("fill", "none")
  .attr("stroke", (d) => gris.has(d.target.name) ? SORTIE_FLUX
    : couleurParti[d.target.name] ?? VERT_FLUX)
  .attr("stroke-opacity", (d) => couleurParti[d.target.name] ? 0.5 : 1)
  .attr("stroke-width", (d) => Math.max(1, d.width));

// nodes
svgSankey.append("g").selectAll("rect").data(sankeyLayout.nodes).join("rect")
  .attr("x", (d) => d.x0).attr("y", (d) => d.y0)
  .attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(1, d.y1 - d.y0))
  .attr("fill", (d) => couleurNoeud(d.name));

// labels of the steps (above) and of the exits (right)
svgSankey.append("g").selectAll("text")
  .data(sankeyLayout.nodes.filter((d) => !couleurParti[d.name] && d.name !== "Others" && d.name !== "Valid votes"))
  .join("text")
  .attr("x", (d) => gris.has(d.name) ? d.x1 + 8 : d.x0)
  .attr("y", (d) => gris.has(d.name) ? (d.y0 + d.y1) / 2 : d.y0 - 6)
  .attr("dy", (d) => gris.has(d.name) ? "0.35em" : null)
  .attr("fill", (d) => gris.has(d.name) ? GRIS : ENCRE)
  .text((d) => `${d.name}: ${valeurM(d.value)}`);

const pct = (x) => Math.round(x * 100) + "%";

// --- seats column: same scale as the valid votes (100% = 100%) ---
const nVV = sankeyLayout.nodes.find((n) => n.name === "Valid votes");
const H = nVV.y1 - nVV.y0;
const PAD = sankeyGen.nodePadding();
let yS = sankeyLayout.nodes.find((n) => n.name === partis[0].parti).y0;

const gBandes = svgSankey.append("g");
const gLbl = svgSankey.append("g")  // above the bands, with a halo
  //.attr("paint-order", "stroke").attr("stroke", "white")
  //.attr("stroke-width", 3).attr("stroke-linejoin", "round");

gLbl.append("text")
  .attr("x", X_SIEGES).attr("y", yS - 10).attr("fill", ENCRE)
  .text(`Seats: ${TOTAL_SIEGES}`);

for (const p of partis) {
  const n = sankeyLayout.nodes.find((nd) => nd.name === p.parti);
  const h = p.sieges / TOTAL_SIEGES * H;
  const s0 = yS, s1 = yS + h, xm = (n.x1 + X_SIEGES) / 2;
  gBandes.append("path")
    .attr("d", `M${n.x1},${n.y0}C${xm},${n.y0} ${xm},${s0} ${X_SIEGES},${s0}`
             + `L${X_SIEGES},${s1}C${xm},${s1} ${xm},${n.y1} ${n.x1},${n.y1}Z`)
    .attr("fill", p.couleur).attr("fill-opacity", 0.3);
  gBandes.append("rect")
    .attr("x", X_SIEGES).attr("y", s0)
    .attr("width", sankeyGen.nodeWidth()).attr("height", Math.max(1, h))
    .attr("fill", p.couleur);

  // votes column: party, % of votes, number of votes
  const tv = gLbl.append("text")
    .attr("x", n.x1 + 8).attr("y", (n.y0 + n.y1) / 2).attr("dy", "0.35em");
  tv.append("tspan").attr("font-weight", 600).attr("fill", ENCRE).text(p.parti);
  tv.append("tspan").attr("font-weight", 600).attr("fill", ENCRE)
    .text(`  ${pct(p.votesN / VOTES_VALIDES)}`);
  tv.append("tspan").attr("fill", GRIS_FONCE).text(`  ${valeurM(p.votesN)}`);

  // seats column: % of seats, number of seats
  const ts = gLbl.append("text")
    .attr("x", X_SIEGES + 16).attr("y", (s0 + s1) / 2).attr("dy", "0.35em");
  ts.append("tspan").attr("font-weight", 600).attr("fill", ENCRE)
    .text(pct(p.sieges / TOTAL_SIEGES));
  ts.append("tspan").attr("fill", GRIS)
    .text(`  ${p.sieges} seat${p.sieges === 1 ? "" : "s"}`);

  yS = s1 + PAD;
}

// "Others", same format as the parties
const nAutres = sankeyLayout.nodes.find((n) => n.name === "Others");
const lblAutres = gLbl.append("text")
  .attr("x", nAutres.x1 + 8).attr("y", (nAutres.y0 + nAutres.y1) / 2).attr("dy", "0.35em");
lblAutres.append("tspan").attr("font-weight", 600).attr("fill", GRIS).text("Others");
lblAutres.append("tspan").attr("font-weight", 600).attr("fill", ENCRE)
  .text(`  ${pct(autresN / VOTES_VALIDES)}`);
lblAutres.append("tspan").attr("fill", GRIS).text(`  ${valeurM(autresN)}`);

svgSankey.attr("viewBox", [0, 0, X_SIEGES + 130, Math.max(480, yS + 10)]);

svgSankey.node();

// %% [markdown]
// *Chart data sources: population on 1 January 2026, [Institut de la statistique du Québec](https://statistique.quebec.ca/fr/fichier/bilan-demographique-quebec-edition-2026.pdf); registered electors and votes, [Élections Québec](https://www.electionsquebec.qc.ca/resultats-et-statistiques/).*
//
// ## Oblivion voting
//
// In each riding, only the votes for the winner elect someone. The other votes have no effect on the makeup of the National Assembly. In 2026, that is the case for 58% of the votes. None of the CAQ's 572,000 votes elected a member.

// %% [javascript] #collapse-cell
const aq = await import("https://cdn.jsdelivr.net/npm/arquero@8/+esm");
const op = aq.op;
// Data shared with the French post, in posts/data/.
const resultats = await aq.loadCSV("https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-10_mode-de-scrutin/resultats_quebec_1970_2026.csv");
const prevision = await (await fetch("https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-10_mode-de-scrutin/prevision_2030.json")).json();

const COULEURS = { PQ: "#1d4ed8", QLP: "#d62728", CPQ: "#8b5cf6", CAQ: "#0891b2", QS: "#ea7c0c", Others: "#a8a29e" };
// Party acronyms, as used in English media. Before 2012, the data name the parties in full.
const SIGLES = {
  LIB: "QLP", PCQ: "CPQ", AUTRES: "Others", Parti_liberal: "QLP", Parti_quebecois: "PQ", Union_nationale: "UN",
  Action_democratique_du_quebec: "ADQ", Coalition_avenir_quebec: "CAQ", Quebec_solidaire: "QS",
  Ralliement_creditiste: "RC", Parti_egalite: "EP",
};
const sigle = (p) => SIGLES[p] ?? p;
const nombre = (x, d = 0) => x.toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
// Rounded to two significant digits: 33,736 becomes 34,000.
const arrondi = (x) => { const pas = 10 ** (Math.floor(Math.log10(x)) - 1); return Math.round(x / pas) * pas; };
// Election date as YYYY-MM-DD.
const jour = (x) => (x instanceof Date ? x.toISOString() : String(x)).slice(0, 10);

// Votes of each party in each riding, with its rank and the riding total.
const votesCirc = resultats
  .derive({ election: aq.escape((d) => jour(d.election)) })
  .groupby("election", "circonscription", "parti")
  .rollup({ votes: op.sum("votes") })
  .groupby("election", "circonscription")
  .orderby(aq.desc("votes"))
  .derive({ rang: op.row_number(), total: op.sum("votes") })
  .ungroup();
// One row per riding: winner and margin over the runner-up.
const cles = ["election", "circonscription"];
const luttes = votesCirc.filter((d) => d.rang === 1)
  .select(...cles, { parti: "gagnant" }, { votes: "v1" }, "total")
  .join_left(votesCirc.filter((d) => d.rang === 2).select(...cles, { votes: "v2" }), [cles, cles], [aq.all(), ["v2"]])
  .derive({ ecart: (d) => (d.v2 == null ? d.v1 : d.v1 - d.v2), annee: (d) => op.parse_int(op.substring(d.election, 0, 4)) });

// Votes that elected someone and votes that elected no one, by party, in 2026.
const votesCirc2026 = votesCirc.filter((d) => d.election === "2026-10-05");
const elus2026 = votesCirc2026
  .filter(aq.escape((d) => ["PQ", "LIB", "PCQ", "CAQ", "QS"].includes(d.parti)))
  .groupby("parti")
  .rollup({ total: op.sum("votes"), utiles: (d) => op.sum(d.rang === 1 ? d.votes : 0) })
  .derive({ perdus: (d) => d.total - d.utiles, parti: aq.escape((d) => sigle(d.parti)) })
  .orderby(aq.desc("total"))
  .objects();
const bilan2026 = votesCirc2026.rollup({ utiles: (d) => op.sum(d.rang === 1 ? d.votes : 0), total: op.sum("votes") }).object();
const partPerdue = 1 - bilan2026.utiles / bilan2026.total;

Plot.plot({
  width: 760, height: 230, marginLeft: 50, marginRight: 100,
  x: { label: "votes (millions)", transform: (x) => x / 1e6, grid: true },
  y: { label: null, domain: elus2026.map((d) => d.parti) },
  color: { domain: ["elected a member", "elected no one"], range: ["#44403c", "#d6d3d1"], legend: true },
  marks: [
    Plot.barX(elus2026.flatMap((d) => [
      { parti: d.parti, type: "elected a member", votes: d.utiles },
      { parti: d.parti, type: "elected no one", votes: d.perdus },
    ]), Plot.stackX({ y: "parti", x: "votes", fill: "type", inset: 1 })),
    Plot.text(elus2026, { y: "parti", x: "total", text: (d) => `${nombre(100 * d.perdus / d.total)}% elected no one`, dx: 6, textAnchor: "start", fontSize: 12 }),
  ],
  //caption: `Grey: votes for a person who was not elected, about ${nombre(100 * partPerdue)}% of the 2026 votes.`,
})

// %% [markdown]
// A party loses all the more votes as it comes second or third in many ridings. Three quarters of Québec solidaire's votes elected no one, against a little over a third of the PQ's.

// %% [markdown]
// ## But compared to...
//
// Political scientists like to have indicators of vote distortion. The Gallagher index (no, not named after Brendan), $\sqrt{\tfrac{1}{2}\sum_i (v_i - s_i)^2}$, measures the gap between vote shares and seat shares. The higher the index, the larger the gap. [Wikipedia lists Gallagher indices](https://en.wikipedia.org/wiki/Gallagher_index) for much of the world. Where does Quebec stand?

// %% [javascript] #collapse-cell
const gallagherMonde = [ // from Wikipedia
  { label: "Quebec 2026",         g: 17.80, type: "qc" },
  { label: "Quebec 2022",         g: 25.80, type: "qc" },
  { label: "Quebec 2018",         g: 17.93, type: "qc" },
  { label: "Saint Lucia 2025",    g: 30.22, type: "monde" },
  { label: "United Kingdom 2024", g: 23.73, type: "monde" },
  { label: "Australia 2025",      g: 23.11, type: "monde" },
  { label: "France 2024",         g: 7.79,  type: "monde" },
  { label: "Germany 2025",        g: 6.49,  type: "monde" },
  { label: "Canada 2025",         g: 5.01,  type: "monde" },
  { label: "New Zealand 2023",    g: 2.63,  type: "monde" },
  { label: "United States 2024",  g: 1.01,  type: "monde" },
  { label: "Sweden 2022",         g: 0.64,  type: "monde" },
  { label: "Denmark 2026",        g: 0.42,  type: "monde" },
];

Plot.plot({
  height: 420,
  width: 760,
  marginLeft: 150,
  marginBottom: 55,
  style: { fontSize: "13px", fontFamily: "system-ui" },
  x: { label: "Gallagher index", grid: true, domain: [0, 32], labelAnchor: "center", labelOffset: 45 },
  y: {
    label: null,
    domain: gallagherMonde.slice().sort((a, b) => b.g - a.g).map((d) => d.label),
  },
  marks: [
    Plot.barX(gallagherMonde, {
      y: "label", x: "g",
      fill: (d) => d.label === "Quebec 2026" ? "#2B50C8" : d.type === "qc" ? "#8FA6E0" : "#c9c9c9",
    }),
    Plot.text(gallagherMonde, {
      y: "label", x: "g", dx: 6, textAnchor: "start",
      text: (d) => d.g.toFixed(1), fill: "#444", fontSize: 11,
    }),
  ]
});

// %% [markdown]
// Countries that vote by proportional representation have low indices, but a majoritarian system is not necessarily very distorted: France (two rounds) and Canada in 2025 stay under 10. In Germany, a party gets seats in the *Bundestag* only if it collects at least 5% of the votes. In 2025, [about 14% of the votes went to parties under that threshold](https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse.html), hence a higher index. For the United States *House of Representatives*, most states elect one person per district, as in Quebec. Almost all votes go to two parties, and seats roughly follow votes. Quebec lives in the zone of the most distorted majoritarian systems. The *CAQ: 0* effect is not an exceptional case, though. In 2022, the CPQ also got about 13% of the votes, and no seat. And in the 2022 election, the CAQ benefited from the distortion even more than the PQ did in 2026.

// %% [markdown]
// ## Fiction: the 2026 election under proportional representation
//
// Under strict proportional representation, a party gets a share of the seats equal to its share of the vote (rounded, of course) [1]. A 5% threshold would change nothing in 2026: the five main parties all exceed 12%. That is not, however, what the *Mouvement démocratie nouvelle* (MDN) proposes, a Quebec organization that has been calling for electoral reform since 1999, and whose current proposal is a [mixed-member proportional system with regional lists](https://democratie-nouvelle.qc.ca/wp-content/uploads/2026/02/Le-mode-de-scrutin-proportionnel-mixte.pptx.pdf), the *Pro-Mix* model (no, not the potting soil brand). In short, the MDN proposes electing members in a smaller number of ridings, with proportionality brought in by lists of candidates in the regions.

// %% [javascript] #collapse-cell
// Distribution of the 127 seats by proportional representation according to the 2026 votes (Sainte-Laguë method, no threshold).
function sainteLague(votes, sieges) {
  const s = Object.fromEntries(Object.keys(votes).map((p) => [p, 0]));
  for (let i = 0; i < sieges; i++) {
    let meilleur = null, quotient = -1;
    for (const p in votes) {
      const q = votes[p] / (2 * s[p] + 1);
      if (q > quotient) { quotient = q; meilleur = p; }
    }
    s[meilleur]++;
  }
  return s;
}
// Pivotal power: share of the majority combinations in which the party is indispensable.
function banzhaf(sieges, majorite) {
  const partis = Object.keys(sieges).filter((p) => sieges[p] > 0);
  const pivots = partis.map(() => 0);
  for (let m = 1; m < 1 << partis.length; m++) {
    let t = 0;
    partis.forEach((p, i) => { if (m >> i & 1) t += sieges[p]; });
    if (t < majorite) continue;
    partis.forEach((p, i) => { if (m >> i & 1 && t - sieges[p] < majorite) pivots[i]++; });
  }
  const total = pivots.reduce((a, b) => a + b, 0);
  return Object.fromEntries(partis.map((p, i) => [p, pivots[i] / total]));
}
// Mixed-member proportional system of Bill 199 (80 ridings, 49 regional seats in 17 regions, 4% threshold, 129 seats):
// simulation by the Mouvement démocratie nouvelle on the votes of 5 October 2026, press release of 7 October 2026,
// figures reported by Hélène Buzzetti, ["Pour en finir avec la réforme électorale"](https://www.lenouvelliste.ca/chroniques/helene-buzzetti/2026/10/09/pour-en-finir-avec-la-reforme-electorale-Q5RHI6WFGRCP5DS46QPM3TO4EY/), Le Nouvelliste, 9 October 2026.
// Not recomputed here.
const siegesMixte = { PQ: 48, QLP: 33, CPQ: 23, CAQ: 16, QS: 9 };
const SIEGES = 127, MAJORITE = 64;
const votesParParti = Object.fromEntries(elus2026.map((d) => [d.parti, d.total]));
const siegesActuels = Object.fromEntries(luttes.filter((d) => d.election === "2026-10-05").groupby("gagnant").count().objects().map((d) => [sigle(d.gagnant), d.count]));
const siegesProportionnels = sainteLague(votesParParti, SIEGES);
const pivotActuel = banzhaf(siegesActuels, MAJORITE);
const pivotProportionnel = banzhaf(siegesProportionnels, MAJORITE);
const comparaison = Object.keys(votesParParti).map((p) => ({
  parti: p,
  "votes (%)": 100 * votesParParti[p] / bilan2026.total,
  "current seats": siegesActuels[p] ?? 0,
  "seats under proportional representation": siegesProportionnels[p],
  "seats under mixed proportional (MDN)": siegesMixte[p] ?? 0,
  "current pivotal power (%)": 100 * (pivotActuel[p] ?? 0),
  "pivotal power under proportional representation (%)": 100 * (pivotProportionnel[p] ?? 0),
}));

// Chart in d3. Two arrows per party: from the current seats to pure proportional representation (curving down), then
// from pure proportional to mixed (curving up). Under three seats of difference, no arrow: the arrival symbol is
// enough. When the mixed system coincides with another one (QS: 9 and 9), its circle is nudged upward.
const ACTUEL = "current seats", PROP = "seats under proportional representation", MIXTE = "seats under mixed proportional (MDN)";
const SYSTEMES = [[ACTUEL, "actuel"], [PROP, "proportionnelle"], [MIXTE, "mixte"]];
const R_SYMBOLE = 3, RANG = 40, L_F = 760, MG = { haut: 28, droite: 40, bas: 32, gauche: 62 };
const H_F = MG.haut + RANG * comparaison.length + MG.bas;
const rang = Object.fromEntries(comparaison.map((d, i) => [d.parti, i]));
const yMixte = (d) => rang[d.parti] - (d[MIXTE] === d[ACTUEL] || d[MIXTE] === d[PROP] ? 0.25 : 0);
const xF = d3.scaleLinear([0, 70], [MG.gauche, L_F - MG.droite]);
const yF = d3.scaleLinear([-0.5, comparaison.length - 0.5], [MG.haut, H_F - MG.bas]);
const SYMBOLE = { actuel: d3.symbolCircle, proportionnelle: d3.symbolTimes, mixte: d3.symbolCircle };
const forme = (systeme) => d3.symbol(SYMBOLE[systeme], Math.PI * R_SYMBOLE ** 2)();

// Arc whose tangents make `courbure` degrees with the chord, bulging down or up, shortened by `retrait` px at each
// end, with a head at the arrival.
function fleche(x1, y1, x2, y2, bombe, courbure = 20, retrait = R_SYMBOLE + 2, pointe = 5) {
  const th = courbure * Math.PI / 180, dx = x2 - x1, dy = y2 - y1, corde = Math.hypot(dx, dy);
  const tourne = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const s = (bombe === "bas" ? 1 : -1) * Math.sign(dx);
  const depart = tourne([dx / corde, dy / corde], s * th), arrivee = tourne([dx / corde, dy / corde], -s * th);
  const [ax, ay] = [x1 + retrait * depart[0], y1 + retrait * depart[1]], [bx, by] = [x2 - retrait * arrivee[0], y2 - retrait * arrivee[1]];
  const r = Math.hypot(bx - ax, by - ay) / (2 * Math.sin(th)), sens = (bombe === "bas") === (dx < 0) ? 1 : 0;
  const tete = [Math.PI - Math.PI / 6, Math.PI + Math.PI / 6].map((a) => tourne(arrivee, a)).map(([px, py]) => `${bx + pointe * px},${by + pointe * py}`);
  return `M${ax},${ay}A${r},${r} 0 0 ${sens} ${bx},${by}M${tete[0]}L${bx},${by}L${tete[1]}`;
}

const svgF = d3.create("svg").attr("viewBox", [0, 0, L_F, H_F]).attr("width", L_F).attr("height", H_F)
  .style("max-width", "100%").style("height", "auto").style("font-family", F_TEXTE).style("font-size", "11px");
svgF.append("g").attr("stroke", "#ddd").selectAll("line").data(xF.ticks(7)).join("line").attr("x1", xF).attr("x2", xF).attr("y1", MG.haut).attr("y2", H_F - MG.bas);
svgF.append("g").attr("transform", `translate(0,${H_F - MG.bas})`).attr("color", "#333").call(d3.axisBottom(xF).ticks(7)).call((g) => g.select(".domain").remove());
svgF.append("text").attr("x", L_F - MG.droite).attr("y", H_F - 2).attr("text-anchor", "end").attr("fill", "#333").text("seats →");
svgF.append("g").attr("fill", "#333").selectAll("text").data(comparaison).join("text").attr("x", MG.gauche - 10).attr("y", (d) => yF(rang[d.parti])).attr("dy", "0.35em").attr("text-anchor", "end").text((d) => d.parti);
svgF.append("line").attr("x1", xF(MAJORITE)).attr("x2", xF(MAJORITE)).attr("y1", MG.haut).attr("y2", H_F - MG.bas).attr("stroke", "#000").attr("stroke-dasharray", "3,3");

const gFleches = svgF.append("g").attr("fill", "none").attr("stroke-width", 1.5);
for (const d of comparaison) {
  const y = yF(rang[d.parti]);
  if (Math.abs(d[PROP] - d[ACTUEL]) >= 3) gFleches.append("path").attr("stroke", COULEURS[d.parti]).attr("d", fleche(xF(d[ACTUEL]), y, xF(d[PROP]), y, "bas"));
  if (Math.abs(d[MIXTE] - d[PROP]) >= 3) gFleches.append("path").attr("stroke", COULEURS[d.parti]).attr("d", fleche(xF(d[PROP]), y, xF(d[MIXTE]), yF(yMixte(d)), "haut"));
}
const points = comparaison.flatMap((d) => SYSTEMES.map(([champ, systeme]) => ({ parti: d.parti, systeme, x: xF(d[champ]), y: yF(champ === MIXTE ? yMixte(d) : rang[d.parti]) })));
svgF.append("g").attr("stroke-width", 1.5).selectAll("path").data(points).join("path").attr("transform", (d) => `translate(${d.x},${d.y})`)
  .attr("d", (d) => forme(d.systeme)).attr("fill", (d) => d.systeme === "actuel" ? COULEURS[d.parti] : "none").attr("stroke", (d) => COULEURS[d.parti]);

// Labels: the number only; left of the first symbol (below it near the axis), right of the last, above the middle
// one. Two equal values get a single label.
const PLACES = { gauche: [-8, 0, "end"], bord: [0, 13, "middle"], milieu: [0, -10, "middle"], droite: [8, 0, "start"] };
const etiquettes = comparaison.flatMap((d) => [...new Set(SYSTEMES.map(([champ]) => d[champ]))].sort((a, b) => a - b)
  .map((x, i, t) => ({ parti: d.parti, x, place: i === 0 ? (x < 6 ? "bord" : "gauche") : i === t.length - 1 ? "droite" : "milieu" })));
svgF.append("g").attr("fill", "#333").selectAll("text").data(etiquettes).join("text").attr("dy", "0.35em")
  .attr("x", (d) => xF(d.x) + PLACES[d.place][0]).attr("y", (d) => yF(rang[d.parti]) + PLACES[d.place][1]).attr("text-anchor", (d) => PLACES[d.place][2]).text((d) => d.x);

// Legend, on one line in the top margin.
const LEGENDE = [["actuel", "current seats", 0], ["proportionnelle", "pure proportional", 110], ["mixte", "mixed (MDN simulation)", 240]];
const gLegende = svgF.append("g").attr("transform", `translate(${MG.gauche},${MG.haut - 14})`).attr("fill", "#555").attr("stroke-width", 1.5);
gLegende.selectAll("path").data(LEGENDE).join("path").attr("transform", (d) => `translate(${d[2]},0)`).attr("d", (d) => forme(d[0])).attr("fill", (d) => d[0] === "actuel" ? "#555" : "none").attr("stroke", "#555");
gLegende.selectAll("text").data(LEGENDE).join("text").attr("x", (d) => d[2] + 8).attr("dy", "0.35em").text((d) => d[1]);

// Figure caption: Filled circle: seats won in 2026. First arrow: the same votes distributed by proportional
// representation (cross). Second arrow: mixed-member proportional system of Bill 199, simulation by the Mouvement
// démocratie nouvelle, 129 seats (hollow circle). Dashed line: majority of 64 seats.
svgF.node()

// %% [markdown]
// Under pure proportional representation, the PQ would have 36 seats rather than 60, and [48 under *Pro-Mix*](https://www.lenouvelliste.ca/chroniques/helene-buzzetti/2026/10/09/pour-en-finir-avec-la-reforme-electorale-Q5RHI6WFGRCP5DS46QPM3TO4EY/) (which would have 129 seats, hence a majority threshold of 65 seats). A majority coalition government, 48 (PQ) + 23 (CPQ) = 71 (with the QLP in opposition), would have been possible. Today, the PQ could join forces with the CPQ or QS (or count on 4 floor-crossers) to reach a majority.

// %% [markdown]
// ## Does your vote change anything?
//
// The electoral system also fundamentally changes the weight of a vote. Today, a vote changes a riding's result only if it breaks a tie. Since 1970, the closest race was Hull in 1976, won by 2 votes. In 2026, Vachon was won by 3 votes, after a judicial recount.

// %% [javascript] #collapse-cell
// Margin between the top two in each riding, from 1970 to 2026.
// Chance of a perfect tie: the share of margins under 100 votes, divided by 100.
const nLuttes = luttes.numRows();
const nSerrees = luttes.filter((d) => d.ecart < 100).numRows();
const probabiliteEgalite = nSerrees / (100 * nLuttes);

luttes.orderby("ecart").slice(0, 10)
  .derive({ annee: aq.escape((d) => String(d.annee)), gagnant: aq.escape((d) => sigle(d.gagnant)) })
  .select({ annee: "year", circonscription: "riding", gagnant: "winner", ecart: "margin (votes)", total: "valid votes" })
  .objects()

// %% [javascript] #collapse-cell
Plot.plot({
  width: 640, height: 240,
  x: { type: "log", domain: [1, 50000], label: "margin between the top two (votes, log scale)", grid: true, ticks: [1, 10, 100, 1000, 10000], tickFormat: (x) => nombre(x) },
  y: { label: "ridings", grid: true },
  marks: [
    Plot.rectY(luttes.filter((d) => d.ecart >= 1).objects(), Plot.binX({ y: "count" }, {
      x: "ecart", thresholds: Array.from({ length: 48 }, (_, i) => 10 ** (i / 10)), fill: "#a8a29e", inset: 0.5,
    })),
    Plot.ruleX([100], { stroke: "#1c1917", strokeDasharray: "3,3" }),
    Plot.text([100], { x: (d) => d, frameAnchor: "top", dx: 6, textAnchor: "start", text: () => "100 votes", fontSize: 11 }),
    Plot.ruleY([0]),
  ],
  //caption: `Margin between the top two in ${nombre(nLuttes)} ridings, elections from 1970 to 2026. Left of the dashed line, the ${nSerrees} won by fewer than 100 votes.`,
})

// %% [markdown]
// Over nearly 2,000 riding races since 1970, 25 were won by fewer than 100 votes. A perfect tie in a riding happens about once in 7,800 riding races [2].
//
// The [Votovision forecast for 2030](https://votovision.github.io/en/quebec/) allows the same calculation for each riding. [The chance that one vote decides the winner](https://doi.org/10.1111/j.1465-7295.2010.00272.x) depends on the forecast margin between the top two and on the number of electors [3].

// %% [javascript] #collapse-cell
// Chance that a single vote changes the winner of each riding in 2030.
// Method: note [3] at the end of the post.
const { normal } = await import("https://cdn.jsdelivr.net/npm/@tangent.to/proba@0.2/+esm");
const deuxPremiers = prevision.circonscriptions.map((c) => {
  const [[p1], [p2]] = Object.entries(c.parts).sort((a, b) => b[1] - a[1]);
  const m = c.parts[p1] - c.parts[p2];
  const p = c.victoire[p1] / Math.max(c.victoire[p1] + c.victoire[p2], 1e-9);
  const z = normal.quantile(p, { mu: 0, sigma: 1 });
  const mesurable = p > 0.02 && p < 0.98 && Math.abs(z) > 0.05;
  return { nom: c.nom, p1, p2, m, electeurs: c.votes2026, s: mesurable ? m / z : null };
});
const ecartTypeMedian = aq.from(deuxPremiers).filter((d) => d.s > 0).rollup({ s: op.median("s") }).get("s", 0);
const decisif = deuxPremiers.map(({ nom, p1, p2, m, s, electeurs }) => ({
  nom, premier: sigle(p1), deuxieme: sigle(p2), electeurs,
  probabilite: normal.pdf(m, { mu: 0, sigma: s > 0 ? s : ecartTypeMedian }) / electeurs,
}));
const tableDecisif = aq.from(decisif);
const resume = tableDecisif.rollup({
  max: op.max("probabilite"),
  mediane: op.median("probabilite"),
  moyenne: (d) => op.sum(d.probabilite * d.electeurs) / op.sum(d.electeurs),
}).object();
const plusSerree = tableDecisif.orderby(aq.desc("probabilite")).get("nom", 0);
// Under proportional representation, one seat per about 34,000 votes: the same chance for everyone.
const proportionnel = SIEGES / aq.from(prevision.circonscriptions).rollup({ n: op.sum("votes2026") }).get("n", 0);
const unSur = (p) => `1 in ${nombre(arrondi(1 / p))}`;
// Under this floor, the riding is considered safe.
const PLANCHER = 1e-7;
const sures = decisif.filter((d) => d.probabilite < PLANCHER).length;

Plot.plot({
  width: 640, height: 300, marginTop: 30, marginLeft: 20, marginRight: 20,
  x: {
    type: "log", domain: [PLANCHER, 1e-3], label: "chance that one vote decides the winner (log scale)",
    grid: true, ticks: [1e-7, 1e-6, 1e-5, 1e-4, 1e-3], tickFormat: (p) => (p === PLANCHER ? "< 1/10 M" : `1/${nombre(1 / p)}`),
  },
  y: { axis: null },
  marks: [
    Plot.ruleX([proportionnel], { stroke: "#1c1917", strokeDasharray: "3,3" }),
    Plot.text([proportionnel], { x: (d) => d, frameAnchor: "top", dy: -18, text: () => "proportional", fontSize: 11 }),
    Plot.dot(decisif, Plot.dodgeY({
      x: (d) => Math.max(d.probabilite, PLANCHER), r: 3.5, fill: (d) => COULEURS[d.premier],
      title: (d) => `${d.nom}: ${unSur(d.probabilite)} (${d.premier} ahead of ${d.deuxieme})`,
    })),
  ],
  //caption: `One dot per riding, coloured by the party leading in the 2030 forecast. The further right the dot, the more a vote counts. The closest: ${plusSerree}, about ${unSur(resume.max)}. On the left, the ${sures} safe ridings. Dashed line: under proportional representation, about ${unSur(proportionnel)} for everyone.`,
})

// %% [markdown]
// In the riding of Ungava, the closest and one of the least populous, that chance is about 1 in 4,100. In the median riding, it is about 1 in 26,000. In 7 ridings, it is under 1 in 10 million, the same order of magnitude as the Lotto 6/49 jackpot (about 1 in 14 million).
//
// Under proportional representation, every vote counts, but a vote changes the distribution of seats about once in 34,000 [4], a little less than today's median. That chance would be the same everywhere, though. Today, a vote weighs much more in a close riding than in a safe one.

// %% [markdown]
// ## Why vote anyway
//
// For the same reason that danger is not risk. A shark attack is dangerous. But it is so unlikely (especially if you are on a bus right now) that the risk is practically nil. Risk is the danger × the probability that it happens. What matters is the size of the consequence relative to its probability. A small probability that something enormous happens: that is no longer a shark attack on a bus, and it is serious.
//
// Whether it is one chance in 26,000 or in 34,000 of making the difference, [it is negligible](https://doi.org/10.2307/1953324). But the stakes affect all of Quebec (budgets, laws, emergency measures), all spread over four years of government (in the case of a majority government). The more electors there are, the smaller the probability of being decisive... but the greater the stakes. The two effects combined make voting a [*rational*](https://www.nber.org/papers/w13562) democratic act for anyone who cares about others and about posterity.
//
// Your vote also has a definite effect, even if your choice loses. Every year, [the State pays the parties about $2 per registered elector](https://www.electionsquebec.qc.ca/partis-politiques/financement/), nearly $13 million, shared according to their share of the votes at the last election. The envelope is fixed: your vote creates no money, it moves about $3 a year to your party ($12 over four years), at the expense of the others. A person can give at most $100 a year to a party.

// %% [javascript] #collapse-cell
const ALLOCATION_PAR_INSCRIT = 1.99;
const allocationTotale = ALLOCATION_PAR_INSCRIT * INSCRITS;
const parVote = allocationTotale / VOTES_VALIDES;
elus2026.map((d) => ({
  party: d.parti,
  "votes 2026": d.total,
  "members elected": siegesActuels[d.parti] ?? 0,
  "annual allowance ($)": Math.round(d.total * parVote),
  "over four years ($)": Math.round(4 * d.total * parVote),
}))

// %% [markdown]
// The CAQ has no member, but its votes bring it about $1,700,000 a year. A party's score also counts beyond money: it affects its media coverage and its ability to recruit candidates.
//
// [Strategic voting](https://www.cambridge.org/core/books/making-votes-count/42CD9425E1410457FFC5079EC851F32B) means voting to block a party you want to see lose. It changes the result only if your riding is close and your vote breaks a tie, the same tiny bet as an ordinary vote. On the other hand, your preferred party loses about $3 a year for sure, and a bit of its score. Under proportional representation, strategic voting loses much of its point, since almost no vote is wasted. It does not disappear entirely: with a threshold, some lend their vote to an ally at risk of falling under the bar, as in Germany.

// %% [markdown]
// ## Why the electoral system does not change
//
// According to its supporters, bringing in more proportionality would allow better representation of political currents, more territorial fairness and, since the parties would form more of a continuous spectrum than sharply drawn clans (in theory at least), a better spirit of cooperation among elected members. Why, then, does the electoral system seem set in concrete?
//
// Changing the electoral system requires a law passed by the National Assembly. But the governing party is almost always the one the electoral system favoured. Proportional representation was in the Parti québécois's platform from its beginnings, and [René Lévesque never managed to get it adopted](https://www.puq.ca/catalogue/livres/reforme-mode-scrutin-quebec-3925.html). Fifty years later, in 2018, [the CAQ committed, with the PQ, Québec solidaire and the Green Party,](https://policyoptions.irpp.org/fr/2021/02/pour-une-reforme-du-systeme-electoral-au-quebec-sans-referendum/) to introducing a share of proportionality. Once in power, it tabled [Bill 39 in 2019](https://www.quebec.ca/nouvelles/actualites/details/le-gouvernement-du-quebec-depose-un-projet-de-loi-etablissant-un-nouveau-mode-de-scrutin), which was dropped before the 2022 election.
//
// Defenders of the current system put forward several arguments, to which supporters of reform respond. Today, each riding has its member, whom the voters judge directly, and sparsely populated regions keep their members: that would also be the case with the MDN's proposal, even if ridings would be larger. It is said that the current system produces stable majority governments, but Quebec had minority governments in 2007, 2012 and 2026. A mixed system would be too complicated, but it is in use in Germany, New Zealand and Scotland.
//
// Finally, it is said that proportional representation would open the door to extremist parties. The MDN's model sets a 4% threshold overall, and since compensation is done by region, in practice it takes much more to win a seat outside the more populous regions. But, and this matters here, *a threshold protects against fragmentation, not against extremism*. The AfD, a German far-right party, [passed 5%](https://www.bundeswahlleiterin.de/bundestagswahlen/2025/ergebnisse.html) and now sits in the *Bundestag*. In Quebec, the current system did not prevent the election of people who had made [anti-vaccine claims](https://www.985fm.ca/audio/797908/une-candidate-du-pcq-aux-propos-anti-vaccins-elle-a-des-idees-hors-consensus) or posted [photos of supposed chemtrails](https://www.journaldemontreal.com/2026/09/30/non-le-parti-conservateur-ne-croit-pas-aux-chemtrails-mais), a theory with no scientific basis.
//
// [At the Radio-Canada leaders' debate](https://ici.radio-canada.ca/ohdio/premiere/emissions/emission-speciale/episodes/1273212/le-debat-des-chefs-2026/transcription), the leader of the Parti québécois, now premier, committed to reforming the electoral system, without giving details.

// %% [markdown]
// ### Notes
//
// [1] The proportional distribution gives the 127 seats to the five main parties according to their 2026 votes, with no threshold (Sainte-Laguë method). The other parties, about 1% of the votes, get no seat.
//
// [2] From 1970 to 2026, 25 ridings out of 1,946 were won by fewer than 100 votes. If these margins are spread evenly between 0 and 100 votes, a perfect tie happens about once in 7,800.
//
// [3] The chance that one vote decides the winner in 2030 is computed from the forecast margin between the top two and the uncertainty on that margin, derived from the probability of winning. When the forecast is nearly certain, the typical uncertainty of the other ridings is used.
//
// [4] Under proportional representation, 4,282,551 valid votes for 127 seats give one seat per about 34,000 votes. One vote therefore changes one seat about once in 34,000.

// %% [javascript]

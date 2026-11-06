// ---
// title: Québec : profil des bureaux de vote et vote de 2026
// id: vote-correlations
// date: 2026-11-06
// ---

// %% [markdown]
// À écrire : objet de l'analyse et question posée.

// %% [javascript] #collapse-cell
// Paquets, résultats précalculés et outils d'affichage. Les calculs sont dans le notebook
// posts/fr/2026-11_vote-correlations-computations (son script run.mjs écrit precomputed.json).
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const Plot = await import("https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm");
const PRECOMPUTED_URL = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/precomputed.json";
const R = await d3.json(PRECOMPUTED_URL);

// Plan d'analyse et ses modifications.
const PLAN = {
  arrete: "2026-11-06, avant d'ajouter les votes",
  unite: "groupe de sections de vote de 2026 desservies par un même bureau de vote par anticipation ; au moins 100 habitants ; vote du jour du scrutin et vote par anticipation additionnés",
  modele: "régression multinomiale des comptes de votes de 2026 : effet fixe de circonscription, vote de 2022 transposé (ilr des cinq principaux partis), covariables du recensement de 2021",
  covariables: "classes ordonnées résumées en unités réelles (âge moyen, années d'études) ; taux en logit ; grandeurs positives en log ; variables nominales en compositions (ilr)",
  incertitude: "bootstrap par circonscription (199 tirages), intervalles à 95 %",
  rapport: "associations entre groupes de sections, jamais comportements individuels ; partis séparés ; effets en points de pourcentage pour un écart interdécile à l'intérieur des circonscriptions",
  modifications: [
    "2026-11-06, après un premier examen des résultats : la réponse est modélisée en comptes (multinomiale) plutôt qu'en log-ratios centrés par une RDA, la variance des log-ratios étant dominée par le bruit des petits comptes",
    "2026-11-06 : les balances choisies à la main sont remplacées par des moyennes en unités réelles (variables ordonnées) et par des compositions entières (variables nominales)",
    "2026-11-06 : la partition de la variance devient une partition de la déviance, rapportée à la déviance explicable (totale moins le bruit du dépouillement simulé)",
    "2026-11-06 : les vecteurs propres spatiaux sont remplacés par le I de Moran des résidus (4, 6 et 8 voisins)",
    "2026-11-06 : le type de logement, le revenu médian et la part des ménages d'une personne sont retirés (redondants avec la densité de la population, le faible revenu et la taille des ménages)",
    "2026-11-06 : l'unité passe de la section au groupe de sections d'un bureau de vote par anticipation, pour inclure le vote par anticipation (publié par bureau) ; l'analyse par bureau de vote du jour du scrutin devient une analyse de robustesse",
  ],
  nonFait: ["interpolation du recensement par surface plutôt que par électeurs", "validation croisée par région administrative"],
};

const PARTIES = R.parties;
const PARTY_NAME = { PQ: "PQ", LIB: "PLQ", CAQ: "CAQ", QS: "QS", PCQ: "PCQ", AUTRES: "Autres" };
const number = (v, decimals = 0) => new Intl.NumberFormat("fr-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
// Valeur d'une covariable dans son unité : pourcentages à une décimale sous 10 %, densité de la population à l'unité.
const display = (c, v) => (c.percent ? number(100 * v, 100 * v < 10 ? 1 : 0) : number(v, c.key === "population_density" ? 0 : 1));
const contrastByKey = new Map(R.contrasts.map((c) => [c.key, c]));
// Étiquette d'un contraste : la covariable, puis les deux valeurs comparées, dans son unité.
const contrastLabel = (key) => { const c = contrastByKey.get(key); return `${c.label}\n${display(c, c.low)} → ${display(c, c.high)} ${c.unit}`; };
const GROUPS = [
  { title: "Âge, scolarité, revenu, ménages, origine, emploi", keys: R.contrasts.filter((c) => !c.block).map((c) => c.key) },
  ...[["mother_tongue", "Langue maternelle"], ["religion", "Religion"], ["commute", "Mode de transport pour la navette"], ["occupation", "Profession"]]
    .map(([block, title]) => ({ title, keys: R.contrasts.filter((c) => c.block === block).map((c) => c.key) })),
];
const INK = "#2A2E24", GREY = "#8B887A", PALE = "#ECE8E1";
const figure = (title, ...content) => {
  const f = document.createElement("figure"); f.style.margin = "0 0 1.5rem";
  if (title) { const caption = document.createElement("figcaption"); caption.textContent = title; caption.style.fontWeight = 600; caption.style.marginBottom = "0.3rem"; f.append(caption); }
  f.append(...content); return f;
};

({ groupes: R.units.count, sections: R.units.sections, circonscriptions: R.units.ridings, votes: R.units.votes, voteDuJour: R.units.day2026, voteParAnticipation: Math.round(R.units.advance2026), calcule: R.generated })

// %% [markdown]
// À écrire : données, unité d'analyse (groupes de sections d'un bureau de vote par anticipation), votes couverts.

// %% [javascript]
// Covariables : valeur médiane des groupes de sections, et les deux valeurs comparées par le modèle. Ces deux valeurs
// encadrent la médiane ; leur écart est l'écart entre le 10e et le 90e centile des groupes d'une même circonscription.
const covariateTable = d3.create("table").style("font-size", "0.85rem").style("border-collapse", "collapse");
covariateTable.append("thead").append("tr").selectAll("th").data(["Covariable", "Unité", "Médiane", "Valeur basse", "Valeur haute"]).join("th")
  .text((d) => d).style("text-align", (d, i) => (i < 2 ? "left" : "right")).style("padding", "2px 8px").style("border-bottom", `1px solid ${INK}`);
covariateTable.append("tbody").selectAll("tr").data(R.contrasts).join("tr").selectAll("td")
  .data((c) => [c.label, c.unit, display(c, c.median), display(c, c.low), display(c, c.high)]).join("td")
  .text((d) => d).style("text-align", (d, i) => (i < 2 ? "left" : "right")).style("padding", "2px 8px").style("border-bottom", `1px solid ${PALE}`);
covariateTable.node()

// %% [markdown]
// À écrire : définition des covariables (moyennes en unités réelles, compositions), sens des valeurs basse et haute.

// %% [javascript]
// Paires de covariables corrélées à l'intérieur des circonscriptions (|r| d'au moins 0,5), hors paires de catégories
// d'une même variable nominale, liées par construction.
const correlatedPairs = R.contrasts.flatMap((a, i) => R.contrasts.slice(i + 1).map((b, k) => ({ a, b, r: R.correlations[i][i + 1 + k] })))
  .filter((d) => Math.abs(d.r) >= 0.5 && !(d.a.block && d.a.block === d.b.block))
  .map((d) => ({ pair: `${d.a.label}\n${d.b.label}`, r: d.r }));
Plot.plot({
  width: 760, height: 40 + 34 * correlatedPairs.length, marginLeft: 400,
  x: { label: "corrélation", grid: true, domain: [-1, 1] }, y: { label: null, domain: d3.sort(correlatedPairs, (d) => -d.r).map((d) => d.pair), tickSize: 0 },
  marks: [Plot.barX(correlatedPairs, { x: "r", y: "pair", fill: GREY, insetTop: 3, insetBottom: 3 }), Plot.ruleX([0]),
    Plot.text(correlatedPairs, { x: "r", y: "pair", text: (d) => number(d.r, 2), dx: (d) => (d.r > 0 ? 4 : -4), textAnchor: (d) => (d.r > 0 ? "start" : "end"), lineAnchor: "middle" })],
})

// %% [javascript]
// Facteur d'inflation de la variance des covariables scalaires dans le modèle complet (à l'intérieur des circonscriptions).
const inflation = R.varianceInflation.map((d) => ({ label: contrastByKey.get(d.key).label, vif: d.vif }));
Plot.plot({
  width: 760, height: 40 + 22 * inflation.length, marginLeft: 400,
  x: { label: "facteur d'inflation de la variance", grid: true }, y: { label: null, domain: d3.sort(inflation, (d) => -d.vif).map((d) => d.label) },
  marks: [Plot.barX(inflation, { x: "vif", y: "label", fill: GREY }), Plot.ruleX([0]), Plot.ruleX([5], { stroke: INK, strokeDasharray: "3,3" }),
    Plot.text(inflation, { x: "vif", y: "label", text: (d) => number(d.vif, 1), dx: 4, textAnchor: "start" })],
})

// %% [markdown]
// À écrire : redondances entre covariables.

// %% [javascript]
// Partition de la déviance. La déviance explicable est la déviance du modèle « province seulement » moins le bruit du
// dépouillement (déviance attendue de comptes multinomiaux tirés au hasard). Le vote de 2022 et les covariables se
// recoupent : chacun est donné seul (après la circonscription) et après l'autre.
const deviance = Object.fromEntries(R.deviance.map((d) => [d.model, d.deviance]));
const explainable = deviance.m0 - R.noise.mean;
const partition = [
  { term: "Circonscription", low: (deviance.m0 - deviance.m1) / explainable, high: (deviance.m0 - deviance.m1) / explainable },
  { term: "Vote de 2022 du groupe de sections", low: (deviance.m2b - deviance.m3) / explainable, high: (deviance.m1 - deviance.m2) / explainable },
  { term: "Covariables du recensement", low: (deviance.m2 - deviance.m3) / explainable, high: (deviance.m1 - deviance.m2b) / explainable },
  { term: "Non expliqué, au-delà du bruit du dépouillement", low: (deviance.m3 - R.noise.mean) / explainable, high: (deviance.m3 - R.noise.mean) / explainable },
];
Plot.plot({
  width: 760, height: 200, marginLeft: 330, marginRight: 110,
  x: { label: "part de la déviance explicable (%)", grid: true, domain: [0, 100] }, y: { label: null, domain: partition.map((d) => d.term) },
  marks: [
    Plot.barX(partition, { x: (d) => 100 * d.high, y: "term", fill: PALE }),
    Plot.barX(partition, { x: (d) => 100 * d.low, y: "term", fill: GREY }),
    Plot.text(partition, { x: (d) => 100 * d.high, y: "term", dx: 4, textAnchor: "start",
      text: (d) => (d.high - d.low < 0.0005 ? `${number(100 * d.low, 1)} %` : `${number(100 * d.low, 1)} à ${number(100 * d.high, 1)} %`) }),
  ],
  caption: `Barre foncée : après l'autre terme ; barre pâle : seul, après la circonscription. Bruit du dépouillement : ${number(100 * R.noise.mean / deviance.m0, 1)} % de la déviance totale. Khi-deux de Pearson par degré de liberté du modèle complet : ${number(R.overdispersion, 2)}.`,
})

// %% [markdown]
// À écrire : lecture de la partition (ce qui tient à la circonscription, au vote de 2022, au profil du groupe de sections).

// %% [javascript]
// Autocorrélation spatiale des résidus entre groupes de sections voisins d'une même circonscription (I de Moran, 6 plus proches voisins).
const MODELS = { m1: "Circonscription", m2: "Circonscription et vote de 2022", m3: "Circonscription, vote de 2022 et covariables" };
const moran = R.spatialAutocorrelation.filter((d) => d.neighbours === 6).map((d) => ({ ...d, party: PARTY_NAME[d.party], model: MODELS[d.model] }));
const moranRange = d3.rollups(R.spatialAutocorrelation.filter((d) => d.model === "m3"), (v) => d3.extent(v, (d) => d.I), (d) => d.party);
Plot.plot({
  width: 760, height: 260, marginLeft: 60,
  x: { label: "I de Moran des résidus", grid: true }, y: { label: null, domain: PARTIES.map((p) => PARTY_NAME[p]) },
  color: { legend: true, domain: Object.values(MODELS), range: [PALE, GREY, INK] },
  marks: [Plot.ruleX([0]), Plot.dot(moran, { x: "I", y: "party", fill: "model", r: 5, stroke: INK, strokeWidth: 0.5,
    title: (d) => `${d.party}, ${d.model} : I = ${number(d.I, 3)} (p = ${number(d.p, 3)})` })],
  caption: `Modèle complet, avec 4, 6 ou 8 voisins : ${moranRange.map(([p, [a, b]]) => `${PARTY_NAME[p]} ${number(a, 2)} à ${number(b, 2)}`).join(" ; ")}.`,
})

// %% [markdown]
// À écrire : ce qui reste de commun entre groupes voisins une fois le profil et le vote de 2022 pris en compte.

// %% [javascript]
// Effets des covariables sur les parts de vote de 2026, en points de pourcentage : écart moyen entre un groupe de sections à
// la valeur haute et un groupe à la valeur basse (10e et 90e centiles à l'intérieur des circonscriptions), à circonscription,
// vote de 2022 et autres covariables égaux. Case grise : l'intervalle à 95 % (bootstrap par circonscription) contient zéro.
const effectsByContrast = d3.group(R.effects, (d) => d.contrast);
const includesZero = (d) => d.low <= 0 && d.high >= 0;
const signed = (v) => (Math.abs(v) < 0.05 ? "0,0" : `${v > 0 ? "+" : ""}${number(v, 1)}`);
const effectMaps = document.createElement("div");
for (const g of GROUPS) {
  const rows = g.keys.flatMap((k) => effectsByContrast.get(k));
  effectMaps.append(figure(g.title, Plot.plot({
    width: 760, height: 40 + 34 * g.keys.length, marginLeft: 400, marginTop: 24, marginBottom: 4,
    x: { domain: PARTIES, label: null, axis: "top", tickFormat: (p) => PARTY_NAME[p], tickSize: 0 },
    y: { domain: g.keys, label: null, tickFormat: contrastLabel, tickSize: 0 },
    color: { type: "diverging", scheme: "RdBu", domain: [-4, 4], clamp: true },
    marks: [
      Plot.cell(rows.filter((d) => !includesZero(d)), { x: "party", y: "contrast", fill: "points", inset: 0.5 }),
      Plot.cell(rows.filter(includesZero), { x: "party", y: "contrast", fill: PALE, inset: 0.5 }),
      Plot.text(rows, { x: "party", y: "contrast", text: (d) => signed(d.points), fontSize: 10,
        fill: (d) => (!includesZero(d) && Math.abs(d.points) > 2.5 ? "white" : INK),
        title: (d) => `${PARTY_NAME[d.party]} : ${number(d.points, 2)} points [${number(d.low, 2)} ; ${number(d.high, 2)}]` }),
    ],
  })));
}
effectMaps

// %% [markdown]
// À écrire : lecture des effets ; rappels : associations entre groupes de sections, 192 cases sans correction pour les comparaisons multiples.

// %% [javascript]
// Ordination des effets en log-ratios, sur les cinq principaux partis : les deux premiers axes de la matrice contrastes x partis.
// Un parti et un contraste du même côté d'un axe vont ensemble.
const ordination = document.createElement("div");
for (const [a, axis] of ["axis1", "axis2"].entries()) {
  const title = `Axe ${a + 1} (${number(100 * R.ordination.shares[a], 0)} % de la structure des effets)`;
  const parties = R.ordination.parties.map((d) => ({ name: PARTY_NAME[d.party], v: d[axis] }));
  const contrasts = d3.sort(R.ordination.contrasts.map((d) => ({ name: contrastByKey.get(d.contrast).label, v: d[axis] })), (d) => -Math.abs(d.v)).slice(0, 12);
  const bars = (rows, colour, xLabel) => Plot.plot({
    width: 760, height: 40 + 20 * rows.length, marginLeft: 400,
    x: { label: xLabel, grid: true }, y: { label: null, domain: d3.sort(rows, (d) => -d.v).map((d) => d.name) },
    marks: [Plot.barX(rows, { x: "v", y: "name", fill: colour }), Plot.ruleX([0])],
  });
  ordination.append(figure(`${title} : partis`, bars(parties, INK, "coordonnée du parti")),
    figure(`${title} : les douze contrastes les plus marqués`, bars(contrasts, GREY, "coordonnée du contraste (log-ratio)")));
}
ordination

// %% [markdown]
// À écrire : lecture des deux axes.

// %% [javascript]
// Robustesse : effets de l'analyse principale (abscisse) contre ceux de quatre variantes (ordonnée), en points de pourcentage.
const variants = [
  { title: "Mêmes groupes de sections, vote du jour du scrutin seulement", v: R.robustness.dayOnly },
  { title: `Bureaux de vote du jour du scrutin (${number(R.robustness.offices.units)} bureaux), sans le vote par anticipation`, v: R.robustness.offices },
  { title: `Groupes au découpage stable entre 2022 et 2026 (${number(R.robustness.stable.units)} groupes)`, v: R.robustness.stable },
  { title: "Scolarité en rangs à intervalles égaux plutôt qu'en années d'études", v: R.robustness.schoolingRanks },
];
const robustness = document.createElement("div");
robustness.style.display = "grid"; robustness.style.gridTemplateColumns = "repeat(2, 1fr)"; robustness.style.gap = "0.5rem";
for (const { title, v } of variants) {
  const points = R.effects.map((d, i) => ({ x: d.points, y: v.effects[i], name: `${contrastByKey.get(d.contrast).label}, ${PARTY_NAME[d.party]}` }));
  robustness.append(figure(title, Plot.plot({
    width: 370, height: 340, grid: true,
    x: { label: "analyse principale (points)" }, y: { label: "variante (points)" },
    marks: [Plot.line([[-4, -4], [4, 4]], { stroke: GREY }), Plot.dot(points, { x: "x", y: "y", r: 2.5, fill: INK, title: (d) => `${d.name}\n${number(d.x, 2)} ; ${number(d.y, 2)}` })],
    caption: `Écart maximal : ${number(v.largestGap, 2)} point ; corrélation : ${number(v.correlation, 3)}.`,
  })));
}
robustness

// %% [markdown]
// À écrire : robustesse et limites (erreur écologique, recensement de 2021, transposition du vote de 2022, vote par anticipation de 2022 réparti puis transposé).

// ---
// title: Québec : profil des sections de vote et vote de 2026
// id: vote-correlations
// date: 2026-11-06
// ---

// %% [markdown]
// À écrire : objet de l'analyse et question posée.

// %% [javascript] #collapse-cell
// Paquets, résultats précalculés et outils d'affichage. Les calculs sont dans le notebook
// posts/fr/2026-11_vote-correlations-calculs (node scripts/executer-calculs.mjs écrit precalculs.json).
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const Plot = await import("https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm");
const URL_PRECALCULS = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/precalculs.json";
const R = await d3.json(URL_PRECALCULS);

// Plan d'analyse et ses modifications.
const PLAN = {
  arrete: "2026-11-06, avant d'ajouter les votes",
  unite: "bureau de vote de 2026 : la section, ou les sections dépouillées ensemble ; au moins 100 habitants ; votes du jour du scrutin",
  modele: "régression multinomiale des comptes de votes de 2026 : effet fixe de circonscription, vote de 2022 transposé (ilr des cinq principaux partis), covariables du recensement de 2021",
  covariables: "classes ordonnées résumées en unités réelles (âge moyen, années d'études) ; taux en logit ; grandeurs positives en log ; variables nominales en compositions (ilr)",
  incertitude: "bootstrap par circonscription (199 tirages), intervalles à 95 %",
  rapport: "associations entre bureaux, jamais comportements individuels ; partis séparés ; effets en points de pourcentage pour un écart interdécile à l'intérieur des circonscriptions",
  modifications: [
    "2026-11-06, après un premier examen des résultats : la réponse est modélisée en comptes (multinomiale) plutôt qu'en log-ratios centrés par une RDA, la variance des log-ratios étant dominée par le bruit des petits comptes",
    "2026-11-06 : les balances choisies à la main sont remplacées par des moyennes en unités réelles (variables ordonnées) et par des compositions entières (variables nominales)",
    "2026-11-06 : la partition de la variance devient une partition de la déviance, rapportée à la déviance explicable (totale moins le bruit du dépouillement simulé)",
    "2026-11-06 : les vecteurs propres spatiaux sont remplacés par le I de Moran des résidus (4, 6 et 8 voisins)",
    "2026-11-06 : le type de logement, le revenu médian et la part des ménages d'une personne sont retirés (redondants avec la densité de la population, le faible revenu et la taille des ménages)",
  ],
  nonFait: ["interpolation du recensement par surface plutôt que par électeurs", "validation croisée par région administrative", "vote par anticipation (publié par groupe de sections, absent des données par section)"],
};

const PARTIS = R.partis;
const NOM_PARTI = { PQ: "PQ", LIB: "PLQ", CAQ: "CAQ", QS: "QS", PCQ: "PCQ", AUTRES: "Autres" };
const nombre = (v, decimales = 0) => new Intl.NumberFormat("fr-CA", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
// Valeur d'une covariable dans son unité : pourcentages à une décimale sous 10 %, densité de la population à l'unité.
const valeur = (c, v) => (c.pourcent ? nombre(100 * v, 100 * v < 10 ? 1 : 0) : nombre(v, c.cle === "densite_population" ? 0 : 1));
const contraste = new Map(R.contrastes.map((c) => [c.cle, c]));
// Étiquette d'un contraste : la covariable, puis les deux valeurs comparées, dans son unité.
const etiquette = (cle) => { const c = contraste.get(cle); return `${c.libelle}\n${valeur(c, c.bas)} → ${valeur(c, c.haut)} ${c.unite}`; };
const GROUPES = [
  { titre: "Âge, scolarité, revenu, ménages, origine, emploi", cles: R.contrastes.filter((c) => !c.bloc).map((c) => c.cle) },
  ...[["langue", "Langue maternelle"], ["religion", "Religion"], ["navette", "Mode de transport pour la navette"], ["profession", "Profession"]]
    .map(([bloc, titre]) => ({ titre, cles: R.contrastes.filter((c) => c.bloc === bloc).map((c) => c.cle) })),
];
const ENCRE = "#2A2E24", GRIS = "#8B887A", GRIS_PALE = "#ECE8E1";
const figure = (titre, ...contenu) => { const f = document.createElement("figure"); f.style.margin = "0 0 1.5rem"; if (titre) { const h = document.createElement("figcaption"); h.textContent = titre; h.style.fontWeight = 600; h.style.marginBottom = "0.3rem"; f.append(h); } f.append(...contenu); return f; };

({ ...R.unites, calcule: R.genere })

// %% [markdown]
// À écrire : données, unité d'analyse, sections exclues.

// %% [javascript]
// Covariables : valeur médiane des bureaux, et les deux valeurs comparées par le modèle. Ces deux valeurs encadrent la
// médiane ; leur écart est l'écart entre le 10e et le 90e centile des bureaux d'une même circonscription.
const tableCovariables = d3.create("table").style("font-size", "0.85rem").style("border-collapse", "collapse");
tableCovariables.append("thead").append("tr").selectAll("th").data(["Covariable", "Unité", "Médiane", "Valeur basse", "Valeur haute"]).join("th")
  .text((d) => d).style("text-align", (d, i) => (i < 2 ? "left" : "right")).style("padding", "2px 8px").style("border-bottom", `1px solid ${ENCRE}`);
tableCovariables.append("tbody").selectAll("tr").data(R.contrastes).join("tr").selectAll("td")
  .data((c) => [c.libelle, c.unite, valeur(c, c.mediane), valeur(c, c.bas), valeur(c, c.haut)]).join("td")
  .text((d) => d).style("text-align", (d, i) => (i < 2 ? "left" : "right")).style("padding", "2px 8px").style("border-bottom", `1px solid ${GRIS_PALE}`);
tableCovariables.node()

// %% [markdown]
// À écrire : définition des covariables (moyennes en unités réelles, compositions), sens des centiles.

// %% [javascript]
// Paires de covariables corrélées à l'intérieur des circonscriptions (|r| d'au moins 0,5), hors paires de catégories
// d'une même variable nominale, liées par construction.
const paires = R.contrastes.flatMap((a, i) => R.contrastes.slice(i + 1).map((b, k) => ({ a, b, r: R.correlations[i][i + 1 + k] })))
  .filter((d) => Math.abs(d.r) >= 0.5 && !(d.a.bloc && d.a.bloc === d.b.bloc))
  .map((d) => ({ paire: `${d.a.libelle}\n${d.b.libelle}`, r: d.r }));
Plot.plot({
  width: 760, height: 40 + 34 * paires.length, marginLeft: 400,
  x: { label: "corrélation", grid: true, domain: [-1, 1] }, y: { label: null, domain: d3.sort(paires, (d) => -d.r).map((d) => d.paire), tickSize: 0 },
  marks: [Plot.barX(paires, { x: "r", y: "paire", fill: GRIS, insetTop: 3, insetBottom: 3 }), Plot.ruleX([0]),
    Plot.text(paires, { x: "r", y: "paire", text: (d) => nombre(d.r, 2), dx: (d) => (d.r > 0 ? 4 : -4), textAnchor: (d) => (d.r > 0 ? "start" : "end"), lineAnchor: "middle" })],
})

// %% [javascript]
// Facteur d'inflation de la variance des covariables scalaires dans le modèle complet (à l'intérieur des circonscriptions).
const inflation = R.inflation.map((d) => ({ libelle: contraste.get(d.cle).libelle, vif: d.vif }));
Plot.plot({
  width: 760, height: 40 + 22 * inflation.length, marginLeft: 400,
  x: { label: "facteur d'inflation de la variance", grid: true }, y: { label: null, domain: d3.sort(inflation, (d) => -d.vif).map((d) => d.libelle) },
  marks: [Plot.barX(inflation, { x: "vif", y: "libelle", fill: GRIS }), Plot.ruleX([0]), Plot.ruleX([5], { stroke: ENCRE, strokeDasharray: "3,3" }),
    Plot.text(inflation, { x: "vif", y: "libelle", text: (d) => nombre(d.vif, 1), dx: 4, textAnchor: "start" })],
})

// %% [markdown]
// À écrire : redondances entre covariables.

// %% [javascript]
// Partition de la déviance. La déviance explicable est la déviance du modèle « province seulement » moins le bruit du
// dépouillement (déviance attendue de comptes multinomiaux tirés au hasard). Le vote de 2022 et les covariables se
// recoupent : chacun est donné seul (après la circonscription) et après l'autre.
const dev = Object.fromEntries(R.deviance.map((d) => [d.modele, d.deviance]));
const explicable = dev.m0 - R.bruit.moyenne;
const partition = [
  { terme: "Circonscription", bas: (dev.m0 - dev.m1) / explicable, haut: (dev.m0 - dev.m1) / explicable },
  { terme: "Vote de 2022 du bureau", bas: (dev.m2b - dev.m3) / explicable, haut: (dev.m1 - dev.m2) / explicable },
  { terme: "Covariables du recensement", bas: (dev.m2 - dev.m3) / explicable, haut: (dev.m1 - dev.m2b) / explicable },
  { terme: "Non expliqué, au-delà du bruit du dépouillement", bas: (dev.m3 - R.bruit.moyenne) / explicable, haut: (dev.m3 - R.bruit.moyenne) / explicable },
];
Plot.plot({
  width: 760, height: 200, marginLeft: 330, marginRight: 110,
  x: { label: "part de la déviance explicable (%)", grid: true, domain: [0, 100] }, y: { label: null, domain: partition.map((d) => d.terme) },
  marks: [
    Plot.barX(partition, { x: (d) => 100 * d.haut, y: "terme", fill: GRIS_PALE }),
    Plot.barX(partition, { x: (d) => 100 * d.bas, y: "terme", fill: GRIS }),
    Plot.text(partition, { x: (d) => 100 * d.haut, y: "terme", dx: 4, textAnchor: "start",
      text: (d) => (d.haut - d.bas < 0.0005 ? `${nombre(100 * d.bas, 1)} %` : `${nombre(100 * d.bas, 1)} à ${nombre(100 * d.haut, 1)} %`) }),
  ],
  caption: `Barre foncée : après l'autre terme ; barre pâle : seul, après la circonscription. Bruit du dépouillement : ${nombre(100 * R.bruit.moyenne / dev.m0, 1)} % de la déviance totale. Khi-deux de Pearson par degré de liberté du modèle complet : ${nombre(R.surdispersion, 2)}.`,
})

// %% [markdown]
// À écrire : lecture de la partition (ce qui tient à la circonscription, au vote de 2022, au profil du bureau).

// %% [javascript]
// Autocorrélation spatiale des résidus entre bureaux voisins d'une même circonscription (I de Moran, 6 plus proches voisins).
const MODELES = { m1: "Circonscription", m2: "Circonscription et vote de 2022", m3: "Circonscription, vote de 2022 et covariables" };
const moran = R.autocorrelation.filter((d) => d.voisins === 6).map((d) => ({ ...d, parti: NOM_PARTI[d.parti], modele: MODELES[d.modele] }));
const etendue = d3.rollups(R.autocorrelation.filter((d) => d.modele === "m3"), (v) => d3.extent(v, (d) => d.I), (d) => d.parti);
Plot.plot({
  width: 760, height: 260, marginLeft: 60,
  x: { label: "I de Moran des résidus", grid: true }, y: { label: null, domain: PARTIS.map((p) => NOM_PARTI[p]) },
  color: { legend: true, domain: Object.values(MODELES), range: [GRIS_PALE, GRIS, ENCRE] },
  marks: [Plot.ruleX([0]), Plot.dot(moran, { x: "I", y: "parti", fill: "modele", r: 5, stroke: ENCRE, strokeWidth: 0.5,
    title: (d) => `${d.parti}, ${d.modele} : I = ${nombre(d.I, 3)} (p = ${nombre(d.p, 3)})` })],
  caption: `Modèle complet, avec 4, 6 ou 8 voisins : ${etendue.map(([p, [a, b]]) => `${NOM_PARTI[p]} ${nombre(a, 2)} à ${nombre(b, 2)}`).join(" ; ")}.`,
})

// %% [markdown]
// À écrire : ce qui reste de commun entre bureaux voisins une fois le profil et le vote de 2022 pris en compte.

// %% [javascript]
// Effets des covariables sur les parts de vote de 2026, en points de pourcentage : écart moyen entre un bureau à la valeur
// haute et un bureau à la valeur basse (10e et 90e centiles à l'intérieur des circonscriptions), à circonscription, vote de
// 2022 et autres covariables égaux. Case grise : l'intervalle à 95 % (bootstrap par circonscription) contient zéro.
const effetsParContraste = d3.group(R.effets, (d) => d.contraste);
const cartesEffets = document.createElement("div");
for (const g of GROUPES) {
  const lignes = g.cles.flatMap((cle) => effetsParContraste.get(cle));
  const nul = (d) => d.bas <= 0 && d.haut >= 0;
  cartesEffets.append(figure(g.titre, Plot.plot({
    width: 760, height: 40 + 34 * g.cles.length, marginLeft: 400, marginTop: 24, marginBottom: 4,
    x: { domain: PARTIS, label: null, axis: "top", tickFormat: (p) => NOM_PARTI[p], tickSize: 0 },
    y: { domain: g.cles, label: null, tickFormat: etiquette, tickSize: 0 },
    color: { type: "diverging", scheme: "RdBu", domain: [-4, 4], clamp: true },
    marks: [
      Plot.cell(lignes.filter((d) => !nul(d)), { x: "parti", y: "contraste", fill: "points", inset: 0.5 }),
      Plot.cell(lignes.filter(nul), { x: "parti", y: "contraste", fill: GRIS_PALE, inset: 0.5 }),
      Plot.text(lignes, { x: "parti", y: "contraste", text: (d) => (Math.abs(d.points) < 0.05 ? "0,0" : `${d.points > 0 ? "+" : ""}${nombre(d.points, 1)}`), fontSize: 10,
        fill: (d) => (!nul(d) && Math.abs(d.points) > 2.5 ? "white" : ENCRE),
        title: (d) => `${NOM_PARTI[d.parti]} : ${nombre(d.points, 2)} points [${nombre(d.bas, 2)} ; ${nombre(d.haut, 2)}]` }),
    ],
  })));
}
cartesEffets

// %% [markdown]
// À écrire : lecture des effets ; rappels : associations entre bureaux, vote du jour du scrutin seulement, 192 cases sans correction pour les comparaisons multiples.

// %% [javascript]
// Ordination des effets en log-ratios, sur les cinq principaux partis : les deux premiers axes de la matrice contrastes x partis.
// Un parti et un contraste du même côté d'un axe vont ensemble.
const ordination = document.createElement("div");
for (const [a, axe] of ["axe1", "axe2"].entries()) {
  const titre = `Axe ${a + 1} (${nombre(100 * R.ordination.parts[a], 0)} % de la structure des effets)`;
  const partis = R.ordination.partis.map((d) => ({ nom: NOM_PARTI[d.parti], v: d[axe] }));
  const contrastes = d3.sort(R.ordination.contrastes.map((d) => ({ nom: contraste.get(d.contraste).libelle, v: d[axe] })), (d) => -Math.abs(d.v)).slice(0, 12);
  const barres = (lignes, couleur, etiquetteX) => Plot.plot({
    width: 760, height: 40 + 20 * lignes.length, marginLeft: 400,
    x: { label: etiquetteX, grid: true }, y: { label: null, domain: d3.sort(lignes, (d) => -d.v).map((d) => d.nom) },
    marks: [Plot.barX(lignes, { x: "v", y: "nom", fill: couleur }), Plot.ruleX([0])],
  });
  ordination.append(figure(`${titre} : partis`, barres(partis, ENCRE, "coordonnée du parti")),
    figure(`${titre} : les douze contrastes les plus marqués`, barres(contrastes, GRIS, "coordonnée du contraste (log-ratio)")));
}
ordination

// %% [markdown]
// À écrire : lecture des deux axes.

// %% [javascript]
// Robustesse : effets du modèle principal (abscisse) contre ceux de deux variantes (ordonnée), en points de pourcentage.
const variantes = [
  { titre: `Bureaux au découpage stable entre 2022 et 2026 (${nombre(R.robustesse.stables.unites)} bureaux)`, v: R.robustesse.stables },
  { titre: "Scolarité en rangs à intervalles égaux plutôt qu'en années d'études", v: R.robustesse.scolariteEnRangs },
];
const robustesse = document.createElement("div");
for (const { titre, v } of variantes) {
  const points = R.effets.map((d, i) => ({ x: d.points, y: v.effets[i], nom: `${contraste.get(d.contraste).libelle}, ${NOM_PARTI[d.parti]}` }));
  robustesse.append(figure(titre, Plot.plot({
    width: 380, height: 360, grid: true,
    x: { label: "modèle principal (points)" }, y: { label: "variante (points)" },
    marks: [Plot.line([[-4.5, -4.5], [4.5, 4.5]], { stroke: GRIS }), Plot.dot(points, { x: "x", y: "y", r: 2.5, fill: ENCRE, title: (d) => `${d.nom}\n${nombre(d.x, 2)} ; ${nombre(d.y, 2)}` })],
    caption: `Écart maximal : ${nombre(v.ecartMaximal, 2)} point ; corrélation : ${nombre(v.correlation, 3)}.`,
  })));
}
robustesse

// %% [markdown]
// À écrire : robustesse et limites (erreur écologique, vote par anticipation exclu, recensement de 2021, transposition du vote de 2022).

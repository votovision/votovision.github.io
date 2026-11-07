// ---
// title: Québec : profil des bureaux de vote et vote de 2026
// id: vote-correlations
// date: 2026-11-06
// ---

// %% [markdown]
// Note pour l'auteur : trame proposée pour le texte. Les notes qui suivent, avant chaque figure, disent ce qu'elle montre et pourquoi elle est là. Elles ne sont pas la prose du billet.
//
// 1. La question. Un ami demande si la migration du vote de 2022 à 2026 s'explique par le profil des quartiers. L'explication courante, « les gens étaient tannés de la CAQ », ne dit pas qui, ni où.
// 2. Ce qu'on peut mesurer. Les votes par groupe de sections (jour du scrutin et vote par anticipation), le recensement de 2021 interpolé sur ces groupes, et le vote de 2022 transposé. Ce sont des associations entre quartiers, pas des comportements individuels.
// 3. D'où viennent les différences de vote. La partition de la déviance : la circonscription explique 90 % des différences entre groupes ; le profil, au plus 5 %. Le vote se joue d'abord localement.
// 4. À l'intérieur des circonscriptions, quel profil bouge vers qui. La carte de chaleur et le biplot : la scolarité et la langue séparent le PLQ du PQ et du PCQ ; la religion isole QS ; la CAQ recule partout de la même façon.
// 5. Ce qui reste entre voisins. Le I de Moran : une fois le profil et le vote de 2022 retirés, les groupes voisins se ressemblent encore un peu.
// 6. Robustesse et limites. Les quatre variantes, l'erreur écologique, le recensement de 2021, le vote de 2022 transposé.
//
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
  covariables: "classes ordonnées résumées en unités réelles (âge moyen, années d'études) ; taux en logit ; grandeurs positives en log ; variables nominales en compositions (ilr, effets par coordonnée pivot)",
  incertitude: "bootstrap par circonscription (199 tirages), intervalles à 95 %",
  rapport: "associations entre groupes de sections, jamais comportements individuels ; partis séparés ; effets en points de pourcentage pour un écart type de la covariable à l'intérieur des circonscriptions",
  modifications: [
    "2026-11-06, après un premier examen des résultats : la réponse est modélisée en comptes (multinomiale) plutôt qu'en log-ratios centrés par une RDA, la variance des log-ratios étant dominée par le bruit des petits comptes",
    "2026-11-06 : les balances choisies à la main sont remplacées par des moyennes en unités réelles (variables ordonnées) et par des compositions entières (variables nominales)",
    "2026-11-06 : la partition de la variance devient une partition de la déviance, rapportée à la déviance explicable (totale moins le bruit du dépouillement simulé)",
    "2026-11-06 : les vecteurs propres spatiaux sont remplacés par le I de Moran des résidus (4, 6 et 8 voisins)",
    "2026-11-06 : le type de logement, le revenu médian et la part des ménages d'une personne sont retirés (redondants avec la densité de la population, le faible revenu et la taille des ménages)",
    "2026-11-06 : l'unité passe de la section au groupe de sections d'un bureau de vote par anticipation, pour inclure le vote par anticipation (publié par bureau) ; l'analyse par bureau de vote du jour du scrutin devient une analyse de robustesse",
    "2026-11-06 : les effets sont donnés pour un écart type de la covariable plutôt que pour un écart interdécile",
  ],
  nonFait: ["interpolation du recensement par surface plutôt que par électeurs", "validation croisée par région administrative"],
};

const PARTIES = R.parties;
const PARTY_NAME = { PQ: "PQ", LIB: "PLQ", CAQ: "CAQ", QS: "QS", PCQ: "PCQ", AUTRES: "Autres" };
const PARTY_COLOUR = { PQ: "#2B50C8", LIB: "#E01020", CAQ: "#6EC9F5", QS: "#F28C28", PCQ: "#10275A", AUTRES: "#8B887A" };
const INK = "#2A2E24", GREY = "#8B887A", PALE = "#ECE8E1";
const number = (v, decimals = 0) => new Intl.NumberFormat("fr-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
// Valeur d'une covariable dans son unité : pourcentages à une décimale sous 10 %, densité de la population à l'unité.
const display = (c, v) => (c.percent ? number(100 * v, 100 * v < 10 ? 1 : 0) : number(v, c.key === "population_density" ? 0 : 1));
const contrastByKey = new Map(R.contrasts.map((c) => [c.key, c]));
const GROUPS = [
  { title: "Âge, scolarité, revenu, ménages, origine, emploi", keys: R.contrasts.filter((c) => !c.block).map((c) => c.key) },
  ...[["mother_tongue", "Langue maternelle"], ["religion", "Religion"], ["commute", "Mode de transport pour se rendre au travail"], ["occupation", "Profession"]]
    .map(([block, title]) => ({ title: `${title} (une catégorie augmente, les autres gardent leurs proportions)`, keys: R.contrasts.filter((c) => c.block === block).map((c) => c.key) })),
];
// Figure : titre, clé de lecture, contenu.
function figure(title, note, ...content) {
  const f = document.createElement("figure"); f.style.margin = "0 0 2rem";
  const heading = document.createElement("div"); heading.textContent = title; heading.style.fontWeight = 600; f.append(heading);
  if (note) { const p = document.createElement("div"); p.textContent = note; p.style.fontSize = "0.85rem"; p.style.color = "#5E5B50"; p.style.margin = "0.2rem 0 0.6rem"; p.style.maxWidth = "46rem"; f.append(p); }
  f.append(...content); return f;
}
// Tableau : en-têtes, rangées (tableaux de cellules), colonnes alignées à droite.
function table(headers, rows, rightAligned = []) {
  const t = d3.create("table").style("font-size", "0.85rem").style("border-collapse", "collapse");
  const align = (d, i) => (rightAligned.includes(i) ? "right" : "left");
  t.append("thead").append("tr").selectAll("th").data(headers).join("th").text((d) => d).style("text-align", align).style("padding", "3px 10px").style("border-bottom", `1px solid ${INK}`);
  t.append("tbody").selectAll("tr").data(rows).join("tr").selectAll("td").data((d) => d).join("td").text((d) => d).style("text-align", align).style("padding", "3px 10px").style("border-bottom", `1px solid ${PALE}`);
  return t.node();
}

figure("Données analysées", "Une unité est un groupe de sections de vote desservies par le même bureau de vote par anticipation.", table(["", "Nombre"], [
  ["Groupes de sections de vote", number(R.units.count)],
  ["Sections de vote regroupées", number(R.units.sections)],
  ["Circonscriptions", number(R.units.ridings)],
  ["Votes de 2026 comptés dans ces groupes", number(R.units.votes)],
  ["Votes du jour du scrutin, au Québec", number(R.units.day2026)],
  ["Votes par anticipation, au Québec", number(R.units.advance2026)],
], [1]))

// %% [markdown]
// Note pour l'auteur : ce tableau situe l'analyse. L'unité est le groupe de sections desservies par un même bureau de vote par anticipation, parce que le vote par anticipation est publié à cette échelle. Les deux derniers nombres montrent ce que l'on gagne : le vote par anticipation représente plus du tiers des votes comptés.
//
// À écrire : données, unité d'analyse, votes couverts.

// %% [javascript]
// Tableau des covariables.
figure("Covariables tirées du recensement de 2021",
  "Dernière colonne : la valeur d'un groupe situé un écart type au-dessus de la médiane, l'écart type étant mesuré entre les groupes d'une même circonscription. Tous les effets plus bas correspondent à cet écart.",
  table(["Covariable", "Unité", "Médiane", "Un écart type au-dessus"], R.contrasts.map((c) => [c.label, c.unit, display(c, c.median), display(c, c.oneSdAbove)]), [2, 3]))

// %% [markdown]
// Note pour l'auteur : ce tableau définit chaque covariable et donne son échelle. La colonne « un écart type au-dessus » est la clé de lecture de toute la suite : chaque effet plus bas compare deux groupes qui diffèrent de cet écart. Par exemple, un demi-an d'études pour la scolarité, ou 30 % contre 47 % de locataires.
//
// À écrire : définition des covariables (moyennes en unités réelles, compositions).

// %% [javascript]
// Partition de la déviance explicable (déviance du modèle « province seulement » moins le bruit du dépouillement).
const deviance = Object.fromEntries(R.deviance.map((d) => [d.model, d.deviance]));
const explainable = deviance.m0 - R.noise.mean;
const partition = [
  { term: "La circonscription", low: (deviance.m0 - deviance.m1) / explainable, high: (deviance.m0 - deviance.m1) / explainable },
  { term: "Le vote de 2022 du groupe de sections", low: (deviance.m2b - deviance.m3) / explainable, high: (deviance.m1 - deviance.m2) / explainable },
  { term: "Les covariables du recensement", low: (deviance.m2 - deviance.m3) / explainable, high: (deviance.m1 - deviance.m2b) / explainable },
  { term: "Rien de ce qui est mesuré ici", low: (deviance.m3 - R.noise.mean) / explainable, high: (deviance.m3 - R.noise.mean) / explainable },
];
figure("Ce qui explique les différences de vote entre groupes de sections en 2026",
  `Part de la déviance explicable du modèle, le hasard du dépouillement retiré (${number(100 * R.noise.mean / deviance.m0, 1)} % de la déviance totale). Barre foncée : ce que le terme ajoute après l'autre. Barre pâle : ce qu'il explique seul, après la circonscription.`,
  Plot.plot({
    width: 760, height: 190, marginLeft: 300, marginRight: 110,
    x: { label: "part des différences de vote expliquée (%)", grid: true, domain: [0, 100] }, y: { label: null, domain: partition.map((d) => d.term) },
    marks: [
      Plot.barX(partition, { x: (d) => 100 * d.high, y: "term", fill: PALE }),
      Plot.barX(partition, { x: (d) => 100 * d.low, y: "term", fill: GREY }),
      Plot.text(partition, { x: (d) => 100 * d.high, y: "term", dx: 4, textAnchor: "start",
        text: (d) => (d.high - d.low < 0.0005 ? `${number(100 * d.low, 1)} %` : `${number(100 * d.low, 1)} à ${number(100 * d.high, 1)} %`) }),
    ],
  }))

// %% [markdown]
// Note pour l'auteur : c'est la réponse principale. La déviance mesure l'écart entre les votes observés et les votes que le modèle prédit. Un modèle qui ne connaît que la province a la déviance la plus grande. Chaque terme ajouté la réduit, et la figure donne la part de cette réduction due à chaque terme. Le hasard du dépouillement est retiré du total, parce qu'aucun modèle ne peut l'expliquer. Lecture : la circonscription explique 90 % des différences de vote entre groupes de sections. Le vote de 2022 du groupe et son profil expliquent chacun moins de 7 %, et ils se recoupent. Il reste 2 % que rien de mesuré n'explique.
//
// À écrire : lecture de la partition.

// %% [javascript]
// Cartes de chaleur des effets, en points de pourcentage pour un écart type.
const effectsByContrast = d3.group(R.effects, (d) => d.contrast);
const includesZero = (d) => d.low <= 0 && d.high >= 0;
const signed = (v) => (Math.abs(v) < 0.005 ? "0,00" : `${v > 0 ? "+" : ""}${number(v, 2)}`);
const effectMaps = figure("Écart de part de vote en 2026 associé à chaque covariable, en points de pourcentage",
  "Écart de part de vote entre deux groupes de sections d'une même circonscription, le premier un écart type plus haut sur la covariable, à vote de 2022 et autres covariables égaux. Case grise : l'intervalle à 95 % contient zéro.");
for (const g of GROUPS) {
  const rows = g.keys.flatMap((k) => effectsByContrast.get(k));
  const subtitle = document.createElement("div"); subtitle.textContent = g.title; subtitle.style.fontWeight = 600; subtitle.style.fontSize = "0.9rem"; subtitle.style.marginTop = "0.8rem";
  effectMaps.append(subtitle, Plot.plot({
    width: 760, height: 36 + 26 * g.keys.length, marginLeft: 400, marginTop: 22, marginBottom: 4,
    x: { domain: PARTIES, label: null, axis: "top", tickFormat: (p) => PARTY_NAME[p], tickSize: 0 },
    y: { domain: g.keys, label: null, tickFormat: (k) => contrastByKey.get(k).label, tickSize: 0 },
    color: { type: "diverging", scheme: "RdBu", domain: [-1.5, 1.5], clamp: true },
    marks: [
      Plot.cell(rows.filter((d) => !includesZero(d)), { x: "party", y: "contrast", fill: "points", inset: 0.5 }),
      Plot.cell(rows.filter(includesZero), { x: "party", y: "contrast", fill: PALE, inset: 0.5 }),
      Plot.text(rows, { x: "party", y: "contrast", text: (d) => signed(d.points), fontSize: 10,
        fill: (d) => (!includesZero(d) && Math.abs(d.points) > 1 ? "white" : INK),
        title: (d) => `${PARTY_NAME[d.party]} : ${number(d.points, 2)} point [${number(d.low, 2)} ; ${number(d.high, 2)}]` }),
    ],
  }));
}
effectMaps

// %% [markdown]
// Note pour l'auteur : la carte de chaleur détaille les 5 % du profil. Chaque case est l'écart de part de vote entre deux groupes d'une même circonscription qui ont le même vote de 2022 et le même profil, sauf sur la covariable de la rangée, où le premier est un écart type plus haut. Lecture : la scolarité est la covariable la plus liée au vote, avec +1,3 point pour le PLQ et −0,8 pour le PQ et le PCQ par demi-an d'études. La langue maternelle française joue en sens inverse. La religion ne compte que pour QS. La CAQ n'a aucun effet au-dessus de 0,4 point : son recul ne suit pas le profil des quartiers.
//
// À écrire : lecture des effets ; rappels : associations entre groupes de sections, 192 cases sans correction pour les comparaisons multiples.

// %% [javascript]
// Biplot des effets en log-ratios sur les cinq principaux partis ; points des partis mis à l'échelle des flèches.
const arrows = R.ordination.contrasts.map((d) => ({ label: contrastByKey.get(d.contrast).label, x: d.axis1, y: d.axis2, length: Math.hypot(d.axis1, d.axis2) }));
const labelled = new Set(d3.sort(arrows, (d) => -d.length).slice(0, 8).map((d) => d.label));
// Étiquette d'une flèche : un peu au-delà de la pointe, dans la direction de la flèche.
const labelPoints = arrows.filter((d) => labelled.has(d.label)).map((d) => {
  const extra = 0.08 * d3.max(arrows, (a) => a.length) / d.length;
  return { ...d, lx: d.x * (1 + extra), ly: d.y * (1 + extra), anchor: Math.abs(d.x) > 1.3 * Math.abs(d.y) ? (d.x > 0 ? "start" : "end") : "middle", dy: Math.abs(d.x) > 1.3 * Math.abs(d.y) ? 0 : d.y > 0 ? -6 : 10 };
});
const partyScale = d3.max(arrows, (d) => d.length) / d3.max(R.ordination.parties, (d) => Math.hypot(d.axis1, d.axis2));
const partyPoints = R.ordination.parties.map((d) => ({ party: d.party, x: partyScale * d.axis1, y: partyScale * d.axis2 }));
figure("Les covariables et les partis dans un même plan",
  `Flèche : covariable, orientée vers les partis qui font mieux là où elle est élevée, à circonscription et vote de 2022 égaux. Point : parti. Les deux axes résument ${number(100 * (R.ordination.shares[0] + R.ordination.shares[1]), 0)} % de la structure des effets.`,
  Plot.plot({
    width: 760, height: 620, inset: 40, marginLeft: 60, marginRight: 60, aspectRatio: 1,
    x: { label: `axe 1 (${number(100 * R.ordination.shares[0], 0)} %)`, ticks: 5, nice: true }, y: { label: `axe 2 (${number(100 * R.ordination.shares[1], 0)} %)`, ticks: 5, nice: true },
    marks: [
      Plot.ruleX([0], { stroke: PALE }), Plot.ruleY([0], { stroke: PALE }),
      Plot.arrow(arrows, { x1: 0, y1: 0, x2: "x", y2: "y", stroke: (d) => (labelled.has(d.label) ? INK : GREY), strokeWidth: (d) => (labelled.has(d.label) ? 1.2 : 0.6), headLength: 5, title: "label" }),
      Plot.text(labelPoints, { x: "lx", y: "ly", text: "label", fontSize: 10, fill: INK, stroke: "white", strokeWidth: 4, textAnchor: "anchor", dy: "dy" }),
      Plot.dot(partyPoints, { x: "x", y: "y", r: 7, fill: (d) => PARTY_COLOUR[d.party] }),
      Plot.text(partyPoints, { x: "x", y: "y", text: (d) => PARTY_NAME[d.party], dy: -14, fontWeight: 700, fontSize: 13, fill: (d) => PARTY_COLOUR[d.party], stroke: "white", strokeWidth: 3 }),
    ],
  }))

// %% [markdown]
// Note pour l'auteur : le biplot résume la carte de chaleur en deux axes. C'est l'équivalent d'une RDA pour le modèle multinomial. Une RDA fait l'analyse en composantes principales de la partie de la réponse expliquée par les covariables. Ici, la réponse est le vote prédit en log-ratios, la partie expliquée est celle des covariables, une fois la circonscription et le vote de 2022 retirés, et les axes sont ceux de cette partie. Les flèches sont les covariables, en coordonnées principales. Les points sont les partis, en coordonnées standard, mis à l'échelle des flèches. Lecture : l'axe 1 (55 %) oppose le PLQ, du côté de la scolarité et de l'anglais, au PQ et au PCQ, du côté du français et du taux d'activité. L'axe 2 (27 %) isole QS, du côté des personnes sans religion et à faible revenu.
//
// À écrire : lecture du biplot.

// %% [javascript]
// I de Moran des résidus, six plus proches voisins.
const MODELS = { m1: "la circonscription seulement", m2: "la circonscription et le vote de 2022", m3: "la circonscription, le vote de 2022 et les covariables" };
const moran = R.spatialAutocorrelation.filter((d) => d.neighbours === 6).map((d) => ({ ...d, party: PARTY_NAME[d.party], model: MODELS[d.model] }));
figure("Ressemblance entre groupes de sections voisins, une fois le modèle retiré",
  "Ressemblance des écarts au modèle entre un groupe de sections et ses six plus proches voisins de la même circonscription, de 0 (aucune) à 1 (écarts identiques). Un point par parti et par modèle.",
  Plot.plot({
    width: 760, height: 250, marginLeft: 60,
    x: { label: "I de Moran des résidus", grid: true, domain: [0, 0.5] }, y: { label: null, domain: PARTIES.map((p) => PARTY_NAME[p]) },
    color: { legend: true, label: "Modèle avec", domain: Object.values(MODELS), range: [PALE, GREY, INK] },
    marks: [Plot.ruleX([0]), Plot.dot(moran, { x: "I", y: "party", fill: "model", r: 5, stroke: INK, strokeWidth: 0.5,
      title: (d) => `${d.party}, ${d.model} : I = ${number(d.I, 3)} (p = ${number(d.p, 3)})` })],
  }))

// %% [markdown]
// Note pour l'auteur : cette figure répond à l'idée que les gens votent comme leurs voisins. Après le modèle, chaque groupe garde un écart entre son vote observé et son vote prédit. Le I de Moran dit si les groupes voisins ont des écarts semblables. Avec la circonscription seule, il vaut 0,13 à 0,44 : les voisins bougent ensemble. Avec le vote de 2022 et le profil, il tombe à 0,08 à 0,14, mais reste positif, et le test par permutation le confirme (p ≤ 0,005). Une partie de la ressemblance entre voisins tient donc au profil, et une autre partie à autre chose. Cette autre partie peut être l'entourage, un candidat, une campagne locale ou un enjeu de quartier. Les données ne permettent pas de trancher.
//
// À écrire : ce qui reste de commun entre groupes voisins une fois le profil et le vote de 2022 pris en compte.

// %% [javascript]
// Paires de covariables corrélées (|r| >= 0,5), hors catégories d'une même variable nominale.
const correlatedPairs = d3.sort(R.contrasts.flatMap((a, i) => R.contrasts.slice(i + 1).map((b, k) => ({ a, b, r: R.correlations[i][i + 1 + k] })))
  .filter((d) => Math.abs(d.r) >= 0.5 && !(d.a.block && d.a.block === d.b.block)), (d) => -Math.abs(d.r));
figure("Covariables qui varient ensemble",
  "Corrélations d'au moins 0,5 en valeur absolue, mesurées entre les groupes de sections d'une même circonscription.",
  table(["Covariable", "Covariable", "Corrélation"], correlatedPairs.map((d) => [d.a.label, d.b.label, number(d.r, 2)]), [2]))

// %% [javascript]
// Facteur d'inflation de la variance des covariables scalaires dans le modèle complet.
const inflation = R.varianceInflation.map((d) => ({ label: contrastByKey.get(d.key).label, vif: d.vif }));
figure("Redondance de chaque covariable avec toutes les autres",
  "Facteur d'inflation de la variance. À 1, la covariable ne dépend pas des autres. Au-delà de 5 (pointillé), son effet se sépare mal de celui des autres.",
  Plot.plot({
    width: 760, height: 40 + 22 * inflation.length, marginLeft: 400,
    x: { label: "facteur d'inflation de la variance", grid: true }, y: { label: null, domain: d3.sort(inflation, (d) => -d.vif).map((d) => d.label) },
    marks: [Plot.barX(inflation, { x: "vif", y: "label", fill: GREY }), Plot.ruleX([0]), Plot.ruleX([5], { stroke: INK, strokeDasharray: "3,3" }),
      Plot.text(inflation, { x: "vif", y: "label", text: (d) => number(d.vif, 1), dx: 4, textAnchor: "start" })],
  }))

// %% [markdown]
// Note pour l'auteur : ces deux figures sont des vérifications. Deux covariables corrélées se partagent l'effet, et le modèle ne peut pas dire lequel des deux compte. Le facteur d'inflation de la variance mesure cette difficulté. Le faible revenu (5,9) et la scolarité (5,2) dépassent 5 : leurs effets sont moins précis, ce que les intervalles reflètent déjà. Ces figures peuvent aller en note de fin.
//
// À écrire : redondances entre covariables.

// %% [javascript]
// Robustesse : quatre variantes comparées à l'analyse principale.
const variants = [
  ["Mêmes groupes de sections, sans le vote par anticipation", R.robustness.dayOnly, R.units.count],
  ["Bureaux de vote du jour du scrutin, sans le vote par anticipation", R.robustness.offices, R.robustness.offices.units],
  ["Groupes dont le découpage n'a pas changé depuis 2022", R.robustness.stable, R.robustness.stable.units],
  ["Scolarité en rangs à intervalles égaux plutôt qu'en années d'études", R.robustness.schoolingRanks, R.units.count],
];
figure("Les effets tiennent-ils si on change l'analyse ?",
  "Chaque variante refait l'analyse. Ses 192 effets sont comparés à ceux de l'analyse principale.",
  table(["Variante", "Unités", "Corrélation avec l'analyse principale", "Plus grand écart (points)"],
    variants.map(([title, v, units]) => [title, number(units), number(v.correlation, 2), number(v.largestGap, 2)]), [1, 2, 3]))

// %% [markdown]
// Note pour l'auteur : les quatre variantes vérifient que les effets ne dépendent pas d'un choix d'analyse. Sans le vote par anticipation, les effets changent peu (corrélation 0,97). Par bureau de vote du jour du scrutin, l'unité la plus fine, ils changent davantage (0,88). Les 497 groupes au découpage inchangé donnent la vérification la plus bruitée (0,77), parce qu'ils sont peu nombreux. La table des années d'études n'a aucun poids (1,00).
//
// À écrire : robustesse et limites (erreur écologique, recensement de 2021, transposition du vote de 2022, vote par anticipation de 2022 réparti puis transposé).

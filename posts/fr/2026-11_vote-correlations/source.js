// ---
// title: Québec : profil des sections de vote et migration du vote, 2022-2026
// id: vote-correlations
// date: 2026-11-06
// ---

// %% [markdown]
// À écrire : objet de l'analyse, question posée, plan d'analyse arrêté avant de regarder les votes.

// %% [javascript] #collapse-cell
// charger les packages
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const Plot = await import("https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm");
const { mva } = await import("https://cdn.jsdelivr.net/npm/@tangent.to/ds@0.16/+esm");

// Recensement de 2021 interpolé sur les sections de vote de 2026 (data : sources/recensement_sections_qc.ts) ;
// aucune variable de vote à cette étape.
const URL_RECENSEMENT = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/recensement_sections_2026.csv";
const brut = await d3.csv(URL_RECENSEMENT, d3.autoType);

// Comptes : 0,5 ajouté pour éviter les zéros avant les log-ratios.
const n = (r, k) => (r[k] ?? 0) + 0.5;
const clr = (v) => { const l = v.map(Math.log); const m = d3.mean(l); return l.map((x) => x - m); };
const logit = (a, total) => Math.log(a / (total - a));

// Blocs compositionnels : parties (sommes de comptes du recensement), en log-ratios centrés.
const BLOCS = {
  age: [["20_34", ["age_20_24", "age_25_29", "age_30_34"]], ["35_49", ["age_35_39", "age_40_44", "age_45_49"]], ["50_64", ["age_50_54", "age_55_59", "age_60_64"]],
    ["65_79", ["age_65_69", "age_70_74", "age_75_79"]], ["80_plus", ["age_80_84", "age_85_plus"]]],
  langue: [["francais", ["langue_maternelle_francais"]], ["anglais", ["langue_maternelle_anglais"]], ["non_officielle", ["langue_maternelle_non_officielle"]]],
  scol: [["aucun", ["scol_aucun"]], ["secondaire", ["scol_secondaire"]], ["metiers", ["scol_metiers"]], ["cegep", ["scol_college_cegep"]],
    ["univ_inf_bac", ["scol_universitaire_inferieur_bac"]], ["bac_plus", ["scol_bac_plus"]]],
  logement: [["individuelle", ["maison_individuelle", "logement_mobile"]], ["attenante", ["maison_jumelee", "maison_rangee", "autre_maison_attenante"]],
    ["petit_collectif", ["duplex", "appartement_moins_5_etages"]], ["tour", ["appartement_5_etages_plus"]]],
  prof: ["0_cadres_superieurs", "1_affaires_finance_admin", "2_sciences", "3_sante", "4_enseignement_droit_social", "5_arts_culture",
    "6_vente_services", "7_metiers_transport", "8_ressources_naturelles", "9_fabrication"].map((k) => [k, [`prof_${k}`]]),
  navette: [["auto", ["navette_auto"]], ["transport_commun", ["navette_transport_commun"]], ["actif", ["navette_marche", "navette_velo"]], ["autre", ["navette_autre"]]],
};

// Covariables d'une section : log-ratios centrés par bloc, logits des proportions, logs des valeurs positives.
function covariables(r) {
  const o = {};
  for (const [b, parties] of Object.entries(BLOCS)) {
    clr(parties.map(([, ks]) => d3.sum(ks, (k) => n(r, k)))).forEach((v, j) => (o[`${b}_${parties[j][0]}`] = v));
  }
  const autreReligion = Math.max(n(r, "religion_total") - (r.catholique ?? 0) - (r.aucune_religion ?? 0), 0.5);
  clr([n(r, "catholique"), n(r, "aucune_religion"), autreReligion]).forEach((v, j) => (o[`religion_${["catholique", "aucune", "autre"][j]}`] = v));
  o.locataires = logit(n(r, "locataires"), n(r, "occupation_total") + 0.5);
  o.menages_1_personne = logit(n(r, "menages_1_personne"), n(r, "menages_total") + 0.5);
  o.immigrants = logit(n(r, "immigrants"), n(r, "immigration_total") + 0.5);
  o.minorites_visibles = logit(n(r, "minorites_visibles"), n(r, "minorites_visibles_total") + 0.5);
  o.autochtone = logit(n(r, "autochtone"), n(r, "autochtone_total") + 0.5);
  o.demenage_5_ans = logit(n(r, "demenage_5_ans"), n(r, "mobilite_5_ans_total") + 0.5);
  o.activite = logit(n(r, "population_active"), n(r, "activite_total") + 0.5);
  o.chomage = logit(n(r, "chomeurs"), n(r, "population_active") + 0.5);
  o.faible_revenu = r.faible_revenu_mfr_api_pct == null ? null : logit(r.faible_revenu_mfr_api_pct + 0.5, 101);
  o.revenu_median = r.revenu_median_menages_apres_impot == null ? null : Math.log(r.revenu_median_menages_apres_impot);
  o.taille_menages = r.taille_moyenne_menages == null ? null : Math.log(r.taille_moyenne_menages);
  o.densite = Math.log((r.population + 1) / Math.max(r.superficie_km2 ?? 0.001, 0.001));
  return o;
}

// Sections d'au moins 100 habitants, toutes covariables publiées.
const sections = brut.filter((r) => r.population >= 100).map((r) => ({ cep: r.cep, sv: r.sv, ...covariables(r) }))
  .filter((o) => Object.values(o).every((v) => v !== null && Number.isFinite(v)));
const variables = Object.keys(sections[0]).filter((k) => !["cep", "sv"].includes(k));

// Centrage par circonscription : la structure vue par un modèle à effet de circonscription.
const moyennes = d3.rollup(sections, (v) => Object.fromEntries(variables.map((k) => [k, d3.mean(v, (o) => o[k])])), (o) => o.cep);
const sectionsIntra = sections.map((o) => ({ cep: o.cep, sv: o.sv, ...Object.fromEntries(variables.map((k) => [k, o[k] - moyennes.get(o.cep)[k]])) }));

function correlations(lignes) {
  const z = variables.map((k) => { const v = lignes.map((o) => o[k]), m = d3.mean(v), s = d3.deviation(v); return v.map((x) => (x - m) / s); });
  return variables.flatMap((a, i) => variables.map((b, j) => ({ a, b, r: d3.sum(z[i], (x, q) => x * z[j][q]) / (lignes.length - 1) })));
}
const corBrut = correlations(sections), corIntra = correlations(sectionsIntra);
const acpBrut = mva.pca.fit(sections.map((o) => variables.map((k) => o[k])), { scale: true });
const acpIntra = mva.pca.fit(sectionsIntra.map((o) => variables.map((k) => o[k])), { scale: true });

({ sections: sections.length, exclues: brut.length - sections.length, variables: variables.length })

// %% [markdown]
// À écrire : données (recensement de 2021, interpolation vers les sections de 2026), transformations, sections exclues.

// %% [javascript]
// Variance expliquée par les dix premières composantes, ACP brute et intra-circonscription.
Plot.plot({
  width: 640, height: 260, marginLeft: 50,
  x: { label: "composante", tickFormat: (d) => `CP${d}` }, y: { label: "variance expliquée (%)", grid: true },
  color: { legend: true, domain: ["brute", "intra-circonscription"], range: ["#8B887A", "#2A2E24"] },
  marks: [
    Plot.barY([...acpBrut.varianceExplained.slice(0, 10).map((v, i) => ({ k: i + 1, v: 100 * v, acp: "brute" })),
      ...acpIntra.varianceExplained.slice(0, 10).map((v, i) => ({ k: i + 1, v: 100 * v, acp: "intra-circonscription" }))],
      { x: "k", y: "v", fill: "acp", fx: "acp" }),
    Plot.ruleY([0]),
  ],
})

// %% [markdown]
// À écrire : lecture de la variance expliquée.

// %% [javascript]
// Corrélations intra-circonscription entre covariables (Pearson, variables transformées).
Plot.plot({
  width: 760, height: 760, marginLeft: 170, marginBottom: 170,
  x: { domain: variables, tickRotate: -90, label: null }, y: { domain: variables, label: null },
  color: { type: "diverging", scheme: "RdBu", domain: [-1, 1], legend: true, label: "r" },
  style: { fontSize: "9px" },
  marks: [Plot.cell(corIntra, { x: "a", y: "b", fill: "r", title: (d) => `${d.a} · ${d.b} : ${d.r.toFixed(2)}` })],
})

// %% [markdown]
// À écrire : lecture de la matrice de corrélation.

// %% [javascript]
// Saturations des variables sur les deux premières composantes de l'ACP intra-circonscription.
const saturations = variables.map((v, i) => ({ v, x: acpIntra.rawLoadings[i][0], y: acpIntra.rawLoadings[i][1] }));
Plot.plot({
    width: 760, height: 620, inset: 20,
    x: { label: `CP1 (${(100 * acpIntra.varianceExplained[0]).toFixed(1)} %)`, grid: true },
    y: { label: `CP2 (${(100 * acpIntra.varianceExplained[1]).toFixed(1)} %)`, grid: true },
    marks: [
      Plot.ruleX([0]), Plot.ruleY([0]),
      Plot.arrow(saturations, { x1: 0, y1: 0, x2: "x", y2: "y", stroke: "#8B887A", headLength: 4 }),
      Plot.text(saturations, { x: "x", y: "y", text: "v", fontSize: 9, dx: 4, textAnchor: "start", fill: "#2A2E24" }),
    ],
  })

// %% [markdown]
// À écrire : lecture des deux premières composantes.

// %% [javascript]
// Paires de covariables de blocs différents corrélées à |r| >= 0,8, brutes et intra-circonscription.
const blocDe = (v) => v.split("_")[0];
const pairesFortes = (cor, niveau) => cor.filter((d) => d.a < d.b && blocDe(d.a) !== blocDe(d.b) && Math.abs(d.r) >= 0.8)
  .map((d) => ({ niveau, a: d.a, b: d.b, r: d.r.toFixed(2) }));
const tablePaires = d3.create("table");
tablePaires.append("thead").append("tr").selectAll("th").data(["niveau", "variable 1", "variable 2", "r"]).join("th").text((d) => d);
tablePaires.append("tbody").selectAll("tr").data([...pairesFortes(corBrut, "brut"), ...pairesFortes(corIntra, "intra-circonscription")]).join("tr")
  .selectAll("td").data((d) => [d.niveau, d.a, d.b, d.r]).join("td").text((d) => d);
tablePaires.node()

// %% [markdown]
// À écrire : groupes de covariables retenus et représentant de chaque groupe.

// %% [javascript] #collapse-cell
// Plan d'analyse, arrêté le 2026-11-06 avant d'ajouter les votes.
const PLAN = {
  unite: "section de vote de 2026 (numéro < 500), au moins 100 habitants, toutes covariables publiées",
  reponse: "perturbation p = clr(x2026) - clr(x2022), votes du jour du scrutin (2022 transposé sur les sections de 2026) ; partis PQ, LIB, CAQ, QS, PCQ, AUTRES",
  inference: "modèle décalé : clr(x2026) ~ clr(x2022) + covariables, effet de circonscription",
  ordination: "RDA pondérée par les votes valides sur les clr, circonscription et clr(x2022) en covariables conditionnelles ; partition de la variance (démographie, socio-économie, circonscription, espace)",
  confirmation: "régression multinomiale (ou Dirichlet-multinomiale) à rang réduit sur les comptes",
  espace: "vecteurs propres spatiaux de Moran ; tests par permutations restreintes à l'intérieur des circonscriptions",
  robustesse: ["sections au découpage stable entre 2022 et 2026", "interpolation par surface plutôt que par électeurs", "validation croisée par région administrative"],
  rapport: "associations, jamais causalité ; partis séparés ; effets en points de pourcentage pour des profils contrastés",
};

// Covariables retenues : une balance par bloc compositionnel, les autres variables telles quelles.
// Écartées : revenu médian des ménages et taille moyenne des ménages (|r| >= 0,8 avec le faible revenu
// et les ménages d'une personne, à l'intérieur des circonscriptions ; ils dépendent de la composition du ménage).
const moyenneClr = (o, bloc, parties) => d3.mean(parties, (k) => o[`${bloc}_${k}`]);
const balance = (o, bloc, A, B) => Math.sqrt(A.length * B.length / (A.length + B.length)) * (moyenneClr(o, bloc, A) - moyenneClr(o, bloc, B));
const retenues = (o) => ({
  age_65plus_vs_moins50: balance(o, "age", ["65_79", "80_plus"], ["20_34", "35_49"]),
  scol_bac_vs_secondaire_ou_moins: balance(o, "scol", ["bac_plus"], ["aucun", "secondaire"]),
  langue_francais_vs_autres: balance(o, "langue", ["francais"], ["anglais", "non_officielle"]),
  logement_individuel_vs_collectif: balance(o, "logement", ["individuelle"], ["petit_collectif", "tour"]),
  navette_auto_vs_tc_actif: balance(o, "navette", ["auto"], ["transport_commun", "actif"]),
  religion_catholique_vs_aucune: balance(o, "religion", ["catholique"], ["aucune"]),
  prof_cols_blancs_vs_bleus: balance(o, "prof", ["0_cadres_superieurs", "1_affaires_finance_admin", "2_sciences", "4_enseignement_droit_social"],
    ["7_metiers_transport", "8_ressources_naturelles", "9_fabrication"]),
  faible_revenu: o.faible_revenu, menages_1_personne: o.menages_1_personne, locataires: o.locataires, immigrants: o.immigrants,
  minorites_visibles: o.minorites_visibles, autochtone: o.autochtone, demenage_5_ans: o.demenage_5_ans, activite: o.activite,
  chomage: o.chomage, densite: o.densite,
});
const covariablesRetenues = sections.map((o) => ({ cep: o.cep, sv: o.sv, ...retenues(o) }));
const nomsRetenus = Object.keys(retenues(sections[0]));

// Facteurs d'inflation de la variance, intra-circonscription : diagonale de l'inverse de la matrice de corrélation.
const retenuesIntra = sectionsIntra.map(retenues);
const zRetenues = nomsRetenus.map((k) => { const v = retenuesIntra.map((o) => o[k]), m = d3.mean(v), s = d3.deviation(v); return v.map((x) => (x - m) / s); });
const corRetenues = nomsRetenus.map((_, i) => nomsRetenus.map((_, j) => d3.sum(zRetenues[i], (x, q) => x * zRetenues[j][q]) / (retenuesIntra.length - 1)));
function inverse(M) {
  const k = M.length, A = M.map((r, i) => [...r, ...M.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < k; c++) {
    let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c]; A[c] = A[c].map((x) => x / d);
    for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c]; A[r] = A[r].map((x, j) => x - f * A[c][j]); }
  }
  return A.map((r) => r.slice(k));
}
const vif = inverse(corRetenues).map((r, i) => ({ covariable: nomsRetenus[i], vif: r[i] }));
Plot.plot({
  width: 640, height: 420, marginLeft: 230,
  x: { label: "facteur d'inflation de la variance (intra-circonscription)", grid: true }, y: { label: null, domain: d3.sort(vif, (d) => -d.vif).map((d) => d.covariable) },
  marks: [Plot.barX(vif, { x: "vif", y: "covariable", fill: "#8B887A" }), Plot.ruleX([0]), Plot.ruleX([5], { stroke: "#2A2E24", strokeDasharray: "3,3" })],
})

// %% [markdown]
// À écrire : covariables retenues et plan d'analyse.

// %% [javascript] #collapse-cell
// Votes du jour du scrutin par section de 2026 : 2026 mesuré, 2022 transposé (billet sur la migration des sections).
const URL_VOTES = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_migration-sections/sections_2022_2026.csv";
const votesBruts = await d3.csv(URL_VOTES, d3.autoType);
const PARTIS = ["PQ", "LIB", "CAQ", "QS", "PCQ", "AUTRES"];
const votesParSection = new Map(votesBruts.map((r) => [`${r.circonscription}-${r.sv}`, r]));

// Unités analysées : covariables retenues et votes valides aux deux élections.
const unites = covariablesRetenues.map((c) => ({ c, v: votesParSection.get(`${c.cep}-${c.sv}`) }))
  .filter(({ v }) => v && v["2026_valides"] > 0 && v["2022_valides"] > 0);
const poids = unites.map(({ v }) => v["2026_valides"]);
const clr26 = unites.map(({ v }) => clr(PARTIS.map((p) => v[`2026_${p}`] + 0.5)));
const clr22 = unites.map(({ v }) => clr(PARTIS.map((p) => v[`2022_${p}`] + 0.5)));
// Covariables standardisées (moyenne et écart type pondérés sur l'ensemble).
const X = (() => {
  const M = unites.map(({ c }) => nomsRetenus.map((k) => c[k]));
  const W = d3.sum(poids);
  const mu = nomsRetenus.map((_, j) => d3.sum(M, (r, i) => poids[i] * r[j]) / W);
  const sd = nomsRetenus.map((_, j) => Math.sqrt(d3.sum(M, (r, i) => poids[i] * (r[j] - mu[j]) ** 2) / W));
  return M.map((r) => r.map((x, j) => (x - mu[j]) / sd[j]));
})();

// Algèbre pondérée : centrage par circonscription, régression, sommes de carrés.
const cepDe = unites.map(({ c }) => c.cep);
function centrerParCirconscription(M) {
  const acc = new Map();
  M.forEach((r, i) => { const a = acc.get(cepDe[i]) ?? acc.set(cepDe[i], { w: 0, s: r.map(() => 0) }).get(cepDe[i]); a.w += poids[i]; r.forEach((x, j) => (a.s[j] += poids[i] * x)); });
  return M.map((r, i) => { const a = acc.get(cepDe[i]); return r.map((x, j) => x - a.s[j] / a.w); });
}
function centrer(M) { const W = d3.sum(poids); const mu = M[0].map((_, j) => d3.sum(M, (r, i) => poids[i] * r[j]) / W); return M.map((r) => r.map((x, j) => x - mu[j])); }
const ss = (M) => d3.sum(M, (r, i) => poids[i] * d3.sum(r, (x) => x * x));
const xtwy = (A, B) => A[0].map((_, j) => B[0].map((_, k) => d3.sum(A, (r, i) => poids[i] * r[j] * B[i][k])));
const produit = (A, B) => A.map((r) => B[0].map((_, k) => d3.sum(r, (x, j) => x * B[j][k])));
function residus(Y, Z) { const C = produit(inverse(xtwy(Z, Z)), xtwy(Z, Y)); const F = produit(Z, C); return Y.map((r, i) => r.map((x, j) => x - F[i][j])); }

// Effet fixe de circonscription (centrage), puis vote de 2022 (5 log-ratios indépendants) retiré des réponses et des covariables.
const Ytot = centrer(clr26);
const Yc = centrerParCirconscription(clr26), Lc = centrerParCirconscription(clr22.map((r) => r.slice(0, 5))), Xc = centrerParCirconscription(X);
const Yr = residus(Yc, Lc), Xr = residus(Xc, Lc);
const B = produit(inverse(xtwy(Xr, Xr)), xtwy(Xr, Yr));
const Yhat = produit(Xr, B);

// Partition de la variance totale (pondérée) des clr de 2026, dans l'ordre circonscription, vote de 2022, covariables.
const partition = (() => {
  const T = ss(Ytot), circ = T - ss(Yc), lag = ss(Yc) - ss(Yr), cov = ss(Yhat);
  return [
    { part: "circonscription", f: circ / T }, { part: "vote de 2022 (à circonscription égale)", f: lag / T },
    { part: "covariables (à circonscription et vote de 2022 égaux)", f: cov / T }, { part: "non expliqué", f: 1 - (circ + lag + cov) / T },
  ];
})();

// Perturbation par parti (clr de 2026 moins clr de 2022), corrélée à chaque covariable, intra-circonscription, pondérée.
const perturbation = centrerParCirconscription(clr26.map((r, i) => r.map((x, j) => x - clr22[i][j])));
const correlationsPerturbation = nomsRetenus.flatMap((k, j) => PARTIS.map((p, q) => {
  const x = Xc.map((r) => r[j]), y = perturbation.map((r) => r[q]);
  const sxy = d3.sum(x, (v, i) => poids[i] * v * y[i]), sxx = d3.sum(x, (v, i) => poids[i] * v * v), syy = d3.sum(y, (v, i) => poids[i] * v * v);
  return { covariable: k, parti: p, r: sxy / Math.sqrt(sxx * syy) };
}));

// RDA partielle : décomposition en valeurs propres de Yhat' W Yhat (6 x 6, méthode de Jacobi).
function valeursPropres(S) {
  const k = S.length, A = S.map((r) => [...r]), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
  for (let it = 0; it < 100; it++) {
    let p = 0, q = 1, m = 0;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (Math.abs(A[i][j]) > m) { m = Math.abs(A[i][j]); p = i; q = j; }
    if (m < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let i = 0; i < k; i++) { const a = A[i][p], b = A[i][q]; A[i][p] = c * a - s * b; A[i][q] = s * a + c * b; }
    for (let i = 0; i < k; i++) { const a = A[p][i], b = A[q][i]; A[p][i] = c * a - s * b; A[q][i] = s * a + c * b; }
    for (let i = 0; i < k; i++) { const a = V[i][p], b = V[i][q]; V[i][p] = c * a - s * b; V[i][q] = s * a + c * b; }
  }
  return d3.sort(A.map((_, i) => ({ valeur: A[i][i], vecteur: V.map((r) => r[i]) })), (d) => -d.valeur);
}
const axes = valeursPropres(xtwy(Yhat, Yhat));
const scoresAxes = axes.slice(0, 2).map((a) => Yhat.map((r) => d3.sum(r, (x, j) => x * a.vecteur[j])));
// Flèches des covariables : corrélation pondérée avec les scores des deux premiers axes.
const corPonderee = (x, y) => d3.sum(x, (v, i) => poids[i] * v * y[i]) / Math.sqrt(d3.sum(x, (v, i) => poids[i] * v * v) * d3.sum(y, (v, i) => poids[i] * v * v));
const flechesCovariables = nomsRetenus.map((k, j) => ({ nom: k, x: corPonderee(Xr.map((r) => r[j]), scoresAxes[0]), y: corPonderee(Xr.map((r) => r[j]), scoresAxes[1]) }));
const flechesPartis = PARTIS.map((p, j) => ({ nom: p, x: axes[0].vecteur[j], y: axes[1].vecteur[j] }));
const inerties = axes.map((a) => a.valeur / d3.sum(axes, (b) => b.valeur));

({ unites: unites.length, partition: partition.map((d) => `${d.part} ${(100 * d.f).toFixed(1)} %`), axes: inerties.slice(0, 3).map((x) => (100 * x).toFixed(1)) })

// %% [markdown]
// À écrire : construction de la réponse et partition de la variance.

// %% [javascript]
// Partition de la variance des log-ratios de 2026.
Plot.plot({
  width: 640, height: 200, marginLeft: 330,
  x: { label: "part de la variance (%)", grid: true, domain: [0, 100] }, y: { label: null, domain: partition.map((d) => d.part) },
  marks: [Plot.barX(partition, { x: (d) => 100 * d.f, y: "part", fill: "#8B887A" }),
    Plot.text(partition, { x: (d) => 100 * d.f, y: "part", text: (d) => `${(100 * d.f).toFixed(1)} %`, dx: 4, textAnchor: "start" })],
})

// %% [markdown]
// À écrire : lecture de la partition.

// %% [javascript]
// Corrélations intra-circonscription entre covariables et perturbation de chaque parti.
Plot.plot({
  width: 640, height: 520, marginLeft: 230,
  x: { domain: PARTIS, label: null, axis: "top" }, y: { domain: nomsRetenus, label: null },
  color: { type: "diverging", scheme: "RdBu", domain: [-0.6, 0.6], legend: true, label: "r" },
  marks: [
    Plot.cell(correlationsPerturbation, { x: "parti", y: "covariable", fill: "r" }),
    Plot.text(correlationsPerturbation, { x: "parti", y: "covariable", text: (d) => d.r.toFixed(2), fontSize: 9 }),
  ],
})

// %% [markdown]
// À écrire : lecture de la carte de chaleur ; rappel : associations entre sections, pas comportements individuels.

// %% [javascript]
// Triplot de la RDA partielle (circonscription et vote de 2022 en covariables conditionnelles) : covariables et partis.
Plot.plot({
  width: 760, height: 620, inset: 30,
  x: { label: `axe 1 (${(100 * inerties[0]).toFixed(1)} % de la variance contrainte)`, grid: true },
  y: { label: `axe 2 (${(100 * inerties[1]).toFixed(1)} %)`, grid: true },
  marks: [
    Plot.ruleX([0]), Plot.ruleY([0]),
    Plot.arrow(flechesCovariables, { x1: 0, y1: 0, x2: "x", y2: "y", stroke: "#8B887A", headLength: 4 }),
    Plot.text(flechesCovariables, { x: "x", y: "y", text: "nom", fontSize: 9, dx: 4, textAnchor: "start", fill: "#5E5B50" }),
    Plot.arrow(flechesPartis, { x1: 0, y1: 0, x2: "x", y2: "y", stroke: "#2A2E24", strokeWidth: 2, headLength: 6 }),
    Plot.text(flechesPartis, { x: "x", y: "y", text: "nom", fontWeight: 600, dx: 6, textAnchor: "start" }),
  ],
})

// %% [markdown]
// À écrire : lecture du triplot. Non fait à cette étape : termes spatiaux, permutations restreintes, modèle multinomial à rang réduit.

// %% [javascript] #collapse-cell
// Résultats des calculs longs (bruit simulé, structures spatiales, permutations, régression multinomiale, bootstrap),
// produits par le notebook posts/fr/2026-11_vote-correlations-calculs (node scripts/executer-calculs.mjs).
const URL_PRECALCULS = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/precalculs.json";
const precalculs = await d3.json(URL_PRECALCULS);
const { plafond, partitionSpatiale, moranResidus, permutation, surdispersion } = precalculs;
const bootstrap = precalculs.effets;

({ plafond, permutation, surdispersion, moranResidus: moranResidus.map((d) => `${d.parti} ${d.I.toFixed(3)}`), calcule: precalculs.genere })

// %% [markdown]
// À écrire : plafond du bruit, structures spatiales, permutations.

// %% [javascript]
// Partition de la variance avec les structures spatiales intra-circonscription.
Plot.plot({
  width: 640, height: 230, marginLeft: 360,
  x: { label: "part de la variance (%)", grid: true, domain: [0, 100] }, y: { label: null, domain: partitionSpatiale.map((d) => d.part) },
  marks: [Plot.barX(partitionSpatiale, { x: (d) => 100 * d.f, y: "part", fill: "#8B887A" }),
    Plot.text(partitionSpatiale, { x: (d) => 100 * d.f, y: "part", text: (d) => `${(100 * d.f).toFixed(1)} %`, dx: 4, textAnchor: "start" })],
})

// %% [markdown]
// À écrire : lecture.

// %% [markdown]
// À écrire : modèle multinomial, surdispersion, effets en points.

// %% [javascript]
// Effets moyens en points de pourcentage (10e au 90e centile intra-circonscription), intervalle de bootstrap à 90 %.
Plot.plot({
  width: 760, height: 900, marginLeft: 230, marginRight: 20,
  fx: { domain: PARTIS, label: null }, x: { label: "points de pourcentage", grid: true }, y: { domain: nomsRetenus, label: null },
  marks: [
    Plot.ruleX([0]),
    Plot.ruleY(bootstrap, { fx: "parti", y: "covariable", x1: "bas", x2: "haut", stroke: "#8B887A" }),
    Plot.dot(bootstrap, { fx: "parti", y: "covariable", x: "points", fill: "#2A2E24", r: 2.5 }),
  ],
})

// %% [markdown]
// À écrire : lecture des effets ; associations entre sections, effet du vote anticipé sur l'âge.

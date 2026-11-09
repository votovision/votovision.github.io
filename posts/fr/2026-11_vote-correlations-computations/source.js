// ---
// title: Québec : profil des bureaux de vote et vote de 2026, calculs
// id: vote-correlations-computations
// date: 2026-11-06
// ---

// %% [markdown]
// Calculs du billet sur le profil des bureaux de vote et le vote de 2026 : unités, covariables, régression multinomiale, bruit du dépouillement, autocorrélation spatiale, effets et bootstrap, analyses de robustesse. La dernière cellule rassemble les résultats ; dans un navigateur, elle propose de télécharger `precomputed.json`, lu par le billet. Hors navigateur : `node posts/fr/2026-11_vote-correlations-computations/run.mjs` dans le dépôt du site.

// %% [javascript]
// Paquets et données.
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const { mva, core } = await import("https://cdn.jsdelivr.net/npm/@tangent.to/ds@0.16/+esm");
const { ilr } = mva.composition;

// Recensement de 2021 interpolé sur les sections de vote de 2026 (votovision/data : sources/census_polling_divisions_qc.ts).
const CENSUS_URL = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/census_polling_divisions_2026.csv";
// Votes du jour du scrutin par section de 2026 : 2026 mesuré, 2022 transposé (sources/transposition_sections_qc.ts).
const SECTION_VOTES_URL = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_migration-sections/sections_2022_2026.csv";
// Vote par anticipation de 2022 et de 2026, réparti par section au prorata des électeurs (sources/quebec_advance_votes.ts).
const ADVANCE_VOTES_URL = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/advance_votes_sections.csv";
// Poids de transposition des sections de 2022 vers celles de 2026.
const SECTION_WEIGHTS_URL = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/section_weights_2022_2026.csv";
const census = await d3.csv(CENSUS_URL, d3.autoType);
const sectionVotes = await d3.csv(SECTION_VOTES_URL, d3.autoType);
const advanceVotes = await d3.csv(ADVANCE_VOTES_URL, d3.autoType);
const sectionWeights = await d3.csv(SECTION_WEIGHTS_URL, d3.autoType);

// Partis ; le premier sert de référence dans la régression multinomiale.
const PARTIES = ["PQ", "LIB", "CAQ", "QS", "PCQ", "AUTRES"];
const MAIN_PARTIES = ["PQ", "LIB", "CAQ", "QS", "PCQ"];
const K = PARTIES.length, J = K - 1;
const key = (riding, section) => `${riding}-${section}`;

// Une ligne par section de 2026 : recensement, votes du jour du scrutin (2026, et 2022 transposé), vote par anticipation
// (2026 réparti ; 2022 réparti par section de 2022, puis transposé avec les poids), bureau de vote par anticipation.
const advance2026 = new Map(advanceVotes.filter((r) => r.election.getUTCFullYear() === 2026).map((r) => [key(r.riding_code, r.section), r]));
const advance2022 = new Map(advanceVotes.filter((r) => r.election.getUTCFullYear() === 2022).map((r) => [key(r.riding_code, r.section), r]));
const transposedAdvance2022 = new Map();
for (const w of sectionWeights) {
  const from = advance2022.get(key(w.from_riding, w.from_section)); if (!from) continue;
  const target = key(w.to_riding, w.to_section), sums = transposedAdvance2022.get(target) ?? transposedAdvance2022.set(target, MAIN_PARTIES.map(() => 0)).get(target);
  MAIN_PARTIES.forEach((p, k) => (sums[k] += w.weight * from[p]));
}
const censusBySection = new Map(census.map((r) => [key(r.riding_code, r.section), r]));
const sections = sectionVotes.map((v) => {
  const id = key(v.circonscription, v.sv), advance = advance2026.get(id);
  return {
    riding: v.circonscription, section: v.sv, office: v.bureau, advancePoll: advance ? advance.advance_poll : null, stability: v.stabilite ?? 0,
    census: censusBySection.get(id),
    day2026: PARTIES.map((p) => v[`2026_${p}`] ?? 0), advance2026: PARTIES.map((p) => (advance ? advance[p] : 0)),
    day2022: MAIN_PARTIES.map((p) => v[`2022_${p}`] ?? 0), advance2022: transposedAdvance2022.get(id) ?? MAIN_PARTIES.map(() => 0),
  };
});

// Unités d'analyse : les sections sont regroupées selon `groupOf` ; comptes du recensement et votes additionnés.
// withAdvance : le vote par anticipation est ajouté au vote du jour du scrutin, aux deux élections.
const NON_ADDITIVE = new Set(["riding_code", "section", "riding_name", "x", "y", "n_dissemination_areas", "mean_household_size", "median_after_tax_household_income", "low_income_lim_at_pct"]);
const additiveColumns = Object.keys(census[0]).filter((k) => !NON_ADDITIVE.has(k));
function buildUnits(groupOf, withAdvance) {
  return d3.groups(sections.filter((s) => groupOf(s) !== null && s.census), groupOf).map(([, members]) => {
    const rows = members.map((s) => s.census), electors = d3.sum(rows, (r) => r.electors ?? 0);
    const u = { riding: members[0].riding, sections: members.length };
    for (const k of additiveColumns) u[k] = d3.sum(rows, (r) => r[k] ?? 0);
    // Taux de faible revenu : moyenne pondérée par la population des sections où il est publié.
    const published = rows.filter((r) => r.low_income_lim_at_pct !== null);
    u.low_income_pct = published.length ? d3.sum(published, (r) => r.population * r.low_income_lim_at_pct) / d3.sum(published, (r) => r.population) : null;
    u.x = d3.sum(rows, (r) => (r.electors ?? 0) * r.x) / electors; u.y = d3.sum(rows, (r) => (r.electors ?? 0) * r.y) / electors;
    u.stability = d3.sum(members, (s) => (s.census.electors ?? 0) * s.stability) / electors;
    u.votes2026 = PARTIES.map((_, k) => d3.sum(members, (s) => s.day2026[k] + (withAdvance ? s.advance2026[k] : 0)));
    u.votes2022 = MAIN_PARTIES.map((_, k) => d3.sum(members, (s) => s.day2022[k] + (withAdvance ? s.advance2022[k] : 0)));
    return u;
  });
}
const byAdvancePoll = (s) => (s.advancePoll === null ? null : `${s.riding}-${s.advancePoll}`);
const byOffice = (s) => (s.office === null ? null : `${s.riding}-${s.office}`);

({ sections: sections.length, withAdvancePoll: sections.filter((s) => s.advancePoll !== null).length })

// %% [javascript]
// Covariables. Une classe ordonnée est résumée par sa moyenne en unités réelles (âge, années d'études) ; un taux entre
// en logit, une grandeur positive en log ; une variable nominale à plus de deux catégories reste une composition, en
// coordonnées ilr (tangent/ds). Rien n'est modélisé en pourcentage.

// Âge : centre de chaque classe de cinq ans (102 ans pour les 100 ans et plus).
const AGE_CLASSES = [["age_20_24", 22.5], ["age_25_29", 27.5], ["age_30_34", 32.5], ["age_35_39", 37.5], ["age_40_44", 42.5], ["age_45_49", 47.5],
  ["age_50_54", 52.5], ["age_55_59", 57.5], ["age_60_64", 62.5], ["age_65_69", 67.5], ["age_70_74", 72.5], ["age_75_79", 77.5], ["age_80_84", 82.5],
  ["age_85_89", 87.5], ["age_90_94", 92.5], ["age_95_99", 97.5], ["age_100_plus", 102]];
// Scolarité : années d'études associées au plus haut diplôme (parcours québécois : secondaire 11 ans, cégep 2 ou 3 ans).
const SCHOOLING_YEARS = [["edu_none", 9], ["edu_high_school", 11], ["edu_trades_school", 12], ["edu_apprenticeship", 12], ["edu_college_cegep", 13.5],
  ["edu_university_below_bachelor", 14], ["edu_bachelor", 16], ["edu_university_above_bachelor", 17], ["edu_medicine", 18], ["edu_master", 18], ["edu_doctorate", 21]];
// Variante pour l'analyse de robustesse : rangs des niveaux, à intervalles égaux.
const SCHOOLING_RANKS = [["edu_none", 1], ["edu_high_school", 2], ["edu_trades_school", 3], ["edu_apprenticeship", 3], ["edu_college_cegep", 4],
  ["edu_university_below_bachelor", 5], ["edu_bachelor", 6], ["edu_university_above_bachelor", 7], ["edu_medicine", 8], ["edu_master", 8], ["edu_doctorate", 9]];
const classMean = (u, classes) => d3.sum(classes, ([k, c]) => u[k] * c) / d3.sum(classes, ([k]) => u[k]);
// Taux d'un compte sur un total, avec un demi-compte de chaque côté pour éviter 0 et 1.
const rate = (count, total) => (count + 0.5) / (total + 1);

const TRANSFORMS = {
  identity: { forward: (v) => v, inverse: (t) => t },
  log: { forward: Math.log, inverse: Math.exp },
  logit: { forward: (p) => Math.log(p / (1 - p)), inverse: (t) => 1 / (1 + Math.exp(-t)) },
};
// `percent` : la valeur est une proportion, affichée en pourcentage.
const SCALARS = [
  { key: "mean_age", label: "Âge moyen des 20 ans et plus", unit: "ans", transform: "identity", value: (u) => classMean(u, AGE_CLASSES) },
  { key: "mean_schooling", label: "Scolarité moyenne des 25-64 ans", unit: "années d'études", transform: "identity", value: (u) => classMean(u, SCHOOLING_YEARS) },
  { key: "low_income", label: "Personnes à faible revenu (mesure de faible revenu après impôt)", unit: "% de la population", percent: true, transform: "logit",
    value: (u) => (u.low_income_pct === null ? NaN : (u.low_income_pct + 0.5) / 101) },
  { key: "household_size", label: "Taille moyenne des ménages", unit: "personnes", transform: "log", value: (u) => u.persons_in_private_households / u.households_total },
  { key: "renters", label: "Ménages locataires", unit: "% des ménages", percent: true, transform: "logit", value: (u) => rate(u.renters, u.tenure_total) },
  { key: "immigrants", label: "Immigrants", unit: "% de la population", percent: true, transform: "logit", value: (u) => rate(u.immigrants, u.immigration_total) },
  { key: "visible_minority", label: "Personnes des minorités visibles", unit: "% de la population", percent: true, transform: "logit", value: (u) => rate(u.visible_minority, u.visible_minority_total) },
  { key: "indigenous", label: "Personnes d'identité autochtone", unit: "% de la population", percent: true, transform: "logit", value: (u) => rate(u.indigenous_identity, u.indigenous_total) },
  { key: "movers", label: "Personnes ayant déménagé depuis cinq ans", unit: "% de la population de 5 ans et plus", percent: true, transform: "logit", value: (u) => rate(u.movers_5_years, u.mobility_5_years_total) },
  { key: "participation_rate", label: "Taux d'activité", unit: "% des 15 ans et plus", percent: true, transform: "logit", value: (u) => rate(u.labour_force, u.labour_total) },
  { key: "unemployment_rate", label: "Taux de chômage", unit: "% de la population active", percent: true, transform: "logit", value: (u) => rate(u.unemployed, u.labour_force) },
  { key: "population_density", label: "Densité de la population", unit: "habitants par km²", transform: "log", value: (u) => u.population / u.land_area_km2 },
];
// Variables nominales : comptes par catégorie.
const NOMINALS = [
  { key: "mother_tongue", unit: "% des personnes ayant une seule langue maternelle", parts: [
    { key: "mother_tongue_french", label: "Personnes de langue maternelle française", count: (u) => u.mother_tongue_french },
    { key: "mother_tongue_english", label: "Personnes de langue maternelle anglaise", count: (u) => u.mother_tongue_english },
    { key: "mother_tongue_other", label: "Personnes d'une autre langue maternelle", count: (u) => u.mother_tongue_non_official },
  ] },
  { key: "religion", unit: "% de la population", parts: [
    { key: "religion_catholic", label: "Catholiques", count: (u) => u.catholic },
    { key: "religion_none", label: "Personnes sans religion", count: (u) => u.no_religion },
    { key: "religion_other", label: "Personnes d'une autre religion", count: (u) => Math.max(u.religion_total - u.catholic - u.no_religion, 0) },
  ] },
  { key: "commute", unit: "% des travailleurs qui se déplacent", parts: [
    { key: "commute_car", label: "Navette en automobile", count: (u) => u.commute_car },
    { key: "commute_transit", label: "Navette en transport en commun", count: (u) => u.commute_transit },
    { key: "commute_walk_bicycle", label: "Navette à pied ou à vélo", count: (u) => u.commute_walk + u.commute_bicycle },
    { key: "commute_other", label: "Navette par un autre moyen", count: (u) => u.commute_other },
  ] },
  { key: "occupation", unit: "% de la population active ayant une profession", parts: [
    { key: "occ_senior_management", label: "Profession : cadres supérieurs", count: (u) => u.occ_0_senior_management },
    { key: "occ_business", label: "Profession : affaires, finance et administration", count: (u) => u.occ_1_business_finance_admin },
    { key: "occ_sciences", label: "Profession : sciences naturelles et appliquées", count: (u) => u.occ_2_sciences },
    { key: "occ_health", label: "Profession : secteur de la santé", count: (u) => u.occ_3_health },
    { key: "occ_education_law_social", label: "Profession : enseignement, droit et services sociaux", count: (u) => u.occ_4_education_law_social },
    { key: "occ_arts", label: "Profession : arts, culture, sports et loisirs", count: (u) => u.occ_5_arts_culture },
    { key: "occ_sales_service", label: "Profession : vente et services", count: (u) => u.occ_6_sales_service },
    { key: "occ_trades_transport", label: "Profession : métiers, transport et machinerie", count: (u) => u.occ_7_trades_transport },
    { key: "occ_natural_resources", label: "Profession : ressources naturelles et agriculture", count: (u) => u.occ_8_natural_resources },
    { key: "occ_manufacturing", label: "Profession : fabrication et services d'utilité publique", count: (u) => u.occ_9_manufacturing },
  ] },
];
const computable = (u) => SCALARS.every((s) => Number.isFinite(TRANSFORMS[s.transform].forward(s.value(u)))) && NOMINALS.every((b) => d3.sum(b.parts, (p) => p.count(u)) > 0);
const correlation = (a, b) => { const ma = d3.mean(a), mb = d3.mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
function generator(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Jeu de données d'une analyse : unités retenues (au moins 100 habitants, votes valides aux deux élections, covariables
// calculables), comptes de votes de 2026, circonscription de chaque unité.
function buildDataset(candidates) {
  const units = candidates.filter((u) => u.population >= 100 && d3.sum(u.votes2022) > 0 && d3.sum(u.votes2026) > 0 && computable(u));
  const n = units.length, ridings = [...new Set(units.map((u) => u.riding))], rank = new Map(ridings.map((r, k) => [r, k]));
  const group = Int32Array.from(units, (u) => rank.get(u.riding)), Y = new Float64Array(n * K), N = new Float64Array(n);
  units.forEach((u, i) => u.votes2026.forEach((v, k) => { Y[i * K + k] = Math.round(v); N[i] += Math.round(v); }));
  // Centrage d'une variable par circonscription (moyenne pondérée par les votes) : l'effet fixe de circonscription du modèle.
  const center = (v) => {
    const s = new Float64Array(ridings.length), w = new Float64Array(ridings.length);
    v.forEach((x, i) => { s[group[i]] += N[i] * x; w[group[i]] += N[i]; });
    return v.map((x, i) => x - s[group[i]] / w[group[i]]);
  };
  return { units, n, ridings, group, nGroups: ridings.length, byGroup: d3.group(d3.range(n), (i) => group[i]), Y, N, center, excluded: candidates.length - n };
}

// Matrice du modèle et contrastes. Colonnes : 4 coordonnées ilr du vote de 2022 des cinq principaux partis, une colonne par
// covariable scalaire (transformée), D - 1 coordonnées ilr par variable nominale ; toutes centrées par circonscription.
// Un contraste est un déplacement d'un écart type dans cet espace, l'écart type étant mesuré à l'intérieur des
// circonscriptions : pour une covariable scalaire, celui de sa colonne ; pour une catégorie d'une variable nominale, celui de
// sa coordonnée pivot, sqrt((D - 1) / D) · ln(catégorie / moyenne géométrique des autres), les autres catégories gardant
// leurs proportions entre elles.
function buildDesign(data, scalars) {
  const { units, n, center } = data, columns = [], contrasts = [];
  const add = (name, v) => columns.push({ name, v: center(v) });
  const lag = ilr(units.map((u) => u.votes2022.map((x) => x + 0.5)));
  for (let a = 0; a < MAIN_PARTIES.length - 1; a++) add(`vote2022_${a + 1}`, lag.map((r) => r[a]));
  const nLag = columns.length;
  for (const s of scalars) {
    const T = TRANSFORMS[s.transform], raw = units.map((u) => s.value(u)), position = columns.length;
    add(s.key, raw.map(T.forward));
    const sd = d3.deviation(columns[position].v), median = d3.median(raw);
    contrasts.push({ key: s.key, block: null, label: s.label, unit: s.unit, percent: !!s.percent, median,
      oneSdAbove: T.inverse(T.forward(median) + sd), shift: [[position, sd]], variable: columns[position].v });
  }
  for (const b of NOMINALS) {
    const D = b.parts.length, counts = units.map((u) => b.parts.map((p) => p.count(u) + 0.5)), coordinates = ilr(counts), position = columns.length;
    for (let a = 0; a < D - 1; a++) add(`${b.key}_${a + 1}`, coordinates.map((r) => r[a]));
    b.parts.forEach((p, k) => {
      const share = counts.map((r) => r[k] / d3.sum(r)), median = d3.median(share);
      const pivot = center(counts.map((r) => Math.sqrt((D - 1) / D) * (Math.log(r[k]) - d3.mean(r.filter((_, m) => m !== k), Math.log))));
      // Un écart type de la coordonnée pivot multiplie la catégorie k par `factor`, les autres restant proportionnelles.
      const sd = d3.deviation(pivot), factor = Math.exp(sd * Math.sqrt(D / (D - 1)));
      const direction = ilr([b.parts.map((_, m) => (m === k ? factor : 1))])[0];
      contrasts.push({ key: p.key, block: b.key, label: p.label, unit: b.unit, percent: true, median,
        oneSdAbove: (median * factor) / (median * factor + 1 - median), shift: direction.map((d, a) => [position + a, d]), variable: pivot });
    });
  }
  const q = columns.length, Z = new Float64Array(n * q);
  columns.forEach((c, a) => c.v.forEach((x, i) => (Z[i * q + a] = x)));
  for (const c of contrasts) { c.delta = new Float64Array(q); for (const [a, d] of c.shift) c.delta[a] = d; }
  return { columns, contrasts, q, Z, nLag };
}

({ scalars: SCALARS.length, nominalParts: d3.sum(NOMINALS, (b) => b.parts.length) })

// %% [javascript]
// Régression multinomiale sur les comptes de votes : log(p_j / p_PQ) = alpha[groupe, j] + z · beta_j.
// Maximum de vraisemblance par Newton en blocs alternés : intercepts de chaque groupe (5 x 5), puis coefficients communs.
function solve(H, g, m) { // Cholesky de H (m x m, symétrique définie positive), résout H d = g ; H est modifiée.
  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= i; j++) {
      let s = H[i * m + j]; for (let k = 0; k < j; k++) s -= H[i * m + k] * H[j * m + k];
      H[i * m + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / H[j * m + j];
    }
  }
  const d = Float64Array.from(g);
  for (let i = 0; i < m; i++) { for (let k = 0; k < i; k++) d[i] -= H[i * m + k] * d[k]; d[i] /= H[i * m + i]; }
  for (let i = m - 1; i >= 0; i--) { for (let k = i + 1; k < m; k++) d[i] -= H[k * m + i] * d[k]; d[i] /= H[i * m + i]; }
  return d;
}
// group : indice du groupe de chaque unité ; Z : matrice n x q ; weights : multiplicité de chaque groupe (bootstrap) ;
// mask : unités retenues ; start : modèle de départ ; rounds : nombre maximal d'alternances.
function fit(data, { group = data.group, nGroups = data.nGroups, Z = null, q = 0, weights = null, mask = null, start = null, rounds = 100, tolerance = 1e-10 } = {}) {
  const { n, Y, N } = data;
  const A = start ? Float64Array.from(start.A) : new Float64Array(nGroups * J), B = start && q ? Float64Array.from(start.B) : new Float64Array(J * q);
  const w = (i) => (mask && !mask[i] ? 0 : weights ? weights[group[i]] : 1), p = new Float64Array(K);
  const probabilities = (i, coefficients = B) => {
    let top = 0;
    for (let j = 0; j < J; j++) { let e = A[group[i] * J + j]; for (let a = 0; a < q; a++) e += Z[i * q + a] * coefficients[j * q + a]; p[j + 1] = e; if (e > top) top = e; }
    let s = (p[0] = Math.exp(-top)); for (let k = 1; k < K; k++) s += (p[k] = Math.exp(p[k] - top));
    for (let k = 0; k < K; k++) p[k] /= s;
  };
  const logLikelihood = (coefficients = B) => { let l = 0; for (let i = 0; i < n; i++) { const wi = w(i); if (!wi) continue; probabilities(i, coefficients); for (let k = 0; k < K; k++) if (Y[i * K + k]) l += wi * Y[i * K + k] * Math.log(p[k]); } return l; };
  if (!start) { // Départ : log des rapports de votes de chaque groupe (solution exacte sans covariables).
    const s = new Float64Array(nGroups * K);
    for (let i = 0; i < n; i++) if (w(i)) for (let k = 0; k < K; k++) s[group[i] * K + k] += Y[i * K + k];
    for (let c = 0; c < nGroups; c++) for (let j = 0; j < J; j++) A[c * J + j] = Math.log((s[c * K + j + 1] + 0.5) / (s[c * K] + 0.5));
  }
  function interceptStep() {
    const g = new Float64Array(nGroups * J), H = new Float64Array(nGroups * J * J);
    for (let i = 0; i < n; i++) {
      if (!w(i)) continue; probabilities(i); const c = group[i];
      for (let j = 0; j < J; j++) {
        g[c * J + j] += Y[i * K + j + 1] - N[i] * p[j + 1];
        for (let k = 0; k < J; k++) H[c * J * J + j * J + k] += N[i] * ((j === k ? p[j + 1] : 0) - p[j + 1] * p[k + 1]);
      }
    }
    let largest = 0;
    for (let c = 0; c < nGroups; c++) {
      const gc = g.subarray(c * J, (c + 1) * J), Hc = H.slice(c * J * J, (c + 1) * J * J);
      if (!Hc.some((x) => x)) continue;
      for (let j = 0; j < J; j++) { Hc[j * J + j] += 1e-8; largest = Math.max(largest, Math.abs(gc[j])); }
      solve(Hc, gc, J).forEach((d, j) => (A[c * J + j] += Math.max(-3, Math.min(3, d))));
    }
    return largest;
  }
  function coefficientStep(before) {
    const m = J * q, g = new Float64Array(m), H = new Float64Array(m * m);
    for (let i = 0; i < n; i++) {
      const wi = w(i); if (!wi) continue; probabilities(i);
      for (let j = 0; j < J; j++) {
        const r = wi * (Y[i * K + j + 1] - N[i] * p[j + 1]);
        for (let a = 0; a < q; a++) g[j * q + a] += r * Z[i * q + a];
        for (let k = 0; k <= j; k++) {
          const v = wi * N[i] * ((j === k ? p[j + 1] : 0) - p[j + 1] * p[k + 1]);
          for (let a = 0; a < q; a++) { const za = v * Z[i * q + a], row = (j * q + a) * m + k * q; for (let b = 0; b < q; b++) H[row + b] += za * Z[i * q + b]; }
        }
      }
    }
    for (let r = 0; r < m; r++) for (let c = r + 1; c < m; c++) H[r * m + c] = H[c * m + r];
    let largest = 0; for (let r = 0; r < m; r++) { largest = Math.max(largest, Math.abs(g[r])); H[r * m + r] *= 1 + 1e-10; }
    const d = solve(H, g, m);
    // Recherche linéaire : le pas est réduit de moitié tant que la vraisemblance ne monte pas.
    for (let step = 1; step > 1e-4; step /= 2) {
      const trial = B.map((b, r) => b + step * d[r]);
      if (logLikelihood(trial) >= before) { B.set(trial); break; }
    }
    return largest;
  }
  let l = logLikelihood(), gradient = Infinity, t = 0;
  for (; t < rounds; t++) {
    let gA = interceptStep(); gA = interceptStep();
    const gB = q ? coefficientStep(logLikelihood()) : 0;
    const l2 = logLikelihood(); gradient = Math.max(gA, gB);
    const gain = l2 - l; l = l2;
    if (gain < tolerance * Math.abs(l)) break;
  }
  return { data, A, B, q, Z, group, logLikelihood: l, rounds: t + 1, gradient, parameters: nGroups * J + J * q };
}
// Probabilités prédites de l'unité i (K valeurs), avec un déplacement optionnel du prédicteur linéaire.
function predict(model, i, out, shift = null, sign = 0) {
  let top = 0;
  for (let j = 0; j < J; j++) {
    let e = model.A[model.group[i] * J + j]; for (let a = 0; a < model.q; a++) e += model.Z[i * model.q + a] * model.B[j * model.q + a];
    if (shift) e += sign * shift[j];
    out[j + 1] = e; if (e > top) top = e;
  }
  let s = (out[0] = Math.exp(-top)); for (let k = 1; k < K; k++) s += (out[k] = Math.exp(out[k] - top));
  for (let k = 0; k < K; k++) out[k] /= s;
  return out;
}
// Déviance : 2 Σ y log(y / (N p)) ; nulle pour un modèle qui reproduit chaque compte.
function deviance(model, counts = model.data.Y) {
  const { n, N } = model.data, p = new Float64Array(K); let total = 0;
  for (let i = 0; i < n; i++) { predict(model, i, p); for (let k = 0; k < K; k++) { const y = counts[i * K + k]; if (y) total += 2 * y * Math.log(y / (N[i] * p[k])); } }
  return total;
}
// Effets. Pour chaque contraste (un écart type), le prédicteur linéaire de chaque unité est déplacé d'un demi-écart type vers
// le bas et d'un demi-écart type vers le haut ; l'effet est l'écart moyen des parts prédites, pondéré par les votes, en
// points de pourcentage.
function effects(model, contrasts, { weights = null, mask = null } = {}) {
  const { n, N } = model.data, C = contrasts.length, out = new Float64Array(C * K), high = new Float64Array(K), low = new Float64Array(K);
  const shifts = contrasts.map((c) => Float64Array.from({ length: J }, (_, j) => { let s = 0; for (let a = 0; a < model.q; a++) s += model.B[j * model.q + a] * c.delta[a]; return s / 2; }));
  let W = 0;
  for (let i = 0; i < n; i++) {
    const wi = (mask && !mask[i] ? 0 : weights ? weights[model.group[i]] : 1) * N[i]; if (!wi) continue; W += wi;
    for (let c = 0; c < C; c++) { predict(model, i, high, shifts[c], 1); predict(model, i, low, shifts[c], -1); for (let k = 0; k < K; k++) out[c * K + k] += wi * (high[k] - low[k]); }
  }
  return out.map((x) => (100 * x) / W);
}
// Le même contraste en log-ratios centrés (indépendant de l'unité).
const logRatioEffects = (model, contrasts) => contrasts.map((c) => {
  const e = [0, ...d3.range(J).map((j) => { let s = 0; for (let a = 0; a < model.q; a++) s += model.B[j * model.q + a] * c.delta[a]; return s; })], m = d3.mean(e);
  return e.map((x) => x - m);
});
const fullModel = (data, design, options = {}) => fit(data, { Z: design.Z, q: design.q, ...options });

// %% [javascript]
// Analyse principale : groupes de sections desservis par un même bureau de vote par anticipation ; vote du jour du scrutin
// et vote par anticipation additionnés, aux deux élections.
const data = buildDataset(buildUnits(byAdvancePoll, true));
const design = buildDesign(data, SCALARS);
const { n, Y, N } = data;

// Corrélations entre les variables des contrastes, à l'intérieur des circonscriptions, et facteurs d'inflation de la
// variance des covariables scalaires dans la matrice complète (diagonale de l'inverse de la matrice de corrélation).
const correlations = design.contrasts.map((a) => design.contrasts.map((b) => correlation(a.variable, b.variable)));
const varianceInflation = (() => {
  const covariates = design.columns.slice(design.nLag), R = covariates.map((a) => covariates.map((b) => correlation(a.v, b.v)));
  const inverse = core.linalg.inverse(R), at = (i, j) => (inverse.get ? inverse.get(i, j) : inverse[i][j]);
  return SCALARS.map((s) => { const i = covariates.findIndex((c) => c.name === s.key); return { key: s.key, vif: at(i, i) }; });
})();

// Modèles emboîtés. Vote de 2022 et covariables dans les deux ordres, pour borner la part de chacun.
const columnsSlice = (from, to) => { const q = to - from, S = new Float64Array(n * q); for (let i = 0; i < n; i++) for (let a = 0; a < q; a++) S[i * q + a] = design.Z[i * design.q + from + a]; return { Z: S, q }; };
const m0 = fit(data, { group: new Int32Array(n), nGroups: 1 });
const m1 = fit(data);
const m2 = fit(data, columnsSlice(0, design.nLag));
const m2b = fit(data, columnsSlice(design.nLag, design.q));
const m3 = fullModel(data, design);

// Bruit du dépouillement : déviance de comptes tirés au hasard (multinomiale) autour des probabilités du modèle complet.
// C'est la déviance qu'aucun modèle ne peut expliquer.
const noise = (() => {
  const random = generator(5), p = new Float64Array(K), simulated = new Float64Array(n * K), draws = [];
  for (let r = 0; r < 20; r++) {
    simulated.fill(0);
    for (let i = 0; i < n; i++) {
      predict(m3, i, p); for (let k = 1; k < K; k++) p[k] += p[k - 1];
      for (let v = 0; v < N[i]; v++) { const u = random() * p[K - 1]; let k = 0; while (k < K - 1 && p[k] < u) k++; simulated[i * K + k]++; }
    }
    draws.push(deviance(m3, simulated));
  }
  return { mean: d3.mean(draws), deviation: d3.deviation(draws) };
})();
const devianceTable = [["m0", m0], ["m1", m1], ["m2", m2], ["m2b", m2b], ["m3", m3]]
  .map(([model, m]) => ({ model, parameters: m.parameters, rounds: m.rounds, gradient: m.gradient, deviance: deviance(m) }));

// Surdispersion du modèle complet : khi-deux de Pearson par degré de liberté.
function pearsonResiduals(model) {
  const p = new Float64Array(K), R = new Float64Array(n * K);
  for (let i = 0; i < n; i++) { predict(model, i, p); for (let k = 0; k < K; k++) { const mu = N[i] * p[k]; R[i * K + k] = (Y[i * K + k] - mu) / Math.sqrt(mu * (1 - p[k])); } }
  return R;
}
const overdispersion = (() => { const p = new Float64Array(K); let chi2 = 0; for (let i = 0; i < n; i++) { predict(m3, i, p); for (let k = 0; k < K; k++) { const mu = N[i] * p[k]; chi2 += (Y[i * K + k] - mu) ** 2 / mu; } } return chi2 / (n * J - m3.parameters); })();

// Autocorrélation spatiale des résidus (I de Moran) entre unités voisines d'une même circonscription : graphe des k plus
// proches voisins, symétrisé. Test par permutation des résidus à l'intérieur des circonscriptions (199 permutations).
function neighbours(k) {
  const pairs = [];
  for (const members of data.byGroup.values()) {
    const seen = new Set();
    for (const i of members) {
      const nearest = d3.sort(members.filter((j) => j !== i), (j) => (data.units[j].x - data.units[i].x) ** 2 + (data.units[j].y - data.units[i].y) ** 2).slice(0, k);
      for (const j of nearest) { const id = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(id)) { seen.add(id); pairs.push([i, j]); } }
    }
  }
  return pairs;
}
function moran(model, name) {
  const R = pearsonResiduals(model), random = generator(17), rows = [];
  for (const k of [4, 6, 8]) {
    const pairs = neighbours(k);
    PARTIES.forEach((party, c) => {
      const r = data.center(d3.range(n).map((i) => R[i * K + c])), denominator = d3.sum(r, (x) => x * x);
      const index = (v) => (n / pairs.length) * d3.sum(pairs, ([i, j]) => v[i] * v[j]) / denominator;
      const I = index(r); let p = null;
      if (k === 6) {
        let atLeast = 0;
        for (let t = 0; t < 199; t++) {
          const v = Float64Array.from(r);
          for (const members of data.byGroup.values()) for (let a = members.length - 1; a > 0; a--) { const b = Math.floor(random() * (a + 1)), x = v[members[a]]; v[members[a]] = v[members[b]]; v[members[b]] = x; }
          if (index(v) >= I) atLeast++;
        }
        p = (1 + atLeast) / 200;
      }
      rows.push({ model: name, party, neighbours: k, I, p });
    });
  }
  return rows;
}
const spatialAutocorrelation = [...moran(m1, "m1"), ...moran(m2, "m2"), ...moran(m3, "m3")];

({ units: n, excluded: data.excluded, deviance: devianceTable.map((d) => `${d.model} : ${Math.round(d.deviance)} (${d.rounds} alternances)`), noise, overdispersion })

// %% [javascript]
// Effets du modèle complet et incertitude : bootstrap par circonscription (199 tirages de circonscriptions entières, avec
// remise), estimateur à deux alternances de Newton à partir du modèle complet. Intervalle à 95 % : centiles 2,5 et 97,5.
const pointEffects = effects(m3, design.contrasts);
const centredLogRatios = logRatioEffects(m3, design.contrasts);
const bootstrap = (() => {
  const random = generator(23), G = data.nGroups, draws = [];
  for (let b = 0; b < 199; b++) {
    const weights = new Float64Array(G); for (let g = 0; g < G; g++) weights[Math.floor(random() * G)]++;
    draws.push(effects(fullModel(data, design, { weights, start: m3, rounds: 2 }), design.contrasts, { weights }));
  }
  return draws;
})();
const effectsTable = design.contrasts.flatMap((c, a) => PARTIES.map((party, k) => {
  const t = bootstrap.map((b) => b[a * K + k]);
  return { contrast: c.key, party, points: pointEffects[a * K + k], low: d3.quantile(t, 0.025), high: d3.quantile(t, 0.975), logRatio: centredLogRatios[a][k] };
}));

// Profil et vote de 2026, sans le vote de 2022 : mêmes contrastes, modèle avec la circonscription et les covariables seulement
// (m2b). Ces effets décrivent qui vote pour qui en 2026 ; ceux du modèle complet, ce qui a changé depuis 2022.
const levelContrasts = design.contrasts.map((c) => ({ ...c, delta: c.delta.slice(design.nLag) }));
const levelPointEffects = effects(m2b, levelContrasts);
const levelBootstrap = (() => {
  const random = generator(29), G = data.nGroups, draws = [];
  for (let b = 0; b < 199; b++) {
    const weights = new Float64Array(G); for (let g = 0; g < G; g++) weights[Math.floor(random() * G)]++;
    draws.push(effects(fit(data, { Z: m2b.Z, q: m2b.q, weights, start: m2b, rounds: 2 }), levelContrasts, { weights }));
  }
  return draws;
})();
const levelEffectsTable = design.contrasts.flatMap((c, a) => PARTIES.map((party, k) => {
  const t = levelBootstrap.map((b) => b[a * K + k]);
  return { contrast: c.key, party, points: levelPointEffects[a * K + k], low: d3.quantile(t, 0.025), high: d3.quantile(t, 0.975) };
}));
// Part de chaque parti dans les votes de 2026 des groupes analysés, pour situer les effets.
const partyShares = Object.fromEntries(PARTIES.map((p, k) => [p, d3.sum(d3.range(n), (i) => Y[i * K + k]) / d3.sum(N)]));

// Ordination des effets en log-ratios (contrastes x partis) : décomposition en valeurs propres de E'E. Elle porte sur les
// cinq principaux partis, log-ratios recentrés entre eux : dans un log-ratio centré, une petite catégorie (les autres
// partis) pèse autant qu'une grande et dominerait les axes.
const ordination = (() => {
  const indices = MAIN_PARTIES.map((p) => PARTIES.indexOf(p)), D = indices.length;
  const E = centredLogRatios.map((r) => { const v = indices.map((k) => r[k]), m = d3.mean(v); return v.map((x) => x - m); });
  const S = d3.range(D).map((a) => d3.range(D).map((b) => d3.sum(E, (r) => r[a] * r[b])));
  const { values, vectors } = core.linalg.eig(S), total = d3.sum(values, (v) => Math.max(v, 0));
  const axis = (r) => { const v = d3.range(D).map((k) => vectors.get(k, r)), s = v[d3.maxIndex(v, Math.abs)] < 0 ? -1 : 1; return v.map((x) => s * x); };
  const axes = [axis(0), axis(1)];
  return { shares: [values[0] / total, values[1] / total], parties: MAIN_PARTIES.map((party, k) => ({ party, axis1: axes[0][k], axis2: axes[1][k] })),
    contrasts: design.contrasts.map((c, a) => ({ contrast: c.key, axis1: d3.sum(E[a], (x, k) => x * axes[0][k]), axis2: d3.sum(E[a], (x, k) => x * axes[1][k]) })) };
})();

// Robustesse : mêmes contrastes (mêmes déplacements) que l'analyse principale, effets comparés case par case.
const compare = (others) => ({ largestGap: d3.max(others, (x, r) => Math.abs(x - pointEffects[r])), correlation: correlation(Array.from(others), Array.from(pointEffects)), effects: Array.from(others) });
const variant = (candidates) => { const d = buildDataset(candidates); return { units: d.n, ...compare(effects(fullModel(d, buildDesign(d, SCALARS)), design.contrasts)) }; };
const robustness = (() => {
  // (1) Mêmes groupes, vote du jour du scrutin seulement : ce que change le vote par anticipation.
  const dayOnly = variant(buildUnits(byAdvancePoll, false));
  // (2) Bureaux de vote (section, ou sections dépouillées ensemble), vote du jour du scrutin seulement : l'unité la plus fine.
  const offices = variant(buildUnits(byOffice, false));
  // (3) Groupes au découpage stable entre 2022 et 2026 (stabilité moyenne d'au moins 0,9 : le vote de 2022 y est presque mesuré).
  const mask = Uint8Array.from(data.units, (u) => (u.stability >= 0.9 ? 1 : 0));
  const stable = { units: d3.sum(mask), ...compare(effects(fullModel(data, design, { mask }), design.contrasts, { mask })) };
  // (4) Scolarité en rangs à intervalles égaux plutôt qu'en années d'études (contraste propre à la variante).
  const rankDesign = buildDesign(data, SCALARS.map((s) => (s.key === "mean_schooling" ? { ...s, value: (u) => classMean(u, SCHOOLING_RANKS) } : s)));
  const schoolingRanks = compare(effects(fullModel(data, rankDesign), rankDesign.contrasts));
  return { dayOnly, offices, stable, schoolingRanks };
})();

({ rounds: m3.rounds, gradient: m3.gradient, largestGaps: Object.fromEntries(Object.entries(robustness).map(([k, v]) => [k, v.largestGap])) })

// %% [javascript]
// Résultats lus par le billet.
const voteTotals = { day2026: d3.sum(sections, (s) => d3.sum(s.day2026)), advance2026: d3.sum(sections, (s) => d3.sum(s.advance2026)) };
const results = {
  generated: new Date().toISOString(), parties: PARTIES,
  units: { count: n, excluded: data.excluded, sections: d3.sum(data.units, (u) => u.sections), ridings: data.nGroups, votes: d3.sum(N), ...voteTotals },
  contrasts: design.contrasts.map((c) => ({ key: c.key, block: c.block, label: c.label, unit: c.unit, percent: c.percent, median: c.median, oneSdAbove: c.oneSdAbove })),
  correlations, varianceInflation, deviance: devianceTable, noise, overdispersion, spatialAutocorrelation,
  effects: effectsTable, levelEffects: levelEffectsTable, partyShares, ordination, robustness,
};
typeof document === "undefined" ? results : (() => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(results)], { type: "application/json" }));
  link.download = "precomputed.json"; link.textContent = "Télécharger precomputed.json";
  return link;
})()

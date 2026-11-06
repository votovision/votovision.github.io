// ---
// title: Québec : profil des sections de vote et vote de 2026, calculs
// id: vote-correlations-calculs
// date: 2026-11-06
// ---

// %% [markdown]
// Calculs du billet sur le profil des sections de vote et le vote de 2026 : unités, covariables, régression multinomiale, bruit du dépouillement, autocorrélation spatiale, effets et bootstrap, analyses de robustesse. La dernière cellule rassemble les résultats ; dans un navigateur, elle propose de télécharger `precalculs.json`, lu par le billet. Hors navigateur : `node scripts/executer-calculs.mjs` dans le dépôt du site.

// %% [javascript]
// Paquets et données.
const d3 = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
const { mva, core } = await import("https://cdn.jsdelivr.net/npm/@tangent.to/ds@0.16/+esm");
const { ilr } = mva.composition;

// Recensement de 2021 interpolé sur les sections de vote de 2026 (votovision/data : sources/recensement_sections_qc.ts).
const URL_RECENSEMENT = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_vote-correlations/recensement_sections_2026.csv";
// Votes du jour du scrutin par section de 2026 : 2026 mesuré, 2022 transposé (sources/transposition_sections_qc.ts).
const URL_VOTES = "https://raw.githubusercontent.com/votovision/votovision.github.io/refs/heads/main/posts/data/2026-11_migration-sections/sections_2022_2026.csv";
const recensement = await d3.csv(URL_RECENSEMENT, d3.autoType);
const votes = await d3.csv(URL_VOTES, d3.autoType);

// Partis ; le premier sert de référence dans la régression multinomiale.
const PARTIS = ["PQ", "LIB", "CAQ", "QS", "PCQ", "AUTRES"];
const PRINCIPAUX = ["PQ", "LIB", "CAQ", "QS", "PCQ"];
const K = PARTIS.length, J = K - 1;

// Unité d'analyse : le bureau de vote, c'est-à-dire la section, ou les sections dépouillées ensemble
// (bureau de regroupement). Les comptes du recensement et les votes des sections d'un bureau sont additionnés.
const NON_ADDITIVES = new Set(["cep", "sv", "nom", "x", "y", "n_aires", "taille_moyenne_menages", "revenu_median_menages_apres_impot", "faible_revenu_mfr_api_pct"]);
const colonnesAdditives = Object.keys(recensement[0]).filter((k) => !NON_ADDITIVES.has(k));
const recensementParSection = new Map(recensement.map((r) => [`${r.cep}-${r.sv}`, r]));
const bureaux = d3.groups(votes.filter((v) => v.bureau !== null && v["2026_valides"] > 0), (v) => `${v.circonscription}-${v.bureau}`).map(([, sections]) => {
  const rec = sections.map((s) => recensementParSection.get(`${s.circonscription}-${s.sv}`));
  const u = { cep: sections[0].circonscription, bureau: sections[0].bureau, sections: sections.length };
  for (const k of colonnesAdditives) u[k] = d3.sum(rec, (r) => r[k] ?? 0);
  // Taux de faible revenu : moyenne pondérée par la population des sections où il est publié.
  const avecTaux = rec.filter((r) => r.faible_revenu_mfr_api_pct !== null);
  u.faible_revenu_pct = avecTaux.length ? d3.sum(avecTaux, (r) => r.population * r.faible_revenu_mfr_api_pct) / d3.sum(avecTaux, (r) => r.population) : null;
  const e = d3.sum(rec, (r) => r.electeurs ?? 0);
  u.x = d3.sum(rec, (r) => (r.electeurs ?? 0) * r.x) / e; u.y = d3.sum(rec, (r) => (r.electeurs ?? 0) * r.y) / e;
  u.votes2026 = PARTIS.map((p) => d3.sum(sections, (s) => s[`2026_${p}`] ?? 0));
  u.votes2022 = PRINCIPAUX.map((p) => d3.sum(sections, (s) => s[`2022_${p}`] ?? 0));
  u.valides2022 = d3.sum(sections, (s) => s["2022_valides"] ?? 0);
  u.stabilite = d3.min(sections, (s) => s.stabilite ?? 0);
  return u;
});

({ sections: votes.length, bureaux: bureaux.length })

// %% [javascript]
// Covariables. Une classe ordonnée est résumée par sa moyenne en unités réelles (âge, années d'études) ; un taux entre
// en logit, une grandeur positive en log ; une variable nominale à plus de deux catégories reste une composition, en
// coordonnées ilr (tangent/ds). Rien n'est modélisé en pourcentage.

// Âge : centre de chaque classe de cinq ans (102 ans pour les 100 ans et plus).
const AGE = [["age_20_24", 22.5], ["age_25_29", 27.5], ["age_30_34", 32.5], ["age_35_39", 37.5], ["age_40_44", 42.5], ["age_45_49", 47.5],
  ["age_50_54", 52.5], ["age_55_59", 57.5], ["age_60_64", 62.5], ["age_65_69", 67.5], ["age_70_74", 72.5], ["age_75_79", 77.5], ["age_80_84", 82.5],
  ["age_85_89", 87.5], ["age_90_94", 92.5], ["age_95_99", 97.5], ["age_100_plus", 102]];
// Scolarité : années d'études associées au plus haut diplôme (parcours québécois : secondaire 11 ans, cégep 2 ou 3 ans).
const SCOLARITE = [["scol_aucun", 9], ["scol_secondaire", 11], ["scol_ecole_metiers", 12], ["scol_apprenti", 12], ["scol_college_cegep", 13.5],
  ["scol_universitaire_inferieur_baccalaureat", 14], ["scol_baccalaureat", 16], ["scol_universitaire_superieur_baccalaureat", 17],
  ["scol_medecine", 18], ["scol_maitrise", 18], ["scol_doctorat", 21]];
// Variante pour l'analyse de robustesse : rangs des niveaux, à intervalles égaux.
const SCOLARITE_RANGS = [["scol_aucun", 1], ["scol_secondaire", 2], ["scol_ecole_metiers", 3], ["scol_apprenti", 3], ["scol_college_cegep", 4],
  ["scol_universitaire_inferieur_baccalaureat", 5], ["scol_baccalaureat", 6], ["scol_universitaire_superieur_baccalaureat", 7],
  ["scol_medecine", 8], ["scol_maitrise", 8], ["scol_doctorat", 9]];
const moyenneDesClasses = (u, classes) => d3.sum(classes, ([k, c]) => u[k] * c) / d3.sum(classes, ([k]) => u[k]);
// Taux d'un compte sur un total, avec un demi-compte de chaque côté pour éviter 0 et 1.
const taux = (compte, total) => (compte + 0.5) / (total + 1);

const TRANSFORMATIONS = {
  identite: { vers: (v) => v, retour: (t) => t },
  log: { vers: Math.log, retour: Math.exp },
  logit: { vers: (p) => Math.log(p / (1 - p)), retour: (t) => 1 / (1 + Math.exp(-t)) },
};
// `pourcent` : la valeur est une proportion, affichée en pourcentage.
const SCALAIRES = [
  { cle: "age_moyen", libelle: "Âge moyen des 20 ans et plus", unite: "ans", transformation: "identite", valeur: (u) => moyenneDesClasses(u, AGE) },
  { cle: "scolarite_moyenne", libelle: "Scolarité moyenne des 25-64 ans", unite: "années d'études", transformation: "identite", valeur: (u) => moyenneDesClasses(u, SCOLARITE) },
  { cle: "faible_revenu", libelle: "Personnes à faible revenu (mesure de faible revenu après impôt)", unite: "% de la population", pourcent: true, transformation: "logit",
    valeur: (u) => (u.faible_revenu_pct === null ? NaN : (u.faible_revenu_pct + 0.5) / 101) },
  { cle: "taille_menages", libelle: "Taille moyenne des ménages", unite: "personnes", transformation: "log", valeur: (u) => u.personnes_menages_prives / u.menages_total },
  { cle: "locataires", libelle: "Ménages locataires", unite: "% des ménages", pourcent: true, transformation: "logit", valeur: (u) => taux(u.locataires, u.occupation_total) },
  { cle: "immigrants", libelle: "Immigrants", unite: "% de la population", pourcent: true, transformation: "logit", valeur: (u) => taux(u.immigrants, u.immigration_total) },
  { cle: "minorites_visibles", libelle: "Personnes des minorités visibles", unite: "% de la population", pourcent: true, transformation: "logit", valeur: (u) => taux(u.minorites_visibles, u.minorites_visibles_total) },
  { cle: "autochtones", libelle: "Personnes d'identité autochtone", unite: "% de la population", pourcent: true, transformation: "logit", valeur: (u) => taux(u.autochtone, u.autochtone_total) },
  { cle: "demenagement", libelle: "Personnes ayant déménagé depuis cinq ans", unite: "% de la population de 5 ans et plus", pourcent: true, transformation: "logit", valeur: (u) => taux(u.demenage_5_ans, u.mobilite_5_ans_total) },
  { cle: "activite", libelle: "Taux d'activité", unite: "% des 15 ans et plus", pourcent: true, transformation: "logit", valeur: (u) => taux(u.population_active, u.activite_total) },
  { cle: "chomage", libelle: "Taux de chômage", unite: "% de la population active", pourcent: true, transformation: "logit", valeur: (u) => taux(u.chomeurs, u.population_active) },
  { cle: "densite_population", libelle: "Densité de la population", unite: "habitants par km²", transformation: "log", valeur: (u) => u.population / u.superficie_km2 },
];
// Variables nominales : comptes par catégorie.
const NOMINALES = [
  { cle: "langue", unite: "% des personnes ayant une seule langue maternelle", parties: [
    { cle: "langue_francais", libelle: "Personnes de langue maternelle française", compte: (u) => u.langue_maternelle_francais },
    { cle: "langue_anglais", libelle: "Personnes de langue maternelle anglaise", compte: (u) => u.langue_maternelle_anglais },
    { cle: "langue_autre", libelle: "Personnes d'une autre langue maternelle", compte: (u) => u.langue_maternelle_non_officielle },
  ] },
  { cle: "religion", unite: "% de la population", parties: [
    { cle: "religion_catholique", libelle: "Catholiques", compte: (u) => u.catholique },
    { cle: "religion_aucune", libelle: "Personnes sans religion", compte: (u) => u.aucune_religion },
    { cle: "religion_autre", libelle: "Personnes d'une autre religion", compte: (u) => Math.max(u.religion_total - u.catholique - u.aucune_religion, 0) },
  ] },
  { cle: "navette", unite: "% des travailleurs qui se déplacent", parties: [
    { cle: "navette_automobile", libelle: "Navette en automobile", compte: (u) => u.navette_auto },
    { cle: "navette_transport_commun", libelle: "Navette en transport en commun", compte: (u) => u.navette_transport_commun },
    { cle: "navette_marche_velo", libelle: "Navette à pied ou à vélo", compte: (u) => u.navette_marche + u.navette_velo },
    { cle: "navette_autre", libelle: "Navette par un autre moyen", compte: (u) => u.navette_autre },
  ] },
  { cle: "profession", unite: "% de la population active ayant une profession", parties: [
    { cle: "prof_cadres", libelle: "Profession : cadres supérieurs", compte: (u) => u.prof_0_cadres_superieurs },
    { cle: "prof_affaires", libelle: "Profession : affaires, finance et administration", compte: (u) => u.prof_1_affaires_finance_admin },
    { cle: "prof_sciences", libelle: "Profession : sciences naturelles et appliquées", compte: (u) => u.prof_2_sciences },
    { cle: "prof_sante", libelle: "Profession : secteur de la santé", compte: (u) => u.prof_3_sante },
    { cle: "prof_enseignement", libelle: "Profession : enseignement, droit et services sociaux", compte: (u) => u.prof_4_enseignement_droit_social },
    { cle: "prof_arts", libelle: "Profession : arts, culture, sports et loisirs", compte: (u) => u.prof_5_arts_culture },
    { cle: "prof_vente", libelle: "Profession : vente et services", compte: (u) => u.prof_6_vente_services },
    { cle: "prof_metiers", libelle: "Profession : métiers, transport et machinerie", compte: (u) => u.prof_7_metiers_transport },
    { cle: "prof_ressources", libelle: "Profession : ressources naturelles et agriculture", compte: (u) => u.prof_8_ressources_naturelles },
    { cle: "prof_fabrication", libelle: "Profession : fabrication et services d'utilité publique", compte: (u) => u.prof_9_fabrication },
  ] },
];

// Unités retenues : au moins 100 habitants, votes valides aux deux élections, toutes covariables calculables.
const calculable = (u) => SCALAIRES.every((s) => Number.isFinite(TRANSFORMATIONS[s.transformation].vers(s.valeur(u))))
  && NOMINALES.every((b) => d3.sum(b.parties, (p) => p.compte(u)) > 0);
const unites = bureaux.filter((u) => u.population >= 100 && u.valides2022 > 0 && calculable(u));
const n = unites.length;
const circonscriptions = [...new Set(unites.map((u) => u.cep))];
const rangCirconscription = new Map(circonscriptions.map((c, k) => [c, k]));
const groupeCirconscription = Int32Array.from(unites, (u) => rangCirconscription.get(u.cep));
const unitesParCirconscription = d3.group(d3.range(n), (i) => groupeCirconscription[i]);
const Y = new Float64Array(n * K), N = new Float64Array(n);
unites.forEach((u, i) => u.votes2026.forEach((v, k) => { Y[i * K + k] = Math.round(v); N[i] += Math.round(v); }));

// Centrage d'une variable par circonscription (moyenne pondérée par les votes) : l'effet fixe de circonscription du modèle.
function centrer(v) {
  const s = new Float64Array(circonscriptions.length), w = new Float64Array(circonscriptions.length);
  v.forEach((x, i) => { s[groupeCirconscription[i]] += N[i] * x; w[groupeCirconscription[i]] += N[i]; });
  return v.map((x, i) => x - s[groupeCirconscription[i]] / w[groupeCirconscription[i]]);
}
const ecartInterdecile = (v) => d3.quantile(v, 0.9) - d3.quantile(v, 0.1);

// Matrice du modèle et contrastes. Colonnes : 4 coordonnées ilr du vote de 2022 des cinq principaux partis, une colonne par
// covariable scalaire (transformée), D - 1 coordonnées ilr par variable nominale ; toutes centrées par circonscription.
// Un contraste est un déplacement dans cet espace : pour une covariable scalaire, son écart interdécile à l'intérieur des
// circonscriptions ; pour une catégorie d'une variable nominale, l'écart interdécile du logit de sa part, les autres
// catégories gardant leurs proportions entre elles (perturbation compositionnelle).
function construire(scalaires) {
  const colonnes = [], contrastes = [];
  const ajouter = (nom, v) => colonnes.push({ nom, v: centrer(v) });
  const lag = ilr(unites.map((u) => u.votes2022.map((x) => x + 0.5)));
  for (let a = 0; a < PRINCIPAUX.length - 1; a++) ajouter(`vote2022_${a + 1}`, lag.map((r) => r[a]));
  const nLag = colonnes.length;
  for (const s of scalaires) {
    const T = TRANSFORMATIONS[s.transformation], brut = unites.map((u) => s.valeur(u)), t = brut.map(T.vers);
    const position = colonnes.length; ajouter(s.cle, t);
    const ecart = ecartInterdecile(colonnes[position].v), centre = T.vers(d3.median(brut));
    contrastes.push({ cle: s.cle, bloc: null, libelle: s.libelle, unite: s.unite, pourcent: !!s.pourcent, transformation: s.transformation,
      mediane: d3.median(brut), bas: T.retour(centre - ecart / 2), haut: T.retour(centre + ecart / 2), deplacement: [[position, ecart]], variable: colonnes[position].v });
  }
  for (const b of NOMINALES) {
    const D = b.parties.length, comptes = unites.map((u) => b.parties.map((p) => p.compte(u) + 0.5));
    const coordonnees = ilr(comptes), position = colonnes.length;
    for (let a = 0; a < D - 1; a++) ajouter(`${b.cle}_${a + 1}`, coordonnees.map((r) => r[a]));
    b.parties.forEach((p, k) => {
      const part = comptes.map((r) => r[k] / d3.sum(r)), logit = centrer(part.map(TRANSFORMATIONS.logit.vers));
      const ecart = ecartInterdecile(logit), centre = TRANSFORMATIONS.logit.vers(d3.median(part));
      // Déplacement ilr d'une perturbation qui multiplie la catégorie k par exp(ecart).
      const direction = ilr([b.parties.map((_, m) => (m === k ? Math.exp(ecart) : 1))])[0];
      contrastes.push({ cle: p.cle, bloc: b.cle, libelle: p.libelle, unite: b.unite, pourcent: true, transformation: "logit",
        mediane: d3.median(part), bas: TRANSFORMATIONS.logit.retour(centre - ecart / 2), haut: TRANSFORMATIONS.logit.retour(centre + ecart / 2),
        deplacement: direction.map((d, a) => [position + a, d]), variable: logit });
    });
  }
  const q = colonnes.length, Z = new Float64Array(n * q);
  colonnes.forEach((c, a) => c.v.forEach((x, i) => (Z[i * q + a] = x)));
  for (const c of contrastes) { c.delta = new Float64Array(q); for (const [a, d] of c.deplacement) c.delta[a] = d; }
  return { colonnes, contrastes, q, Z, nLag };
}
const plan = construire(SCALAIRES);

// Corrélations entre les variables des contrastes, à l'intérieur des circonscriptions, et facteurs d'inflation de la
// variance des covariables scalaires dans la matrice complète (diagonale de l'inverse de la matrice de corrélation).
function correlation(a, b) { const ma = d3.mean(a), mb = d3.mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); }
const correlations = plan.contrastes.map((a) => plan.contrastes.map((b) => correlation(a.variable, b.variable)));
const inflation = (() => {
  const cov = plan.colonnes.slice(plan.nLag), R = cov.map((a) => cov.map((b) => correlation(a.v, b.v)));
  const inverse = core.linalg.inverse(R), valeur = (i, j) => (inverse.get ? inverse.get(i, j) : inverse[i][j]);
  return SCALAIRES.map((s) => { const i = cov.findIndex((c) => c.nom === s.cle); return { cle: s.cle, vif: valeur(i, i) }; });
})();

({ unites: n, exclus: bureaux.length - n, circonscriptions: circonscriptions.length, colonnes: plan.q, contrastes: plan.contrastes.length })

// %% [javascript]
// Régression multinomiale sur les comptes de votes : log(p_j / p_PQ) = alpha[groupe, j] + z · beta_j.
// Maximum de vraisemblance par Newton en blocs alternés : intercepts de chaque groupe (5 x 5), puis coefficients communs.
function resoudre(H, g, m) { // Cholesky de H (m x m, symétrique définie positive), résout H d = g ; H est modifiée.
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
// groupe : indice du groupe de chaque unité ; Z : matrice n x q ; poids : multiplicité de chaque groupe (bootstrap) ;
// masque : unités retenues ; depart : modèle de départ ; tours : nombre maximal d'alternances.
function ajuster({ groupe, nGroupes, Z = null, q = 0, poids = null, masque = null, depart = null, tours = 100, tolerance = 1e-10 }) {
  const A = depart ? Float64Array.from(depart.A) : new Float64Array(nGroupes * J), B = depart && q ? Float64Array.from(depart.B) : new Float64Array(J * q);
  const w = (i) => (masque && !masque[i] ? 0 : poids ? poids[groupe[i]] : 1), p = new Float64Array(K);
  const probabilites = (i, coef = B) => {
    let mx = 0;
    for (let j = 0; j < J; j++) { let e = A[groupe[i] * J + j]; for (let a = 0; a < q; a++) e += Z[i * q + a] * coef[j * q + a]; p[j + 1] = e; if (e > mx) mx = e; }
    let s = (p[0] = Math.exp(-mx)); for (let k = 1; k < K; k++) s += (p[k] = Math.exp(p[k] - mx));
    for (let k = 0; k < K; k++) p[k] /= s;
  };
  const logVraisemblance = (coef = B) => { let l = 0; for (let i = 0; i < n; i++) { const wi = w(i); if (!wi) continue; probabilites(i, coef); for (let k = 0; k < K; k++) if (Y[i * K + k]) l += wi * Y[i * K + k] * Math.log(p[k]); } return l; };
  if (!depart) { // Départ : log des rapports de votes de chaque groupe (solution exacte sans covariables).
    const s = new Float64Array(nGroupes * K);
    for (let i = 0; i < n; i++) if (w(i)) for (let k = 0; k < K; k++) s[groupe[i] * K + k] += Y[i * K + k];
    for (let c = 0; c < nGroupes; c++) for (let j = 0; j < J; j++) A[c * J + j] = Math.log((s[c * K + j + 1] + 0.5) / (s[c * K] + 0.5));
  }
  function pasIntercepts() {
    const g = new Float64Array(nGroupes * J), H = new Float64Array(nGroupes * J * J);
    for (let i = 0; i < n; i++) {
      if (!w(i)) continue; probabilites(i); const c = groupe[i];
      for (let j = 0; j < J; j++) {
        g[c * J + j] += Y[i * K + j + 1] - N[i] * p[j + 1];
        for (let k = 0; k < J; k++) H[c * J * J + j * J + k] += N[i] * ((j === k ? p[j + 1] : 0) - p[j + 1] * p[k + 1]);
      }
    }
    let gmax = 0;
    for (let c = 0; c < nGroupes; c++) {
      const gc = g.subarray(c * J, (c + 1) * J), Hc = H.slice(c * J * J, (c + 1) * J * J);
      if (!Hc.some((x) => x)) continue;
      for (let j = 0; j < J; j++) { Hc[j * J + j] += 1e-8; gmax = Math.max(gmax, Math.abs(gc[j])); }
      resoudre(Hc, gc, J).forEach((d, j) => (A[c * J + j] += Math.max(-3, Math.min(3, d))));
    }
    return gmax;
  }
  function pasCoefficients(lAvant) {
    const m = J * q, g = new Float64Array(m), H = new Float64Array(m * m);
    for (let i = 0; i < n; i++) {
      const wi = w(i); if (!wi) continue; probabilites(i);
      for (let j = 0; j < J; j++) {
        const r = wi * (Y[i * K + j + 1] - N[i] * p[j + 1]);
        for (let a = 0; a < q; a++) g[j * q + a] += r * Z[i * q + a];
        for (let k = 0; k <= j; k++) {
          const v = wi * N[i] * ((j === k ? p[j + 1] : 0) - p[j + 1] * p[k + 1]);
          for (let a = 0; a < q; a++) { const za = v * Z[i * q + a], ligne = (j * q + a) * m + k * q; for (let b = 0; b < q; b++) H[ligne + b] += za * Z[i * q + b]; }
        }
      }
    }
    for (let r = 0; r < m; r++) for (let c = r + 1; c < m; c++) H[r * m + c] = H[c * m + r];
    let gmax = 0; for (let r = 0; r < m; r++) { gmax = Math.max(gmax, Math.abs(g[r])); H[r * m + r] *= 1 + 1e-10; }
    const d = resoudre(H, g, m);
    // Recherche linéaire : le pas est réduit de moitié tant que la vraisemblance ne monte pas.
    for (let pas = 1; pas > 1e-4; pas /= 2) {
      const essai = B.map((b, r) => b + pas * d[r]);
      if (logVraisemblance(essai) >= lAvant) { B.set(essai); break; }
    }
    return gmax;
  }
  let l = logVraisemblance(), gradient = Infinity, t = 0;
  for (; t < tours; t++) {
    let gA = pasIntercepts(); gA = pasIntercepts();
    const gB = q ? pasCoefficients(logVraisemblance()) : 0;
    const l2 = logVraisemblance(); gradient = Math.max(gA, gB);
    const gain = l2 - l; l = l2;
    if (gain < tolerance * Math.abs(l)) break;
  }
  return { A, B, q, Z, groupe, logVraisemblance: l, tours: t + 1, gradient, parametres: nGroupes * J + J * q };
}
// Probabilités prédites de l'unité i (K valeurs), avec un déplacement optionnel du prédicteur linéaire.
function predire(mod, i, sortie, deplacement = null, signe = 0) {
  let mx = 0;
  for (let j = 0; j < J; j++) {
    let e = mod.A[mod.groupe[i] * J + j]; for (let a = 0; a < mod.q; a++) e += mod.Z[i * mod.q + a] * mod.B[j * mod.q + a];
    if (deplacement) e += signe * deplacement[j];
    sortie[j + 1] = e; if (e > mx) mx = e;
  }
  let s = (sortie[0] = Math.exp(-mx)); for (let k = 1; k < K; k++) s += (sortie[k] = Math.exp(sortie[k] - mx));
  for (let k = 0; k < K; k++) sortie[k] /= s;
  return sortie;
}
// Déviance : 2 Σ y log(y / (N p)) ; nulle pour un modèle qui reproduit chaque compte.
function deviance(mod, comptes = Y) {
  const p = new Float64Array(K); let dev = 0;
  for (let i = 0; i < n; i++) { predire(mod, i, p); for (let k = 0; k < K; k++) { const y = comptes[i * K + k]; if (y) dev += 2 * y * Math.log(y / (N[i] * p[k])); } }
  return dev;
}

// Modèles emboîtés.
const unSeulGroupe = new Int32Array(n);
const sousMatrice = (q) => { const S = new Float64Array(n * q); for (let i = 0; i < n; i++) for (let a = 0; a < q; a++) S[i * q + a] = plan.Z[i * plan.q + a]; return S; };
const m0 = ajuster({ groupe: unSeulGroupe, nGroupes: 1 });
const m1 = ajuster({ groupe: groupeCirconscription, nGroupes: circonscriptions.length });
const m2 = ajuster({ groupe: groupeCirconscription, nGroupes: circonscriptions.length, Z: sousMatrice(plan.nLag), q: plan.nLag });
const m3 = ajuster({ groupe: groupeCirconscription, nGroupes: circonscriptions.length, Z: plan.Z, q: plan.q });
// Vote de 2022 et covariables dans l'autre ordre, pour borner la part de chacun.
const m2b = (() => { const q = plan.q - plan.nLag, S = new Float64Array(n * q); for (let i = 0; i < n; i++) for (let a = 0; a < q; a++) S[i * q + a] = plan.Z[i * plan.q + plan.nLag + a];
  return ajuster({ groupe: groupeCirconscription, nGroupes: circonscriptions.length, Z: S, q }); })();

// Bruit du dépouillement : déviance de comptes tirés au hasard (multinomiale) autour des probabilités du modèle complet.
// C'est la déviance qu'aucun modèle ne peut expliquer.
function generateur(graine) { let s = graine >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const bruit = (() => {
  const alea = generateur(5), p = new Float64Array(K), sim = new Float64Array(n * K), tirages = [];
  for (let r = 0; r < 20; r++) {
    sim.fill(0);
    for (let i = 0; i < n; i++) {
      predire(m3, i, p); for (let k = 1; k < K; k++) p[k] += p[k - 1];
      for (let v = 0; v < N[i]; v++) { const u = alea() * p[K - 1]; let k = 0; while (k < K - 1 && p[k] < u) k++; sim[i * K + k]++; }
    }
    tirages.push(deviance(m3, sim));
  }
  return { moyenne: d3.mean(tirages), ecartType: d3.deviation(tirages) };
})();
const devianceModeles = [
  { modele: "m0", libelle: "Province seulement", ...m0 }, { modele: "m1", libelle: "Circonscription", ...m1 },
  { modele: "m2", libelle: "Circonscription et vote de 2022", ...m2 }, { modele: "m2b", libelle: "Circonscription et covariables", ...m2b },
  { modele: "m3", libelle: "Circonscription, vote de 2022 et covariables", ...m3 },
].map((m) => ({ modele: m.modele, libelle: m.libelle, parametres: m.parametres, tours: m.tours, gradient: m.gradient, deviance: deviance(m) }));

// Surdispersion du modèle complet : khi-deux de Pearson par degré de liberté.
function residusPearson(mod) {
  const p = new Float64Array(K), R = new Float64Array(n * K);
  for (let i = 0; i < n; i++) { predire(mod, i, p); for (let k = 0; k < K; k++) { const mu = N[i] * p[k]; R[i * K + k] = (Y[i * K + k] - mu) / Math.sqrt(mu * (1 - p[k])); } }
  return R;
}
const surdispersion = (() => { const p = new Float64Array(K); let chi2 = 0; for (let i = 0; i < n; i++) { predire(m3, i, p); for (let k = 0; k < K; k++) { const mu = N[i] * p[k]; chi2 += (Y[i * K + k] - mu) ** 2 / mu; } } return chi2 / (n * J - m3.parametres); })();

// Autocorrélation spatiale des résidus (I de Moran) entre bureaux voisins d'une même circonscription : graphe des k plus
// proches voisins, symétrisé. Test par permutation des résidus à l'intérieur des circonscriptions (199 permutations).
function voisinage(k) {
  const paires = [];
  for (const idx of unitesParCirconscription.values()) {
    const vus = new Set();
    for (const i of idx) {
      const proches = d3.sort(idx.filter((j) => j !== i), (j) => (unites[j].x - unites[i].x) ** 2 + (unites[j].y - unites[i].y) ** 2).slice(0, k);
      for (const j of proches) { const c = i < j ? `${i}-${j}` : `${j}-${i}`; if (!vus.has(c)) { vus.add(c); paires.push([i, j]); } }
    }
  }
  return paires;
}
function moran(mod, modele) {
  const R = residusPearson(mod), alea = generateur(17), lignes = [];
  for (const k of [4, 6, 8]) {
    const paires = voisinage(k);
    PARTIS.forEach((parti, c) => {
      const r = centrer(d3.range(n).map((i) => R[i * K + c])), denominateur = d3.sum(r, (x) => x * x);
      const indice = (v) => (n / (2 * paires.length)) * (2 * d3.sum(paires, ([i, j]) => v[i] * v[j])) / denominateur;
      const I = indice(r); let p = null;
      if (k === 6) {
        let auMoins = 0;
        for (let t = 0; t < 199; t++) {
          const v = Float64Array.from(r);
          for (const idx of unitesParCirconscription.values()) for (let a = idx.length - 1; a > 0; a--) { const b = Math.floor(alea() * (a + 1)), x = v[idx[a]]; v[idx[a]] = v[idx[b]]; v[idx[b]] = x; }
          if (indice(v) >= I) auMoins++;
        }
        p = (1 + auMoins) / 200;
      }
      lignes.push({ modele, parti, voisins: k, I, p });
    });
  }
  return lignes;
}
const autocorrelation = [...moran(m1, "m1"), ...moran(m2, "m2"), ...moran(m3, "m3")];

({ deviance: devianceModeles.map((d) => `${d.libelle} : ${Math.round(d.deviance)} (${d.tours} tours)`), bruit, surdispersion })

// %% [javascript]
// Effets. Pour chaque contraste, le prédicteur linéaire de chaque unité est déplacé de moitié vers le bas et de moitié vers
// le haut ; l'effet est l'écart moyen des parts prédites, pondéré par les votes, en points de pourcentage. Le même contraste
// en log-ratios centrés (indépendant de l'unité) sert à l'ordination.
function effets(mod, contrastes, { poids = null, masque = null } = {}) {
  const C = contrastes.length, sortie = new Float64Array(C * K), haut = new Float64Array(K), bas = new Float64Array(K);
  const deplacements = contrastes.map((c) => Float64Array.from({ length: J }, (_, j) => { let s = 0; for (let a = 0; a < mod.q; a++) s += mod.B[j * mod.q + a] * c.delta[a]; return s / 2; }));
  let W = 0;
  for (let i = 0; i < n; i++) {
    const wi = (masque && !masque[i] ? 0 : poids ? poids[mod.groupe[i]] : 1) * N[i]; if (!wi) continue; W += wi;
    for (let c = 0; c < C; c++) { predire(mod, i, haut, deplacements[c], 1); predire(mod, i, bas, deplacements[c], -1); for (let k = 0; k < K; k++) sortie[c * K + k] += wi * (haut[k] - bas[k]); }
  }
  return sortie.map((x) => (100 * x) / W);
}
const effetsPoints = effets(m3, plan.contrastes);
const effetsLogRatios = plan.contrastes.map((c) => {
  const e = [0, ...d3.range(J).map((j) => { let s = 0; for (let a = 0; a < plan.q; a++) s += m3.B[j * plan.q + a] * c.delta[a]; return s; })], m = d3.mean(e);
  return e.map((x) => x - m);
});

// Incertitude : bootstrap par circonscription (199 tirages de circonscriptions entières, avec remise), estimateur à deux
// alternances de Newton à partir du modèle complet. Intervalle à 95 % : centiles 2,5 et 97,5.
const bootstrap = (() => {
  const alea = generateur(23), G = circonscriptions.length, tirages = [];
  for (let b = 0; b < 199; b++) {
    const poids = new Float64Array(G); for (let g = 0; g < G; g++) poids[Math.floor(alea() * G)]++;
    const mod = ajuster({ groupe: groupeCirconscription, nGroupes: G, Z: plan.Z, q: plan.q, poids, depart: m3, tours: 2 });
    tirages.push(effets(mod, plan.contrastes, { poids }));
  }
  return tirages;
})();
const tableEffets = plan.contrastes.flatMap((c, a) => PARTIS.map((parti, k) => {
  const t = bootstrap.map((b) => b[a * K + k]);
  return { contraste: c.cle, parti, points: effetsPoints[a * K + k], bas: d3.quantile(t, 0.025), haut: d3.quantile(t, 0.975), logRatio: effetsLogRatios[a][k] };
}));

// Ordination des effets en log-ratios (contrastes x partis) : décomposition en valeurs propres de E'E. Elle porte sur les
// cinq principaux partis, log-ratios recentrés entre eux : dans un log-ratio centré, une petite catégorie (les autres
// partis, 0,3 % des votes) pèse autant qu'une grande et dominerait les axes.
const ordination = (() => {
  const indices = PRINCIPAUX.map((p) => PARTIS.indexOf(p)), D = indices.length;
  const E = effetsLogRatios.map((r) => { const v = indices.map((k) => r[k]), m = d3.mean(v); return v.map((x) => x - m); });
  const S = d3.range(D).map((a) => d3.range(D).map((b) => d3.sum(E, (r) => r[a] * r[b])));
  const { values, vectors } = core.linalg.eig(S), total = d3.sum(values, (v) => Math.max(v, 0));
  const axe = (r) => { const v = d3.range(D).map((k) => vectors.get(k, r)), s = v[d3.maxIndex(v, Math.abs)] < 0 ? -1 : 1; return v.map((x) => s * x); };
  const axes = [axe(0), axe(1)];
  return { parts: [values[0] / total, values[1] / total], partis: PRINCIPAUX.map((parti, k) => ({ parti, axe1: axes[0][k], axe2: axes[1][k] })),
    contrastes: plan.contrastes.map((c, a) => ({ contraste: c.cle, axe1: d3.sum(E[a], (x, k) => x * axes[0][k]), axe2: d3.sum(E[a], (x, k) => x * axes[1][k]) })) };
})();

// Robustesse. (1) Bureaux au découpage stable entre 2022 et 2026 (stabilité d'au moins 0,9 : le vote de 2022 y est mesuré,
// pas transposé). (2) Scolarité en rangs à intervalles égaux plutôt qu'en années d'études.
const comparer = (autres) => ({ ecartMaximal: d3.max(autres, (x, r) => Math.abs(x - effetsPoints[r])), correlation: correlation(Array.from(autres), Array.from(effetsPoints)) });
const robustesse = (() => {
  const G = circonscriptions.length, masque = Uint8Array.from(unites, (u) => (u.stabilite >= 0.9 ? 1 : 0));
  const stables = effets(ajuster({ groupe: groupeCirconscription, nGroupes: G, Z: plan.Z, q: plan.q, masque }), plan.contrastes, { masque });
  const planRangs = construire(SCALAIRES.map((s) => (s.cle === "scolarite_moyenne" ? { ...s, valeur: (u) => moyenneDesClasses(u, SCOLARITE_RANGS) } : s)));
  const rangs = effets(ajuster({ groupe: groupeCirconscription, nGroupes: G, Z: planRangs.Z, q: planRangs.q }), planRangs.contrastes);
  return {
    stables: { unites: d3.sum(masque), ...comparer(stables), effets: Array.from(stables) },
    scolariteEnRangs: { ...comparer(rangs), effets: Array.from(rangs) },
  };
})();

({ tours: m3.tours, gradient: m3.gradient, robustesse: { stables: robustesse.stables.ecartMaximal, rangs: robustesse.scolariteEnRangs.ecartMaximal } })

// %% [javascript]
// Résultats lus par le billet.
const resultats = {
  genere: new Date().toISOString(), partis: PARTIS,
  unites: { bureaux: n, exclus: bureaux.length - n, sections: d3.sum(unites, (u) => u.sections), circonscriptions: circonscriptions.length, votes: d3.sum(N), stables: robustesse.stables.unites },
  contrastes: plan.contrastes.map((c) => ({ cle: c.cle, bloc: c.bloc, libelle: c.libelle, unite: c.unite, pourcent: c.pourcent, transformation: c.transformation, mediane: c.mediane, bas: c.bas, haut: c.haut })),
  correlations, inflation, deviance: devianceModeles, bruit, surdispersion, autocorrelation,
  effets: tableEffets, ordination,
  robustesse: { stables: { unites: robustesse.stables.unites, ecartMaximal: robustesse.stables.ecartMaximal, correlation: robustesse.stables.correlation, effets: robustesse.stables.effets },
    scolariteEnRangs: robustesse.scolariteEnRangs },
};
typeof document === "undefined" ? resultats : (() => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(resultats)], { type: "application/json" }));
  a.download = "precalculs.json"; a.textContent = "Télécharger precalculs.json";
  return a;
})()

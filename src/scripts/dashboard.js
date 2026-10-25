/**
 * Browser entry point: fetches the exported data, runs the compositional/GP/
 * swing/simulation pipeline client-side, and renders the dashboard. See
 * index.html for the section layout.
 *
 * Every section is wrapped independently (section()) so one failing section
 * leaves the rest of the dashboard intact instead of blanking the whole page.
 */

import * as Plot from "@observablehq/plot";
import { mva } from "@tangent.to/ds";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pivotPolls } from "./compositional.js";
import { PARTIES, repoData, LANG, LOCALE, partyLabel, formatNumber, formatPercent } from "./parties.js";
// Every visible string, in the page's language (<html lang>).
const T = {
  fr: {
    nd: "n/d",
    results: (prelim) => (prelim ? "Résultats préliminaires et prévision de la veille" : "Résultats et prévision de la veille"),
    resultsHead: "<th>Parti</th><th>Sièges</th><th>Prévision</th><th>Vote</th><th>Vote prévu</th>",
    resultsNote: (hits, n, src) => `Prévision : scénario médian des sièges (intervalle à 90 %) et part des votes utilisée par le modèle, au dernier calcul avant le scrutin. ` +
      `Le favori de la prévision a été élu dans ${hits} circonscriptions sur ${n}. Source : ${src}.`,
    resultsSource: (prelim, x) => `Elections BC, ${prelim ? "résultats préliminaires" : "résultats"}${x ? `, ${x} des urnes dépouillées` : ""}`,
    gallagherQc: "17,8 au Québec en 2026",
    gallagherCa: (g) => `${formatNumber(g, 1)} au Canada en 2025`,
    gallagherBc: (g) => `${formatNumber(g, 1)} en Colombie-Britannique en 2024`,
    ranges: ["3 mois", "6 mois", "1 an", (y) => `Depuis l'élection ${y}`, "Tout"],
    error: (id, m) => `Erreur (${id}) : ${m}`,
    detailHead: (y) => `<th>Parti</th><th>Chances de gagner</th><th>Appui prévu</th><th>Résultat ${y}</th>`,
    date: "Date", intention: "Intention de vote",
    winProb: "Probabilité de victoire :",
    tileNote: (pc) => `Couleur : parti favori · intensité : probabilité de victoire · contour : parti poursuivant lorsque le favori est sous ${pc} %.`,
    region: {},
    watchHead: "<th>Circonscription</th><th>Favori</th><th>Poursuivant</th><th>Écart</th>",
    pt: "pt",
    leaderHead: "<th>Parti</th><th>Chef</th><th>Circonscription</th><th>Prévision</th>",
    notAnnounced: "candidature non annoncée", currentSeat: "siège actuel",
    holds: "conserve", gains: "gagne",
    seats: "Sièges",
    seatNote: (n, t) => `Distribution du nombre de sièges par parti sur ${n} simulations. Trait pointillé : seuil de majorité (${t} sièges). ` +
      "Valeurs à droite : sièges dans le scénario médian de la distribution jointe (médoïde), suivis de l'intervalle à 90 %.",
    dispAxis: "du % des votes vers le % des sièges",
    pctVotes: (v) => `${v} % des votes`, pctSeats: (v) => `${v} % des sièges`,
    dispNote: (n, s, g, lo, hi, ref) => `Espérances sur les ${n} simulations : la flèche va de la part des votes à la part des ${s} sièges. ` +
      "Le scrutin uninominal amplifie le parti en tête et pénalise les appuis dispersés. " +
      `Indice de disproportion de Gallagher : ${g} [intervalle à 90 % : ${lo}–${hi}] ; repères : 4 à 6 sous un scrutin proportionnel, ${ref}.`,
    govLead: (a, b) => `<strong>${a} %</strong> de probabilité d'un gouvernement majoritaire, <strong>${b} %</strong> d'un gouvernement minoritaire.`,
    govHead: "<th>Probabilité</th><th>Gouvernement</th><th>Opposition officielle</th><th>Balance du pouvoir</th>",
    majority: "majoritaire", minority: "minoritaire", na: "sans objet", noneSuffices: "aucun tiers parti seul",
    govNote: (t) => "Chaque simulation est classée dans un scénario unique; les probabilités somment à 100 % (scénarios sous 1 % omis). " +
      `Balance du pouvoir : partis autres que le gouvernement et l'opposition officielle dont les sièges, ajoutés à ceux du gouvernement, atteindraient la majorité de ${t} sièges, du plus petit au plus grand.`,
    certainty: ["sûre", "probable", "penchant", "incertaine"],
    certaintyAxis: "Circonscriptions où le parti est favori",
    certaintyTip: (p, c, n, names) => `${p}, ${c} : ${n} circonscription${n > 1 ? "s" : ""}\n${names}`,
    certaintyNote: (t) => "Chaque circonscription est attribuée à son parti favori et classée selon sa probabilité de victoire : " +
      `sûre (95 % ou plus), probable (75 à 95 %), penchant (60 à 75 %), incertaine (moins de 60 %). Trait pointillé : majorité (${t} sièges).`,
    candidate: "Candidat.e", noCandidate: "aucune candidature",
    loading: "Chargement des données…",
    status: (d, n, r, c) => `Intentions de vote au ${d} · ${n} sondages · ${r} circonscriptions · mis à jour le ${c}`,
    trendNote: (s) => "Courbes : moyenne des sondages. La prévision utilise les parts corrigées de l'écart historique " +
      `entre les sondages de veille et les résultats, par région : ${s}.`,
    trendNoteBc: (s) => "Courbes : moyenne des sondages. La prévision prolonge la moyenne au jour du scrutin et ramène la part de chaque parti " +
      `à la part des votes des circonscriptions où il présente une candidature : ${s}.`,
    fatal: (m) => `Erreur : ${m}`,
  },
  en: {
    nd: "n/a",
    results: (prelim) => (prelim ? "Preliminary results and eve-of-election forecast" : "Results and eve-of-election forecast"),
    resultsHead: "<th>Party</th><th>Seats</th><th>Forecast</th><th>Vote</th><th>Forecast vote</th>",
    resultsNote: (hits, n, src) => `Forecast: median seat scenario (90% interval) and vote shares used by the model, at the last run before the vote. ` +
      `The forecast favourite was elected in ${hits} of ${n} ridings. Source: ${src}.`,
    resultsSource: (prelim, x) => `Elections BC, ${prelim ? "preliminary results" : "results"}${x ? `, ${x} of ballot boxes reported` : ""}`,
    gallagherQc: "17.8 in Quebec in 2026",
    gallagherCa: (g) => `${formatNumber(g, 1)} in Canada in 2025`,
    gallagherBc: (g) => `${formatNumber(g, 1)} in British Columbia in 2024`,
    ranges: ["3 months", "6 months", "1 year", (y) => `Since the ${y} election`, "All"],
    error: (id, m) => `Error (${id}): ${m}`,
    detailHead: (y) => `<th>Party</th><th>Chance of winning</th><th>Forecast support</th><th>${y} result</th>`,
    date: "Date", intention: "Voting intention",
    winProb: "Probability of winning:",
    tileNote: (pc) => `Colour: favourite party · intensity: probability of winning · outline: runner-up when the favourite is below ${pc}%.`,
    region: { "C.-B.": "B.C.", "Alb.": "Alta.", "Qc": "Que.", "Atlantique": "Atlantic", "Territoires": "Territories",
      "Île": "Island", "Vallée du Fraser": "Fraser Valley", "Intérieur": "Interior", "Nord": "North" },
    watchHead: "<th>Riding</th><th>Favourite</th><th>Runner-up</th><th>Gap</th>",
    pt: "pts",
    leaderHead: "<th>Party</th><th>Leader</th><th>Riding</th><th>Forecast</th>",
    notAnnounced: "candidacy not announced", currentSeat: "current seat",
    holds: "holds", gains: "gains",
    seats: "Seats",
    seatNote: (n, t) => `Distribution of the number of seats per party over ${n} simulations. Dashed line: majority threshold (${t} seats). ` +
      "Values on the right: seats in the median scenario of the joint distribution (medoid), followed by the 90% interval.",
    dispAxis: "from % of votes to % of seats",
    pctVotes: (v) => `${v}% of votes`, pctSeats: (v) => `${v}% of seats`,
    dispNote: (n, s, g, lo, hi, ref) => `Expectations over the ${n} simulations: the arrow goes from the share of votes to the share of the ${s} seats. ` +
      "First-past-the-post amplifies the leading party and penalises dispersed support. " +
      `Gallagher disproportionality index: ${g} [90% interval: ${lo}–${hi}]; benchmarks: 4 to 6 under proportional representation, ${ref}.`,
    govLead: (a, b) => `<strong>${a}%</strong> probability of a majority government, <strong>${b}%</strong> of a minority government.`,
    govHead: "<th>Probability</th><th>Government</th><th>Official Opposition</th><th>Balance of power</th>",
    majority: "majority", minority: "minority", na: "not applicable", noneSuffices: "no single third party",
    govNote: (t) => "Each simulation is assigned to a single scenario; probabilities sum to 100% (scenarios below 1% omitted). " +
      `Balance of power: parties other than the government and the Official Opposition whose seats, added to the government's, would reach the ${t}-seat majority, from smallest to largest.`,
    certainty: ["safe", "likely", "lean", "toss-up"],
    certaintyAxis: "Ridings where the party is the favourite",
    certaintyTip: (p, c, n, names) => `${p}, ${c}: ${n} riding${n > 1 ? "s" : ""}\n${names}`,
    certaintyNote: (t) => "Each riding is assigned to its favourite party and classed by that party's probability of winning: " +
      `safe (95% or more), likely (75 to 95%), lean (60 to 75%), toss-up (under 60%). Dashed line: majority (${t} seats).`,
    candidate: "Candidate", noCandidate: "no candidate",
    loading: "Loading data…",
    status: (d, n, r, c) => `Voting intentions as of ${d} · ${n} polls · ${r} ridings · updated ${c}`,
    trendNote: (s) => "Lines: poll average. The forecast uses shares corrected for the historical gap " +
      `between eve-of-election polls and results, by region: ${s}.`,
    trendNoteBc: (s) => "Lines: poll average. The forecast extends the average to election day and scales each party's share " +
      `to the share of the votes cast in the districts where it has a candidate: ${s}.`,
    fatal: (m) => `Error: ${m}`,
  },
}[LANG];

/** "197.0", 197 and "197" designate the same riding. */
const normalizeRidingCode = (code) => { const n = parseFloat(code); return Number.isFinite(n) ? String(Math.round(n)) : String(code); };

// One page, one election: <body data-election="qc|bc|ca"> picks the config.
const CONFIGS = {
  qc: {
    files: Object.fromEntries(Object.entries({
      projection: "qc_projection.json", polls: "qc_national_polls.json",
      geojson: "qc_ridings_2026.geojson", leaders: "qc_leaders.json",
      tiles: "qc_tile_layout.json",
    }).map(([k, f]) => [k, repoData("quebec") + f])),
    colors: PARTIES.qc.colors,
    previousElection: { date: "2026-10-05", label: "2026" },
    gallagherRef: () => T.gallagherQc,
  },
  ca: {
    files: Object.fromEntries(Object.entries({
      projection: "ca_dashboard.json", polls: "ca_national_polls.json",
      geojson: "ca_ridings_2023.geojson", tiles: "ca_tile_layout.json",
    }).map(([k, f]) => [k, repoData("canada") + f])),
    colors: PARTIES.ca.colors,
    previousElection: { date: "2025-04-28", label: "2025" },
    initialBounds: [[42, -128], [56, -55]],
    gallagherRef: (meta) => T.gallagherCa(meta.gallagherPrevious),
  },
  bc: {
    files: Object.fromEntries(Object.entries({
      projection: "bc_dashboard.json", polls: "bc_national_polls.json",
      geojson: "bc_ridings_2023.geojson", tiles: "bc_tile_layout.json", results: "bc_results.json",
    }).map(([k, f]) => [k, repoData("bc") + f])),
    colors: PARTIES.bc.colors,
    previousElection: { date: "2024-10-19", label: "2024" },
    gallagherRef: (meta) => T.gallagherBc(meta.gallagherPrevious),
    trendNote: (s) => T.trendNoteBc(s),
  },
};
const ELECTION = document.body.dataset.election ?? "qc";
const CFG = CONFIGS[ELECTION];
const PARTY_COLORS = CFG.colors;
/** Display label of a party code, in the page's language. */
const label = (p) => partyLabel(ELECTION, p);
/** Colour swatch + label in ink: identity by the mark, text stays readable. */
const chip = (p) => `<span class="chip"><span class="sw" style="background:${PARTY_COLORS[p] ?? "#ccc"}"></span>${label(p)}</span>`;

// A range is either rolling (`days` back from today) or anchored (`since` a
// fixed date). "Since the election" anchors at the last general election --
// the natural "this whole cycle" view, which no rolling window can express.
const RANGES = [
  { label: T.ranges[0], days: 90 },
  { label: T.ranges[1], days: 182 },
  { label: T.ranges[2], days: 365 },
  { label: T.ranges[3](CFG.previousElection.label), since: CFG.previousElection.date },
  { label: T.ranges[4], days: null },
];

function section(id, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[dashboard] section "${id}" failed:`, err);
    const el = document.getElementById(id);
    if (el) el.textContent = T.error(id, err.message);
  }
}

function colorScale(partyCodes) {
  return { domain: partyCodes, range: partyCodes.map((p) => PARTY_COLORS[p] ?? "#ccc") };
}

// ---- Shared selection state --------------------------------------------
// A single selectRiding() call drives the map highlight, the popup, the
// detail panel, and the watchlist row highlight together, so a click in any
// one of those three places produces the same visible, connected result in
// all three -- instead of one view silently updating far from where the
// user clicked.

const registry = {
  partyCodes: null,
  nameByCode: new Map(),
  ridingForecast: null,
  ridingBaseline: null,
  mapLayersByCode: new Map(),
  watchlistRowsByCode: new Map(),
  leafletMap: null,
  defaultStyleByCode: new Map(),
  tileByCode: new Map(),
  tileSelFrame: null,
};

function selectRiding(code, { zoom = true } = {}) {
  const name = registry.nameByCode.get(code) ?? code;
  const entry = registry.ridingForecast.get(code);
  if (!entry) return;
  registry.selectedCode = code;

  renderRidingDetail(code, name, entry, registry.ridingBaseline.sharesFor(code), registry.partyCodes,
    registry.winProbs?.[code] ?? null, registry.candidates?.[code] ?? null);

  // Map: reset every layer to its default style, then highlight the
  // selected one with a heavy black outline that stays until the next
  // selection (not just on hover) -- a persistent "you clicked this" mark.
  for (const [c, layer] of registry.mapLayersByCode) {
    layer.setStyle(registry.defaultStyleByCode.get(c));
  }
  const selectedLayer = registry.mapLayersByCode.get(code);
  if (selectedLayer) {
    selectedLayer.setStyle({ weight: 3.5, color: "#000" });
    selectedLayer.bringToFront();
    selectedLayer
      .bindPopup(`<strong>${name}</strong><br>${label(entry.winner)} ${formatPercent(entry.shares[entry.winner])}`)
      .openPopup();
    const geoVisible = !document.getElementById("riding-map")?.hidden;
    if (zoom && geoVisible && registry.leafletMap) {
      registry.leafletMap.fitBounds(selectedLayer.getBounds(), { maxZoom: 11 });
    }
  }

  // Tile cartogram: move the selection frame onto the chosen tile.
  const tile = registry.tileByCode.get(code);
  if (tile && registry.tileSelFrame) {
    const f = registry.tileSelFrame;
    f.setAttribute("x", tile.getAttribute("x"));
    f.setAttribute("y", tile.getAttribute("y"));
    f.setAttribute("width", tile.getAttribute("width"));
    f.setAttribute("height", tile.getAttribute("height"));
    f.removeAttribute("hidden");
  }

  // Watchlist: highlight the matching row (if it's in the top-N list) and
  // scroll it into view.
  for (const row of registry.watchlistRowsByCode.values()) row.classList.remove("selected-row");
  const watchRow = registry.watchlistRowsByCode.get(code);
  if (watchRow) {
    watchRow.classList.add("selected-row");
    // Scroll the list only, never the page (scrollIntoView would also move
    // the window, e.g. on the default selection at load).
    const list = document.getElementById("watchlist");
    const top = watchRow.offsetTop - list.offsetTop, bottom = top + watchRow.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  // Detail panel: a brief flash draws the eye to it, since it can be a
  // fair distance from wherever the click happened.
  const detailSection = document.getElementById("riding-detail").closest("section");
  detailSection.classList.remove("flash");
  void detailSection.offsetWidth; // restart the CSS animation
  detailSection.classList.add("flash");
}

function renderRidingDetail(code, name, forecastEntry, baselineShares, partyCodes, winProbs, candidates) {
  const host = document.getElementById("riding-detail");
  host.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = name;
  host.appendChild(title);

  // With a candidate list, a party with no candidate and no previous vote here is left out.
  const rows = partyCodes
    .filter((p) => !candidates || candidates[p] || (baselineShares?.[p] ?? 0) > 0)
    .map((p) => ({
      party: p,
      projected: forecastEntry.shares[p],
      baseline: baselineShares?.[p] ?? null,
      pWin: winProbs?.[p] ?? null,
    }))
    .sort((a, b) => (b.pWin ?? b.projected) - (a.pWin ?? a.projected) || b.projected - a.projected);

  // Ranked by CHANCE OF WINNING, the number that colours the map, so the
  // first row always matches the tile -- ranking by projected share instead
  // made the panel contradict the map in close multi-way races (Jean-Lesage:
  // QS ahead by 0.8 in the central scenario, PCQ the likelier winner).
  // Plain-language headers on purpose.
  const table = document.createElement("table");
  // Candidates, when the forecast lists them: a column after the party.
  const head = T.detailHead(CFG.previousElection.label);
  table.innerHTML = `<thead><tr>${candidates ? head.replace(/(<\/th>)/, `$1<th>${T.candidate}</th>`) : head}</tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const r of rows) {
    const tr = document.createElement("tr");
    const proj = formatPercent(r.projected, 1);
    const base = r.baseline !== null ? formatPercent(r.baseline, 1) : T.nd;
    const pw = r.pWin !== null ? formatPercent(r.pWin) : T.nd;
    const cand = candidates ? `<td>${candidates[r.party] ?? `<span class="muted-cell">${T.noCandidate}</span>`}</td>` : "";
    tr.innerHTML =
      `<td>${chip(r.party)}</td>${cand}` +
      `<td>${pw}</td><td>${proj}</td><td>${base}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);
}

// ---- Trend chart with a date-range selector -------------------------------

function renderTrendChart(fullSeries, polls, partyCodes) {
  const container = document.getElementById("trend-chart");
  const controls = document.createElement("div");
  controls.className = "range-controls";
  container.appendChild(controls);
  const chartHost = document.createElement("div");
  container.appendChild(chartHost);

  // Only plot parties a poll actually measured. Drawing an unmeasured party
  // at zero put a row of dots along the axis for every pre-2021 poll, each
  // reading as a pollster having found the PCQ at 0% -- a measurement none of
  // them made.
  const pollPoints = [];
  for (const p of polls) {
    for (const party of partyCodes) {
      if (p.shares[party] == null) continue;
      pollPoints.push({ date: new Date(p.pollDate), party, share: p.shares[party], firm: p.firm });
    }
  }

  function draw(range) {
    chartHost.innerHTML = "";
    const cutoff = range.since
      ? new Date(range.since)
      : range.days
        ? new Date(Date.now() - range.days * 86_400_000)
        : null;
    const series = cutoff ? fullSeries.filter((row) => new Date(row.date) >= cutoff) : fullSeries;
    const dots = cutoff ? pollPoints.filter((d) => d.date >= cutoff) : pollPoints;

    const points = [];
    for (const row of series) {
      for (const party of partyCodes) if (row[party]) points.push({ date: new Date(row.date), party, ...row[party] });
    }

    // End-of-line labels: party name + last predicted share, right of the
    // last point. Labels whose values are close would overprint (LIB and CAQ
    // are 1pt apart), so the y positions are relaxed apart with a minimum
    // gap while the leader line still ends at the true value.
    const last = series.at(-1);
    const endLabels = partyCodes
      .filter((p) => last?.[p])
      .map((p) => ({ party: p, value: last[p].mean, label: `${label(p)} ${formatPercent(last[p].mean, 1)}` }))
      .sort((a, b) => b.value - a.value);
    const MIN_GAP = 0.022; // in share units, ~9px at this height
    endLabels.forEach((d, i) => { d.y = d.value; });
    for (let i = 1; i < endLabels.length; i++) {
      if (endLabels[i - 1].y - endLabels[i].y < MIN_GAP) endLabels[i].y = endLabels[i - 1].y - MIN_GAP;
    }

    const plot = Plot.plot({
      width: container.clientWidth || 900,
      height: 420,
      marginLeft: 55,
      marginRight: 78,
      x: { label: T.date },
      y: { label: T.intention, percent: true, grid: true },
      color: colorScale(partyCodes),
      marks: [
        Plot.areaY(points, { x: "date", y1: "p05", y2: "p95", fill: "party", fillOpacity: 0.12 }),
        Plot.dot(dots, { x: "date", y: "share", fill: "party", r: 2.5, fillOpacity: 0.55, title: (d) => `${d.firm}\n${label(d.party)} ${formatPercent(d.share, 1)}` }),
        Plot.lineY(points, { x: "date", y: "mean", stroke: "party", strokeWidth: 2.5, z: "party" }),
        Plot.text(endLabels, {
          x: () => new Date(last.date), y: "y", text: "label", fill: "party",
          dx: 8, textAnchor: "start", fontWeight: 600, fontSize: 12,
        }),
        // Hover: nearest trend point, all parties' values at that date.
        Plot.ruleX(points, Plot.pointerX({ x: "date", stroke: "#bbb" })),
        Plot.tip(points, Plot.pointerX({
          x: "date", y: "mean",
          title: (d) => {
            const row = series.find((r) => +new Date(r.date) === +d.date);
            const at = d.date.toISOString().slice(0, 10);
            const lines = partyCodes
              .filter((p) => row?.[p])
              .sort((a, b) => row[b].mean - row[a].mean)
              .map((p) => `${label(p)} ${formatPercent(row[p].mean, 1)}`);
            return [at, ...lines].join("\n");
          },
        })),
        Plot.ruleY([0]),
      ],
    });
    chartHost.appendChild(plot);
  }

  const buttons = [];
  for (const range of RANGES) {
    const btn = document.createElement("button");
    btn.textContent = range.label;
    btn.onclick = () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      draw(range);
    };
    buttons.push(btn);
    controls.appendChild(btn);
  }
  // Default: the last twelve months -- shown as ALREADY PRESSED, since a
  // control whose state is invisible reads as "nothing selected".
  const defaultRange = RANGES.find((r) => r.days === 365);
  buttons[RANGES.indexOf(defaultRange)].classList.add("active");
  draw(defaultRange);
}

// ---- Tile cartogram ---------------------------------------------------------
// US-state-grid style: one equal-size tile per riding (layout precomputed in
// qc_tile_layout.json from rank-normalised centroids). Equal tiles fix the
// choropleth's central lie -- 27 island-of-Montreal ridings vanishing into
// 0.1% of the pixels -- and make CLOSE RACES representable: the fill is the
// favourite (opacity = its win probability across the simulation draws), and
// when the race is close the tile's BORDER takes the runner-up's colour, a
// mark only legible because every tile is big and uniform.

const CLOSE_RACE_P = 0.75; // favourite below this = show the runner-up border

function renderTileMap(layout, winProbs, ridingForecast) {
  const host = document.getElementById("tile-map");
  host.innerHTML = "";
  // Layout coordinates are TILE CENTRES in tile-side units (precomputed by
  // tools/make_tiles.mjs); U converts to pixels.
  const tilesById = layout.tiles ?? layout;
  const U = 56, SIDE = U * 0.94;
  // Frame: every tile and every region label, with a margin for the labels.
  const regionsList = layout.regions ?? [];
  const xs = [...Object.values(tilesById).map((t) => t.x), ...regionsList.map((r) => r.x)];
  const ys = Object.values(tilesById).map((t) => t.y), ry = regionsList.map((r) => r.y);
  const x0 = Math.min(...xs) - 0.65, x1 = Math.max(...xs) + 0.65;
  const y0 = Math.min(...ys, ...ry) - 0.9, y1 = Math.max(...ys, ...ry) + 0.7;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `${x0 * U} ${y0 * U} ${(x1 - x0) * U} ${(y1 - y0) * U}`);
  // Strokes and labels are sized in viewBox units; this ratio keeps them
  // near their intended screen size whatever the map's scale (the federal
  // map is about four times wider than Quebec's).
  const unitsPerPx = ((x1 - x0) * U) / (host.clientWidth || 600);

  for (const [code, t] of Object.entries(tilesById)) {
    const probs = winProbs?.[code];
    const ranked = probs
      ? Object.entries(probs).sort((a, b) => b[1] - a[1])
      : [[ridingForecast.get(code)?.winner ?? "AUTRES", 1]];
    const [fav, pFav] = ranked[0];
    const runner = ranked[1]?.[0];
    const close = probs && pFav < CLOSE_RACE_P && runner;

    const g = document.createElementNS(svg.namespaceURI, "g");
    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("class", "tile");
    rect.setAttribute("x", t.x * U - SIDE / 2);
    rect.setAttribute("y", t.y * U - SIDE / 2);
    rect.setAttribute("width", SIDE);
    rect.setAttribute("height", SIDE);
    rect.setAttribute("rx", 4);
    rect.setAttribute("fill", PARTY_COLORS[fav] ?? "#ccc");
    // Opacity carries certainty: a 52/48 race must not look like 90/10.
    rect.setAttribute("fill-opacity", (0.25 + 0.7 * pFav).toFixed(2));
    rect.setAttribute("stroke", close ? PARTY_COLORS[runner] ?? "#999" : "#ddd");
    rect.setAttribute("stroke-width", close ? 4 * Math.min(Math.max(1, unitsPerPx), 2) : 1);
    const title = document.createElementNS(svg.namespaceURI, "title");
    title.textContent = probs
      ? `${t.name}\n${T.winProb}\n${ranked.slice(0, 3).filter(([, p]) => p >= 0.005)
        .map(([p, v]) => `${label(p)} ${formatPercent(v)}`).join("\n")}`
      : t.name;
    rect.appendChild(title);
    rect.addEventListener("click", () => selectRiding(code, { zoom: false }));
    registry.tileByCode.set(code, rect);
    g.appendChild(rect);

    if (!t.abbr) { svg.appendChild(g); continue; }
    const tileText = document.createElementNS(svg.namespaceURI, "text");
    tileText.setAttribute("x", t.x * U);
    tileText.setAttribute("y", t.y * U + 5);
    tileText.setAttribute("text-anchor", "middle");
    // Adaptive size: short codes get big type; only long two-part names drop
    // smaller. The map column renders a tile at ~35 screen px, so anything
    // below ~12px SVG units was unreadable.
    tileText.setAttribute("font-size", t.abbr.length <= 4 ? "16" : t.abbr.length <= 6 ? "13" : "11");
    tileText.setAttribute("font-weight", "600");
    tileText.setAttribute("fill", pFav > 0.6 ? "#fff" : "#222");
    tileText.textContent = t.abbr;
    g.appendChild(tileText);
    svg.appendChild(g);
  }

  // Region labels on top (they sit in space the layout kept free): bearings,
  // not boundaries.
  const labelSize = Math.max(13, 12 * unitsPerPx);
  for (const r of layout.regions ?? []) {
    const lbl = document.createElementNS(svg.namespaceURI, "text");
    lbl.setAttribute("x", r.x * U);
    lbl.setAttribute("y", r.y * U);
    lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("font-size", labelSize.toFixed(1));
    lbl.setAttribute("letter-spacing", "0.08em");
    lbl.setAttribute("fill", "#8a8a8a");
    lbl.textContent = (T.region[r.label] ?? r.label).toUpperCase();
    svg.appendChild(lbl);
  }

  // Selection: a double HALO (white over black) drawn OUTSIDE the tile.
  // A plain black border was indistinguishable from the PCQ navy fill and
  // sat exactly where the runner-up border carries the close-race signal;
  // the halo reads on any colour and covers nothing.
  const halo = document.createElementNS(svg.namespaceURI, "g");
  const mk = (stroke, width, grow) => {
    const r = document.createElementNS(svg.namespaceURI, "rect");
    r.setAttribute("fill", "none");
    r.setAttribute("stroke", stroke);
    r.setAttribute("stroke-width", width);
    r.setAttribute("rx", 6);
    r.setAttribute("pointer-events", "none");
    r.dataset.grow = grow;
    halo.appendChild(r);
    return r;
  };
  const k = Math.max(1, unitsPerPx);
  const haloOuter = mk("#000", 2.5 * k, 7 * k);
  const haloInner = mk("#fff", 2.5 * k, 4.5 * k);
  halo.setAttribute("hidden", "");
  svg.appendChild(halo);
  registry.tileSelFrame = {
    setAttribute(name, value) {
      if (name === "hidden") { halo.setAttribute("hidden", value); return; }
      for (const r of [haloOuter, haloInner]) {
        const grow = +r.dataset.grow;
        if (name === "x" || name === "y") r.setAttribute(name, +value - grow);
        else r.setAttribute(name, +value + 2 * grow);
      }
    },
    removeAttribute(name) { if (name === "hidden") halo.removeAttribute("hidden"); },
  };

  host.appendChild(svg);

  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    T.tileNote(Math.round(CLOSE_RACE_P * 100));
  host.appendChild(note);
}

// ---- Riding map (Leaflet: pan/zoom, click-to-select) ------------------------

function renderMap(geojson, ridingForecast) {
  const container = document.getElementById("riding-map");

  const map = L.map(container, { zoomControl: true, attributionControl: false });
  registry.leafletMap = map;
  // No base tile layer on purpose: this is a choropleth of riding results,
  // not a street map, and it keeps the look black-and-white/minimalist
  // instead of importing an OSM basemap's own styling.

  const layer = L.geoJSON(geojson, {
    style: (feature) => {
      const code = normalizeRidingCode(feature.properties.riding_code);
      const winner = ridingForecast.get(code)?.winner;
      const style = { color: "#111", weight: 0.6, fillColor: PARTY_COLORS[winner] ?? "#ccc", fillOpacity: 0.85 };
      registry.defaultStyleByCode.set(code, style);
      return style;
    },
    onEachFeature: (feature, lyr) => {
      const code = normalizeRidingCode(feature.properties.riding_code);
      registry.mapLayersByCode.set(code, lyr);
      lyr.on("click", () => selectRiding(code));
      lyr.on("mouseover", () => {
        if (registry.mapLayersByCode.get(code) !== lyr) return;
        const current = lyr.options.weight;
        if (current < 2) lyr.setStyle({ weight: 1.6 });
      });
      lyr.on("mouseout", () => {
        const isSelected = lyr.options.weight >= 3;
        if (!isSelected) lyr.setStyle(registry.defaultStyleByCode.get(code));
      });
    },
  }).addTo(map);

  // The container gets its height from a flex row, which the browser
  // resolves after this runs -- Leaflet would otherwise compute its bounds
  // against a provisional height and leave the province floating in dead
  // space. Recompute once layout has settled, and again on resize.
  // Web Mercator stretches the Arctic: the federal map opens on the
  // populated south (where nearly every riding lies), the north one pan away.
  const bounds = CFG.initialBounds ? L.latLngBounds(CFG.initialBounds) : layer.getBounds();
  const fit = () => { map.invalidateSize(); map.fitBounds(bounds, { padding: [12, 12] }); };
  requestAnimationFrame(fit);
  new ResizeObserver(fit).observe(container);
}

// ---- Closest-ridings watchlist ----------------------------------------------

function renderWatchlist(ridingForecast, partyCodes, n = 20) {
  const rows = [...ridingForecast.entries()].map(([code, entry]) => {
    const sorted = partyCodes.map((p) => [p, entry.shares[p]]).sort((a, b) => b[1] - a[1]);
    const margin = sorted[0][1] - sorted[1][1];
    return { code, name: registry.nameByCode.get(code) ?? code, winner: entry.winner, runnerUp: sorted[1][0], margin };
  });
  rows.sort((a, b) => a.margin - b.margin);

  const table = document.createElement("table");
  table.innerHTML =
    `<thead><tr>${T.watchHead}</tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const r of rows.slice(0, n)) {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    tr.innerHTML = `<td>${r.name}</td><td>${chip(r.winner)}</td>` +
      `<td>${chip(r.runnerUp)}</td><td>${formatNumber(r.margin * 100, 1)} ${T.pt}</td>`;
    tr.onclick = () => selectRiding(r.code);
    registry.watchlistRowsByCode.set(r.code, tr);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  document.getElementById("watchlist").appendChild(table);
}

// ---- Leaders' ridings -------------------------------------------------------
// The riding shown is the one the leader contests at the next election, not
// necessarily the seat they hold. `riding_source` distinguishes a confirmed
// candidacy from the assumption that a sitting leader runs again where they
// sit, and the distinction is shown. With neither, the riding is unknown and
// marked as not announced; a party with no designated leader is marked n/a.

function renderLeaderRidings(leaders, partyCodes) {
  const host = document.getElementById("leader-ridings");
  host.innerHTML = "";

  const codeByName = new Map([...registry.nameByCode].map(([code, name]) => [name, code]));

  const table = document.createElement("table");
  table.innerHTML =
    `<thead><tr>${T.leaderHead}</tr></thead>`;
  const tbody = document.createElement("tbody");

  // Parties with no designated leader keep their row, marked n/d.
  const withLeader = new Set(leaders.map((l) => l.party_code));
  const rows = [...leaders, ...partyCodes.filter((p) => p !== "AUTRES" && !withLeader.has(p)).map((p) => ({ party_code: p }))];
  for (const leader of rows) {
    const tr = document.createElement("tr");
    const partyCell = `<td>${chip(leader.party_code)}</td>`;

    if (!leader.leader_name) {
      tr.innerHTML = `${partyCell}<td class="muted-cell">${T.nd}</td><td colspan="2" class="muted-cell">${T.nd}</td>`;
      tbody.appendChild(tr);
      continue;
    }

    if (!leader.riding_name) {
      tr.innerHTML =
        `${partyCell}<td>${leader.leader_name}</td>` +
        `<td colspan="2" class="muted-cell">${T.notAnnounced}</td>`;
      tbody.appendChild(tr);
      continue;
    }

    // A riding held on assumption rather than announcement is marked, so the
    // reader isn't told a switch has been ruled out when it simply hasn't
    // been announced.
    const ridingLabel =
      leader.riding_source === "siege actuel"
        ? `${leader.riding_name} <span class="muted-cell">(${T.currentSeat})</span>`
        : leader.riding_name;

    const code = codeByName.get(leader.riding_name);
    const entry = code ? registry.ridingForecast.get(code) : null;
    if (!entry) {
      tr.innerHTML = `${partyCell}<td>${leader.leader_name}</td><td>${ridingLabel}</td><td class="muted-cell">${T.nd}</td>`;
      tbody.appendChild(tr);
      continue;
    }

    const sorted = partyCodes.map((p) => [p, entry.shares[p]]).sort((a, b) => b[1] - a[1]);
    const margin = sorted[0][1] - sorted[1][1];

    // "conserve" vs "gagne" is about the SEAT changing hands, so it compares
    // the projected winner with whoever won the riding last time -- not with
    // the leader's own party. Comparing against the leader's party labelled
    // Duhaime's PCQ as "conserve" in Bellechasse, a seat the CAQ won in 2022.
    const baseline = registry.ridingBaseline.sharesFor(code);
    const previousWinner = baseline
      ? partyCodes.reduce((best, p) => ((baseline[p] ?? 0) > (baseline[best] ?? 0) ? p : best), partyCodes[0])
      : null;
    const holds = previousWinner !== null && entry.winner === previousWinner;
    tr.className = "clickable-row";
    tr.innerHTML =
      `${partyCell}<td>${leader.leader_name}</td><td>${ridingLabel}</td>` +
      `<td>${chip(entry.winner)} ${holds ? T.holds : T.gains} (+${formatNumber(margin * 100, 1)} ${T.pt})</td>`;
    tr.onclick = () => selectRiding(code);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  host.appendChild(table);
}

// ---- Seat posterior distributions ------------------------------------------
// The simulation produces a full posterior over each party's seat count, so
// show that distribution rather than collapsing it to one number. A single
// point estimate hides exactly what matters here: how wide the plausible
// range is and how much of it sits above the majority line.

function renderSeatDistributions(distributions, totalSeats, partyCodes, medoidCounts) {
  const host = document.getElementById("seat-bar");
  host.innerHTML = "";
  const threshold = Math.floor(totalSeats / 2) + 1;

  const ordered = [...partyCodes].sort((a, b) => distributions[b].mean - distributions[a].mean);
  // Large houses: seats grouped in classes of W so a few thousand draws give
  // a readable shape instead of single-seat noise; heights renormalised.
  const W = totalSeats > 200 ? 3 : 1;
  const data = [];
  for (const party of ordered) {
    const bins = new Map();
    for (const b of distributions[party].histogram) { const k = Math.floor(b.seats / W) * W; bins.set(k, (bins.get(k) ?? 0) + b.prob); }
    const maxP = Math.max(...bins.values());
    for (const [seats, prob] of [...bins].sort((a, b) => a[0] - b[0])) data.push({ party, seats, prob, height: prob / maxP });
  }

  const plot = Plot.plot({
    width: 640,
    height: 90 * ordered.length,
    marginLeft: 72,
    marginRight: 20,
    x: { label: T.seats, domain: [0, totalSeats], grid: true },
    y: { label: null, axis: null, domain: [0, 1] },
    fy: { domain: ordered, label: null, tickFormat: label },
    color: colorScale(partyCodes),
    marks: [
      Plot.ruleX([threshold], { stroke: "#000", strokeDasharray: "3,3" }),
      Plot.areaY(data, { x: "seats", y: "height", fy: "party", fill: "party", fillOpacity: 0.5, curve: "step" }),
      Plot.lineY(data, { x: "seats", y: "height", fy: "party", stroke: "party", strokeWidth: 1.5, curve: "step" }),
      // The headline is the MEDOID: the simulated draw closest (mean L1) to
      // all others -- the most typical JOINT scenario. Per-party medians are
      // not jointly attainable (they don't sum to the house size), and the
      // central point projection floors any party sitting narrowly second in
      // many ridings (CAQ showed 3 while its simulated median was 11). The
      // medoid is an actual draw: coherent across parties, sums to 127.
      Plot.text(ordered.map((p) => ({ party: p, label: `${medoidCounts[p] ?? 0} [${distributions[p].p05}–${distributions[p].p95}]` })),
        { fy: "party", x: totalSeats, y: 0.5, text: "label", textAnchor: "end", fontSize: 11, fill: "#333" }),
    ],
  });
  host.appendChild(plot);

  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    T.seatNote(registry.nDraws.toLocaleString(LOCALE), threshold);
  host.appendChild(note);
}

// ---- Vote-vs-seat disproportion ----------------------------------------------
// Each simulation draw carries both a national vote composition and a seat
// allocation, so the electoral system's distortion is a joint distribution:
// dumbbells show expected vote share vs expected seat share per party, the
// note carries the Gallagher index summarised over the draws.

function renderDisproportion(d, partyCodes) {
  const host = document.getElementById("disproportion");
  if (!d) { host.textContent = T.nd; return; }
  host.innerHTML = "";

  const ordered = [...partyCodes]
    .filter((p) => d.voteShare[p] > 0.5 || d.seatShare[p] > 0.5)
    .sort((a, b) => d.voteShare[b] - d.voteShare[a]);
  const rows = ordered.map((p) => ({
    party: p,
    votes: d.voteShare[p],
    sieges: d.seatShare[p],
    gap: d.gaps[p].p50,
  }));

  const plot = Plot.plot({
    width: 640,
    height: 46 * rows.length + 50,
    marginLeft: 72,
    marginRight: 175,
    x: { label: T.dispAxis, grid: true },
    y: { domain: ordered, label: null, tickFormat: label },
    color: colorScale(partyCodes),
    marks: [
      Plot.arrow(rows, {
        x1: "votes", x2: "sieges", y1: "party", y2: "party",
        stroke: "party", strokeWidth: 2, headLength: 5,
      }),
      Plot.dot(rows, { x: "votes", y: "party", fill: "party", r: 4 }),
      // Labels sit at their own mark: the vote share beside the dot on the
      // side AWAY from the arrow, the seat share beyond the arrowhead. When
      // the arrow is too short for side-by-side text, the two stack.
      ...(() => {
        const vLbl = (r) => T.pctVotes(formatNumber(r.votes));
        const sLbl = (r) => T.pctSeats(formatNumber(r.sieges));
        const wide = rows.filter((r) => Math.abs(r.sieges - r.votes) >= 3);
        const tight = rows.filter((r) => Math.abs(r.sieges - r.votes) < 3);
        const right = wide.filter((r) => r.sieges > r.votes);
        const left = wide.filter((r) => r.sieges < r.votes);
        // A left-pointing head near the axis has no room for an end-anchored
        // label (QS at 3 % overprinted the axis): it goes above the head.
        const leftFar = left.filter((r) => r.sieges >= 8);
        const leftEdge = left.filter((r) => r.sieges < 8);
        const TXT = { fontSize: 11, fill: "#333", y: "party" };
        return [
          Plot.text(right, { ...TXT, x: "votes", text: vLbl, dx: -9, textAnchor: "end" }),
          Plot.text(right, { ...TXT, x: "sieges", text: sLbl, dx: 11, textAnchor: "start" }),
          Plot.text(left, { ...TXT, x: "votes", text: vLbl, dx: 9, textAnchor: "start" }),
          Plot.text(leftFar, { ...TXT, x: "sieges", text: sLbl, dx: -11, textAnchor: "end" }),
          Plot.text(leftEdge, { ...TXT, x: "sieges", text: sLbl, dx: -4, dy: -12, textAnchor: "start" }),
          Plot.text(tight, { ...TXT, x: (r) => Math.max(r.votes, r.sieges), text: sLbl, dx: 10, dy: -7, textAnchor: "start" }),
          Plot.text(tight, { ...TXT, x: (r) => Math.max(r.votes, r.sieges), text: vLbl, dx: 10, dy: 7, textAnchor: "start" }),
        ];
      })(),
    ],
  });
  host.appendChild(plot);

  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    T.dispNote(registry.nDraws.toLocaleString(LOCALE), registry.totalSeats, formatNumber(d.gallagher.p50, 1),
      formatNumber(d.gallagher.p05, 1), formatNumber(d.gallagher.p95, 1), CFG.gallagherRef(registry.meta));
  host.appendChild(note);
}

// ---- Government scenarios ---------------------------------------------------
// Mutually exclusive by construction: every simulation lands in exactly one
// row, so the probabilities partition to 100%. For a minority, the parties
// holding the balance of power are listed: parties other than the government
// and the Official Opposition whose seats would lift the government to a
// majority.

/** Parties holding the balance of power in a minority scenario. */
const balanceHolders = (s) => (s.type === "minority" ? (s.supports ?? []).filter((p) => p !== s.opposition) : []);

function renderGovernmentScenarios(scenarios, totalSeats, partyCodes) {
  const host = document.getElementById("government-outcomes");
  host.innerHTML = "";
  const threshold = Math.floor(totalSeats / 2) + 1;

  const majority = scenarios.filter((s) => s.type === "majority").reduce((a, s) => a + s.probability, 0);
  // Round once and subtract, rather than rounding both: two complementary
  // probabilities rounded independently display as 9% and 92%.
  const majPct = Math.round(majority * 100);
  const lead = document.createElement("p");
  lead.innerHTML = T.govLead(majPct, 100 - majPct);
  host.appendChild(lead);

  const table = document.createElement("table");
  table.innerHTML = `<thead><tr>${T.govHead}</tr></thead>`;
  const tbody = document.createElement("tbody");

  for (const s of scenarios.filter((x) => x.probability >= 0.01)) {
    const tr = document.createElement("tr");
    const kind = s.type === "majority" ? T.majority : T.minority;
    let supports;
    if (s.type === "majority") supports = `<span class="muted-cell">${T.na}</span>`;
    else if (balanceHolders(s).length) supports = balanceHolders(s).map(chip).join(" ");
    else supports = `<span class="muted-cell">${T.noneSuffices}</span>`;
    tr.innerHTML =
      `<td>${formatPercent(s.probability)}</td>` +
      `<td>${chip(s.leader)} <span class="muted-cell">${kind}</span></td>` +
      `<td>${s.opposition ? chip(s.opposition) : "-"}</td>` +
      `<td>${supports}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);

  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    T.govNote(threshold);
  host.appendChild(note);
}

// ---- Seats by certainty ----------------------------------------------------
// Each riding goes to its favourite (highest probability of winning), classed
// by that probability; one stacked bar per party, darker = surer.

const CERTAINTY = [0.95, 0.75, 0.6, 0];
const CERTAINTY_OPACITY = [1, 0.68, 0.42, 0.2];

function renderSeatCertainty(winProbs, partyCodes, totalSeats) {
  const host = document.getElementById("seat-certainty");
  if (!winProbs) { host.closest("section")?.remove(); return; }
  host.innerHTML = "";
  const cells = new Map();
  for (const [code, probs] of Object.entries(winProbs)) {
    const p = partyCodes.reduce((b, q) => ((probs[q] ?? 0) > (probs[b] ?? 0) ? q : b), partyCodes[0]);
    const k = CERTAINTY.findIndex((t) => probs[p] >= t);
    const key = `${p}|${k}`;
    if (!cells.has(key)) cells.set(key, { party: p, k, n: 0, names: [] });
    const c = cells.get(key); c.n++; c.names.push(registry.nameByCode.get(code) ?? code);
  }
  const totals = Object.fromEntries(partyCodes.map((p) => [p, 0]));
  for (const c of cells.values()) totals[c.party] += c.n;
  const parties = partyCodes.filter((p) => totals[p] > 0).sort((a, b) => totals[b] - totals[a]);
  const rows = [...cells.values()].sort((a, b) => a.k - b.k);
  const threshold = Math.floor(totalSeats / 2) + 1;
  const list = (names) => names.length > 12 ? `${names.slice(0, 12).join(", ")}…` : names.join(", ");

  host.appendChild(Plot.plot({
    width: 560,
    height: 40 * parties.length + 50,
    marginLeft: 72,
    marginRight: 20,
    marginBottom: 44,
    x: { label: T.certaintyAxis, labelAnchor: "center", labelArrow: "none", labelOffset: 34, domain: [0, Math.max(threshold, ...Object.values(totals)) * 1.04], grid: true },
    y: { domain: parties, label: null, tickFormat: label },
    marks: [
      Plot.barX(rows, Plot.stackX({
        x: "n", y: "party", order: "k", fill: (d) => PARTY_COLORS[d.party] ?? "#a8a29e",
        fillOpacity: (d) => CERTAINTY_OPACITY[d.k], insetTop: 6, insetBottom: 6,
      })),
      Plot.text(rows.filter((d) => d.n >= 3), Plot.stackX({
        x: "n", y: "party", order: "k", text: "n", fill: (d) => (d.k < 2 ? "white" : "#1c1917"), fontSize: 11,
      })),
      Plot.tip(rows, Plot.pointer(Plot.stackX({
        x: "n", y: "party", order: "k",
        title: (d) => T.certaintyTip(label(d.party), T.certainty[d.k], d.n, list(d.names)),
      }))),
      Plot.ruleX([threshold], { stroke: "#1c1917", strokeDasharray: "3,3" }),
      Plot.ruleX([0]),
    ],
  }));

  const legend = document.createElement("div");
  legend.className = "certainty-legend";
  legend.innerHTML = T.certainty.map((c, k) => `<span><i style="opacity:${CERTAINTY_OPACITY[k]}"></i>${c}</span>`).join("");
  host.appendChild(legend);
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = T.certaintyNote(threshold);
  host.appendChild(note);
}

// ---- Main -------------------------------------------------------------------

/** Results of the election against the eve-of-election forecast, in a row above the trend. */
function renderResults(results, projection) {
  const row = document.createElement("div");
  row.className = "row results";
  row.innerHTML = `<section><h2>${T.results(results.preliminary)}</h2><div id="results-summary"></div></section>`;
  document.querySelector(".row.trend").before(row);
  const valid = Object.values(results.votes).reduce((a, b) => a + b, 0);
  const eve = projection.medoidCounts ?? projection.pointCounts, vote = projection.meta.projectedVote ?? {};
  const order = Object.keys(results.votes).filter((p) => p !== "AUTRES").sort((a, b) => results.votes[b] - results.votes[a]);
  const rows = order.map((p) => {
    const d = projection.seatDistributions[p];
    const interval = d ? `<span class="interval">${d.p05}–${d.p95}</span>` : "";
    return `<tr><td>${chip(p)}</td><td class="n"><b>${results.seats[p] ?? 0}</b></td><td class="n">${eve[p] ?? 0}${interval}</td>` +
      `<td class="n"><b>${formatPercent(results.votes[p] / valid, 1)}</b></td><td class="n">${vote[p] != null ? formatPercent(vote[p], 1) : T.nd}</td></tr>`;
  }).join("");
  const ridings = Object.entries(results.ridings);
  const hits = ridings.filter(([code, r]) => projection.ridingForecast[code]?.winner === r.winner).length;
  const reporting = results.provenance.match(/([\d.]+) % des urnes/)?.[1];
  const source = T.resultsSource(results.preliminary, reporting ? formatPercent(Number(reporting) / 100, 2) : null);
  document.getElementById("results-summary").innerHTML = `<div class="table-scroll"><table class="results-table"><thead><tr>${T.resultsHead}</tr></thead>` +
    `<tbody>${rows}</tbody></table></div><p class="note">${T.resultsNote(hits, ridings.length, source)}</p>`;
}

async function loadJSON(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`);
  return resp.json();
}

async function main() {
  const status = document.getElementById("status");
  status.textContent = T.loading;

  // The page DISPLAYS a precomputed projection (js/tools/compute.mjs writes
  // qc_projection.json when the poll watch finds new data). The modelling
  // code is identical -- computeProjection.js, same library -- it just runs
  // in Node at build time instead of in every visitor's browser. Page load
  // went from ~20s of GP fitting to rendering a JSON.
  const F = CFG.files;
  const opt = (path) => (path ? loadJSON(path).catch(() => null) : Promise.resolve(null));
  const [projection, pollRows, geojson, leaders, tileLayout, results] = await Promise.all([
    loadJSON(F.projection), loadJSON(F.polls), opt(F.geojson), opt(F.leaders), opt(F.tiles), opt(F.results),
  ]);

  const { meta, partyCodes, trendSeries, totalSeats } = projection;
  registry.partyCodes = partyCodes;
  registry.totalSeats = totalSeats;
  registry.meta = meta;
  registry.nDraws = meta.nDraws ?? (Object.values(projection.seatDistributions)[0]?.histogram
    ? Math.round(1 / Math.min(...Object.values(projection.seatDistributions).flatMap((d) => d.histogram.map((b) => b.prob)).filter((x) => x > 0)))
    : 0);
  registry.nameByCode = projection.ridingNames
    ? new Map(Object.entries(projection.ridingNames))
    : new Map(geojson.features.map((f) => [normalizeRidingCode(f.properties.riding_code), f.properties.riding_name]));
  const ridingForecast = new Map(Object.entries(projection.ridingForecast));
  registry.ridingForecast = ridingForecast;
  registry.winProbs = projection.ridingWinProbs ?? null;
  registry.candidates = projection.ridingCandidates ?? null;
  const baselineAll = projection.ridingBaseline ?? projection.ridingBaseline2022;
  registry.ridingBaseline = { sharesFor: (code) => baselineAll[String(code)] ?? null };

  // generatedAt is ISO UTC; shown in Eastern time.
  const computedAt = new Intl.DateTimeFormat(LOCALE, {
    timeZone: "America/Toronto", dateStyle: "long", timeStyle: "short",
  }).format(new Date(meta.generatedAt));
  status.textContent =
    T.status(new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeZone: "UTC" }).format(new Date(meta.asOf)), meta.nPolls, meta.nRidings, computedAt);

  // Sections without data for this election are removed, not left empty.
  const drop = (id) => document.getElementById(id)?.closest("section")?.remove();
  if (!leaders) drop("leader-ridings");
  // After the vote, the results come first, next to the frozen forecast.
  if (results && results.election === meta.electionDate) section("results-summary", () => renderResults(results, projection));
  section("trend-chart", () => {
    // Dots come from the raw poll rows (a cheap pivot, no fitting); the
    // smoothed series and bands come precomputed.
    const { polls } = pivotPolls(pollRows);
    // The trend may include parties of earlier cycles (trendPartyCodes).
    renderTrendChart(trendSeries, polls, projection.trendPartyCodes ?? partyCodes);
    // When the seat projection uses vote shares corrected for the polls'
    // historical bias, say so under the poll trend, with the shares used.
    if (meta.projectedVote) {
      const note = document.createElement("p");
      note.className = "note";
      const shares = partyCodes.filter((p) => meta.projectedVote[p] >= 0.005)
        .sort((a, b) => meta.projectedVote[b] - meta.projectedVote[a])
        .map((p) => `${label(p)} ${formatPercent(meta.projectedVote[p], 1)}`).join(", ");
      note.textContent = (CFG.trendNote ?? T.trendNote)(shares);
      document.getElementById("trend-chart").appendChild(note);
    }
  });

  if (tileLayout) section("tile-map", () => renderTileMap(tileLayout, projection.ridingWinProbs, ridingForecast));

  // Tiles by default; the geographic map stays one click away. Leaflet
  // CANNOT be initialised inside a hidden container (it computes its pixel
  // size at init and gets zero -- the map then renders blank), so it is
  // created lazily on the first switch, once the container is visible.
  const btnTiles = document.getElementById("btn-tiles");
  const btnGeo = document.getElementById("btn-geo");
  const setMode = (tiles) => {
    document.getElementById("tile-map").hidden = !tiles;
    document.getElementById("riding-map").hidden = tiles;
    btnTiles.classList.toggle("active", tiles);
    btnGeo.classList.toggle("active", !tiles);
    if (!tiles && !registry.leafletMap) {
      section("riding-map", () => renderMap(geojson, ridingForecast));
      // Late init: re-apply the current selection so the map opens in sync.
      if (registry.selectedCode) selectRiding(registry.selectedCode, { zoom: false });
    }
  };
  btnTiles.onclick = () => setMode(true);
  btnGeo.onclick = () => setMode(false);
  if (tileLayout) setMode(true);
  else if (geojson) { document.getElementById("map-mode").hidden = true; setMode(false); }
  else { drop("tile-map"); document.querySelector(".row.explore")?.classList.add("nomap"); }
  section("watchlist", () => renderWatchlist(ridingForecast, partyCodes));
  if (leaders) section("leader-ridings", () => renderLeaderRidings(leaders, partyCodes));
  section("seat-bar", () =>
    renderSeatDistributions(projection.seatDistributions, totalSeats, partyCodes,
      projection.medoidCounts ?? projection.pointCounts));
  section("government-outcomes", () =>
    renderGovernmentScenarios(projection.scenarios, totalSeats, partyCodes));
  section("seat-certainty", () => renderSeatCertainty(projection.ridingWinProbs, partyCodes, totalSeats));
  section("disproportion", () =>
    renderDisproportion(projection.disproportion, partyCodes));

  // Default selection so the detail panel isn't empty on first load, and so
  // it's obvious from the start that clicking updates it.
  const firstWatchlistCode = [...registry.watchlistRowsByCode.keys()][0];
  if (firstWatchlistCode) selectRiding(firstWatchlistCode, { zoom: false });
}

main().catch((err) => {
  console.error(err);
  document.getElementById("status").textContent = T.fatal(err.message);
});

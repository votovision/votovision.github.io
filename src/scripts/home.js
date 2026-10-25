/**
 * Home page: summary of each forecast (seats in the median scenario,
 * intervals, probability of a majority, one-year trend) and the latest polls
 * of both elections, read from the same files as the dashboards.
 */
import * as Plot from "@observablehq/plot";
import { PARTIES, repoData, LANG, LOCALE, partyLabel, formatPercent } from "./parties.js";

const T = {
  fr: {
    name: { qc: "Québec", bc: "Colombie-Britannique", ca: "Canada" }, short: { bc: "C.-B." }, party: "Parti", forecast: (a) => (a ? `Prévision ${a}` : "Prévision"), interval: "Intervalle à 90 %",
    majority: (n) => `Majorité : ${n} sièges`, seatsOf: (p, n) => `${p} : ${n} sièges`,
    house: (t, n) => `${t} sièges · majorité : ${n}`,
    first: (p) => `${p} avec le plus de sièges`, majorityGov: "Gouvernement majoritaire",
    asOf: (d, n) => `Sondages au ${d} · ${n} sondages`, unavailable: "Prévision indisponible.", live: (d) => `Élections du ${d}`, next: (d) => `Prochaines élections : au plus tard le ${d}`,
    colon: " :",
    results: (d, prelim) => `${prelim ? "Résultats préliminaires" : "Résultats"} · ${formatDate(d)}`,
    seats: "Sièges", vote: "Vote", eve: "Prévision",
    eveLeader: (p, x) => `Prévision de la veille : ${p} en tête à ${x}`,
    favourites: (n, t) => `Favori de la prévision élu dans ${n} circonscriptions sur ${t}`,
    reporting: (x) => `Elections BC · ${x} des urnes dépouillées · votes par la poste comptés au décompte final`,
  },
  en: {
    name: { qc: "Quebec", bc: "British Columbia", ca: "Canada" }, short: { bc: "B.C." }, party: "Party", forecast: (a) => (a ? `${a} forecast` : "Forecast"), interval: "90% interval",
    majority: (n) => `Majority: ${n} seats`, seatsOf: (p, n) => `${p}: ${n} seats`,
    house: (t, n) => `${t} seats · majority: ${n}`,
    first: (p) => `${p} with the most seats`, majorityGov: "Majority government",
    asOf: (d, n) => `Polls as of ${d} · ${n} polls`, unavailable: "Forecast unavailable.", live: (d) => `Election on ${d}`, next: (d) => `Next election: by ${d}`,
    colon: ":",
    results: (d, prelim) => `${prelim ? "Preliminary results" : "Results"} · ${formatDate(d)}`,
    seats: "Seats", vote: "Vote", eve: "Forecast",
    eveLeader: (p, x) => `Eve-of-election forecast: ${p} ahead at ${x}`,
    favourites: (n, t) => `Forecast favourite elected in ${n} of ${t} ridings`,
    reporting: (x) => `Elections BC · ${x} of ballot boxes reported · mail-in ballots counted at the final count`,
  },
}[LANG];

const SOURCES = {
  qc: { repo: "quebec", projection: "qc_projection.json", polls: "qc_national_polls.json" },
  bc: { repo: "bc", projection: "bc_dashboard.json", polls: "bc_national_polls.json", results: "bc_results.json" },
  ca: { repo: "canada", projection: "ca_dashboard.json", polls: "ca_national_polls.json" },
};
const monthYear = (d) => d.toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" });
const formatDate = (iso) => new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

/** Seat bar of the median scenario (or of the results), with the majority threshold. */
function seatBar(proj, P, seats = proj.medoidCounts ?? proj.pointCounts) {
  const total = proj.totalSeats;
  const order = proj.partyCodes.filter((p) => seats[p] > 0).sort((a, b) => seats[b] - seats[a]);
  const threshold = Math.floor(total / 2) + 1;
  const bar = document.createElement("div");
  bar.className = "seat-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", order.map((p) => `${P.label(p)} ${seats[p]}`).join(", "));
  for (const p of order) {
    const seg = document.createElement("span");
    seg.style.flexGrow = seats[p];
    seg.style.background = P.color(p);
    seg.title = T.seatsOf(P.label(p), seats[p]);
    bar.appendChild(seg);
  }
  const mark = document.createElement("span");
  mark.className = "threshold";
  mark.style.left = `${(threshold / total) * 100}%`;
  mark.title = T.majority(threshold);
  bar.appendChild(mark);
  return { bar, order, seats, threshold };
}

/** Twelve-month trend, one line per party, labels at the end. */
function trend(proj, P) {
  const end = new Date(proj.trendSeries.at(-1).date);
  const start = new Date(end); start.setFullYear(start.getFullYear() - 1);
  const rows = proj.trendSeries.filter((r) => new Date(r.date) >= start);
  const points = rows.flatMap((r) => proj.partyCodes.filter((p) => p !== "AUTRES" && r[p]).map((p) => ({ date: new Date(r.date), p, v: r[p].mean })));
  const last = proj.partyCodes.filter((p) => p !== "AUTRES" && rows.at(-1)[p] && rows.at(-1)[p].mean >= 0.04)
    .map((p) => ({ p, v: rows.at(-1)[p].mean })).sort((a, b) => b.v - a.v);
  last[0].y = last[0].v;
  for (let i = 1; i < last.length; i++) last[i].y = Math.min(last[i].v, last[i - 1].y - 0.065);
  // Labels pushed below the axis move up together.
  const lift = Math.max(0, 0.03 - last.at(-1).y);
  for (const l of last) l.y += lift;
  return Plot.plot({
    width: 320, height: 150, marginLeft: 0, marginRight: 82, marginTop: 8, marginBottom: 22,
    x: { ticks: 0, label: null }, y: { axis: null, domain: [0, Math.max(...points.map((d) => d.v), ...last.map((d) => d.y)) * 1.08] },
    marks: [
      Plot.ruleY([0], { stroke: "#d6d3d1" }),
      Plot.lineY(points, { x: "date", y: "v", z: "p", stroke: (d) => P.color(d.p), strokeWidth: 2 }),
      Plot.text(last, { x: () => end, y: "y", text: (d) => `${P.label(d.p)} ${formatPercent(d.v)}`, dx: 6, textAnchor: "start", fill: "#44403c", fontSize: 13 }),
      Plot.text([start], { x: (d) => d, frameAnchor: "bottom", dy: 14, text: monthYear, textAnchor: "start", fill: "#6b6560", fontSize: 13 }),
      Plot.text([end], { x: (d) => d, frameAnchor: "bottom", dy: 14, text: monthYear, textAnchor: "end", fill: "#6b6560", fontSize: 13 }),
    ],
  });
}

function summarise(election, proj, results) {
  const C = PARTIES[election];
  const P = { color: (p) => C.colors[p] ?? "#a8a29e", label: (p) => partyLabel(election, p) };
  const host = document.querySelector(`.tile.election[data-election="${election}"] .summary`);
  host.innerHTML = "";
  if (results && results.election === proj.meta?.electionDate) return summariseResults(proj, results, P, host);

  // Election under way: the vote is within the next 60 days.
  const days = proj.meta?.electionDate ? (Date.parse(proj.meta.electionDate) - Date.now()) / 864e5 : null;
  if (days !== null && days > -1 && days <= 60) {
    const tile = host.closest(".tile.election");
    tile.classList.add("live");
    const badge = document.createElement("p");
    badge.className = "live-badge";
    badge.textContent = T.live(formatDate(proj.meta.electionDate));
    tile.querySelector("h2").after(badge);
  } else if (days !== null && days > 60) {
    // Otherwise, the date by which the next election must be held (fixed-date law; it can come sooner).
    const next = document.createElement("p");
    next.className = "next-election";
    next.textContent = T.next(formatDate(proj.meta.electionDate));
    host.closest(".tile.election").querySelector("h2").after(next);
  }

  const { bar, order, seats, threshold } = seatBar(proj, P);
  const frame = document.createElement("div");
  frame.className = "seat-frame";
  frame.appendChild(bar);
  const legend = document.createElement("p");
  legend.className = "threshold-legend";
  legend.textContent = T.house(proj.totalSeats, threshold);
  frame.appendChild(legend);
  host.appendChild(frame);

  const body = document.createElement("div");
  body.className = "tile-body";
  const table = document.createElement("table");
  table.className = "seat-table";
  table.innerHTML = `<thead><tr><th>${T.party}</th><th>${T.forecast(proj.meta?.electionDate?.slice(0, 4))}</th><th>${T.interval}</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const p of order.slice(0, 5)) {
    const d = proj.seatDistributions[p];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><span class="sw" style="background:${P.color(p)}"></span>${P.label(p)}</td>` +
      `<td class="n">${seats[p]}</td><td class="n muted">${d.p05}–${d.p95}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  body.appendChild(table);
  const fig = document.createElement("figure");
  fig.className = "trend";
  fig.appendChild(trend(proj, P));
  body.appendChild(fig);
  host.appendChild(body);

  const majority = proj.scenarios.filter((s) => s.type === "majority").reduce((a, s) => a + s.probability, 0);
  const leading = {};
  for (const s of proj.scenarios) leading[s.leader] = (leading[s.leader] ?? 0) + s.probability;
  const [first, pFirst] = Object.entries(leading).sort((a, b) => b[1] - a[1])[0];
  const facts = document.createElement("p");
  facts.className = "facts";
  facts.innerHTML = `<span><span class="sw" style="background:${P.color(first)}"></span>${T.first(P.label(first))}${T.colon} <b>${formatPercent(pFirst)}</b></span>` +
    `<span>${T.majorityGov}${T.colon} <b>${formatPercent(majority)}</b></span>`;
  host.appendChild(facts);

  const date = document.createElement("p");
  date.className = "computed-on";
  date.textContent = T.asOf(formatDate(proj.meta.asOf), proj.meta.nPolls);
  host.appendChild(date);
}

/** After the vote: results (seats, vote), next to the eve-of-election forecast. */
function summariseResults(proj, results, P, host) {
  const badge = document.createElement("p");
  badge.className = "live-badge done";
  badge.textContent = T.results(results.election, results.preliminary);
  host.closest(".tile.election").querySelector("h2").after(badge);

  const { bar, threshold } = seatBar(proj, P, results.seats);
  const frame = document.createElement("div");
  frame.className = "seat-frame";
  frame.appendChild(bar);
  const legend = document.createElement("p");
  legend.className = "threshold-legend";
  legend.textContent = T.house(proj.totalSeats, threshold);
  frame.appendChild(legend);
  host.appendChild(frame);

  const valid = Object.values(results.votes).reduce((a, b) => a + b, 0);
  const eve = proj.medoidCounts ?? proj.pointCounts;
  const order = Object.keys(results.votes).filter((p) => p !== "AUTRES").sort((a, b) => results.votes[b] - results.votes[a]).slice(0, 5);
  const table = document.createElement("table");
  table.className = "seat-table";
  table.innerHTML = `<thead><tr><th>${T.party}</th><th>${T.seats}</th><th>${T.vote}</th><th>${T.eve}</th></tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const p of order) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><span class="sw" style="background:${P.color(p)}"></span>${P.label(p)}</td>` +
      `<td class="n">${results.seats[p] ?? 0}</td><td class="n">${formatPercent(results.votes[p] / valid, 1)}</td><td class="n muted">${eve[p] ?? 0}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);

  const leading = {};
  for (const s of proj.scenarios) leading[s.leader] = (leading[s.leader] ?? 0) + s.probability;
  const [first, pFirst] = Object.entries(leading).sort((a, b) => b[1] - a[1])[0];
  const ridings = Object.entries(results.ridings);
  const hits = ridings.filter(([code, r]) => proj.ridingForecast?.[code]?.winner === r.winner).length;
  const facts = document.createElement("p");
  facts.className = "facts";
  facts.innerHTML = `<span>${T.eveLeader(P.label(first), `<b>${formatPercent(pFirst)}</b>`)}</span>` +
    `<span>${T.favourites(`<b>${hits}</b>`, ridings.length)}</span>`;
  host.appendChild(facts);

  const reporting = results.provenance.match(/([\d.]+) % des urnes/)?.[1];
  const note = document.createElement("p");
  note.className = "computed-on";
  note.textContent = reporting ? T.reporting(formatPercent(Number(reporting) / 100, 2)) : results.provenance;
  host.appendChild(note);
}

/** The most recent polls of both elections, with the leading party. */
function latestPolls(batches) {
  const list = [];
  for (const [election, rows] of batches) {
    const C = PARTIES[election];
    const byPoll = new Map();
    for (const r of rows) {
      if (!byPoll.has(r.poll_id)) byPoll.set(r.poll_id, { election, firm: r.firm, date: r.poll_date, shares: {} });
      byPoll.get(r.poll_id).shares[r.party_code] = r.pct_reported;
    }
    for (const s of byPoll.values()) {
      const [p, v] = Object.entries(s.shares).filter(([q]) => q !== "AUTRES").sort((a, b) => b[1] - a[1])[0] ?? [];
      list.push({ ...s, value: v, color: C.colors[p] ?? "#a8a29e", label: partyLabel(election, p) });
    }
  }
  list.sort((a, b) => b.date.localeCompare(a.date));
  const ol = document.getElementById("latest-polls");
  ol.innerHTML = "";
  for (const s of list.slice(0, 6)) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="jurisdiction">${T.short[s.election] ?? T.name[s.election]}</span>` +
      `<span class="firm">${s.firm}</span>` +
      `<span class="leading"><span class="sw" style="background:${s.color}"></span>${s.label} ${formatPercent(s.value / 100)}</span>` +
      `<span class="date">${formatDate(s.date)}</span>`;
    ol.appendChild(li);
  }
}

const batches = await Promise.all(Object.entries(SOURCES).map(async ([election, s]) => {
  const base = repoData(s.repo);
  try {
    const [proj, polls, results] = await Promise.all([loadJSON(base + s.projection), loadJSON(base + s.polls),
      s.results ? loadJSON(base + s.results).catch(() => null) : null]);
    summarise(election, proj, results);
    return [election, polls];
  } catch (err) {
    console.error(err);
    document.querySelector(`.tile.election[data-election="${election}"] .summary`).innerHTML = `<p class="pending">${T.unavailable}</p>`;
    return [election, []];
  }
}));
latestPolls(batches);

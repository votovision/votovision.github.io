// Vote par groupe de sections de 2026 desservies par un même bureau de vote par anticipation : vote du jour du scrutin
// et vote par anticipation, en 2026 (mesurés) et en 2022 (transposés sur les sections de 2026), avec le parti arrivé premier.
// Le vote par anticipation est publié par bureau ; à l'intérieur d'un groupe, il n'est jamais réparti dans l'analyse.
// Pour 2022, il est réparti par section de 2022 au prorata des électeurs, puis transposé avec les poids : une approximation.
// Écrit posts/data/2026-11_migration-sections/advance_poll_groups_2022_2026.csv.
//
// Run: node posts/fr/2026-11_migration-sections/build_advance_poll_groups.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { csvParse, csvFormat, groups, sum } from "d3";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path) => csvParse(readFileSync(repository + path, "utf-8"));
const PARTIES = ["PQ", "LIB", "CAQ", "QS", "PCQ", "AUTRES"];
const key = (riding, section) => `${riding}-${section}`;

const sections = read("posts/data/2026-11_migration-sections/sections_2022_2026.csv");
const advance = read("posts/data/2026-11_vote-correlations/advance_votes_sections.csv");
const weights = read("posts/data/2026-11_vote-correlations/section_weights_2022_2026.csv");
const advance2026 = new Map(advance.filter((r) => r.election.startsWith("2026")).map((r) => [key(r.riding_code, r.section), r]));
const advance2022 = new Map(advance.filter((r) => r.election.startsWith("2022")).map((r) => [key(r.riding_code, r.section), r]));
const transposed2022 = new Map();
for (const w of weights) {
  const from = advance2022.get(key(w.from_riding, w.from_section)); if (!from) continue;
  const to = key(w.to_riding, w.to_section), totals = transposed2022.get(to) ?? transposed2022.set(to, PARTIES.map(() => 0)).get(to);
  PARTIES.forEach((p, k) => (totals[k] += Number(w.weight) * Number(from[p])));
}
const number = (v) => (v === "" || v === undefined ? 0 : Number(v));
// Premier : parti principal en tête, sauf si les autres partis réunis le dépassent ; aucun s'il n'y a pas de votes.
const winner = (votes) => {
  if (!sum(votes)) return "";
  const best = PARTIES.slice(0, 5).reduce((a, p, k) => (votes[k] > votes[a] ? k : a), 0);
  return votes[5] > votes[best] ? "AUTRES" : PARTIES[best];
};
const rows = groups(sections.filter((s) => advance2026.has(key(s.circonscription, s.sv))), (s) => key(s.circonscription, advance2026.get(key(s.circonscription, s.sv)).advance_poll))
  .map(([, members]) => {
    const first = members[0], poll = advance2026.get(key(first.circonscription, first.sv)).advance_poll;
    const votes2026 = PARTIES.map((p) => sum(members, (s) => number(s[`2026_${p}`]) + number(advance2026.get(key(s.circonscription, s.sv))[p])));
    const votes2022 = PARTIES.map((p, k) => sum(members, (s) => number(s[`2022_${p}`]) + (transposed2022.get(key(s.circonscription, s.sv))?.[k] ?? 0)));
    return {
      riding_code: first.circonscription, riding_name: first.nom, advance_poll: poll, sections: members.length,
      ...Object.fromEntries(PARTIES.map((p, k) => [`votes_2026_${p}`, Math.round(votes2026[k])])), winner_2026: winner(votes2026),
      ...Object.fromEntries(PARTIES.map((p, k) => [`votes_2022_${p}`, Math.round(votes2022[k] * 10) / 10])), winner_2022: winner(votes2022),
    };
  });
writeFileSync(repository + "posts/data/2026-11_migration-sections/advance_poll_groups_2022_2026.csv", csvFormat(rows) + "\n");
console.log(`${rows.length} groupes de sections, ${rows.filter((r) => r.winner_2022 && r.winner_2026).length} avec un premier aux deux élections`);

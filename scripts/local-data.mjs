/**
 * Copies, for development, the files the dashboards read from the
 * neighbouring model repositories (../quebec/data, ../bc/data, ../canada/data) into
 * public/data/ (not versioned). In production the dashboards read them
 * directly from the published repositories.
 *
 * Run: npm run local-data
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";

const FILES = {
  quebec: ["qc_projection.json", "qc_national_polls.json", "qc_ridings_2026.geojson", "qc_leaders.json", "qc_tile_layout.json"],
  bc: ["bc_dashboard.json", "bc_national_polls.json", "bc_results.json", "bc_ridings_2023.geojson", "bc_tile_layout.json"],
  canada: ["ca_dashboard.json", "ca_national_polls.json", "ca_ridings_2023.geojson", "ca_tile_layout.json"],
};
for (const [repo, files] of Object.entries(FILES)) {
  const dest = new URL(`../public/data/${repo}/`, import.meta.url);
  mkdirSync(dest, { recursive: true });
  for (const f of files) {
    const src = new URL(`../../${repo}/data/${f}`, import.meta.url);
    if (!existsSync(src)) { console.log(`missing: ${repo}/data/${f}`); continue; }
    copyFileSync(src, new URL(f, dest));
    console.log(`public/data/${repo}/${f}`);
  }
}

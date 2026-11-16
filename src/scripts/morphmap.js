/**
 * Three-stage riding map drawn in the tile map's SVG: area (geography),
 * electors (each riding scaled to its registered electors and centred on its
 * tile), tiles (one square per riding). The stage is a number t in [0, 2]:
 * from 0 to 1 the shapes move and scale rigidly; from 1 to 2 each outline,
 * resampled to N points, morphs point by point into its square.
 */
import { geoConicEqualArea } from "d3-geo";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { select } from "d3-selection";
import "d3-transition";

const N = 96; // points per resampled outline
const FILL = 0.45; // share of a tile's area taken by the median riding at the electors stage
const NS = "http://www.w3.org/2000/svg";

const shoelace = (ring) => {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % n];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
};

function centroid(rings) {
  let a = 0, cx = 0, cy = 0;
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % n], k = x0 * y1 - x1 * y0;
      a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** N points equally spaced along the closed ring. */
function resample(ring, n) {
  const pts = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  const seg = pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out = [];
  let i = 0, done = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (done + seg[i] < target && i < pts.length - 1) done += seg[i++];
    const f = seg[i] ? (target - done) / seg[i] : 0, p = pts[i], q = pts[(i + 1) % pts.length];
    out.push([p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])]);
  }
  return out;
}

/** N points along a square of half-side h centred at 0, clockwise on screen from the top-left corner. */
function squarePoints(h, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const s = (k / n) * 4, side = Math.floor(s), f = s - side;
    out.push(side === 0 ? [-h + 2 * h * f, -h] : side === 1 ? [h, -h + 2 * h * f] : side === 2 ? [h - 2 * h * f, h] : [-h, h - 2 * h * f]);
  }
  return out;
}

/** Rotates the ring's start so its points sit closest to the square's. */
function align(ring, square) {
  let best = 0, bestCost = Infinity;
  for (let r = 0; r < ring.length; r++) {
    let c = 0;
    for (let k = 0; k < ring.length; k++) {
      const p = ring[(k + r) % ring.length], q = square[k];
      c += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }
    if (c < bestCost) { bestCost = c; best = r; }
  }
  return ring.map((_, k) => ring[(k + best) % ring.length]);
}

const ringPath = (ring) => `M${ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
const ease = (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Adds the area and electors stages to a rendered tile map.
 * svg: the tile map's SVG; layers: {root, tiles, regions} groups inside it;
 * tiles: {code: {x, y}} centres in pixels; side: tile side in pixels;
 * style(code): {fill, fillOpacity, stroke, strokeWidth} of the code's tile.
 */
export function addMorphStages({ svg, layers, geojson, electors, tiles, side, style, codeOf, onSelect }) {
  // Projected geography, fitted to the tile frame.
  const feats = geojson.features.map((f) => ({ code: codeOf(f.properties.riding_code), geometry: f.geometry }))
    .filter((f) => tiles[f.code] && electors[f.code]);
  const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
  const allLonLat = feats.flatMap((f) => polys(f.geometry).flatMap((p) => p[0]));
  const lon = [Math.min(...allLonLat.map((p) => p[0])), Math.max(...allLonLat.map((p) => p[0]))];
  const lat = [Math.min(...allLonLat.map((p) => p[1])), Math.max(...allLonLat.map((p) => p[1]))];
  // Equal-area conic, standard parallels at one sixth and five sixths of the latitude range.
  const dLat = lat[1] - lat[0];
  const proj = geoConicEqualArea().parallels([lat[0] + dLat / 6, lat[1] - dLat / 6])
    .rotate([-(lon[0] + lon[1]) / 2, 0]).center([0, (lat[0] + lat[1]) / 2]).translate([0, 0]).scale(1);
  const raw = feats.map((f) => ({ ...f, polys: polys(f.geometry).map((p) => p.map((ring) => ring.map((pt) => proj(pt)).map(([x, y]) => [x, y]))) }));
  const pts = raw.flatMap((f) => f.polys.flatMap((p) => p[0]));
  const bx = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const by = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const vb = svg.viewBox.baseVal, pad = 0.03;
  const k = Math.min((vb.width * (1 - 2 * pad)) / (bx[1] - bx[0]), (vb.height * (1 - 2 * pad)) / (by[1] - by[0]));
  const ox = vb.x + (vb.width - k * (bx[1] - bx[0])) / 2, oy = vb.y + (vb.height - k * (by[1] - by[0])) / 2;
  const fit = ([x, y]) => [ox + (x - bx[0]) * k, oy + (y - by[0]) * k];

  const medianE = [...feats.map((f) => electors[f.code])].sort((a, b) => a - b)[Math.floor(feats.length / 2)];
  const kArea = (FILL * side * side) / medianE; // pixels² per elector at the electors stage

  // Deepest zoom: the smallest riding fills about half the frame.
  const extents = raw.map((f) => {
    const p = f.polys.flatMap((q) => q[0]);
    return Math.max(Math.max(...p.map((x) => x[0])) - Math.min(...p.map((x) => x[0])), Math.max(...p.map((x) => x[1])) - Math.min(...p.map((x) => x[1]))) * k;
  });
  const maxZoom = Math.max(8, (0.5 * Math.min(vb.width, vb.height)) / Math.min(...extents));

  const geoLayer = document.createElementNS(NS, "g");
  layers.root.insertBefore(geoLayer, layers.tiles);
  const ridings = new Map();
  for (const f of raw) {
    const parts = f.polys.map((p) => p.map((ring) => ring.map(fit)));
    // Outer rings drawn on screen are clockwise in y-down coordinates when the shoelace is positive.
    const area = parts.reduce((a, p) => a + Math.abs(shoelace(p[0])) - p.slice(1).reduce((b, h) => b + Math.abs(shoelace(h)), 0), 0);
    const c = centroid(parts.map((p) => (shoelace(p[0]) < 0 ? [...p[0]].reverse() : p[0])));
    const mainIdx = parts.reduce((m, p, i) => (Math.abs(shoelace(p[0])) > Math.abs(shoelace(parts[m][0])) ? i : m), 0);
    const scale = Math.sqrt((kArea * electors[f.code]) / area);
    const t = tiles[f.code];
    let ring = resample(parts[mainIdx][0], N).map(([x, y]) => [(x - c[0]) * scale, (y - c[1]) * scale]);
    if (shoelace(ring) < 0) ring.reverse();
    const square = squarePoints(side / 2, N);
    ring = align(ring, square);

    const st = style(f.code);
    const g = document.createElementNS(NS, "g");
    g.style.cursor = "pointer";
    const detailed = document.createElementNS(NS, "path");
    detailed.setAttribute("d", parts.map((p) => p.map(ringPath).join("")).join(""));
    detailed.setAttribute("fill-rule", "evenodd");
    const extras = document.createElementNS(NS, "path");
    extras.setAttribute("d", parts.filter((_, i) => i !== mainIdx).map((p) => ringPath(p[0])).join(""));
    const morph = document.createElementNS(NS, "path");
    for (const el of [detailed, extras, morph]) {
      el.setAttribute("fill", st.fill);
      el.setAttribute("fill-opacity", st.fillOpacity);
      el.setAttribute("vector-effect", "non-scaling-stroke");
      g.appendChild(el);
    }
    const title = document.createElementNS(NS, "title");
    title.textContent = st.title;
    g.appendChild(title);
    g.addEventListener("click", () => onSelect(f.code));
    geoLayer.appendChild(g);
    ridings.set(f.code, { g, detailed, extras, morph, c, scale, tile: t, ring, square, st });
  }

  let current = 2, selected = null;
  function draw(tt) {
    current = tt;
    const toTiles = tt >= 2;
    layers.tiles.style.display = toTiles ? "" : "none";
    geoLayer.style.display = toTiles ? "none" : "";
    layers.regions.style.opacity = clamp01((tt - 0.6) / 0.4);
    if (toTiles) return;
    const u = Math.min(tt, 1), v = Math.max(0, tt - 1);
    for (const [code, r] of ridings) {
      const s = r.scale ** u;
      const x = r.c[0] + u * (r.tile.x - r.c[0]), y = r.c[1] + u * (r.tile.y - r.c[1]);
      const tf = `translate(${x},${y}) scale(${s}) translate(${-r.c[0]},${-r.c[1]})`;
      const isSel = code === selected;
      // Runner-up borders appear with the stages where every riding is visible.
      const stroke = isSel ? "#000" : u >= 1 && r.st.close ? r.st.stroke : "#fff";
      const width = isSel ? 2.5 : u >= 1 && r.st.close ? 2 : 0.5;
      if (tt <= 1) {
        r.detailed.style.display = "";
        r.extras.style.display = "none";
        r.morph.style.display = "none";
        r.detailed.setAttribute("transform", tf);
        r.detailed.setAttribute("stroke", stroke);
        r.detailed.setAttribute("stroke-width", width);
      } else {
        r.detailed.style.display = "none";
        r.extras.style.display = "";
        r.morph.style.display = "";
        r.extras.setAttribute("transform", tf);
        r.extras.setAttribute("opacity", 1 - v);
        const w = ease(v);
        r.morph.setAttribute("d", ringPath(r.ring.map(([px, py], i) => [
          r.tile.x + px + w * (r.square[i][0] - px), r.tile.y + py + w * (r.square[i][1] - py)])));
        r.morph.setAttribute("stroke", stroke);
        r.morph.setAttribute("stroke-width", width);
      }
    }
  }

  // Zoom and pan, at the area stage only (the other stages fit the frame).
  const sel = select(svg);
  const zoomer = d3zoom().scaleExtent([1, maxZoom])
    .filter((e) => current === 0 && (!e.ctrlKey || e.type === "wheel") && !e.button)
    .on("zoom", (e) => layers.root.setAttribute("transform", e.transform));
  sel.call(zoomer).on("dblclick.zoom", null);

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let frame = null;
  function goTo(target, onDone) {
    cancelAnimationFrame(frame);
    const from = current, dur = reduced ? 0 : 750 * Math.abs(target - from);
    sel.transition().duration(reduced ? 0 : 300).call(zoomer.transform, zoomIdentity);
    if (!dur) { draw(target); onDone?.(); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      draw(from + (target - from) * (Math.abs(target - from) > 1 ? p : ease(p)));
      if (p < 1) frame = requestAnimationFrame(step); else onDone?.();
    };
    frame = requestAnimationFrame(step);
  }

  function setSelected(code, { zoom = false } = {}) {
    selected = code;
    const r = ridings.get(code);
    if (r) r.g.parentNode.appendChild(r.g); // draw the selection on top
    if (current < 2) draw(current);
    if (zoom && current === 0 && r) {
      const b = r.detailed.getBBox(), z = Math.min(maxZoom, 0.5 * Math.min(vb.width / b.width, vb.height / b.height));
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      sel.transition().duration(reduced ? 0 : 600)
        .call(zoomer.transform, zoomIdentity.translate(vb.x + vb.width / 2, vb.y + vb.height / 2).scale(Math.max(1, z)).translate(-cx, -cy));
    }
  }

  const zoomBy = (f) => sel.transition().duration(250).call(zoomer.scaleBy, f);
  const resetZoom = () => sel.transition().duration(250).call(zoomer.transform, zoomIdentity);
  return { goTo, draw, setSelected, zoomBy, resetZoom, get stage() { return current; } };
}

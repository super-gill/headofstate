const fs = require('fs');
const path = require('path');
const topo = require('topojson-client');
const d3 = require('d3-geo');
const S = require('./stats.js');
const wc = require('world-countries');
const T = require('../node_modules/world-atlas/countries-50m.json');

const rows = S.ROWS.trim().split('\n').map(l => {
  const [iso, name, pop, gdp, mil, gov] = l.split('|');
  return { iso, name, pop: +pop, gdp: +gdp, mil: +mil, gov };
});
const byIso = {}; rows.forEach(r => byIso[r.iso] = r);
const numToIso = {}; wc.forEach(c => numToIso[c.ccn3] = c.cca3);
const regionOf = {}; wc.forEach(c => regionOf[c.cca3] = { region: c.region, sub: c.subregion, area: c.area });

const geoms = T.objects.countries.geometries;
const owner = geoms.map(g => {
  const nm = g.properties.name;
  if (nm in S.TERRITORY_PARENT) return S.TERRITORY_PARENT[nm];
  const iso = numToIso[g.id];
  return iso;
});
const problems = [];
geoms.forEach((g, i) => { if (owner[i] !== null && !byIso[owner[i]]) problems.push(`${g.properties.name} -> ${owner[i]}`); });
const covered = new Set(owner);
rows.forEach(r => { if (!covered.has(r.iso)) problems.push('NO POLYGON: ' + r.iso + ' ' + r.name); });
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));

// neighbours across land borders
const nb = topo.neighbors(geoms);
const nbSets = {};
geoms.forEach((g, i) => {
  const a = owner[i]; if (!a) return;
  nbSets[a] = nbSets[a] || new Set();
  nb[i].forEach(j => { const b = owner[j]; if (b && b !== a) nbSets[a].add(b); });
});

// group geometries by owner and merge
const groups = {};
geoms.forEach((g, i) => { const o = owner[i]; if (!o) return; (groups[o] = groups[o] || []).push(g); });
const feats = {};
for (const iso in groups) {
  let g = topo.merge(T, groups[iso]);
  // merging can break on shapes that cross the antimeridian (Russia, Fiji). Compare against the parts
  // and fall back to a plain union of polygons when area is lost.
  const parts = groups[iso].map(x => topo.feature(T, x).geometry);
  const sum = parts.reduce((a, x) => a + d3.geoArea(x), 0), got = d3.geoArea(g);
  if (!(Math.abs(got - sum) < sum * 0.15)) {
    console.log('merge fallback for', iso, 'merged area', got.toFixed(4), 'parts', sum.toFixed(4));
    const polys = []; parts.forEach(x => { if (x.type === 'Polygon') polys.push(x.coordinates); else if (x.type === 'MultiPolygon') x.coordinates.forEach(c => polys.push(c)); });
    g = { type: 'MultiPolygon', coordinates: polys };
  }
  feats[iso] = g;
}

const collection = { type: 'FeatureCollection', features: Object.keys(feats).map(k => ({ type: 'Feature', geometry: feats[k] })) };
const W = 1000;
const proj = d3.geoNaturalEarth1().fitWidth(W, collection);
const gp = d3.geoPath(proj).digits(1);
let b = gp.bounds(collection);
const dy = -b[0][1], dx = -b[0][0];
const t = proj.translate(); proj.translate([t[0] + dx, t[1] + dy]);
b = gp.bounds(collection);
const H = Math.ceil(b[1][1]);

function rdp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifiedPath(feature, eps, minSize) {
  const rings = []; let cur = null;
  const ctx = { moveTo(x, y) { cur = [[x, y]]; rings.push(cur); }, lineTo(x, y) { cur.push([x, y]); }, closePath() {}, arc() {}, rect() {} };
  d3.geoPath(proj, ctx)(feature);
  let best = null, bestSize = -1; const parts = [];
  for (const r of rings) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    r.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    const size = Math.max(x1 - x0, y1 - y0);
    // a closed ring repeats its first point, which makes the simplifier collapse it (this hid Russia's mainland).
    // Drop the duplicate and simplify each half so the ring survives.
    const pts = r.slice(); const f0 = pts[0], fl = pts[pts.length - 1];
    if (pts.length > 3 && Math.abs(f0[0] - fl[0]) < 1e-6 && Math.abs(f0[1] - fl[1]) < 1e-6) pts.pop();
    const mid = pts.length >> 1;
    const sr = pts.length > 8 ? rdp(pts.slice(0, mid + 1), eps).concat(rdp(pts.slice(mid).concat([pts[0]]), eps).slice(1, -1)) : rdp(pts, eps);
    if (size > bestSize) { bestSize = size; best = sr; }
    if (size >= minSize && sr.length >= 3) parts.push(sr);
  }
  if (!parts.length && best) parts.push(best);
  return parts.map(r => 'M' + r.map(p => (+p[0].toFixed(1)) + ',' + (+p[1].toFixed(1))).join('L') + 'Z').join('');
}
const out = [];
for (const iso in feats) {
  const geom = feats[iso];
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates.map(c => ({ type: 'Polygon', coordinates: c })) : [geom];
  let best = polys[0], ba = -1;
  polys.forEach(p => { const a = d3.geoArea(p); if (a > ba) { ba = a; best = p; } });
  const ll = d3.geoCentroid(best);
  const xy = proj(ll);
  const bb = gp.bounds({ type: 'Feature', geometry: geom });
  out.push({
    id: iso,
    d: simplifiedPath({ type: 'Feature', geometry: geom }, 0.35, 0.8),
    cx: +xy[0].toFixed(1), cy: +xy[1].toFixed(1),
    lon: +ll[0].toFixed(2), lat: +ll[1].toFixed(2),
    w: +(bb[1][0] - bb[0][0]).toFixed(1), h: +(bb[1][1] - bb[0][1]).toFixed(1),
    nb: [...(nbSets[iso] || [])],
  });
}
const mapData = { W, H, c: out };
fs.writeFileSync(path.join(__dirname, '../src/mapdata.json'), JSON.stringify(mapData));

// world stats
const world = rows.map(r => {
  const m = out.find(o => o.id === r.iso);
  const rg = regionOf[r.iso] || {};
  return { ...r, region: rg.region, sub: rg.sub, area: rg.area,
    nukes: S.NUKES[r.iso] || 0, tech: S.TECH[r.iso] || 0, fragile: S.FRAGILE.includes(r.iso) ? 1 : 0,
    debt: S.DEBT[r.iso], growth: S.GROWTH_OVERRIDE[r.iso], aggr: S.AGGRESSION[r.iso],
    lon: m ? m.lon : 0, lat: m ? m.lat : 0 };
});
const iso = new Set(rows.map(r => r.iso));
const chk = (list, label) => list.forEach(x => { if (!iso.has(x)) console.log('BAD ISO in', label, x); });
S.BLOCS.forEach(bl => chk(bl.members.split(' '), bl.id));
S.PACTS.forEach(p => chk(p.split(' '), 'pact'));
S.RIVALRIES.forEach(p => chk(p.split(' ').slice(0, 2), 'rival'));
const meta = {
  blocs: S.BLOCS.map(b => ({ ...b, members: b.members.split(' ') })),
  pacts: S.PACTS.map(p => p.split(' ')),
  rivalries: S.RIVALRIES.map(p => { const a = p.split(' '); return { a: a[0], b: a[1], n: +a[2], why: a.slice(3).join(' ') }; }),
  startWars: S.START_WARS.map(p => p.split(' ')),
};
fs.writeFileSync(path.join(__dirname, '../src/worlddata.json'), JSON.stringify({ countries: world, ...meta }));
console.log('countries', out.length, 'map', W, H, 'mapdata bytes', fs.statSync(path.join(__dirname, '../src/mapdata.json')).size);
const noNb = out.filter(o => !o.nb.length).length; console.log('countries without land neighbours', noNb);
console.log('USA nb', out.find(o => o.id === 'USA').nb.join(','), '| FRA nb', out.find(o => o.id === 'FRA').nb.join(','));

import { readFileSync, writeFileSync } from 'node:fs';
import { contains, unwrapRing } from '../src/earth-explorer/geography.js';
const root = new URL('../', import.meta.url),
  read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const features = read('public/earth-explorer/countries.geojson').features;
// Natural Earth reuses AU for dependent map units; keep Australia's main polygon.
const byISO = new Map();
for (const feature of features) {
  const iso = feature.properties.iso2;
  if (!byISO.has(iso) || feature.properties.id === 'aus') byISO.set(iso, feature);
}
const raw = ['a', 'b', 'c'].flatMap((letter) =>
  read('src/earth-explorer/data/facts-' + letter + '.json'),
);
if (raw.length !== 195 || new Set(raw.map((c) => c.iso2)).size !== 195)
  throw Error('Expected all 195 unique country ISO codes');
// Find an interior point when an authored coordinate or map label misses an island.
function interior(feature) {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  let best;
  for (const polygon of polygons) {
    const rings = polygon.map((r) => unwrapRing(r)),
      outer = rings[0],
      ys = outer.map((p) => p[1]),
      lo = Math.min(...ys),
      hi = Math.max(...ys);
    for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const lat = lo + (hi - lo) * fraction,
        cuts = [];
      for (const ring of rings)
        for (let i = 1; i < ring.length; i++) {
          const [a, b] = [ring[i - 1], ring[i]];
          if (a[1] > lat !== b[1] > lat)
            cuts.push(a[0] + ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]));
        }
      cuts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const width = cuts[i + 1] - cuts[i],
          lon = (((cuts[i] + cuts[i + 1]) / 2 + 540) % 360) - 180;
        if ((!best || width > best.width) && contains(feature, lon, lat))
          best = { lat, lon, width };
      }
    }
  }
  if (!best) throw Error('No interior landing: ' + feature.properties.name);
  return best;
}
const adjusted = [];
const countries = raw
  .map((c) => {
    const f = byISO.get(c.iso2);
    if (!f) throw Error('Missing map ' + c.iso2);
    let location = { lat: c.lat, lon: c.lon };
    if (!contains(f, c.lon, c.lat)) {
      const [lon, lat] = f.properties.label;
      location = contains(f, lon, lat) ? { lat, lon } : interior(f);
      adjusted.push(c.iso2);
    }
    return {
      ...c,
      id: f.properties.id,
      ...location,
      continent: c.continent === 'Australia' ? 'Oceania' : c.continent,
      factVersion: 2,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
if (new Set(countries.map((c) => c.fact)).size !== 195) throw Error('Repeated fact');
writeFileSync(
  new URL('src/earth-explorer/data/catalog.json', root),
  JSON.stringify(countries, null, 2) + '\n',
);
console.log(
  '195 countries with unique facts and verified polygon-interior landings; adjusted ' +
    adjusted.length +
    ' coordinates: ' +
    adjusted.join(', '),
);

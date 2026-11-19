// Dati dei confini dei paesi (countries.json): decodifica e ricerca del paese che contiene un punto.
export type Country = { n: string; p: number[][][] };
export type Rings = { name: string; polys: { ring: [number, number][]; holes: [number, number][][]; box: [number, number, number, number] }[] };

export const Q = 100; // i confini sono salvati in centesimi di grado (circa 1 km)

// Decodifica i confini (numeri interi in centesimi di grado, con differenze da punto a punto)
export function decode(countries: Country[], q = Q): { raw: Country[]; rings: Rings[] } {
  const rings: Rings[] = countries.map((c) => ({
    name: c.n,
    polys: c.p.map((poly) => {
      const decoded = poly.map((flat) => {
        const pts: [number, number][] = [];
        let x = 0,
          y = 0;
        for (let i = 0; i < flat.length; i += 2) {
          x += flat[i];
          y += flat[i + 1];
          pts.push([x / q, y / q]); // [lon, lat]
        }
        return pts;
      });
      const outer = decoded[0] ?? [];
      let minX = 181,
        maxX = -181,
        minY = 91,
        maxY = -91;
      for (const [lo, la] of outer) {
        if (lo < minX) minX = lo;
        if (lo > maxX) maxX = lo;
        if (la < minY) minY = la;
        if (la > maxY) maxY = la;
      }
      return { ring: outer, holes: decoded.slice(1), box: [minX, minY, maxX, maxY] as [number, number, number, number] };
    }),
  }));
  return { raw: countries, rings };
}

export function inRing(lon: number, lat: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Il paese che contiene il punto; per le località sulla costa (fuori dal contorno semplificato)
// il paese più vicino entro circa 2 gradi.
export function countryAt(lat: number, lon: number, rings: Rings[], tol = 4): string | null {
  for (const c of rings) {
    for (const p of c.polys) {
      const [x0, y0, x1, y1] = p.box;
      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
      if (inRing(lon, lat, p.ring) && !p.holes.some((h) => inRing(lon, lat, h))) return c.name;
    }
  }
  let best: string | null = null;
  let bestD = tol; // gradi² (4 = circa 2 gradi)
  const reach = Math.sqrt(tol);
  for (const c of rings) {
    for (const p of c.polys) {
      const [x0, y0, x1, y1] = p.box;
      if (lon < x0 - reach || lon > x1 + reach || lat < y0 - reach || lat > y1 + reach) continue;
      for (const [lo, la] of p.ring) {
        const d = (lo - lon) ** 2 + (la - lat) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c.name;
        }
      }
    }
  }
  return best;
}


// Regione (o altra area) che contiene il punto, con una piccola tolleranza per le coste
export function areaAt(lat: number, lon: number, rings: Rings[]): string | null {
  return countryAt(lat, lon, rings, 0.04);
}

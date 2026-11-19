import type * as THREE_NS from "three";

// Immagini satellitari a tasselli (NASA GIBS, pubblico dominio, senza chiave):
// - Blue Marble con rilievo e fondali (500 m per punto) come base, livelli 3-7
// - Landsat (circa 30 m per punto) sopra le terre emerse quando ci si avvicina, livelli 8-11
// Si scaricano solo i tasselli della zona inquadrata, sempre più dettagliati man mano che si scende.
// Griglia geografica (EPSG:4326): al livello z ogni tassello copre 288/2^z gradi e ha 512×512 punti.

const D2R = Math.PI / 180;
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best";
const TILE_PX = 512;
const BASE_MIN_Z = 3;
const BASE_MAX_Z = 7;
const DETAIL_MIN_Z = 8;
export const DETAIL_MAX_Z = 11;
const MAX_CACHE = 150;
const MAX_INFLIGHT = 6;
const MAX_TILES_PER_LEVEL = 64;

type Layer = "base" | "detail";
type Entry = {
  key: string;
  layer: Layer;
  z: number;
  y: number;
  x: number;
  state: "loading" | "ready" | "empty" | "error";
  mesh: THREE_NS.Mesh | null;
  used: number;
};

const span = (z: number) => 288 / 2 ** z;
const cols = (z: number) => Math.ceil(360 / span(z));
const rows = (z: number) => Math.ceil(180 / span(z));

function tileUrl(layer: Layer, z: number, y: number, x: number) {
  return layer === "base"
    ? `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/default/500m/${z}/${y}/${x}.jpeg`
    : `${GIBS}/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2000-12-01/31.25m/${z}/${y}/${x}.jpg`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("tile"));
    img.src = url;
  });
}

export type TileView = { lat: number; lon: number; radiusDeg: number; degPerPx: number };

export class SatelliteTiles {
  readonly group: THREE_NS.Group;
  private T: typeof THREE_NS;
  private cache = new Map<string, Entry>();
  private queue: Entry[] = [];
  private inflight = 0;
  private anisotropy: number;
  private disposed = false;
  private clock = 0;
  onChange: (() => void) | null = null;

  constructor(T: typeof THREE_NS, anisotropy: number) {
    this.T = T;
    this.anisotropy = anisotropy;
    this.group = new T.Group();
  }

  // Livello di dettaglio giusto per la distanza: un punto dell'immagine ≈ un pixel dello schermo
  static levelFor(degPerPx: number) {
    return Math.ceil(Math.log2(288 / (TILE_PX * Math.max(degPerPx, 1e-7))));
  }

  update(view: TileView) {
    if (this.disposed) return;
    this.clock++;
    let z = Math.min(DETAIL_MAX_Z, SatelliteTiles.levelFor(view.degPerPx));
    const wanted = new Set<string>();
    if (z >= BASE_MIN_Z) {
      const baseZ = Math.min(z, BASE_MAX_Z);
      this.want("base", this.fitLevel(view, baseZ), view, wanted);
      if (z >= DETAIL_MIN_Z) {
        z = this.fitLevel(view, z);
        if (z >= DETAIL_MIN_Z) this.want("detail", z, view, wanted);
      }
    }
    // Visibili: i tasselli voluti già pronti; dove non lo sono ancora, il "genitore" più vicino già caricato
    const show = new Set<string>();
    for (const key of wanted) {
      const e = this.cache.get(key)!;
      if (e.state === "ready") show.add(key);
      else if (e.layer === "base") {
        for (let pz = e.z - 1, py = e.y, px = e.x; pz >= BASE_MIN_Z; pz--) {
          py = Math.floor(py / 2);
          px = Math.floor(px / 2);
          const parent = this.cache.get(`base/${pz}/${py}/${px}`);
          if (parent?.state === "ready") {
            show.add(parent.key);
            parent.used = this.clock;
            break;
          }
        }
      }
    }
    for (const e of this.cache.values()) if (e.mesh) e.mesh.visible = show.has(e.key);
    this.pump();
    this.evict(wanted);
  }

  // Abbassa il livello se servirebbero troppi tasselli (vista molto ampia)
  private fitLevel(view: TileView, z: number) {
    while (z > BASE_MIN_Z) {
      const s = span(z);
      const latN = Math.min(90, view.lat + view.radiusDeg);
      const latS = Math.max(-90, view.lat - view.radiusDeg);
      const cosLat = Math.max(0.05, Math.cos(Math.min(85, Math.max(Math.abs(latN), Math.abs(latS)) ) * D2R));
      const lonExt = Math.min(360, (2 * view.radiusDeg) / cosLat);
      const n = Math.ceil((latN - latS) / s + 1) * Math.ceil(lonExt / s + 1);
      if (n <= MAX_TILES_PER_LEVEL) break;
      z--;
    }
    return z;
  }

  private want(layer: Layer, z: number, view: TileView, wanted: Set<string>) {
    const s = span(z);
    const latN = Math.min(90, view.lat + view.radiusDeg);
    const latS = Math.max(-90, view.lat - view.radiusDeg);
    const yMin = Math.max(0, Math.floor((90 - latN) / s));
    const yMax = Math.min(rows(z) - 1, Math.floor((90 - latS) / s));
    const nearPole = latN >= 89 || latS <= -89;
    const cosLat = Math.max(0.05, Math.cos(Math.max(Math.abs(latN), Math.abs(latS)) * D2R));
    const lonHalf = nearPole ? 180 : Math.min(180, view.radiusDeg / cosLat);
    const c = cols(z);
    const xs: number[] = [];
    if (lonHalf >= 180) for (let x = 0; x < c; x++) xs.push(x);
    else {
      const x0 = Math.floor((view.lon - lonHalf + 180) / s);
      const x1 = Math.floor((view.lon + lonHalf + 180) / s);
      for (let x = x0; x <= x1; x++) {
        const xx = ((x % c) + c) % c;
        if (!xs.includes(xx)) xs.push(xx);
      }
    }
    const cx = Math.cos(view.lat * D2R) * Math.cos(view.lon * D2R);
    const cy = Math.sin(view.lat * D2R);
    const cz = -Math.cos(view.lat * D2R) * Math.sin(view.lon * D2R);
    const reach = Math.cos(Math.min(180, view.radiusDeg + s * 0.75) * D2R);
    for (let y = yMin; y <= yMax; y++) {
      for (const x of xs) {
        const lonA = -180 + x * s;
        const latA = 90 - y * s;
        if (lonA >= 180 || latA <= -90) continue;
        // centro del tassello rivolto verso la camera?
        const lat = (latA + Math.max(latA - s, -90)) / 2;
        const lon = (lonA + Math.min(lonA + s, 180)) / 2;
        const dot = Math.cos(lat * D2R) * Math.cos(lon * D2R) * cx + Math.sin(lat * D2R) * cy - Math.cos(lat * D2R) * Math.sin(lon * D2R) * cz;
        if (dot < reach) continue;
        const key = `${layer}/${z}/${y}/${x}`;
        wanted.add(key);
        let e = this.cache.get(key);
        if (!e) {
          e = { key, layer, z, y, x, state: "loading", mesh: null, used: this.clock };
          this.cache.set(key, e);
          this.queue.push(e);
        }
        e.used = this.clock;
      }
    }
    // prima i tasselli al centro della vista
    this.queue.sort((a, b) => b.used - a.used);
  }

  private pump() {
    while (this.inflight < MAX_INFLIGHT && this.queue.length > 0) {
      const e = this.queue.shift()!;
      if (e.used < this.clock - 2) {
        // non serve più: lo si dimentica (verrà richiesto di nuovo se torna in vista)
        this.cache.delete(e.key);
        continue;
      }
      this.inflight++;
      this.load(e).finally(() => {
        this.inflight--;
        if (!this.disposed) this.pump();
      });
    }
  }

  private async load(e: Entry) {
    try {
      const img = await loadImage(tileUrl(e.layer, e.z, e.y, e.x));
      if (this.disposed) return;
      const T = this.T;
      let texture: THREE_NS.Texture;
      if (e.layer === "detail") {
        // Landsat: le zone senza dati (mare) sono nere → trasparenti, così sotto si vede la base
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        let empty = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i] + px[i + 1] + px[i + 2] < 30) {
            px[i + 3] = 0;
            empty++;
          }
        }
        if (empty > (px.length / 4) * 0.985) {
          e.state = "empty";
          return;
        }
        ctx.putImageData(data, 0, 0);
        texture = new T.CanvasTexture(canvas);
      } else {
        texture = new T.Texture(img);
        texture.needsUpdate = true;
      }
      texture.colorSpace = T.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = T.LinearFilter;
      texture.anisotropy = this.anisotropy;
      const radius = e.layer === "base" ? 1.0001 + e.z * 0.000004 : 1.00016 + (e.z - DETAIL_MIN_Z) * 0.000004;
      const mesh = new T.Mesh(
        this.patch(e.z, e.y, e.x, radius),
        new T.MeshLambertMaterial({ map: texture, transparent: e.layer === "detail", side: T.DoubleSide }),
      );
      mesh.visible = false;
      mesh.renderOrder = e.layer === "base" ? 1 : 2;
      this.group.add(mesh);
      e.mesh = mesh;
      e.state = "ready";
      this.onChange?.();
    } catch {
      e.state = "error";
    }
  }

  // Pezzo di sfera che copre il tassello (ritagliato ai bordi del mondo)
  private patch(z: number, y: number, x: number, r: number) {
    const T = this.T;
    const s = span(z);
    const lonA = -180 + x * s;
    const latA = 90 - y * s;
    const lonB = Math.min(lonA + s, 180);
    const latB = Math.max(latA - s, -90);
    const segs = Math.max(2, Math.min(32, Math.ceil(Math.max(lonB - lonA, latA - latB) / 0.5)));
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const lat = latA + ((latB - latA) * i) / segs;
      for (let j = 0; j <= segs; j++) {
        const lon = lonA + ((lonB - lonA) * j) / segs;
        const cl = Math.cos(lat * D2R);
        pos.push(r * cl * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * cl * Math.sin(lon * D2R));
        uv.push((lon - lonA) / s, 1 - (latA - lat) / s);
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * (segs + 1) + j;
        const b = a + segs + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  private evict(wanted: Set<string>) {
    const ready = [...this.cache.values()].filter((e) => e.state !== "loading");
    if (ready.length <= MAX_CACHE) return;
    ready.sort((a, b) => a.used - b.used);
    for (const e of ready.slice(0, ready.length - MAX_CACHE)) {
      if (wanted.has(e.key)) continue;
      this.drop(e);
    }
  }

  private drop(e: Entry) {
    if (e.mesh) {
      this.group.remove(e.mesh);
      e.mesh.geometry.dispose();
      const mat = e.mesh.material as THREE_NS.MeshLambertMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.cache.delete(e.key);
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  dispose() {
    this.disposed = true;
    for (const e of [...this.cache.values()]) this.drop(e);
    this.queue = [];
  }
}

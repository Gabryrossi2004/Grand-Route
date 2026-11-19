"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Crosshair, Loader2 } from "lucide-react";
import CountryBoard from "@/components/CountryBoard";
import GlobeSearch, { type GlobeSearchItem } from "@/components/GlobeSearch";
import { namesOf } from "@/lib/geo/countryCodes";
import { countryNameIt } from "@/lib/geo/countryNames";
import { buildOceanLabels } from "@/lib/geo/oceanLabels";
import { Q, areaAt, countryAt, decode, inRing, type Country, type Rings } from "@/lib/geo/countryData";
import { SatelliteTiles } from "@/lib/geo/satelliteTiles";
import type * as THREE_NS from "three";

export type GlobePlace = { name: string; lat: number; lon: number };
export type GlobeTrip = {
  id: string;
  title: string;
  destination: string | null;
  from: string | null;
  to: string | null;
  status: "done" | "current" | "upcoming";
  places: GlobePlace[];
};

const D2R = Math.PI / 180;
// Zoom espresso come altezza sopra la superficie (1 = raggio della Terra, circa 6.371 km)
const MAX_ALT = 6;
// quota minima: fisico fino a ~40 km; carta d'epoca fino a ~450 km (abbastanza per leggere le zone di una regione)
const minAltFor = (style: "antique" | "physical") => (style === "physical" ? 0.006 : 0.07);
export type GlobeStyle = "antique" | "physical";
// Colori delle linee e del velo di selezione per ciascuno stile
const STYLE_CFG = {
  antique: { plain: [0x233c5e, 0.85, 1.3], marked: [0x1b2f4d, 1, 2.2], sel: [0x0d1d38, 1, 3.4], veil: "rgba(35,60,94,.22)" },
  physical: { plain: [0xf3ead2, 0.8, 1.1], marked: [0xffd75e, 1, 2.2], sel: [0xffffff, 1, 3.2], veil: "rgba(255,255,255,.2)" },
} as const;
const STYLE_KEY = "gr-globe-style";
function readStyle(): GlobeStyle {
  try {
    return localStorage.getItem(STYLE_KEY) === "physical" ? "physical" : "antique";
  } catch {
    return "antique";
  }
}
const STATUS_LABEL = { done: "Fatto", current: "In corso", upcoming: "In programma" } as const;

// Una piccola "carta antica" nei colori di Grand Route: pergamena color crema, inchiostro blu navy,
// dettagli in oro. I paesi visitati si colorano d'oro, quelli dei viaggi in programma d'oro più chiaro.
const NAVY = "#233c5e";
const PALETTE = ["#f8efd9", "#f3e6c9", "#f6ebd2", "#efe0bd", "#f4e8cd"];
const hashName = (name: string) => {
  let h = 7;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
};

// Disegna il contorno di un paese su un canvas equirettangolare di larghezza W e altezza H
function tracePath(ctx: CanvasRenderingContext2D, c: Country, W: number, H: number) {
  ctx.beginPath();
  for (const poly of c.p) {
    for (const flat of poly) {
      let px = 0,
        py = 0;
      for (let i = 0; i < flat.length; i += 2) {
        px += flat[i];
        py += flat[i + 1];
        const x = ((px / Q + 180) / 360) * W;
        const y = ((90 - py / Q) / 180) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  }
}

function drawTexture(raw: Country[], gold: Set<string>, soft: Set<string>, fontFamily: string): HTMLCanvasElement {
  const W = 4096,
    H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const X = (lon: number) => ((lon + 180) / 360) * W;
  const Y = (lat: number) => ((90 - lat) / 180) * H;

  // Pergamena: base chiara con macchie e grana, sempre con lo stesso disegno
  let seed = 5;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#cfd6c4");
  bg.addColorStop(0.5, "#dde3d2");
  bg.addColorStop(1, "#ccd3c0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const bx = rnd() * W,
      by = rnd() * H,
      br = 50 + rnd() * 230;
    const gr = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const dark = rnd() < 0.55;
    gr.addColorStop(0, dark ? `rgba(150,110,50,${0.04 + rnd() * 0.06})` : `rgba(255,248,225,${0.08 + rnd() * 0.08})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  for (let i = 0; i < 36000; i++) {
    ctx.fillStyle = `rgba(110,80,40,${0.04 + rnd() * 0.1})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }

  // Meridiani e paralleli a inchiostro, con tropici e equatore tratteggiati
  ctx.lineWidth = 1.5;
  for (let lon = -180; lon <= 180; lon += 10) {
    ctx.strokeStyle = lon % 30 === 0 ? "rgba(35,60,94,.42)" : "rgba(35,60,94,.2)";
    ctx.beginPath();
    ctx.moveTo(X(lon), 0);
    ctx.lineTo(X(lon), H);
    ctx.stroke();
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    ctx.strokeStyle = lat % 30 === 0 ? "rgba(35,60,94,.42)" : "rgba(35,60,94,.2)";
    ctx.beginPath();
    ctx.moveTo(0, Y(lat));
    ctx.lineTo(W, Y(lat));
    ctx.stroke();
  }
  ctx.setLineDash([16, 10]);
  ctx.strokeStyle = "rgba(160,120,60,.8)";
  ctx.lineWidth = 2.2;
  for (const lat of [0, 23.44, -23.44]) {
    ctx.beginPath();
    ctx.moveTo(0, Y(lat));
    ctx.lineTo(W, Y(lat));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Linee di rotta della cartografia antica, tenui
  ctx.strokeStyle = "rgba(35,60,94,.14)";
  ctx.lineWidth = 1.2;
  for (const [clon, clat] of [[-35, -8], [72, -28], [-150, 8]]) {
    for (let k = 0; k < 32; k++) {
      const a = (k * Math.PI) / 16;
      ctx.beginPath();
      ctx.moveTo(X(clon), Y(clat));
      ctx.lineTo(X(clon) + Math.cos(a) * 380, Y(clat) + Math.sin(a) * 380);
      ctx.stroke();
    }
  }

  const path = (c: Country) => tracePath(ctx, c, W, H);

  // Ombra della costa nel mare
  ctx.lineJoin = "round";
  for (const c of raw) {
    path(c);
    ctx.strokeStyle = "rgba(35,60,94,.11)";
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  // Paesi (solo il colore: i confini sono linee vettoriali nitide, disegnate sopra dal globo)
  for (const c of raw) {
    path(c);
    ctx.fillStyle = gold.has(c.n) ? "#c58f2d" : soft.has(c.n) ? "#e3c27a" : PALETTE[hashName(c.n) % PALETTE.length];
    ctx.fill("evenodd");
  }

  // Rose dei venti in blu e oro
  const compass = (cx: number, cy: number, R: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.62, 0, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.56, 0, 7);
    ctx.stroke();
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8;
      const len = k % 4 === 0 ? R : k % 2 === 0 ? R * 0.78 : R * 0.55;
      const w = k % 4 === 0 ? 0.13 : 0.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - w) * R * 0.1, Math.sin(a - w) * R * 0.1);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + w) * R * 0.1, Math.sin(a + w) * R * 0.1);
      ctx.closePath();
      ctx.fillStyle = k % 4 === 0 ? "#cda876" : "rgba(205,168,118,.45)";
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = NAVY;
    ctx.font = `italic ${Math.round(R * 0.22)}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText("N", 0, -R - 10);
    ctx.restore();
  };
  compass(X(-38), Y(-24), 170);
  compass(X(-135), Y(-30), 135);
  compass(X(88), Y(-38), 150);

  return canvas;
}

const dateIt = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", { month: "short", year: "numeric" }) : "");

// Mappamondo 3D dei viaggi del cliente: i paesi visitati sono d'oro, i viaggi in programma più tenui.
// La posizione attuale si legge solo dal telefono e non viene inviata né salvata.
export type AgencyCountryStat = { count: number; value: number; trips: { id: string; title: string; from: string | null; client: string | null }[] };
export type AgencyGlobeData = { stats: Record<string, AgencyCountryStat>; countLabel: string; showValue: boolean };

export default function TravelGlobe({
  trips,
  userId = "",
  photoCounts = {},
  mode = "client",
  agency,
  onOpenSheet,
  focusRequest,
  onOpenItaly,
  regionRequest,
  zoneMarks,
  onZone,
  onRegionChange,
}: {
  trips: GlobeTrip[];
  userId?: string;
  photoCounts?: Record<string, number>;
  mode?: "client" | "agency";
  agency?: AgencyGlobeData;
  onOpenSheet?: (name: string) => void;
  focusRequest?: { name: string; nonce: number } | null;
  // Italia regione per regione (solo agenzia)
  onOpenItaly?: (region: string | null) => void;
  regionRequest?: { code: string | null; nonce: number } | null;
  zoneMarks?: { id: string; name: string; lat: number; lon: number }[];
  onZone?: (id: string) => void;
  onRegionChange?: (code: string | null) => void;
}) {
  const agencyRef = useRef(agency);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    zoom: (factor: number) => void;
    focus: (lat: number, lon: number, maxDist?: number) => void;
    setMe: (p: { lat: number; lon: number } | null) => void;
    chooseTrip: (tripId: string) => void;
    setStyle: (style: GlobeStyle) => Promise<boolean>;
    clear: () => void;
    selectCountry: (name: string) => void;
    setHighlight: (data: AgencyGlobeData) => void;
    selectRegion: (code: string | null) => void;
    setZones: (list: { id: string; name: string; lat: number; lon: number }[]) => void;
  } | null>(null);
  const [regionInfo, setRegionInfo] = useState<{ code: string; name: string } | null>(null);
  const [regionNames, setRegionNames] = useState<{ code: string; name: string }[]>([]);
  const onZoneRef = useRef(onZone);
  const onRegionRef = useRef(onRegionChange);
  useEffect(() => {
    onZoneRef.current = onZone;
    onRegionRef.current = onRegionChange;
  }, [onZone, onRegionChange]);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const countryRef = useRef<string | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied" | "on" | "unsupported">("idle");
  // Paesi visitati (oro), in programma (oro chiaro) e viaggi che toccano ciascun paese
  const [info, setInfo] = useState<{ gold: string[]; soft: string[]; byCountry: Record<string, string[]> } | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [style, setStyle] = useState<GlobeStyle>(readStyle);
  const styleRef = useRef<GlobeStyle>(style);
  const [counts, setCounts] = useState<Record<string, number>>(photoCounts);

  const [styleBusy, setStyleBusy] = useState(false);
  const chooseStyle = useCallback(async (next: GlobeStyle) => {
    if (next === styleRef.current || !api.current) return;
    setStyleBusy(true);
    const ok = await api.current.setStyle(next);
    setStyleBusy(false);
    if (ok) {
      setStyle(next);
      try {
        localStorage.setItem(STYLE_KEY, next);
      } catch {}
    }
  }, []);

  const focusTrip = useCallback((trip: GlobeTrip) => api.current?.chooseTrip(trip.id), []);
  const onBoardCount = useCallback(
    (n: number) => {
      if (country) setCounts((c) => (c[country] === n ? c : { ...c, [country]: n }));
    },
    [country],
  );

  // ---- costruzione della scena (una volta) ----
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const [THREE, geo, lineMod, lineMatMod, lineGeoMod, italyMod] = await Promise.all([
          import("three"),
          import("@/lib/geo/countries.json"),
          import("three/examples/jsm/lines/LineSegments2.js"),
          import("three/examples/jsm/lines/LineMaterial.js"),
          import("three/examples/jsm/lines/LineSegmentsGeometry.js"),
          mode === "agency" ? import("@/lib/geo/italyRegions.json") : Promise.resolve(null),
        ]);
        if (disposed || !stageRef.current || !canvasRef.current) return;
        const T = THREE as typeof THREE_NS;
        const countries = (geo.default ?? geo) as unknown as Country[];
        const { raw, rings } = decode(countries);
        // regioni italiane (confini ISTAT, dettaglio di circa 400 m)
        type RegionGeo = { c: string; n: string; q: number; center: [number, number]; p: number[][][] };
        const regionList = (italyMod ? ((italyMod as { default?: unknown }).default ?? italyMod) : []) as RegionGeo[];
        const regionRings = regionList.length ? decode(regionList.map((r) => ({ n: r.c, p: r.p })), regionList[0].q).rings : [];
        setRegionNames(regionList.map((r) => ({ code: r.c, name: r.n })));

        // Paesi per stato
        const gold = new Set<string>();
        const soft = new Set<string>();
        const pinsData: { trip: GlobeTrip; place: GlobePlace; country: string | null }[] = [];
        const byCountry: Record<string, string[]> = {};
        for (const trip of trips) {
          for (const place of trip.places) {
            const c = countryAt(place.lat, place.lon, rings);
            if (c) {
              (trip.status === "upcoming" ? soft : gold).add(c);
              if (!(byCountry[c] ??= []).includes(trip.id)) byCountry[c].push(trip.id);
            }
            pinsData.push({ trip, place, country: c });
          }
        }
        if (mode === "agency") {
          for (const [name, stat] of Object.entries(agencyRef.current?.stats ?? {})) if (stat.count > 0) gold.add(name);
        }
        gold.forEach((c) => soft.delete(c));
        setInfo({ gold: [...gold], soft: [...soft], byCountry });

        const canvas = canvasRef.current;
        const stage = stageRef.current;
        const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
        scene.add(camera);
        const pitchG = new T.Group();
        scene.add(pitchG);
        const yawG = new T.Group();
        pitchG.add(yawG);

        const ll2v = (lat: number, lon: number, r = 1) =>
          new T.Vector3(r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * Math.cos(lat * D2R) * Math.sin(lon * D2R));

        const fam = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "Georgia, serif";
        const texture = new T.CanvasTexture(drawTexture(raw, gold, soft, `${fam}, Georgia, serif`));
        texture.colorSpace = T.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const globe = new T.Mesh(
          new T.SphereGeometry(1, 96, 72),
          new T.MeshPhongMaterial({ map: texture, specular: new T.Color(0x2a1e0e), shininess: 14 }),
        );
        yawG.add(globe);

        const key = new T.DirectionalLight(0xfff2da, 1.7);
        key.position.set(-2.5, 2.2, 3);
        camera.add(key);
        const ambient = new T.AmbientLight(0xfff4e0, 2.1);
        scene.add(ambient);

        // Scritte di oceani e mari (solo nello stile carta d'epoca)
        try {
          await document.fonts?.ready;
        } catch {}
        const oceanLabels = buildOceanLabels(T, `${fam}, Georgia, serif`, renderer.capabilities.getMaxAnisotropy());
        yawG.add(oceanLabels);

        // Il paese scelto si evidenzia con un velo blu e un bordo marcato (un secondo strato trasparente sul globo)
        const OW = 2048,
          OH = 1024;
        const overlayCanvas = document.createElement("canvas");
        overlayCanvas.width = OW;
        overlayCanvas.height = OH;
        const overlayCtx = overlayCanvas.getContext("2d")!;
        const overlayTex = new T.CanvasTexture(overlayCanvas);
        overlayTex.colorSpace = T.SRGBColorSpace;
        const overlay = new T.Mesh(
          new T.SphereGeometry(1.00045, 360, 180),
          new T.MeshBasicMaterial({ map: overlayTex, transparent: true, depthWrite: false }),
        );
        overlay.visible = false;
        overlay.renderOrder = 4;
        yawG.add(overlay);
        // Confini come linee vere (spessore costante in pixel): restano nitidi a qualsiasi ingrandimento
        const { LineSegments2 } = lineMod;
        const { LineMaterial } = lineMatMod;
        const { LineSegmentsGeometry } = lineGeoMod;
        const lineMats: InstanceType<typeof LineMaterial>[] = [];
        type LineSet = { cells: { line: InstanceType<typeof LineSegments2>; x: number; y: number; z: number }[]; mat: InstanceType<typeof LineMaterial> };
        const CELL = 15; // i confini sono divisi in caselle di 15°: si disegnano solo quelle rivolte verso di noi
        const makeLines = (list: Rings[], width: number, color: number, opacity: number, split = true): LineSet => {
          const R = 1.0006;
          const buckets = new Map<number, number[]>();
          for (const c of list) {
            for (const p of c.polys) {
              for (const r of [p.ring, ...p.holes]) {
                for (let i = 0; i < r.length; i++) {
                  const a = r[i],
                    b = r[(i + 1) % r.length];
                  // niente linee lungo l'antimeridiano o il bordo del polo: sono tagli della carta, non confini
                  if (Math.abs(a[0] - b[0]) > 180 || (Math.abs(a[0]) >= 179.99 && Math.abs(b[0]) >= 179.99 && a[0] * b[0] > 0) || (a[1] <= -89.99 && b[1] <= -89.99)) continue;
                  const key = split ? Math.floor((a[1] + 90) / CELL) * 100 + Math.floor((a[0] + 180) / CELL) : 0;
                  let arr = buckets.get(key);
                  if (!arr) buckets.set(key, (arr = []));
                  // i tratti lunghi (es. confini dritti) si dividono, così seguono la curva della Terra
                  const pieces = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 0.5));
                  for (let k = 0; k < pieces; k++) {
                    const t0 = k / pieces, t1 = (k + 1) / pieces;
                    const lat1 = (a[1] + (b[1] - a[1]) * t0) * D2R, lon1 = (a[0] + (b[0] - a[0]) * t0) * D2R;
                    const lat2 = (a[1] + (b[1] - a[1]) * t1) * D2R, lon2 = (a[0] + (b[0] - a[0]) * t1) * D2R;
                    arr.push(
                      R * Math.cos(lat1) * Math.cos(lon1), R * Math.sin(lat1), -R * Math.cos(lat1) * Math.sin(lon1),
                      R * Math.cos(lat2) * Math.cos(lon2), R * Math.sin(lat2), -R * Math.cos(lat2) * Math.sin(lon2),
                    );
                  }
                }
              }
            }
          }
          const mat = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, worldUnits: false });
          mat.resolution.set(stage.clientWidth || 1, stage.clientHeight || 1);
          lineMats.push(mat);
          const cells: LineSet["cells"] = [];
          for (const [key, arr] of buckets) {
            const geom = new LineSegmentsGeometry();
            geom.setPositions(arr);
            const line = new LineSegments2(geom, mat);
            line.frustumCulled = false;
            line.renderOrder = 5;
            yawG.add(line);
            const lat = split ? ((Math.floor(key / 100) + 0.5) * CELL - 90) * D2R : 0;
            const lon = split ? (((key % 100) + 0.5) * CELL - 180) * D2R : 0;
            cells.push(split ? { line, x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: -Math.cos(lat) * Math.sin(lon) } : { line, x: 0, y: 0, z: 0 });
          }
          return { cells, mat };
        };
        const lineSets: LineSet[] = [];
        const removeLines = (set: LineSet) => {
          for (const c of set.cells) {
            yawG.remove(c.line);
            c.line.geometry.dispose();
          }
          set.mat.dispose();
          const i = lineMats.indexOf(set.mat);
          if (i >= 0) lineMats.splice(i, 1);
          const j = lineSets.indexOf(set);
          if (j >= 0) lineSets.splice(j, 1);
        };
        const plain = rings.filter((c) => !gold.has(c.name) && !soft.has(c.name));
        const marked = rings.filter((c) => gold.has(c.name) || soft.has(c.name));
        let plainSet = makeLines(plain, 1.3, 0x233c5e, 0.85);
        let markedSet = makeLines(marked, 2.2, 0x1b2f4d, 1);
        lineSets.push(plainSet, markedSet);
        let selLine: LineSet | null = null;
        // confini delle regioni italiane: compaiono avvicinandosi all'Italia o scegliendola
        const regionSet = regionRings.length ? makeLines(regionRings, 1, 0x233c5e, 0.5) : null;
        if (regionSet) lineSets.push(regionSet);
        let regionSel: LineSet | null = null;
        let regionCode: string | null = null;
        const setRegion = (code: string | null) => {
          if (regionSel) {
            removeLines(regionSel);
            regionSel = null;
          }
          regionCode = code;
          const r = code ? regionRings.find((x) => x.name === code) : null;
          if (r) {
            regionSel = makeLines([r], 3.5, styleRef.current === "physical" ? 0xffd75e : 0xc58f2d, 1, false);
            lineSets.push(regionSel);
          }
          const info = code ? regionList.find((x) => x.c === code) : null;
          setRegionInfo(info ? { code: info.c, name: info.n } : null);
          onRegionRef.current?.(code);
        };

        const drawOverlay = (name: string | null) => {
          overlayCtx.clearRect(0, 0, OW, OH);
          if (selLine) {
            removeLines(selLine);
            selLine = null;
          }
          const c = name ? raw.find((r) => r.n === name) : null;
          overlay.visible = !!c;
          if (!c) {
            overlayTex.needsUpdate = true;
            return;
          }
          const sel = rings.find((r) => r.name === name);
          if (sel) {
            const [sc, so, sw] = STYLE_CFG[styleRef.current].sel;
            selLine = makeLines([sel], sw, sc, so, false);
            lineSets.push(selLine);
          }
          tracePath(overlayCtx, c, OW, OH);
          overlayCtx.fillStyle = STYLE_CFG[styleRef.current].veil;
          overlayCtx.fill("evenodd");
          overlayTex.needsUpdate = true;
        };

        // Puntini
        type Marker = { group: THREE_NS.Group; head: THREE_NS.Mesh; hit: THREE_NS.Mesh; tripId: string; country: string | null; label: HTMLDivElement };
        const markers: Marker[] = [];
        const labels = labelsRef.current!;
        labels.innerHTML = "";
        const makePin = (lat: number, lon: number, color: number, scale = 1) => {
          const n = ll2v(lat, lon, 1.0003);
          const g = new T.Group();
          g.position.copy(n);
          g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n);
          const stemH = 0.05 * scale;
          const stem = new T.Mesh(new T.CylinderGeometry(0.0035 * scale, 0.0035 * scale, stemH, 8), new T.MeshBasicMaterial({ color: 0xf3e2bd }));
          stem.position.y = stemH / 2;
          g.add(stem);
          const head = new T.Mesh(new T.SphereGeometry(0.02 * scale, 20, 16), new T.MeshBasicMaterial({ color }));
          head.position.y = stemH + 0.011 * scale;
          g.add(head);
          const hit = new T.Mesh(new T.SphereGeometry(0.085, 8, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
          hit.position.y = stemH;
          g.add(hit);
          yawG.add(g);
          return { g, head, hit };
        };
        const seenTrip = new Set<string>();
        for (const { trip, place, country: pinCountry } of pinsData) {
          const color = trip.status === "upcoming" ? 0xffe9b8 : 0xfff3d4;
          const { g, head, hit } = makePin(place.lat, place.lon, color);
          const first = !seenTrip.has(trip.id);
          seenTrip.add(trip.id);
          const label = document.createElement("div");
          label.className = "tg-tag";
          label.textContent = first ? trip.destination || trip.title : place.name;
          label.dataset.main = first ? "1" : "0";
          labels.appendChild(label);
          markers.push({ group: g, head, hit, tripId: trip.id, country: pinCountry, label });
        }

        // "Sei qui" (solo sul telefono)
        let me: { group: THREE_NS.Group; pulse: THREE_NS.Mesh; head: THREE_NS.Mesh; label: HTMLDivElement } | null = null;
        const setMe = (p: { lat: number; lon: number } | null) => {
          if (me) {
            yawG.remove(me.group);
            me.label.remove();
            me = null;
          }
          if (!p) return;
          const { g, head } = makePin(p.lat, p.lon, 0xff4a3a, 1.1);
          const pulse = new T.Mesh(
            new T.RingGeometry(0.02, 0.026, 40),
            new T.MeshBasicMaterial({ color: 0xff5a48, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }),
          );
          pulse.rotation.x = -Math.PI / 2;
          pulse.position.y = 0.004;
          g.add(pulse);
          const label = document.createElement("div");
          label.className = "tg-tag tg-me";
          label.textContent = "Sei qui";
          labels.appendChild(label);
          me = { group: g, pulse, head, label };
        };

        // Controlli
        const st = { yaw: 0, pitch: 0.4, yawV: 0, pitchV: 0, dist: 4.2, distT: 4.2, idle: 0, goal: null as null | { yaw: number; pitch: number } };
        const zoomBy = (factor: number) => {
          const alt = Math.max(minAltFor(styleRef.current), Math.min(MAX_ALT, (st.distT - 1) * factor));
          st.distT = 1 + alt;
          st.idle = 0;
        };
        const wrap = (a: number) => {
          while (a > Math.PI) a -= 2 * Math.PI;
          while (a < -Math.PI) a += 2 * Math.PI;
          return a;
        };
        // Soluzione numerica (robusta): trova lo yaw che porta il punto più vicino al centro
        // exact: da vicino il punto va proprio al centro (da lontano si lascia vedere un po' più di nord)
        const solve = (lat: number, lon: number, exact = false) => {
          const v = ll2v(lat, lon, 1);
          const pitch = Math.max(-1.2, Math.min(1.2, lat * D2R * (exact ? 1 : 0.9)));
          let best = 0,
            bz = -9;
          const m = new T.Matrix4();
          const tmp = new T.Vector3();
          for (let a = 0; a < 720; a++) {
            const yaw = (a * Math.PI) / 360;
            m.makeRotationX(pitch).multiply(new T.Matrix4().makeRotationY(yaw));
            tmp.copy(v).applyMatrix4(m);
            if (tmp.z > bz) {
              bz = tmp.z;
              best = yaw;
            }
          }
          return { yaw: st.yaw + wrap(best - st.yaw), pitch };
        };

        // Vista iniziale: il primo viaggio, altrimenti l'Italia
        const firstPlace = trips.find((t) => t.places.length)?.places[0];
        const startAt = firstPlace ?? { lat: 41.9, lon: 12.5, name: "" };
        const s0 = solve(startAt.lat, startAt.lon);
        st.yaw = s0.yaw;
        st.pitch = s0.pitch;

        const resize = () => {
          const w = stage.clientWidth,
            h = stage.clientHeight;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          for (const m of lineMats) m.resolution.set(w, h);
        };
        const ro = new ResizeObserver(resize);
        ro.observe(stage);
        resize();

        const pointers = new Map<number, { x: number; y: number }>();
        let dragging = false;
        let down: { x: number; y: number; t: number; moved: number } | null = null;
        let pinch0 = 0;

        const pick = (cx: number, cy: number) => {
          const rect = canvas.getBoundingClientRect();
          const ndc = new T.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
          const ray = new T.Raycaster();
          ray.setFromCamera(ndc, camera);
          const gh = ray.intersectObject(globe, false)[0];
          let best: Marker | null = null;
          let bd = 1e9;
          for (const m of markers) {
            const h = ray.intersectObject(m.hit, false)[0];
            if (h && h.distance < bd && (!gh || h.distance < gh.distance + 0.12)) {
              bd = h.distance;
              best = m;
            }
          }
          return { marker: best, ground: gh ?? null };
        };

        // Il paese sotto il dito (null se è mare)
        const countryFromHit = (point: THREE_NS.Vector3) => {
          const l = globe.worldToLocal(point.clone()).normalize();
          const lat = Math.asin(Math.max(-1, Math.min(1, l.y))) / D2R;
          const lon = Math.atan2(-l.z, l.x) / D2R;
          return { name: countryAt(lat, lon, rings, 0.2), lat, lon };
        };

        // Sceglie un paese (o nessuno): evidenzia, aggiorna la scheda e, se è visitato, può aprire la bacheca
        const choose = (name: string | null, tripId: string | null, openBoard: boolean) => {
          drawOverlay(name);
          if (name !== "Italy" && regionCode) setRegion(null);
          selectedRef.current = tripId;
          countryRef.current = name;
          setSelected(tripId);
          setCountry(name);
          setBoardOpen(mode === "client" && !!name && openBoard && (gold.has(name) || soft.has(name)));
        };

        const onDown = (e: PointerEvent) => {
          canvas.setPointerCapture(e.pointerId);
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.size === 1) {
            dragging = true;
            down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
            st.goal = null;
          } else if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
            down = null;
          }
          st.idle = 0;
        };
        const onMove = (e: PointerEvent) => {
          const p = pointers.get(e.pointerId);
          if (!p) return;
          const dx = e.clientX - p.x,
            dy = e.clientY - p.y;
          p.x = e.clientX;
          p.y = e.clientY;
          if (pointers.size >= 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinch0 > 0) zoomBy(pinch0 / d);
            pinch0 = d;
            return;
          }
          if (down) down.moved += Math.abs(dx) + Math.abs(dy);
          const k = ((Math.max(st.dist - 1, 0.002) / 4.1) * Math.PI * 0.9) / Math.max(stage.clientWidth, 280);
          st.yaw += dx * k;
          st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch + dy * k));
          st.yawV = dx * k * 0.9;
          st.pitchV = dy * k * 0.5;
          st.idle = 0;
        };
        const onUp = (e: PointerEvent) => {
          const had = pointers.get(e.pointerId);
          pointers.delete(e.pointerId);
          if (pointers.size === 0) {
            dragging = false;
            if (down && had && down.moved < 8 && performance.now() - down.t < 450) {
              const { marker, ground } = pick(e.clientX, e.clientY);
              if (marker) {
                choose(marker.country, marker.tripId, true);
              } else if (ground) {
                const hit = countryFromHit(ground.point);
                if (hit.name === "Italy" && regionRings.length) {
                  const rc = areaAt(hit.lat, hit.lon, regionRings);
                  choose("Italy", null, false);
                  setRegion(rc);
                  api.current?.focus(hit.lat, hit.lon, rc ? regionDist(rc) : 2.2);
                } else if (hit.name) {
                  choose(hit.name, null, true);
                  api.current?.focus(hit.lat, hit.lon, 3);
                } else choose(null, null, false);
              } else {
                choose(null, null, false);
              }
            }
            down = null;
            pinch0 = 0;
          }
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          zoomBy(Math.exp(e.deltaY * 0.0015));
          st.idle = 0;
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
        canvas.addEventListener("wheel", onWheel, { passive: false });

        // ---- stile "fisico": foto satellitare NASA con rilievo e oceani lucidi (si scarica solo se scelto) ----
        const antiqueMat = globe.material as THREE_NS.MeshPhongMaterial;
        let phys: { mat: THREE_NS.MeshPhongMaterial; marks: THREE_NS.Mesh; marksCanvas: HTMLCanvasElement; marksTex: THREE_NS.CanvasTexture; glow: THREE_NS.Mesh; textures: THREE_NS.Texture[] } | null = null;
        // Velo dorato sui paesi visitati / venduti (stile fisico)
        const drawMarks = (mc: HTMLCanvasElement) => {
          const mctx = mc.getContext("2d")!;
          mctx.clearRect(0, 0, mc.width, mc.height);
          for (const c of raw) {
            if (!gold.has(c.n) && !soft.has(c.n)) continue;
            tracePath(mctx, c, mc.width, mc.height);
            mctx.fillStyle = gold.has(c.n) ? "rgba(255,190,50,.42)" : "rgba(255,214,120,.26)";
            mctx.fill("evenodd");
          }
        };
        // Immagini satellitari a tasselli, sempre più dettagliate avvicinandosi (solo stile fisico)
        const tiles = new SatelliteTiles(T, renderer.capabilities.getMaxAnisotropy());
        tiles.setVisible(false);
        yawG.add(tiles.group);
        const ensurePhysical = async () => {
          if (phys) return true;
          try {
            const loader = new T.TextureLoader();
            const aniso = renderer.capabilities.getMaxAnisotropy();
            const [map, bump, water] = await Promise.all([loader.loadAsync("/globe/terra.jpg"), loader.loadAsync("/globe/rilievo.png"), loader.loadAsync("/globe/acque.png")]);
            if (disposed) return false;
            map.colorSpace = T.SRGBColorSpace;
            map.anisotropy = aniso;
            bump.anisotropy = aniso;
            const mat = new T.MeshPhongMaterial({ map, bumpMap: bump, bumpScale: 4, specularMap: water, specular: new T.Color(0x3a5878), shininess: 34 });
            // paesi visitati e in programma: velo dorato sopra la foto
            const mc = document.createElement("canvas");
            mc.width = 4096;
            mc.height = 2048;
            drawMarks(mc);
            const marksTex = new T.CanvasTexture(mc);
            marksTex.colorSpace = T.SRGBColorSpace;
            marksTex.anisotropy = aniso;
            const marks = new T.Mesh(new T.SphereGeometry(1.0004, 360, 180), new T.MeshBasicMaterial({ map: marksTex, transparent: true, depthWrite: false }));
            marks.visible = false;
            marks.renderOrder = 3;
            yawG.add(marks);
            // alone azzurro dell'atmosfera
            const glow = new T.Mesh(
              new T.SphereGeometry(1.13, 64, 48),
              new T.ShaderMaterial({
                transparent: true,
                side: T.BackSide,
                depthWrite: false,
                blending: T.AdditiveBlending,
                vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
                fragmentShader: "varying vec3 vN; void main(){ float i = pow(max(0.0, 0.74 - dot(vN, vec3(0.0,0.0,1.0))), 3.0); gl_FragColor = vec4(0.32,0.58,1.0,1.0) * i; }",
              }),
            );
            glow.visible = false;
            scene.add(glow);
            phys = { mat, marks, marksCanvas: mc, marksTex, glow, textures: [map, bump, water, marksTex] };
            return true;
          } catch (error) {
            console.error("[TravelGlobe] stile fisico", error);
            return false;
          }
        };
        const applyStyle = async (next: GlobeStyle) => {
          if (next === "physical" && !(await ensurePhysical())) return false;
          if (disposed) return false;
          styleRef.current = next;
          const real = next === "physical" ? phys : null;
          globe.material = real ? real.mat : antiqueMat;
          oceanLabels.visible = !real;
          if (phys) {
            phys.marks.visible = !!real;
            phys.glow.visible = !!real;
          }
          tiles.setVisible(!!real);
          if (!real) st.distT = Math.max(st.distT, 1 + minAltFor("antique"));
          key.color.setHex(real ? 0xffffff : 0xfff2da);
          key.intensity = real ? 2.4 : 1.7;
          ambient.color.setHex(real ? 0xc9d6ee : 0xfff4e0);
          ambient.intensity = real ? 0.85 : 2.1;
          styleLines();
          drawOverlay(countryRef.current);
          return true;
        };
        function styleLines() {
          const cfg = STYLE_CFG[styleRef.current];
          for (const [set, c] of [[plainSet, cfg.plain], [markedSet, cfg.marked]] as const) {
            set.mat.color.setHex(c[0]);
            set.mat.opacity = c[1];
            set.mat.transparent = c[1] < 1;
            set.mat.linewidth = c[2];
            set.mat.needsUpdate = true;
          }
          if (regionSet) {
            regionSet.mat.color.setHex(cfg.plain[0]);
            regionSet.mat.opacity = cfg.plain[1] * 0.6;
            regionSet.mat.transparent = true;
            regionSet.mat.linewidth = 1;
            regionSet.mat.needsUpdate = true;
          }
          if (regionSel) {
            regionSel.mat.color.setHex(styleRef.current === "physical" ? 0xffd75e : 0xc58f2d);
            regionSel.mat.needsUpdate = true;
          }
        }

        // ---- agenzia: numeri sui paesi e aggiornamento dei paesi evidenziati quando cambiano i filtri ----
        const centroidCache = new Map<string, { lat: number; lon: number } | null>();
        const centroidOf = (name: string) => {
          if (centroidCache.has(name)) return centroidCache.get(name)!;
          const c = rings.find((r) => r.name === name);
          let best: { lat: number; lon: number } | null = null;
          if (c && c.polys.length) {
            const poly = [...c.polys].sort((a, b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]))[0];
            let A = 0,
              cx = 0,
              cy = 0;
            const r = poly.ring;
            for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
              const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
              A += f;
              cx += (r[j][0] + r[i][0]) * f;
              cy += (r[j][1] + r[i][1]) * f;
            }
            best = A !== 0 ? { lon: cx / (3 * A), lat: cy / (3 * A) } : { lon: (poly.box[0] + poly.box[2]) / 2, lat: (poly.box[1] + poly.box[3]) / 2 };
            if (!inRing(best.lon, best.lat, r)) {
              // forma "a mezzaluna": il punto interno più vicino al centro
              let bd = Infinity;
              let inside: { lat: number; lon: number } | null = null;
              const [x0, y0, x1, y1] = poly.box;
              for (let i = 0; i <= 24; i++)
                for (let j = 0; j <= 24; j++) {
                  const lon = x0 + ((x1 - x0) * i) / 24,
                    lat = y0 + ((y1 - y0) * j) / 24;
                  if (!inRing(lon, lat, r)) continue;
                  const d = (lon - best.lon) ** 2 + (lat - best.lat) ** 2;
                  if (d < bd) {
                    bd = d;
                    inside = { lat, lon };
                  }
                }
              if (inside) best = inside;
            }
          }
          centroidCache.set(name, best);
          return best;
        };
        type Badge = { name: string; el: HTMLDivElement; pos: THREE_NS.Vector3 };
        let badges: Badge[] = [];
        const buildBadges = () => {
          for (const b of badges) b.el.remove();
          badges = [];
          if (mode !== "agency") return;
          for (const [name, stat] of Object.entries(agencyRef.current?.stats ?? {})) {
            if (stat.count <= 0) continue;
            const c = centroidOf(name);
            if (!c) continue;
            const el = document.createElement("div");
            el.className = "tg-badge";
            el.textContent = String(stat.count);
            labels.appendChild(el);
            badges.push({ name, el, pos: ll2v(c.lat, c.lon, 1.0006) });
          }
        };
        buildBadges();
        const setHighlight = (data: AgencyGlobeData) => {
          agencyRef.current = data;
          gold.clear();
          soft.clear();
          for (const [name, stat] of Object.entries(data.stats)) if (stat.count > 0) gold.add(name);
          setInfo({ gold: [...gold], soft: [], byCountry: {} });
          texture.image = drawTexture(raw, gold, soft, `${fam}, Georgia, serif`);
          texture.needsUpdate = true;
          if (phys) {
            drawMarks(phys.marksCanvas);
            phys.marksTex.needsUpdate = true;
          }
          removeLines(plainSet);
          removeLines(markedSet);
          plainSet = makeLines(rings.filter((c) => !gold.has(c.name)), 1.3, 0x233c5e, 0.85);
          markedSet = makeLines(rings.filter((c) => gold.has(c.name)), 2.2, 0x1b2f4d, 1);
          lineSets.unshift(plainSet, markedSet);
          styleLines();
          buildBadges();
        };
        // zone della regione scelta: etichette cliccabili sul globo
        // ogni zona: un pallino numerato sul punto esatto e il nome accanto, spostato dove c'è spazio
        // (con una linea sottile che lo collega al pallino); se non c'è posto resta solo il numero
        type ZoneMark = { id: string; dot: HTMLButtonElement; label: HTMLButtonElement; line: HTMLDivElement; pos: THREE_NS.Vector3; w: number; h: number };
        let zones: ZoneMark[] = [];
        const setZones = (list: { id: string; name: string; lat: number; lon: number }[]) => {
          for (const z of zones) {
            z.dot.remove();
            z.label.remove();
            z.line.remove();
          }
          zones = list.map((z, i) => {
            const line = document.createElement("div");
            line.className = "tg-zone-line";
            const label = document.createElement("button");
            label.type = "button";
            label.className = "tg-zone";
            label.textContent = z.name;
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "tg-zone-dot";
            dot.textContent = String(i + 1);
            dot.title = z.name;
            dot.setAttribute("aria-label", z.name);
            for (const el of [label, dot]) el.addEventListener("click", () => onZoneRef.current?.(z.id));
            labels.append(line, label, dot);
            return { id: z.id, dot, label, line, pos: ll2v(z.lat, z.lon, 1.0006), w: label.offsetWidth || z.name.length * 7 + 18, h: label.offsetHeight || 22 };
          });
        };
        // inquadratura adatta alla grandezza della regione
        const regionDist = (code: string) => {
          const r = regionRings.find((x) => x.name === code);
          if (!r) return 1.5;
          let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
          for (const p of r.polys) {
            x0 = Math.min(x0, p.box[0]);
            y0 = Math.min(y0, p.box[1]);
            x1 = Math.max(x1, p.box[2]);
            y1 = Math.max(y1, p.box[3]);
          }
          const extent = Math.max((x1 - x0) * Math.cos((((y0 + y1) / 2) * Math.PI) / 180), y1 - y0) * D2R;
          return 1 + Math.max(minAltFor(styleRef.current), Math.min(0.9, extent * 2.1));
        };
        const selectRegion = (code: string | null) => {
          choose("Italy", null, false);
          setRegion(code);
          const info = code ? regionList.find((x) => x.c === code) : null;
          if (info) {
            api.current?.focus(info.center[1], info.center[0], regionDist(info.c));
            st.distT = regionDist(info.c); // l'inquadratura si adatta alla regione, anche allontanandosi
          } else api.current?.focus(42.5, 12.5, 2.1);
        };
        // un paese cercato o scelto dalla classifica: inquadratura adatta alla sua grandezza
        const selectCountry = (name: string) => {
          const c = centroidOf(name);
          choose(name, null, false);
          const ring = rings.find((r) => r.name === name);
          const big = ring ? [...ring.polys].sort((a, b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]))[0] : null;
          const extent = big ? Math.max((big.box[2] - big.box[0]) * Math.cos((((big.box[1] + big.box[3]) / 2) * Math.PI) / 180), big.box[3] - big.box[1]) * D2R : 0.5;
          const dist = 1 + Math.max(minAltFor(styleRef.current), Math.min(2.2, extent * 2.7));
          if (c) {
            api.current?.focus(c.lat, c.lon, dist);
            st.distT = dist;
          }
        };

        api.current = {
          zoom: (factor) => zoomBy(factor),
          focus: (lat, lon, maxDist = 2.2) => {
            st.goal = solve(lat, lon, maxDist < 2);
            st.yawV = 0;
            st.pitchV = 0;
            st.distT = Math.min(st.distT, maxDist);
          },
          setMe: (p) => {
            setMe(p);
            if (p) api.current?.focus(p.lat, p.lon);
          },
          chooseTrip: (tripId) => {
            const first = pinsData.find((d) => d.trip.id === tripId);
            if (!first) return;
            choose(first.country, tripId, false);
            api.current?.focus(first.place.lat, first.place.lon);
          },
          clear: () => choose(null, null, false),
          setStyle: applyStyle,
          selectCountry,
          setHighlight,
          selectRegion,
          setZones,
        };
        if (styleRef.current !== "antique") {
          applyStyle(styleRef.current).then((ok) => {
            if (!ok && !disposed) {
              styleRef.current = "antique";
              setStyle("antique");
            }
          });
        }

        // Ciclo
        let raf = 0;
        let last = performance.now();
        let visible = true;
        const onVis = () => {
          visible = !document.hidden;
          last = performance.now();
        };
        document.addEventListener("visibilitychange", onVis);
        const v = new T.Vector3();
        const toCam = new T.Vector3();
        let lastTiles = 0;
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          if (!visible) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          const t = now / 1000;
          if (st.goal) {
            const k = 1 - Math.exp(-dt * 5);
            st.yaw += (st.goal.yaw - st.yaw) * k;
            st.pitch += (st.goal.pitch - st.pitch) * k;
            if (Math.abs(st.goal.yaw - st.yaw) < 0.002 && Math.abs(st.goal.pitch - st.pitch) < 0.002) st.goal = null;
          } else if (!dragging) {
            st.yaw += st.yawV;
            st.pitch = Math.max(-1.3, Math.min(1.3, st.pitch + st.pitchV));
            st.yawV *= Math.pow(0.9, dt * 60);
            st.pitchV *= Math.pow(0.85, dt * 60);
            st.idle += dt;
          }
          st.dist += (st.distT - st.dist) * (1 - Math.exp(-dt * 8));
          camera.position.set(0, 0, st.dist);
          camera.lookAt(0, 0, 0);
          // piano di taglio vicino adatto alla quota (da vicino la superficie è a pochi km)
          const near = Math.max(0.0004, (st.dist - 1) * 0.3);
          if (Math.abs(camera.near - near) > near * 0.05) {
            camera.near = near;
            camera.far = st.dist + 2;
            camera.updateProjectionMatrix();
          }
          yawG.rotation.y = st.yaw;
          pitchG.rotation.x = st.pitch;

          if (me) {
            const p = (t % 1.8) / 1.8;
            me.pulse.scale.setScalar(1 + p * 5);
            (me.pulse.material as THREE_NS.MeshBasicMaterial).opacity = 0.85 * (1 - p);
          }
          // I puntini restano piccoli anche da vicino
          const pinScale = Math.max(0.004, Math.min(1.1, (st.dist - 1) * 0.62));
          for (const m of markers) {
            m.group.scale.setScalar(pinScale);
            m.head.scale.setScalar(selectedRef.current === m.tripId ? 1.5 : 1);
          }
          if (me) me.group.scale.setScalar(pinScale);
          // Si disegnano solo i confini rivolti verso la camera (il resto del globo è nascosto comunque)
          yawG.updateWorldMatrix(true, false);
          const me_ = yawG.matrixWorld.elements;
          const limb = Math.acos(Math.min(1, 1 / st.dist)) + 0.2;
          const minZ = Math.cos(Math.min(Math.PI, limb));
          for (const set of lineSets) {
            for (const c of set.cells) c.line.visible = c.x === 0 && c.y === 0 && c.z === 0 ? true : me_[2] * c.x + me_[6] * c.y + me_[10] * c.z > minZ;
          }
          if (regionSet) {
            const showRegions = st.dist - 1 < 1.1 || countryRef.current === "Italy";
            if (!showRegions) for (const c of regionSet.cells) c.line.visible = false;
          }
          // da vicino il velo dorato si attenua, per lasciare vedere l'immagine satellitare (restano i bordi)
          if (phys && styleRef.current === "physical") {
            (phys.marks.material as THREE_NS.MeshBasicMaterial).opacity = Math.max(0.12, Math.min(1, (st.dist - 1) * 1.6));
          }
          // tasselli satellitari della zona inquadrata (aggiornati 5 volte al secondo)
          if (styleRef.current === "physical" && now - lastTiles > 200) {
            lastTiles = now;
            // punto del globo al centro della vista
            const cxl = me_[2],
              cyl = me_[6],
              czl = me_[10];
            const cLat = Math.asin(Math.max(-1, Math.min(1, cyl))) / D2R;
            const cLon = Math.atan2(-czl, cxl) / D2R;
            const fovHalf = (camera.fov / 2) * D2R;
            const diag = Math.atan(Math.tan(fovHalf) * Math.hypot(1, camera.aspect));
            const horizon = Math.acos(Math.min(1, 1 / st.dist));
            const reach = st.dist * Math.sin(diag) < 1 ? Math.asin(st.dist * Math.sin(diag)) - diag : horizon;
            const H = Math.max(200, stage.clientHeight);
            const degPerPx = ((2 * (st.dist - 1) * Math.tan(fovHalf)) / H) * (180 / Math.PI) / Math.min(window.devicePixelRatio || 1, 2) * 1.25;
            tiles.update({ lat: cLat, lon: cLon, radiusDeg: Math.min(horizon, reach) / D2R + 2, degPerPx });
          }
          renderer.render(scene, camera);

          // Etichette
          const w = stage.clientWidth,
            h = stage.clientHeight;
          const place = (el: HTMLDivElement, head: THREE_NS.Object3D, show: boolean) => {
            head.getWorldPosition(v);
            toCam.copy(camera.position).sub(v).normalize();
            const facing = v.clone().normalize().dot(toCam);
            v.project(camera);
            el.style.opacity = show && facing > 0.28 ? "1" : "0";
            el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%,-135%)`;
          };
          for (const m of markers) place(m.label, m.head, m.label.dataset.main === "1" || selectedRef.current === m.tripId);
          for (const b of badges) {
            v.copy(b.pos).applyMatrix4(yawG.matrixWorld);
            toCam.copy(camera.position).sub(v).normalize();
            const facing = v.clone().normalize().dot(toCam);
            v.project(camera);
            // con una regione italiana scelta i numeri dei viaggi lasciano spazio a quelli delle zone
            b.el.style.opacity = facing > 0.2 && !regionCode ? "1" : "0";
            b.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%,-50%)`;
          }
          if (me) place(me.label, me.head, true);
          if (zones.length) {
            // 1. posizione sullo schermo di ogni pallino
            const shown: { z: ZoneMark; x: number; y: number }[] = [];
            for (const z of zones) {
              v.copy(z.pos).applyMatrix4(yawG.matrixWorld);
              toCam.copy(camera.position).sub(v).normalize();
              const facing = v.clone().normalize().dot(toCam);
              v.project(camera);
              const on = facing > 0.3 && st.dist - 1 < 1.2;
              z.dot.style.opacity = on ? "1" : "0";
              z.dot.style.pointerEvents = on ? "auto" : "none";
              if (on) {
                const x = (v.x * 0.5 + 0.5) * w,
                  y = (-v.y * 0.5 + 0.5) * h;
                z.dot.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
                shown.push({ z, x, y });
              } else {
                z.label.style.opacity = "0";
                z.label.style.pointerEvents = "none";
                z.line.style.opacity = "0";
              }
            }
            // 2. i nomi si sistemano uno alla volta dove non coprono pallini né altri nomi
            const taken = shown.map((s) => [s.x - 12, s.y - 12, s.x + 12, s.y + 12]);
            // i nomi non finiscono sotto la scheda del paese
            const card = stage.querySelector<HTMLElement>("[data-globe-card]");
            if (card) {
              const sr = stage.getBoundingClientRect(),
                cr = card.getBoundingClientRect();
              taken.push([cr.left - sr.left - 4, cr.top - sr.top - 4, cr.right - sr.left + 4, cr.bottom - sr.top + 4]);
            }
            const free = (b: number[]) => b[0] >= 2 && b[1] >= 2 && b[2] <= w - 2 && b[3] <= h - 2 && taken.every((t) => b[2] <= t[0] || b[0] >= t[2] || b[3] <= t[1] || b[1] >= t[3]);
            for (const s of shown) {
              const { z } = s;
              let best: number[] | null = null;
              for (const d of [16, 34, 56]) {
                const cands = [
                  [0, -(z.h / 2 + d)], [z.w / 2 + d, 0], [-(z.w / 2 + d), 0], [0, z.h / 2 + d],
                  [z.w / 2 + d * 0.7, -(z.h / 2 + d * 0.7)], [-(z.w / 2 + d * 0.7), -(z.h / 2 + d * 0.7)],
                  [z.w / 2 + d * 0.7, z.h / 2 + d * 0.7], [-(z.w / 2 + d * 0.7), z.h / 2 + d * 0.7],
                ];
                for (const [dx, dy] of cands) {
                  const cx = s.x + dx,
                    cy = s.y + dy;
                  const b = [cx - z.w / 2 - 2, cy - z.h / 2 - 2, cx + z.w / 2 + 2, cy + z.h / 2 + 2];
                  if (free(b)) {
                    best = [cx, cy, ...b];
                    break;
                  }
                }
                if (best) break;
              }
              if (best) {
                taken.push(best.slice(2));
                const [cx, cy] = best;
                z.label.style.opacity = "1";
                z.label.style.pointerEvents = "auto";
                z.label.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) translate(-50%,-50%)`;
                const len = Math.hypot(cx - s.x, cy - s.y);
                z.line.style.opacity = "1";
                z.line.style.width = `${len.toFixed(1)}px`;
                z.line.style.transform = `translate(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px) rotate(${Math.atan2(cy - s.y, cx - s.x).toFixed(3)}rad)`;
              } else {
                z.label.style.opacity = "0";
                z.label.style.pointerEvents = "none";
                z.line.style.opacity = "0";
              }
            }
          }
        };
        raf = requestAnimationFrame(frame);
        setReady(true);

        cleanup = () => {
          cancelAnimationFrame(raf);
          document.removeEventListener("visibilitychange", onVis);
          ro.disconnect();
          canvas.removeEventListener("pointerdown", onDown);
          canvas.removeEventListener("pointermove", onMove);
          canvas.removeEventListener("pointerup", onUp);
          canvas.removeEventListener("pointercancel", onUp);
          canvas.removeEventListener("wheel", onWheel);
          scene.traverse((o) => {
            const mesh = o as THREE_NS.Mesh;
            mesh.geometry?.dispose?.();
            const mat = mesh.material as THREE_NS.Material | THREE_NS.Material[] | undefined;
            (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((m) => m.dispose());
          });
          texture.dispose();
          overlayTex.dispose();
          tiles.dispose();
          (phys as { textures: THREE_NS.Texture[] } | null)?.textures.forEach((t) => t.dispose());
          oceanLabels.traverse((o) => ((o as THREE_NS.Mesh).material as THREE_NS.MeshBasicMaterial | undefined)?.map?.dispose());
          renderer.dispose();
          api.current = null;
        };
      } catch (error) {
        console.error("[TravelGlobe]", error);
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [trips, mode]);

  // Agenzia: cambiano i filtri → si aggiornano paesi evidenziati e numeri, senza ricostruire il globo
  useEffect(() => {
    if (mode !== "agency" || !agency || !ready || agency === agencyRef.current) return;
    api.current?.setHighlight(agency);
  }, [agency, mode, ready]);

  // Agenzia: una regione italiana scelta dal pannello Italia si evidenzia sul globo
  useEffect(() => {
    if (regionRequest && ready) api.current?.selectRegion(regionRequest.code);
  }, [regionRequest, ready]);
  useEffect(() => {
    if (ready) api.current?.setZones(zoneMarks ?? []);
  }, [zoneMarks, ready]);

  // Agenzia: un paese scelto dalla classifica si evidenzia e si centra sul globo
  useEffect(() => {
    if (focusRequest && ready) api.current?.selectCountry(focusRequest.name);
  }, [focusRequest, ready]);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeoState("unsupported");
      return;
    }
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // La posizione resta in questa pagina: non viene salvata né inviata a nessuno
        api.current?.setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoState("on");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  }

  const countryTrips = country && info ? (info.byCountry[country] ?? []).map((id) => trips.find((t) => t.id === id)).filter((t): t is GlobeTrip => !!t) : [];
  const isVisited = !!country && !!info?.gold.includes(country);
  const isPlanned = !!country && !!info?.soft.includes(country);
  const photoCount = country ? (counts[country] ?? 0) : 0;
  const countriesDone = info?.gold.length ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={stageRef}
        className="relative aspect-square max-h-[78vh] w-full touch-none select-none overflow-hidden rounded-3xl"
        style={{
          background:
            style === "physical"
              ? "radial-gradient(ellipse at 50% 42%, #14223a 0%, #0a1322 62%, #04080f 100%)"
              : "radial-gradient(ellipse at 50% 42%, #243f66 0%, #13233c 62%, #0b1626 100%)",
        }}
        aria-label="Mappamondo dei tuoi viaggi"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-grab touch-none" aria-label="Mappamondo 3D: trascina per girarlo" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
        {!ready && !failed && (
          <div className="absolute inset-0 z-10 grid place-items-center text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Carico il mondo…
            </span>
          </div>
        )}
        {ready && style === "physical" && (
          <p className="pointer-events-none absolute bottom-1 right-3 z-[5] text-[10px] text-white/60">Immagini: NASA Blue Marble, Landsat (GIBS)</p>
        )}
        {failed && (
          <div className="absolute inset-0 z-10 grid place-items-center p-6 text-center text-sm text-white/80">
            Il tuo telefono non riesce a mostrare il globo 3D. Qui sotto trovi comunque l&apos;elenco dei tuoi viaggi.
          </div>
        )}
        {ready && (
          <button
            type="button"
            onClick={locateMe}
            disabled={geoState === "asking"}
            className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/60 disabled:opacity-60"
          >
            <Crosshair size={13} />
            {geoState === "asking" ? "Cerco la tua posizione…" : geoState === "on" ? "Aggiorna la mia posizione" : "Dove sono adesso"}
          </button>
        )}
        {ready && (
          <div className="absolute left-3 top-12 z-10 flex overflow-hidden rounded-full border border-white/25 bg-black/45 text-xs font-medium text-white backdrop-blur" role="group" aria-label="Aspetto del mappamondo">
            {(
              [
                ["antique", "Carta d'epoca"],
                ["physical", styleBusy ? "Carico…" : "Fisico"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => chooseStyle(id)}
                aria-pressed={style === id}
                disabled={styleBusy}
                className={`px-3 py-1.5 transition ${style === id ? "bg-white/85 text-[#13233c]" : "hover:bg-black/60"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {ready && (
          <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-full border border-white/25 bg-black/45 backdrop-blur">
            <button type="button" aria-label="Ingrandisci" onClick={() => api.current?.zoom(0.6)} className="h-9 w-9 text-lg font-medium leading-none text-white hover:bg-black/60">
              +
            </button>
            <button type="button" aria-label="Riduci" onClick={() => api.current?.zoom(1.6)} className="h-9 w-9 border-t border-white/20 text-lg font-medium leading-none text-white hover:bg-black/60">
              −
            </button>
          </div>
        )}
        {ready && (
          <div className="absolute right-3 top-[88px] z-20 flex justify-end">
            <GlobeSearch
              regions={regionNames}
              onPick={(item: GlobeSearchItem) => {
                if (item.kind === "region") api.current?.selectRegion(item.code);
                else {
                  const name = namesOf(item.code)[0];
                  if (name) api.current?.selectCountry(name);
                }
              }}
            />
          </div>
        )}
        {country && mode === "agency" && (
          <div data-globe-card className="absolute inset-x-3 bottom-3 z-10 max-w-sm rounded-2xl bg-[#faf3e6]/95 p-3.5 pr-10 text-[#1d2b40] shadow-xl">
            <button
              type="button"
              onClick={() => api.current?.clear()}
              aria-label="Chiudi la scheda del paese"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-black/5"
            >
              ×
            </button>
            {(() => {
              const stat = agency?.stats[country];
              return (
                <>
                  <p className="text-xs font-semibold text-[#756548]">
                    {stat && stat.count > 0
                      ? `${stat.count} ${agency?.countLabel ?? "viaggi"}${agency?.showValue && stat.value > 0 ? ` · ${stat.value.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}` : ""}`
                      : "Nessun viaggio nel periodo scelto"}
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold leading-tight">
                    {countryNameIt(country)}
                    {country === "Italy" && regionInfo && <span className="text-[#a87a1e]"> · {regionInfo.name}</span>}
                  </p>
                  {stat && stat.trips.length > 0 && (
                    <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-sm text-slate-600">
                      {stat.trips.map((t) => (
                        <li key={t.id} className="truncate">
                          <a href={`/dashboard/trips/${t.id}`} className="underline decoration-[#c58f2d] underline-offset-2">
                            {t.title}
                          </a>
                          <span className="text-slate-500">
                            {t.client ? ` · ${t.client}` : ""}
                            {t.from ? ` · ${dateIt(t.from)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {country === "Italy" && onOpenItaly && regionInfo && (
                      <button
                        type="button"
                        onClick={() => onOpenItaly(regionInfo.code)}
                        className="flex items-center gap-2 rounded-full bg-[#c58f2d] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#a87a1e]"
                      >
                        Scheda {regionInfo.name}
                      </button>
                    )}
                    {country === "Italy" && onOpenItaly && (
                      <button
                        type="button"
                        onClick={() => onOpenItaly(null)}
                        className="flex items-center gap-2 rounded-full border border-[#233c5e] px-3.5 py-1.5 text-sm font-semibold text-[#233c5e] hover:bg-white"
                      >
                        Regioni d&apos;Italia
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenSheet?.(country)}
                      className="flex items-center gap-2 rounded-full bg-[#233c5e] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#1b3050]"
                    >
                      Scheda paese
                    </button>
                  </div>
                  {country === "Italy" && regionInfo && zoneMarks && zoneMarks.length > 0 && (
                    <div className="mt-2 border-t border-[#e6d7bb] pt-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#a87a1e]">Zone di {regionInfo.name}</p>
                      <ol className="flex max-h-[4.5rem] flex-wrap gap-1 overflow-y-auto">
                        {zoneMarks.map((z, i) => (
                          <li key={z.id}>
                            <button
                              type="button"
                              onClick={() => onZone?.(z.id)}
                              className="flex items-center gap-1 rounded-full border border-[#e6d7bb] bg-white py-0.5 pl-0.5 pr-2 text-xs font-medium text-[#233c5e] hover:border-[#c58f2d]"
                            >
                              <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#233c5e] text-[10px] font-bold text-white">{i + 1}</span>
                              {z.name}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {country === "Italy" && onOpenItaly && !regionInfo && <p className="mt-1.5 text-xs text-slate-500">Tocca una regione sul globo per aprirne la scheda.</p>}
                </>
              );
            })()}
          </div>
        )}
        {country && mode === "client" && (
          <div className="absolute inset-x-3 bottom-3 z-10 max-w-sm rounded-2xl bg-[#faf3e6]/95 p-3.5 pr-10 text-[#1d2b40] shadow-xl">
            <button
              type="button"
              onClick={() => api.current?.clear()}
              aria-label="Chiudi la scheda del paese"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-black/5"
            >
              ×
            </button>
            <p className="text-xs font-semibold text-[#756548]">{isVisited ? "Paese visitato" : isPlanned ? "In programma" : "Non ancora visitato"}</p>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold leading-tight">{countryNameIt(country)}</p>
            {countryTrips.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                {countryTrips.map((t) => (
                  <li key={t.id}>
                    <a href={`/client/trips/${t.id}`} className="underline decoration-[#c58f2d] underline-offset-2">
                      {t.title}
                    </a>
                    <span className="text-slate-500">
                      {" "}
                      · {STATUS_LABEL[t.status].toLowerCase()}
                      {t.from ? `, ${dateIt(t.from)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setBoardOpen(true)}
              className="mt-2 flex items-center gap-2 rounded-full bg-[#233c5e] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#1b3050]"
            >
              <Camera size={15} />
              {photoCount > 0 ? `Bacheca · ${photoCount} foto` : "Bacheca · aggiungi foto"}
            </button>
          </div>
        )}
      </div>

      {boardOpen && country && (
        <CountryBoard
          key={country}
          country={country}
          nameIt={countryNameIt(country)}
          userId={userId}
          trips={countryTrips.map((t) => ({ id: t.id, title: t.title, from: t.from, status: t.status }))}
          onClose={() => setBoardOpen(false)}
          onCountChange={onBoardCount}
        />
      )}

      {geoState === "denied" && <p className="text-sm text-amber-700">Non ho potuto leggere la tua posizione: controlla di aver dato il permesso al sito nelle impostazioni del telefono.</p>}
      {geoState === "unsupported" && <p className="text-sm text-amber-700">Questo dispositivo non permette di leggere la posizione.</p>}
      {geoState === "on" && <p className="text-xs text-slate-500">La tua posizione resta su questo telefono: non viene salvata né condivisa con nessuno.</p>}

      {countriesDone !== null && trips.length > 0 && (
        <p className="text-sm text-[#756548]">
          {countriesDone === 0 ? "Nessun paese ancora visitato." : countriesDone === 1 ? "Hai visitato 1 paese." : `Hai visitato ${countriesDone} paesi.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {trips.map((trip) => (
          <button
            key={trip.id}
            type="button"
            onClick={() => focusTrip(trip)}
            aria-pressed={selected === trip.id}
            className={`min-w-0 rounded-xl border px-3 py-2 text-left text-sm leading-snug transition ${
              selected === trip.id ? "border-[#233c5e] bg-[#233c5e] text-white" : "border-[#e6d7bb] bg-white text-[#1d2b40] hover:border-[#233c5e]"
            }`}
          >
            <span className="block font-medium">{trip.title}</span>
            <span className={`block text-xs ${selected === trip.id ? "text-white/80" : "text-slate-500"}`}>
              {STATUS_LABEL[trip.status]}
              {trip.from ? ` · ${dateIt(trip.from)}` : ""}
            </span>
          </button>
        ))}
      </div>

      <style>{`
        .tg-tag { position: absolute; left: 0; top: 0; transform: translate(-50%, -135%); white-space: nowrap; font-size: 11.5px; font-weight: 600; line-height: 1; padding: 5px 8px; border-radius: 99px; background: rgba(10,18,32,.72); color: #fff; border: 1px solid rgba(255,255,255,.18); backdrop-filter: blur(4px); transition: opacity .2s; will-change: transform; }
        .tg-me { background: #e24a3b; border-color: rgba(255,255,255,.5); }
        .tg-zone { position: absolute; left: 0; top: 0; white-space: nowrap; font-size: 11px; font-weight: 700; line-height: 1; padding: 5px 8px; border-radius: 99px; background: #faf3e6; color: #233c5e; border: 1.5px solid #c58f2d; box-shadow: 0 2px 6px rgba(0,0,0,.3); cursor: pointer; transition: opacity .15s; will-change: transform; opacity: 0; }
        .tg-zone:hover, .tg-zone-dot:hover { background: #c58f2d; color: #fff; }
        .tg-zone-dot { position: absolute; left: 0; top: 0; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 99px; background: #233c5e; color: #fff; font-size: 11px; font-weight: 800; border: 2px solid #e3c27a; box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: pointer; transition: opacity .15s; will-change: transform; opacity: 0; }
        .tg-zone-line { position: absolute; left: 0; top: 0; height: 1.5px; background: #c58f2d; transform-origin: 0 50%; opacity: 0; pointer-events: none; will-change: transform; }
        .tg-badge { position: absolute; left: 0; top: 0; min-width: 26px; height: 26px; padding: 0 7px; display: grid; place-items: center; border-radius: 99px; background: #233c5e; color: #fff; font-size: 12.5px; font-weight: 700; border: 2px solid #e3c27a; box-shadow: 0 2px 6px rgba(0,0,0,.35); transition: opacity .2s; will-change: transform; pointer-events: none; }
      `}</style>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Loader2 } from "lucide-react";
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

type Country = { n: string; p: number[][][] };
type Rings = { name: string; polys: { ring: [number, number][]; holes: [number, number][][]; box: [number, number, number, number] }[] };

const D2R = Math.PI / 180;
const STATUS_LABEL = { done: "Fatto", current: "In corso", upcoming: "In programma" } as const;

// Decodifica i confini (numeri interi in ventesimi di grado, con differenze da punto a punto)
function decode(countries: Country[]): { raw: Country[]; rings: Rings[] } {
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
          pts.push([x / 20, y / 20]); // [lon, lat]
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

function inRing(lon: number, lat: number, ring: [number, number][]) {
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
function countryAt(lat: number, lon: number, rings: Rings[]): string | null {
  for (const c of rings) {
    for (const p of c.polys) {
      const [x0, y0, x1, y1] = p.box;
      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
      if (inRing(lon, lat, p.ring) && !p.holes.some((h) => inRing(lon, lat, h))) return c.name;
    }
  }
  let best: string | null = null;
  let bestD = 4; // gradi² (circa 2 gradi)
  for (const c of rings) {
    for (const p of c.polys) {
      const [x0, y0, x1, y1] = p.box;
      if (lon < x0 - 2 || lon > x1 + 2 || lat < y0 - 2 || lat > y1 + 2) continue;
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

function drawTexture(raw: Country[], gold: Set<string>, soft: Set<string>): HTMLCanvasElement {
  const W = 3072,
    H = 1536;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a2f4e");
  g.addColorStop(0.5, "#27456f");
  g.addColorStop(1, "#1a2f4e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Meridiani e paralleli
  ctx.lineWidth = 1.4;
  for (let lon = -180; lon <= 180; lon += 15) {
    ctx.strokeStyle = lon % 30 === 0 ? "rgba(205,168,118,.2)" : "rgba(205,168,118,.10)";
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    ctx.strokeStyle = lat % 30 === 0 ? "rgba(205,168,118,.2)" : "rgba(205,168,118,.10)";
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const path = (c: Country) => {
    ctx.beginPath();
    for (const poly of c.p) {
      for (const flat of poly) {
        let px = 0,
          py = 0;
        for (let i = 0; i < flat.length; i += 2) {
          px += flat[i];
          py += flat[i + 1];
          const x = ((px / 20 + 180) / 360) * W;
          const y = ((90 - py / 20) / 180) * H;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
    }
  };

  ctx.lineJoin = "round";
  for (const c of raw) {
    path(c);
    ctx.strokeStyle = "rgba(205,168,118,.12)";
    ctx.lineWidth = 14;
    ctx.stroke();
  }
  for (const c of raw) {
    path(c);
    if (gold.has(c.n)) {
      ctx.fillStyle = "#cda876";
      ctx.fill("evenodd");
      ctx.strokeStyle = "#f3e2bd";
      ctx.lineWidth = 2;
    } else if (soft.has(c.n)) {
      ctx.fillStyle = "rgba(205,168,118,.38)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(243,226,189,.7)";
      ctx.lineWidth = 1.8;
    } else {
      ctx.fillStyle = "rgba(236,226,204,.2)";
      ctx.fill("evenodd");
      ctx.strokeStyle = "rgba(236,226,204,.38)";
      ctx.lineWidth = 1.4;
    }
    ctx.stroke();
  }
  return canvas;
}

const dateIt = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", { month: "short", year: "numeric" }) : "");

// Mappamondo 3D dei viaggi del cliente: i paesi visitati sono d'oro, i viaggi in programma più tenui.
// La posizione attuale si legge solo dal telefono e non viene inviata né salvata.
export default function TravelGlobe({ trips }: { trips: GlobeTrip[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ focus: (lat: number, lon: number) => void; setMe: (p: { lat: number; lon: number } | null) => void } | null>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied" | "on" | "unsupported">("idle");
  const [countriesDone, setCountriesDone] = useState<number | null>(null);

  const focusTrip = useCallback(
    (trip: GlobeTrip) => {
      selectedRef.current = trip.id;
      setSelected(trip.id);
      const p = trip.places[0];
      if (p) api.current?.focus(p.lat, p.lon);
    },
    [],
  );

  // ---- costruzione della scena (una volta) ----
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const [THREE, geo] = await Promise.all([import("three"), import("@/lib/geo/countries.json")]);
        if (disposed || !stageRef.current || !canvasRef.current) return;
        const T = THREE as typeof THREE_NS;
        const countries = (geo.default ?? geo) as unknown as Country[];
        const { raw, rings } = decode(countries);

        // Paesi per stato
        const gold = new Set<string>();
        const soft = new Set<string>();
        const pinsData: { trip: GlobeTrip; place: GlobePlace }[] = [];
        for (const trip of trips) {
          for (const place of trip.places) {
            const c = countryAt(place.lat, place.lon, rings);
            if (c) (trip.status === "upcoming" ? soft : gold).add(c);
            pinsData.push({ trip, place });
          }
        }
        gold.forEach((c) => soft.delete(c));
        setCountriesDone(gold.size);

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

        const texture = new T.CanvasTexture(drawTexture(raw, gold, soft));
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const globe = new T.Mesh(
          new T.SphereGeometry(1, 96, 72),
          new T.MeshPhongMaterial({ map: texture, specular: new T.Color(0x000000), shininess: 70 }),
        );
        yawG.add(globe);

        const key = new T.DirectionalLight(0xfff2da, 0.8);
        key.position.set(-2.5, 2.2, 3);
        camera.add(key);
        scene.add(new T.AmbientLight(0xa8b8d8, 0.62));

        // Alone dorato
        const halo = new T.Mesh(
          new T.SphereGeometry(1.12, 64, 48),
          new T.ShaderMaterial({
            uniforms: { c: { value: new T.Color(0xcda876) } },
            vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
            fragmentShader:
              "uniform vec3 c; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.72 - dot(vN, vec3(0.0,0.0,1.0))), 3.6); gl_FragColor = vec4(c, 1.0) * i * 0.8; }",
            side: T.BackSide,
            blending: T.AdditiveBlending,
            transparent: true,
            depthWrite: false,
          }),
        );
        pitchG.add(halo);

        // Puntini
        type Marker = { group: THREE_NS.Group; head: THREE_NS.Mesh; hit: THREE_NS.Mesh; tripId: string; label: HTMLDivElement };
        const markers: Marker[] = [];
        const labels = labelsRef.current!;
        labels.innerHTML = "";
        const makePin = (lat: number, lon: number, color: number, scale = 1) => {
          const n = ll2v(lat, lon, 1);
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
        for (const { trip, place } of pinsData) {
          const color = trip.status === "upcoming" ? 0xffe9b8 : 0xfff3d4;
          const { g, head, hit } = makePin(place.lat, place.lon, color);
          const first = !seenTrip.has(trip.id);
          seenTrip.add(trip.id);
          const label = document.createElement("div");
          label.className = "tg-tag";
          label.textContent = first ? trip.destination || trip.title : place.name;
          label.dataset.main = first ? "1" : "0";
          labels.appendChild(label);
          markers.push({ group: g, head, hit, tripId: trip.id, label });
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
        const wrap = (a: number) => {
          while (a > Math.PI) a -= 2 * Math.PI;
          while (a < -Math.PI) a += 2 * Math.PI;
          return a;
        };
        // Soluzione numerica (robusta): trova lo yaw che porta il punto più vicino al centro
        const solve = (lat: number, lon: number) => {
          const v = ll2v(lat, lon, 1);
          const pitch = Math.max(-1.2, Math.min(1.2, lat * D2R * 0.9));
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
          return best;
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
            if (pinch0 > 0) st.distT = Math.max(2.3, Math.min(6.5, (st.distT * pinch0) / d));
            pinch0 = d;
            return;
          }
          if (down) down.moved += Math.abs(dx) + Math.abs(dy);
          const k = ((st.dist / 4.2) * Math.PI * 0.9) / Math.max(stage.clientWidth, 280);
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
              const m = pick(e.clientX, e.clientY);
              if (m) {
                const trip = trips.find((t) => t.id === m.tripId);
                if (trip) {
                  selectedRef.current = trip.id;
                  setSelected(trip.id);
                }
              } else {
                selectedRef.current = null;
                setSelected(null);
              }
            }
            down = null;
            pinch0 = 0;
          }
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          st.distT = Math.max(2.3, Math.min(6.5, st.distT * Math.exp(e.deltaY * 0.0012)));
          st.idle = 0;
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
        canvas.addEventListener("wheel", onWheel, { passive: false });

        api.current = {
          focus: (lat, lon) => {
            st.goal = solve(lat, lon);
            st.yawV = 0;
            st.pitchV = 0;
            st.distT = Math.min(st.distT, 3.6);
          },
          setMe: (p) => {
            setMe(p);
            if (p) api.current?.focus(p.lat, p.lon);
          },
        };

        // Ciclo
        let raf = 0;
        let last = performance.now();
        let visible = true;
        const onVis = () => {
          visible = !document.hidden;
          last = performance.now();
        };
        document.addEventListener("visibilitychange", onVis);
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const v = new T.Vector3();
        const toCam = new T.Vector3();
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
            if (!reduce && !selectedRef.current && st.idle > 3) st.yaw += dt * 0.08;
          }
          st.dist += (st.distT - st.dist) * (1 - Math.exp(-dt * 8));
          camera.position.set(0, 0, st.dist);
          camera.lookAt(0, 0, 0);
          yawG.rotation.y = st.yaw;
          pitchG.rotation.x = st.pitch;

          if (me) {
            const p = (t % 1.8) / 1.8;
            me.pulse.scale.setScalar(1 + p * 5);
            (me.pulse.material as THREE_NS.MeshBasicMaterial).opacity = 0.85 * (1 - p);
          }
          for (const m of markers) m.head.scale.setScalar(selectedRef.current === m.tripId ? 1.5 : 1);
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
          if (me) place(me.label, me.head, true);
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
  }, [trips]);

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

  const selectedTrip = trips.find((t) => t.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={stageRef}
        className="relative aspect-square max-h-[78vh] w-full touch-none select-none overflow-hidden rounded-3xl"
        style={{ background: "radial-gradient(ellipse at 50% 42%, #243f66 0%, #13233c 62%, #0b1626 100%)" }}
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
        {selectedTrip && (
          <div className="absolute inset-x-3 bottom-3 z-10 max-w-sm rounded-2xl bg-[#faf3e6]/95 p-3.5 text-[#1d2b40] shadow-xl">
            <p className="text-xs font-semibold text-[#756548]">{STATUS_LABEL[selectedTrip.status]}</p>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold leading-tight">{selectedTrip.title}</p>
            <p className="text-sm text-slate-600">
              {[selectedTrip.destination, selectedTrip.from ? `${dateIt(selectedTrip.from)}${selectedTrip.to && selectedTrip.to !== selectedTrip.from ? ` – ${dateIt(selectedTrip.to)}` : ""}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {selectedTrip.places.length > 0 && <p className="mt-1 text-xs text-slate-500">Tappe: {selectedTrip.places.map((p) => p.name).join(" · ")}</p>}
            <a href={`/client/trips/${selectedTrip.id}`} className="mt-2 inline-block text-sm font-semibold text-[#233c5e] underline">
              Apri il viaggio
            </a>
          </div>
        )}
      </div>

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
      `}</style>
    </div>
  );
}

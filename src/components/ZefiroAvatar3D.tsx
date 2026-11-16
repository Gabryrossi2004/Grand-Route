"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from "three";
import { buildOutfit, type CostumeId, type Outfit } from "@/components/zefiroCostumes3d";

export type ZefiroState = "idle" | "thinking" | "happy";
export type ZefiroVariant = CostumeId;

// Zefiro in 3D: una piccola nuvola-vento che cambia costume. È costruito con
// forme semplici (sfere, tori, coni), senza file esterni. Galleggia, sbatte le
// palpebre, segue il puntatore con lo sguardo; quando "pensa" la scia di vento
// gira veloce e saltella quando è contento. Se il dispositivo preferisce poche
// animazioni, resta fermo.
//
// Il contesto grafico e la scena si creano UNA volta (per dimensione): quando
// cambia il costume si sostituisce soltanto il gruppo dei vestiti, e Zefiro
// fa un saltino. Così cambiare costume di continuo non pesa.
export default function ZefiroAvatar3D({
  size,
  state,
  variant = "classico",
  onUnsupported,
}: {
  size: number;
  state: ZefiroState;
  variant?: ZefiroVariant;
  onUnsupported: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ZefiroState>(state);
  const happySince = useRef<number>(0);
  const variantRef = useRef<ZefiroVariant>(variant);
  // Funzione che sostituisce il costume nella scena (impostata dalla scena)
  const swapRef = useRef<((next: ZefiroVariant) => void) | null>(null);

  useEffect(() => {
    if (state === "happy") happySince.current = performance.now();
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    variantRef.current = variant;
    swapRef.current?.(variant);
  }, [variant]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      onUnsupported();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const geometries: BufferGeometry[] = [];
    const materials: Material[] = [];
    const track = <T extends BufferGeometry>(geometry: T) => {
      geometries.push(geometry);
      return geometry;
    };
    const material = (color: string, roughness = 0.6, metalness = 0) => {
      const m = new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
      materials.push(m);
      return m;
    };

    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0.3, 7.4);
    camera.lookAt(0.25, 0.1, 0);

    scene.add(new HemisphereLight(0xffffff, 0xf0dfc0, 1.05));
    scene.add(new AmbientLight(0xffffff, 0.35));
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new DirectionalLight(0x9fd3ee, 0.9);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const root = new Group();
    scene.add(root);

    // — Corpo: nuvola fatta di sfere morbide
    const cloud = material("#fffaf0", 0.55);
    const puff = (x: number, y: number, z: number, r: number, sx = 1, sy = 1, sz = 1) => {
      const mesh = new Mesh(track(new SphereGeometry(r, 32, 20)), cloud);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      root.add(mesh);
      return mesh;
    };
    const body = puff(0, -0.02, 0, 1.0, 1.12, 0.96, 0.96);
    puff(-0.95, -0.2, 0.02, 0.58);
    puff(0.97, -0.17, 0.02, 0.62);
    puff(-0.5, -0.72, 0.1, 0.5);
    puff(0.5, -0.72, 0.1, 0.52);

    // — Viso
    const ink = material("#17283f", 0.35);
    const white = material("#ffffff", 0.2);
    const blush = material("#f6a9a4", 0.7);
    const faceZ = 0.9;

    const eyeGroups: Group[] = [];
    for (const side of [-1, 1]) {
      const eye = new Group();
      eye.position.set(side * 0.34, 0.14, faceZ);
      const ball = new Mesh(track(new SphereGeometry(0.13, 20, 14)), ink);
      ball.scale.set(1, 1.18, 0.7);
      eye.add(ball);
      const shine = new Mesh(track(new SphereGeometry(0.045, 12, 8)), white);
      shine.position.set(0.04, 0.07, 0.08);
      eye.add(shine);
      root.add(eye);
      eyeGroups.push(eye);

      const cheek = new Mesh(track(new SphereGeometry(0.12, 16, 12)), blush);
      cheek.scale.set(1.2, 0.72, 0.3);
      cheek.position.set(side * 0.62, -0.1, faceZ - 0.06);
      root.add(cheek);
    }

    const mouth = new Mesh(track(new TorusGeometry(0.15, 0.028, 10, 28, Math.PI)), ink);
    mouth.rotation.z = Math.PI; // arco rivolto verso il basso = sorriso
    mouth.position.set(0, -0.08, faceZ + 0.01);
    root.add(mouth);

    // — Costume (sostituibile)
    let outfit: Outfit = buildOutfit(variantRef.current);
    root.add(outfit.group);
    let bounceUntil = 0;

    swapRef.current = (next: ZefiroVariant) => {
      root.remove(outfit.group);
      outfit.dispose();
      outfit = buildOutfit(next);
      root.add(outfit.group);
      bounceUntil = performance.now() + 900; // saltino quando si cambia vestito
      if (reduceMotion) renderer.render(scene, camera);
    };

    // — Interazione: lo sguardo segue il puntatore
    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let visible = true;
    let last = performance.now();
    let nextBlink = last + 1500 + Math.random() * 2500;
    let blinkUntil = 0;
    let windAngle = 0;
    let lookX = 0;
    let lookY = 0;

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const current = stateRef.current;

      // Galleggia e dondola piano
      const bob = reduceMotion ? 0 : Math.sin(t * 1.6) * 0.07;
      let jump = 0;
      if (current === "happy" && !reduceMotion) {
        const elapsed = (now - happySince.current) / 1000;
        if (elapsed < 1.4) jump = Math.abs(Math.sin(elapsed * 7)) * 0.22 * (1 - elapsed / 1.4);
      }
      if (!reduceMotion && now < bounceUntil) {
        const left = (bounceUntil - now) / 900;
        jump = Math.max(jump, Math.abs(Math.sin((1 - left) * Math.PI * 2)) * 0.24 * left);
      }
      root.position.y = bob + jump;

      lookX += (pointer.x - lookX) * Math.min(dt * 4, 1);
      lookY += (pointer.y - lookY) * Math.min(dt * 4, 1);
      root.rotation.y = lookX * 0.4 + (reduceMotion ? 0 : Math.sin(t * 0.9) * 0.08);
      root.rotation.x = lookY * 0.18;
      root.rotation.z = reduceMotion ? 0 : Math.sin(t * 1.1) * 0.045;

      // Occhi: guardano verso il puntatore, in alto quando pensa; battito di ciglia
      const gazeY = current === "thinking" ? 0.05 : 0;
      for (const eye of eyeGroups) {
        eye.position.x += (Math.sign(eye.position.x) * 0.34 + lookX * 0.06 - eye.position.x) * 0.2;
        eye.position.y += (0.14 + gazeY - lookY * 0.04 - eye.position.y) * 0.2;
      }
      if (!reduceMotion && now > nextBlink) {
        blinkUntil = now + 130;
        nextBlink = now + 2200 + Math.random() * 3000;
      }
      const blinkScale = now < blinkUntil || current === "happy" ? 0.12 : 1;
      const happyEyes = current === "happy" ? 0.35 : blinkScale;
      for (const eye of eyeGroups) eye.scale.y += (happyEyes - eye.scale.y) * 0.35;

      // Bocca: sorriso più grande quando è contento
      const smile = current === "happy" ? 1.45 : current === "thinking" ? 0.9 : 1;
      mouth.scale.x += (smile - mouth.scale.x) * 0.2;
      mouth.scale.y += (smile - mouth.scale.y) * 0.2;

      // Respiro del corpo
      const breathe = reduceMotion ? 1 : 1 + Math.sin(t * (current === "thinking" ? 6 : 2.2)) * 0.012;
      body.scale.set(1.12 * breathe, 0.96 * breathe, 0.96 * breathe);

      // Scia di vento, coda della sciarpa e fiocco del costume
      windAngle += dt * (current === "thinking" ? 5.5 : 1);
      outfit.windPivot.rotation.x = reduceMotion ? 0 : windAngle;
      outfit.windPivot.rotation.z = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.12;
      if (outfit.tailPivot) outfit.tailPivot.rotation.z = reduceMotion ? 0 : Math.sin(t * 3.2) * 0.32 + 0.1;
      if (outfit.pompom) outfit.pompom.position.x = reduceMotion ? 0 : Math.sin(t * 2.4) * 0.05;

      renderer.render(scene, camera);
      if (!reduceMotion && visible) raf = requestAnimationFrame(render);
    };

    // Si ferma quando non è visibile (altra scheda o fuori schermo): risparmia batteria
    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = visible;
        visible = entry.isIntersecting && !document.hidden;
        if (visible && !wasVisible && !reduceMotion) {
          last = performance.now();
          raf = requestAnimationFrame(render);
        }
      },
      { threshold: 0.01 },
    );
    observer.observe(container);
    const onVisibility = () => {
      const wasVisible = visible;
      visible = !document.hidden;
      if (visible && !wasVisible && !reduceMotion) {
        last = performance.now();
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    raf = requestAnimationFrame(render);

    return () => {
      swapRef.current = null;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      outfit.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((m) => m.dispose());
      // Libera subito il contesto grafico: i browser ne concedono pochi in
      // contemporanea, e a forza di aprire e chiudere finestre si esaurirebbero.
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // La scena si crea una sola volta per dimensione; stato e costume si
    // leggono da riferimenti (non ricreano nulla).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return <div ref={containerRef} style={{ width: size, height: size }} aria-hidden />;
}

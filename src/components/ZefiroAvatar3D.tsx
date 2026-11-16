"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  CapsuleGeometry,
  CatmullRomCurve3,
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
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from "three";

export type ZefiroState = "idle" | "thinking" | "happy";

// Zefiro in 3D: una piccola nuvola-vento con berretto blu, sciarpa dorata e
// una scia di vento. È costruito con forme semplici (sfere, tori, tubi),
// senza file esterni. Galleggia, sbatte le palpebre, segue il puntatore con
// lo sguardo; quando "pensa" la scia di vento gira veloce e saltella quando è
// contento. Se il dispositivo preferisce poche animazioni, resta fermo.
export default function ZefiroAvatar3D({
  size,
  state,
  onUnsupported,
}: {
  size: number;
  state: ZefiroState;
  onUnsupported: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ZefiroState>(state);
  const happySince = useRef<number>(0);

  useEffect(() => {
    if (state === "happy") happySince.current = performance.now();
    stateRef.current = state;
  }, [state]);

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

    // — Berretto blu con pon-pon dorato
    const navy = material("#233c5e", 0.5);
    const gold = material("#cda876", 0.35, 0.25);
    const cap = new Mesh(track(new SphereGeometry(0.66, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), navy);
    cap.position.set(0, 0.74, 0.05);
    cap.scale.set(1.05, 0.78, 1.0);
    cap.rotation.x = -0.12;
    root.add(cap);
    const capBand = new Mesh(track(new TorusGeometry(0.67, 0.045, 10, 40)), gold);
    capBand.rotation.x = Math.PI / 2 - 0.12;
    capBand.position.set(0, 0.76, 0.05);
    capBand.scale.set(1.05, 1.0, 1.0);
    root.add(capBand);
    const pompom = new Mesh(track(new SphereGeometry(0.11, 16, 12)), gold);
    pompom.position.set(0, 1.28, 0.02);
    root.add(pompom);

    // — Sciarpa dorata con coda che svolazza
    const scarf = new Mesh(track(new TorusGeometry(0.78, 0.15, 14, 44)), gold);
    scarf.rotation.x = Math.PI / 2 - 0.12;
    scarf.position.set(0, -0.62, 0.16);
    scarf.scale.set(1.12, 0.9, 1);
    root.add(scarf);

    const tailPivot = new Group();
    tailPivot.position.set(0.62, -0.62, 0.72);
    const tail = new Mesh(track(new CapsuleGeometry(0.1, 0.5, 6, 12)), gold);
    tail.position.set(0.05, -0.32, 0);
    tailPivot.add(tail);
    root.add(tailPivot);

    // — Scia di vento (tubo a spirale) azzurra
    const windMat = material("#a9dcf3", 0.3);
    const points: Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      points.push(new Vector3(1.3 + t * 0.85, -0.05 + Math.sin(t * Math.PI * 3) * 0.28 * (1 - t * 0.4), Math.cos(t * Math.PI * 3) * 0.28 * (1 - t * 0.4) - 0.1));
    }
    const wind = new Mesh(track(new TubeGeometry(new CatmullRomCurve3(points), 80, 0.055, 8, false)), windMat);
    const windPivot = new Group();
    windPivot.position.set(0.9, 0.1, 0);
    windPivot.add(wind);
    wind.position.set(-0.9, -0.1, 0);
    root.add(windPivot);

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

      // Scia di vento e coda della sciarpa
      windAngle += dt * (current === "thinking" ? 5.5 : 1);
      windPivot.rotation.x = reduceMotion ? 0 : windAngle;
      windPivot.rotation.z = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.12;
      tailPivot.rotation.z = reduceMotion ? 0 : Math.sin(t * 3.2) * 0.32 + 0.1;
      pompom.position.x = reduceMotion ? 0 : Math.sin(t * 2.4) * 0.05;

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
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
    // La scena si crea una sola volta; lo stato si legge da stateRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return <div ref={containerRef} style={{ width: size, height: size }} aria-hidden />;
}

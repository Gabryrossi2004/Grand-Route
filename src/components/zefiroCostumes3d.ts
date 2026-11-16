// I costumi di Zefiro, disegnati in 3D con forme semplici (sfere, tori,
// coni, cilindri). Ogni costume è un gruppo a sé: per cambiare vestito si
// toglie il gruppo vecchio e se ne mette uno nuovo, senza ricreare la scena
// né il contesto grafico. Il corpo e il viso di Zefiro non cambiano mai.
import {
  BoxGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";

export type CostumeId =
  | "classico"
  | "seta"
  | "giappone"
  | "grecia"
  | "egitto"
  | "arabo"
  | "africa"
  | "messico"
  | "nordico"
  | "tropicale";

export type Outfit = {
  group: Group;
  tailPivot: Group | null; // coda della sciarpa (se c'è): svolazza
  pompom: Mesh | null; // pon-pon / fiocco in cima: ondeggia
  windPivot: Group; // scia di vento: gira
  dispose: () => void;
};

export function buildOutfit(id: CostumeId): Outfit {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const geo = <T extends BufferGeometry>(geometry: T) => {
    geometries.push(geometry);
    return geometry;
  };
  const mat = (color: string, roughness = 0.6, metalness = 0) => {
    const m = new MeshStandardMaterial({ color: new Color(color), roughness, metalness });
    materials.push(m);
    return m;
  };
  const sphere = (r: number, m: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const mesh = new Mesh(geo(new SphereGeometry(r, 20, 14)), m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
  };
  // Anello orizzontale (fascia, sciarpa, bordo): sx/sz = allargamento in larghezza e profondità
  const torus = (radius: number, tube: number, m: Material, y: number, z = 0, tilt = 0, sx = 1, sz = 1) => {
    const mesh = new Mesh(geo(new TorusGeometry(radius, tube, 12, 44)), m);
    mesh.rotation.x = Math.PI / 2 + tilt;
    mesh.position.set(0, y, z);
    mesh.scale.set(sx, sz, 1);
    group.add(mesh);
    return mesh;
  };
  // Calotta (mezza sfera) sopra la testa
  const dome = (radius: number, m: Material, y: number, sx = 1.08, sy = 0.9, sz = 1.02, tilt = -0.1) => {
    const mesh = new Mesh(geo(new SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), m);
    mesh.position.set(0, y, 0.04);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.x = tilt;
    group.add(mesh);
    return mesh;
  };
  // Tesa piatta (disco) di un cappello
  const brim = (radius: number, thickness: number, m: Material, y: number, tilt = -0.12) => {
    const mesh = new Mesh(geo(new CylinderGeometry(radius, radius, thickness, 56)), m);
    mesh.position.set(0, y, 0.04);
    mesh.rotation.x = tilt;
    group.add(mesh);
    return mesh;
  };

  let tailPivot: Group | null = null;
  let pompom: Mesh | null = null;

  const scarfTail = (main: Material, tip: Material | null) => {
    const pivot = new Group();
    pivot.position.set(0.62, -0.62, 0.72);
    const tail = new Mesh(geo(new CapsuleGeometry(0.1, 0.5, 6, 12)), main);
    tail.position.set(0.05, -0.32, 0);
    pivot.add(tail);
    if (tip) {
      const end = new Mesh(geo(new SphereGeometry(0.115, 14, 10)), tip);
      end.position.set(0.05, -0.66, 0);
      pivot.add(end);
    }
    group.add(pivot);
    tailPivot = pivot;
  };
  const scarf = (main: Material, trim: Material | null) => {
    torus(0.78, 0.15, main, -0.62, 0.16, -0.12, 1.12, 0.9);
    if (trim) torus(0.78, 0.045, trim, -0.5, 0.16, -0.12, 1.12, 0.9);
  };
  // Sciarpa a righe: tre anelli sovrapposti di colori diversi
  const stripedScarf = (colors: [Material, Material, Material]) => {
    torus(0.78, 0.095, colors[0], -0.48, 0.16, -0.12, 1.12, 0.9);
    torus(0.79, 0.095, colors[1], -0.64, 0.16, -0.12, 1.12, 0.9);
    torus(0.78, 0.095, colors[2], -0.8, 0.16, -0.12, 1.1, 0.88);
  };
  // Fiore: petali attorno a un centro
  const flower = (x: number, y: number, z: number, petal: Material, center: Material, scale = 1) => {
    const f = new Group();
    f.position.set(x, y, z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new Mesh(geo(new SphereGeometry(0.075 * scale, 10, 8)), petal);
      p.scale.set(1.2, 0.5, 1);
      p.position.set(Math.cos(a) * 0.08 * scale, Math.sin(a) * 0.08 * scale, 0);
      f.add(p);
    }
    const c = new Mesh(geo(new SphereGeometry(0.045 * scale, 10, 8)), center);
    c.position.z = 0.03;
    f.add(c);
    f.rotation.y = x > 0 ? -0.5 : 0.5;
    group.add(f);
  };

  let windColor = "#a9dcf3";

  switch (id) {
    case "seta": {
      // Via della Seta: cappello conico di paglia, seta rossa con bordo dorato
      const straw = mat("#e6c47e", 0.85);
      const strawDark = mat("#b98f3f", 0.8);
      const red = mat("#b3262d", 0.38, 0.1);
      const gold = mat("#cda876", 0.35, 0.25);
      const apexY = 1.46;
      const height = 0.86;
      const hat = new Mesh(geo(new ConeGeometry(1.2, height, 56, 1, false)), straw);
      hat.position.set(0, apexY - height / 2, 0.02);
      hat.rotation.x = -0.1;
      group.add(hat);
      for (const f of [0.4, 0.68]) torus(1.2 * f + 0.01, 0.02, strawDark, apexY - height * f, 0.02, -0.1);
      pompom = sphere(0.09, red, 0, apexY + 0.02, 0.02);
      for (const side of [-1, 1]) {
        const ribbon = new Mesh(geo(new CapsuleGeometry(0.03, 0.6, 4, 8)), red);
        ribbon.position.set(side * 0.98, 0.2, 0.18);
        ribbon.rotation.z = side * 0.12;
        group.add(ribbon);
      }
      scarf(red, gold);
      scarfTail(red, gold);
      windColor = "#7fd1b9";
      break;
    }
    case "giappone": {
      // Giappone: fascia hachimaki con il sole rosso, obi e fiori di ciliegio
      const white = mat("#ffffff", 0.45);
      const red = mat("#d3262e", 0.4);
      const obi = mat("#b3204a", 0.4, 0.05);
      const gold = mat("#d9b45a", 0.35, 0.3);
      const pink = mat("#f8b6c8", 0.55);
      const centre = mat("#f2c94c", 0.5);
      torus(0.84, 0.075, white, 0.5, 0.02, -0.1, 1.14, 0.98);
      const sun = new Mesh(geo(new CylinderGeometry(0.15, 0.15, 0.04, 28)), red);
      sun.rotation.x = Math.PI / 2;
      sun.position.set(0, 0.52, 0.93);
      group.add(sun);
      for (const side of [-1, 1]) {
        const knot = new Mesh(geo(new CapsuleGeometry(0.05, 0.4, 4, 8)), white);
        knot.position.set(side * 0.93, 0.33, 0.2);
        knot.rotation.z = side * 0.35;
        group.add(knot);
      }
      flower(-0.72, 0.9, 0.55, pink, centre, 1.15);
      flower(0.6, 0.98, 0.5, pink, centre, 1.0);
      flower(-0.35, 1.02, 0.42, pink, centre, 0.8);
      torus(0.78, 0.17, obi, -0.62, 0.16, -0.12, 1.12, 0.9);
      torus(0.78, 0.045, gold, -0.5, 0.16, -0.12, 1.12, 0.9);
      scarfTail(obi, gold);
      windColor = "#f4a6c0";
      break;
    }
    case "grecia": {
      // Grecia: corona d'alloro, sciarpa blu Egeo
      const leafDark = mat("#5f8c49", 0.7);
      const leafLight = mat("#86ad62", 0.7);
      const stem = mat("#4f7a3c", 0.7);
      const white = mat("#ffffff", 0.45);
      const aegean = mat("#2a6fb8", 0.45);
      torus(0.76, 0.045, stem, 0.64, 0.04, -0.1, 1.06, 1);
      const leafCount = 18;
      for (let i = 0; i < leafCount; i++) {
        const angle = (i / leafCount) * Math.PI * 2;
        const leaf = new Mesh(geo(new SphereGeometry(0.16, 14, 10)), i % 2 ? leafDark : leafLight);
        leaf.scale.set(1.15, 0.36, 0.55);
        leaf.position.set(Math.cos(angle) * 0.8 * 1.06, 0.64 + Math.sin(angle) * -0.03, 0.04 + Math.sin(angle) * 0.8);
        leaf.rotation.y = -angle + Math.PI / 2;
        leaf.rotation.z = i % 2 ? 0.45 : -0.45;
        group.add(leaf);
      }
      scarf(aegean, white);
      scarfTail(aegean, white);
      windColor = "#cfe8ff";
      break;
    }
    case "egitto": {
      // Egitto: copricapo a strisce oro e lapislazzuli, collare dorato con perle
      const goldM = mat("#e0b04a", 0.3, 0.45);
      const lapis = mat("#1f4fa3", 0.45, 0.1);
      const turq = mat("#33b8aa", 0.4);
      const red = mat("#c0392b", 0.4);
      dome(0.7, goldM, 0.6, 1.1, 0.82, 1.02, 0);
      for (const h of [0.14, 0.32, 0.5]) {
        const ringRadius = Math.sqrt(0.7 * 0.7 - h * h);
        torus(ringRadius * 1.05, 0.026, lapis, 0.6 + h * 0.82, 0.03, 0, 1.1, 1.02);
      }
      torus(0.72, 0.055, goldM, 0.62, 0.03, 0, 1.1, 1.02);
      for (const side of [-1, 1]) {
        const lappet = new Group();
        lappet.position.set(side * 0.8, -0.12, 0.74);
        lappet.rotation.set(0, side * -0.55, side * 0.05);
        lappet.add(new Mesh(geo(new BoxGeometry(0.3, 1.0, 0.18)), goldM));
        for (const y of [-0.34, -0.12, 0.1, 0.32]) {
          const stripe = new Mesh(geo(new BoxGeometry(0.305, 0.07, 0.19)), lapis);
          stripe.position.y = y;
          lappet.add(stripe);
        }
        group.add(lappet);
      }
      sphere(0.085, goldM, 0, 0.74, 0.78);
      sphere(0.035, red, 0, 0.76, 0.85);
      torus(0.82, 0.2, goldM, -0.64, 0.16, -0.12, 1.12, 0.9);
      for (let i = 0; i < 13; i++) {
        const angle = (i / 12) * Math.PI;
        sphere(0.075, i % 2 ? lapis : turq, Math.cos(angle) * 0.93, -0.5, 0.42 + Math.sin(angle) * 0.62);
      }
      windColor = "#43c6b6";
      break;
    }
    case "arabo": {
      // Medio Oriente / Marocco: turbante con gioiello, sciarpa turchese e oro
      const cream = mat("#f3e6c8", 0.7);
      const creamShade = mat("#e6d3a8", 0.7);
      const gold = mat("#d9a441", 0.3, 0.4);
      const teal = mat("#1e8a8a", 0.45);
      torus(0.74, 0.19, cream, 0.58, 0.03, -0.12, 1.12, 1.02);
      torus(0.64, 0.19, creamShade, 0.78, 0.03, -0.18, 1.1, 1.0);
      torus(0.5, 0.18, cream, 0.95, 0.02, -0.2, 1.08, 1.0);
      sphere(0.4, creamShade, 0, 1.08, 0.01, 1.05, 0.7, 1);
      torus(0.74, 0.025, gold, 0.68, 0.03, -0.12, 1.12, 1.02);
      sphere(0.09, teal, 0, 0.74, 0.93);
      torus(0.1, 0.025, gold, 0.74, 0.96);
      scarf(teal, gold);
      scarfTail(teal, gold);
      windColor = "#e8cf9e";
      break;
    }
    case "africa": {
      // Africa / safari: cappello color cachi con fascia, sciarpa a righe ocra
      const khaki = mat("#cdb887", 0.85);
      const khakiDark = mat("#b09a69", 0.85);
      const band = mat("#6b4a2b", 0.7);
      const rust = mat("#b5532a", 0.6);
      const yellow = mat("#e8b23a", 0.55);
      const green = mat("#2f7d4f", 0.6);
      dome(0.62, khaki, 0.7, 1.08, 0.95, 1.02, -0.1);
      brim(1.22, 0.05, khaki, 0.66);
      torus(1.22, 0.03, khakiDark, 0.66, 0.04, -0.12);
      torus(0.64, 0.06, band, 0.74, 0.04, -0.1, 1.08, 1.02);
      pompom = sphere(0.08, band, 0, 1.34, 0.02);
      stripedScarf([rust, yellow, green]);
      scarfTail(rust, yellow);
      windColor = "#e8c97a";
      break;
    }
    case "messico": {
      // Messico / America Latina: sombrero e poncho a righe
      const straw = mat("#e0b45c", 0.85);
      const red = mat("#d62839", 0.5);
      const orange = mat("#ec7a2b", 0.55);
      const teal = mat("#1b9e8a", 0.55);
      const yellow = mat("#f6c445", 0.55);
      brim(1.52, 0.06, straw, 0.68, -0.14);
      torus(1.52, 0.04, red, 0.68, 0.04, -0.14);
      const crown = new Mesh(geo(new CylinderGeometry(0.42, 0.6, 0.55, 40)), straw);
      crown.position.set(0, 0.97, 0.04);
      crown.rotation.x = -0.1;
      group.add(crown);
      sphere(0.42, straw, 0, 1.24, 0.03, 1, 0.55, 1);
      torus(0.6, 0.06, red, 0.76, 0.04, -0.1);
      torus(0.5, 0.025, yellow, 0.95, 0.04, -0.1);
      stripedScarf([orange, red, teal]);
      scarfTail(orange, teal);
      windColor = "#ffb86b";
      break;
    }
    case "nordico": {
      // Nord: elmo con le corna, sciarpa di lana grigio-azzurra
      const metal = mat("#8c97a3", 0.35, 0.6);
      const metalDark = mat("#5d6773", 0.4, 0.6);
      const horn = mat("#f2e6c9", 0.5);
      const gold = mat("#cda876", 0.35, 0.3);
      const wool = mat("#5b7fa6", 0.8);
      const woolLight = mat("#eef3f8", 0.8);
      dome(0.72, metal, 0.6, 1.08, 0.88, 1.02, 0);
      torus(0.74, 0.06, metalDark, 0.62, 0.04, 0, 1.1, 1.02);
      for (const side of [-1, 1]) {
        const hornMesh = new Mesh(geo(new ConeGeometry(0.18, 1.0, 20)), horn);
        hornMesh.position.set(side * 1.0, 1.02, 0.02);
        hornMesh.rotation.z = -side * 0.95;
        group.add(hornMesh);
        sphere(0.13, gold, side * 0.78, 0.74, 0.02);
      }
      sphere(0.06, gold, 0, 1.25, 0.03);
      torus(0.78, 0.15, wool, -0.62, 0.16, -0.12, 1.12, 0.9);
      torus(0.79, 0.04, woolLight, -0.54, 0.16, -0.12, 1.12, 0.9);
      torus(0.79, 0.04, woolLight, -0.7, 0.16, -0.12, 1.12, 0.9);
      scarfTail(wool, woolLight);
      windColor = "#d9efff";
      break;
    }
    case "tropicale": {
      // Tropici / isole: cappello di paglia con ibisco e collana di fiori
      const straw = mat("#ecd08a", 0.85);
      const band = mat("#2bb5b8", 0.5);
      const hibiscus = mat("#ef476f", 0.5);
      const hibiscusCentre = mat("#ffd166", 0.5);
      const pink = mat("#ff8fab", 0.5);
      const orange = mat("#ff9f1c", 0.5);
      const yellow = mat("#ffd166", 0.5);
      const stringM = mat("#3d8b5f", 0.6);
      dome(0.58, straw, 0.72, 1.08, 0.9, 1.02, -0.1);
      brim(1.28, 0.05, straw, 0.68);
      torus(1.28, 0.03, straw, 0.68, 0.04, -0.12);
      torus(0.6, 0.06, band, 0.74, 0.04, -0.1, 1.08, 1.02);
      flower(0.58, 0.9, 0.62, hibiscus, hibiscusCentre, 1.6);
      torus(0.82, 0.02, stringM, -0.52, 0.2, -0.12, 1.12, 0.9);
      const palette = [pink, orange, yellow, hibiscus];
      for (let i = 0; i < 15; i++) {
        const angle = (i / 14) * Math.PI;
        sphere(0.1, palette[i % palette.length], Math.cos(angle) * 0.94, -0.52 - 0.02 * Math.sin(angle), 0.4 + Math.sin(angle) * 0.66, 1, 0.8, 1);
      }
      windColor = "#7fe0e8";
      break;
    }
    default: {
      // Classico: berretto blu con pon-pon dorato e sciarpa dorata
      const navy = mat("#233c5e", 0.5);
      const gold = mat("#cda876", 0.35, 0.25);
      dome(0.66, navy, 0.74, 1.05, 0.78, 1.0, -0.12);
      torus(0.67, 0.045, gold, 0.76, 0.05, -0.12, 1.05, 1);
      pompom = sphere(0.11, gold, 0, 1.28, 0.02);
      scarf(gold, null);
      scarfTail(gold, null);
      break;
    }
  }

  // Scia di vento (tubo a spirale) del colore del costume
  const windMat = mat(windColor, 0.3);
  const points: Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    points.push(
      new Vector3(
        1.3 + t * 0.85,
        -0.05 + Math.sin(t * Math.PI * 3) * 0.28 * (1 - t * 0.4),
        Math.cos(t * Math.PI * 3) * 0.28 * (1 - t * 0.4) - 0.1,
      ),
    );
  }
  const wind = new Mesh(geo(new TubeGeometry(new CatmullRomCurve3(points), 80, 0.055, 8, false)), windMat);
  const windPivot = new Group();
  windPivot.position.set(0.9, 0.1, 0);
  windPivot.add(wind);
  wind.position.set(-0.9, -0.1, 0);
  group.add(windPivot);

  return {
    group,
    tailPivot,
    pompom,
    windPivot,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

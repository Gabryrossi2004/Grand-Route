import type { LogoShape } from "@/lib/logoShape";

// Il logo dell'agenzia nella forma scelta nelle impostazioni, sempre senza
// sfondo né margini bianchi (il logo caricato viene già ritagliato sul
// disegno). "Personalizzato" segue il contorno del logo senza tagliarlo;
// le altre forme lo ritagliano a rettangolo, rettangolo smussato o cerchio.
export default function AgencyLogo({
  src,
  shape,
  size = 40,
  className = "",
}: {
  src: string;
  shape: LogoShape;
  size?: number;
  className?: string;
}) {
  if (shape === "tondo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  const radius = shape === "squadrato" ? "rounded-none" : shape === "smussato" ? "rounded-xl" : "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ height: size, maxWidth: size * 4 }}
      className={`w-auto shrink-0 object-contain ${radius} ${className}`}
    />
  );
}

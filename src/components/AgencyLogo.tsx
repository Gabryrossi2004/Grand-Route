import type { LogoShape } from "@/lib/logoShape";

// Il logo dell'agenzia nella forma scelta nelle impostazioni.
// "personalizzato" segue il contorno del logo: niente riquadro, sfondo o
// spazi bianchi (il logo caricato viene già ritagliato al contenuto).
export default function AgencyLogo({
  src,
  shape,
  size = 32,
  boxClassName = "bg-white",
  className = "",
}: {
  src: string;
  shape: LogoShape;
  size?: number;
  boxClassName?: string; // sfondo del riquadro (non per "personalizzato")
  className?: string;
}) {
  if (shape === "personalizzato") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{ height: size, maxWidth: size * 4 }}
        className={`w-auto shrink-0 object-contain ${className}`}
      />
    );
  }
  const radius = shape === "squadrato" ? "rounded-none" : shape === "tondo" ? "rounded-full" : "rounded-xl";
  const padding = shape === "tondo" ? "p-[14%]" : "p-[8%]";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${boxClassName} ${radius} ${padding} ${className}`}
    />
  );
}

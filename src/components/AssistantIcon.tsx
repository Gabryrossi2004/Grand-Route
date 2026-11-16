// Mini icona dell'assistente: una bussola con l'ago d'oro, su fondo blu notte.
// Disegnata a mano (non è un'icona della libreria usata altrove), pensata per
// restare leggibile anche a 16 pixel.
export default function AssistantIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Assistente di viaggio"
    >
      <circle cx="16" cy="16" r="15" fill="#233c5e" />
      <circle cx="16" cy="16" r="12" fill="none" stroke="#cda876" strokeWidth="1.4" />
      <path d="M16 3.6v2.6M16 25.8v2.6M3.6 16h2.6M25.8 16h2.6" stroke="#cda876" strokeWidth="1.4" strokeLinecap="round" />
      <g transform="rotate(40 16 16)">
        <path d="M16 6.8 19.4 16H12.6Z" fill="#e4cc98" />
        <path d="M16 25.2 19.4 16H12.6Z" fill="#ffffff" fillOpacity="0.88" />
      </g>
      <circle cx="16" cy="16" r="1.7" fill="#233c5e" stroke="#ffffff" strokeWidth="1" />
    </svg>
  );
}

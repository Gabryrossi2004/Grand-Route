// Mini icona di Zefiro: una nuvoletta sorridente con la scia di vento dorata,
// su fondo blu notte. Disegnata a mano, pensata per restare leggibile anche a
// 16 pixel. (La versione grande, animata in 3D, è <Zefiro />.)
export default function AssistantIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Zefiro, assistente di viaggio"
    >
      <circle cx="16" cy="16" r="15" fill="#233c5e" />
      <g fill="#fffaf0">
        <circle cx="10.6" cy="18.8" r="4.4" />
        <circle cx="16" cy="14.4" r="5.9" />
        <circle cx="21.4" cy="18.8" r="4.4" />
        <rect x="10.6" y="18.8" width="10.8" height="4.4" rx="2.2" />
      </g>
      <circle cx="13.5" cy="17.4" r="1" fill="#17283f" />
      <circle cx="18.5" cy="17.4" r="1" fill="#17283f" />
      <path d="M14.2 20.1Q16 21.8 17.8 20.1" fill="none" stroke="#17283f" strokeWidth="1" strokeLinecap="round" />
      <circle cx="12.1" cy="19.7" r="0.95" fill="#f6a9a4" opacity="0.85" />
      <circle cx="19.9" cy="19.7" r="0.95" fill="#f6a9a4" opacity="0.85" />
      <path d="M22.4 9.4c1.9-1.1 3.9.2 3.3 2-.4 1.3-2.2 1.5-2.8.4" fill="none" stroke="#cda876" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

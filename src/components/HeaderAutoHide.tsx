"use client";

import { useEffect, useRef, useState } from "react";

// Nasconde l'intestazione mentre si scorre verso il basso (per non rubare
// spazio, specie su mobile con pagine lunghe), e la rimette subito in vista
// non appena si risale anche di poco, segno che si vuole tornare in alto.
export default function HeaderAutoHide({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const diff = y - lastY.current;

      if (y < 60) {
        setVisible(true);
      } else if (diff > 8) {
        setVisible(false);
      } else if (diff < -8) {
        setVisible(true);
      }
      lastY.current = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      } ${className ?? ""}`}
    >
      {children}
    </header>
  );
}

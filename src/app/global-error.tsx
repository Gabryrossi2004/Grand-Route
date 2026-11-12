"use client";

// Ultima rete di sicurezza, per un errore così grave da uscire anche dal
// layout principale. Volutamente semplice (stili in linea, niente font o
// classi del progetto): deve funzionare anche se il resto non si è caricato.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#faf3e6" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              textAlign: "center",
              backgroundColor: "white",
              borderRadius: "16px",
              border: "1px solid #e6d7bb",
              padding: "32px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1e293b", margin: "0 0 8px" }}>
              Qualcosa è andato storto
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px" }}>
              Si è verificato un problema imprevisto. Prova a ricaricare la pagina.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  backgroundColor: "#233c5e",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Riprova
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: "white",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Ricarica
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

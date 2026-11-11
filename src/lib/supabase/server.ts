import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// Client Supabase usato nel server (dentro le pagine, prima che la pagina
// venga inviata al browser). Legge/scrive i "cookie" per sapere chi è loggato.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // In certi casi (es. Server Component puro) non si può scrivere
            // un cookie: va bene, il middleware se ne occupa comunque.
          }
        },
      },
    },
  );
}

// supabase.auth.getUser() fa una vera chiamata di rete (verifica il token
// con il server di autenticazione), e layout + pagina lo richiamavano
// entrambi a ogni apertura pagina: un secondo giro di rete via (quello tra
// Vercel e Supabase è particolarmente lento) a vuoto, per lo stesso utente.
// react cache() lo ricorda per tutta la stessa richiesta, quindi va in rete
// una sola volta anche se più punti della pagina lo richiamano.
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

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

// L'utente collegato (solo l'identificativo, che è ciò che serve alle pagine). Usa getClaims():
// con le chiavi di firma asimmetriche di Supabase il token si verifica qui, senza andare in rete;
// altrimenti ripiega da solo sul controllo con il server di autenticazione. react cache() lo ricorda
// per tutta la stessa richiesta. Le regole di sicurezza del database (RLS) usano comunque lo stesso token.
export const getCachedUser = cache(async (): Promise<{ id: string; email?: string } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return claims?.sub ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined } : null;
});

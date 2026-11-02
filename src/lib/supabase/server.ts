import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

import { createBrowserClient } from "@supabase/ssr";

// Client Supabase usato nei componenti che girano nel browser
// (es. un form con cui interagisci con un click).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

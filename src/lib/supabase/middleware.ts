import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_LOGIN, PRO_LOGIN } from "@/lib/areas";

// Si occupa di tenere "viva" la sessione dell'utente loggato e di
// rimandare al login chi prova ad aprire una pagina privata senza essere loggato.
// pathOverride: l'indirizzo "interno" quando il proxy riscrive la richiesta (es. / → /professionisti sul sito dei professionisti).
export async function updateSession(request: NextRequest, pathOverride?: string) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() controlla la firma del token direttamente sul server del sito (senza chiamare Supabase
  // a ogni pagina, come faceva getUser): un giro di rete in meno prima di ogni apertura.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const user = claims?.sub ? { id: claims.sub } : null;
  const meta = (claims?.user_metadata ?? {}) as { account_kind?: string; business_kind?: string };

  const pathname = pathOverride ?? request.nextUrl.pathname;
  const is = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  // Porte d'ingresso: professionisti (/professionisti, /signup, vecchio /login) e clienti (/clienti e le registrazioni)
  const isProAuthRoute = is(PRO_LOGIN) || is("/signup") || is("/login");
  const isClientAuthRoute = is(CLIENT_LOGIN) || is("/client/login") || is("/client/signup") || is("/viaggiatore/login") || is("/viaggiatore/signup");
  const isProPrivateRoute = is("/dashboard") || is("/rete") || is("/stampa");
  const isClientPrivateRoute = (is("/client") || is("/viaggiatore")) && !isClientAuthRoute;

  if (!user && (isProPrivateRoute || isClientPrivateRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = isProPrivateRoute ? PRO_LOGIN : CLIENT_LOGIN;
    url.search = "";
    url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user && (isProAuthRoute || isClientAuthRoute)) {
    // Chi è già dentro va diretto alla sua area. Dalla porta dei clienti: i viaggiatori e i clienti di agenzia vanno
    // ciascuno alla propria; un professionista resta nella sua area.
    const url = request.nextUrl.clone();
    url.search = "";
    if (isProAuthRoute) url.pathname = "/dashboard";
    else if (meta.account_kind === "traveler") url.pathname = "/viaggiatore";
    else if (meta.business_kind) url.pathname = "/dashboard";
    else url.pathname = "/client";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

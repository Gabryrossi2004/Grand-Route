import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Si occupa di tenere "viva" la sessione dell'utente loggato e di
// rimandare al login chi prova ad aprire una pagina privata senza essere loggato.
export async function updateSession(request: NextRequest) {
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
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const pathname = request.nextUrl.pathname;
  const isClientAuthRoute = pathname.startsWith("/client/login") || pathname.startsWith("/client/signup");
  const isClientPrivateRoute = pathname.startsWith("/client") && !isClientAuthRoute;
  // Viaggiatori privati (senza agenzia)
  const isTravelerAuthRoute = pathname.startsWith("/viaggiatore/login") || pathname.startsWith("/viaggiatore/signup");
  const isTravelerPrivateRoute = pathname.startsWith("/viaggiatore") && !isTravelerAuthRoute;

  const isPrivateRoute = pathname.startsWith("/dashboard") || isClientPrivateRoute || isTravelerPrivateRoute;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup") || isClientAuthRoute || isTravelerAuthRoute;

  if (!user && isPrivateRoute) {
    const next = `${pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = isTravelerPrivateRoute ? "/viaggiatore/login" : isClientPrivateRoute ? "/client/login" : "/login";
    url.search = "";
    if (!isClientPrivateRoute && !isTravelerPrivateRoute) {
      url.searchParams.set("next", next);
    }
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isTravelerAuthRoute ? "/viaggiatore" : isClientAuthRoute ? "/client" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

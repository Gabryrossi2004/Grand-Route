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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isClientAuthRoute = pathname.startsWith("/client/login") || pathname.startsWith("/client/signup");
  const isClientPrivateRoute = pathname.startsWith("/client") && !isClientAuthRoute;

  const isPrivateRoute = pathname.startsWith("/dashboard") || isClientPrivateRoute;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup") || isClientAuthRoute;

  if (!user && isPrivateRoute) {
    const next = `${pathname}${request.nextUrl.search}`;
    const url = request.nextUrl.clone();
    url.pathname = isClientPrivateRoute ? "/client/login" : "/login";
    url.search = "";
    if (!isClientPrivateRoute) {
      url.searchParams.set("next", next);
    }
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isClientAuthRoute ? "/client" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routeForHost } from "@/lib/areas";

// Si chiama "proxy" (da Next.js 16 in poi, prima si chiamava "middleware"):
// è codice che gira prima di ogni pagina, usato qui per controllare il login.
// Se i due siti (professionisti / clienti) sono separati (vedi docs/DUE-APP.md) smista anche le richieste
// in base all'indirizzo; senza le due variabili NEXT_PUBLIC_PRO_HOST e NEXT_PUBLIC_CLIENT_HOST non fa nulla di più.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const route = routeForHost(request.headers.get("host"), pathname, search);

  if (route.kind === "redirect") return NextResponse.redirect(route.url);

  if (route.kind === "rewrite") {
    const res = await updateSession(request, route.pathname);
    // se la sessione ha chiesto un redirect lo seguiamo, altrimenti mostriamo la pagina d'ingresso dell'area
    if (res.headers.get("location")) return res;
    const url = request.nextUrl.clone();
    url.pathname = route.pathname;
    const rewritten = NextResponse.rewrite(url, { request });
    res.cookies.getAll().forEach((c) => rewritten.cookies.set(c));
    return rewritten;
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

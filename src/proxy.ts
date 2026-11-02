import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Si chiama "proxy" (da Next.js 16 in poi, prima si chiamava "middleware"):
// è codice che gira prima di ogni pagina, usato qui per controllare il login.
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

// Applicatiebreed poortje: laat enkel geauthenticeerde bezoekers door.
export async function middleware(req: NextRequest) {
  const expected = await expectedToken();

  // Poortje staat uit (geen APP_PASSWORD ingesteld) -> alles doorlaten.
  if (!expected) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // De inlogpagina (en de bijhorende server-action-POST) is altijd bereikbaar.
  if (pathname === "/login") return NextResponse.next();

  // Geldige sessiecookie? Dan doorlaten.
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === expected) return NextResponse.next();

  // Anders: door naar de inlogpagina, met het oorspronkelijke pad als "from".
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("from", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

// Beveilig alle routes behalve Next-internals en statische bestanden.
export const config = {
  matcher: [
    // api/opname/blob-upload is uitgesloten: Vercel roept de upload-completed
    // callback zonder onze auth-cookie aan; die route regelt auth zelf.
    "/((?!api/opname/blob-upload|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

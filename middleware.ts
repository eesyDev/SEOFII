import createIntlMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { routing } from "./i18n/routing";
import { NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED = ["/dashboard", "/projects", "/reports", "/billing", "/settings"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Strip locale prefix to get the actual path
  const pathnameNoLocale = pathname.replace(/^\/(ru|en)(?=\/|$)/, "") || "/";

  const isProtected = PROTECTED.some((p) => pathnameNoLocale.startsWith(p));
  const locale = pathname.match(/^\/(ru|en)/)?.[1] ?? "ru";

  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL(`/${locale}/login`, req.url));
  }

  if (req.auth && (pathnameNoLocale === "/login" || pathnameNoLocale === "/register")) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};

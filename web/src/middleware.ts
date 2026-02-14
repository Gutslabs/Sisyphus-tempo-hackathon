import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// If NEXT_PUBLIC_APP_URL is not set, disable host-based routing entirely.
// This keeps the app working as a single-host deployment (dashboard at /, landing at /landing).
function getAppHost(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const APP_HOST = getAppHost();

function getHost(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.hostname;
  return raw.toLowerCase().split(":")[0].trim();
}

export function middleware(req: NextRequest) {
  if (!APP_HOST) {
    return NextResponse.next();
  }

  const host = getHost(req);
  const pathname = req.nextUrl.pathname;

  // App subdomain only: dashboard at /; redirect /landing -> /
  // Also treat localhost:3000 as app host for development
  if (host === APP_HOST || host.startsWith("localhost")) {
    if (pathname === "/landing") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Everything else (IP, root domain, www, etc.): landing at /
  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/landing", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/landing"],
};

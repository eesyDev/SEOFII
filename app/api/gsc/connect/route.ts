import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGscAuthUrl } from "@/lib/gscApi";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(getGscAuthUrl(state));
  res.cookies.set("gsc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}

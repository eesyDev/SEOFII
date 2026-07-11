import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeGscCode,
  emailFromIdToken,
  listGscProperties,
} from "@/lib/gscApi";

function settingsRedirect(req: NextRequest, status: "connected" | "error") {
  const res = NextResponse.redirect(new URL(`/settings?gsc=${status}`, req.url));
  res.cookies.delete("gsc_oauth_state");
  return res;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = req.cookies.get("gsc_oauth_state")?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return settingsRedirect(req, "error");
  }

  try {
    const tokens = await exchangeGscCode(code);
    if (!tokens.refresh_token) {
      // Без refresh_token соединение бесполезно — access истечёт через час
      console.error("[gsc] No refresh_token in response");
      return settingsRedirect(req, "error");
    }

    const properties = await listGscProperties(tokens.access_token).catch((err) => {
      console.warn("[gsc] Failed to list properties:", err);
      return [];
    });

    const data = {
      googleEmail: emailFromIdToken(tokens.id_token),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope ?? null,
      properties: properties as unknown as object,
    };

    await prisma.gscConnection.upsert({
      where: { userId: session.user.id },
      update: data,
      create: { userId: session.user.id, ...data },
    });

    return settingsRedirect(req, "connected");
  } catch (err) {
    console.error("[gsc] OAuth callback failed:", err);
    return settingsRedirect(req, "error");
  }
}

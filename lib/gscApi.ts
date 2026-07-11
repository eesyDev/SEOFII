// Google Search Console: OAuth-подключение + Search Analytics API
// Отдельный флоу от next-auth — GSC могут подключать и credentials-пользователи

import { prisma } from "./prisma";
import type { GscRow } from "./gsc";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GSC_SITES_URL = "https://www.googleapis.com/webmasters/v3/sites";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// GSC-данные отстают от реального времени на ~2-3 дня
const GSC_DATA_LAG_DAYS = 3;
const GSC_RANGE_DAYS = 28;

export interface GscProperty {
  siteUrl: string; // "sc-domain:example.com" или "https://example.com/"
  permissionLevel: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
}

export function gscRedirectUri(): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/gsc/callback`;
}

// ─────────────────────────────────────────
// OAuth
// ─────────────────────────────────────────

export function getGscAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: gscRedirectUri(),
    response_type: "code",
    scope: `openid email ${GSC_SCOPE}`,
    access_type: "offline",
    prompt: "consent", // всегда просим consent — иначе Google не вернёт refresh_token повторно
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGscCode(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      redirect_uri: gscRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`GSC token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function refreshGscToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`GSC token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Email из id_token — пришёл напрямую от Google по TLS, подпись можно не проверять
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")
    );
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// Валидный access_token для юзера, с авто-refresh и записью в БД
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const conn = await prisma.gscConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  if (conn.expiresAt.getTime() > Date.now() + 60_000) {
    return conn.accessToken;
  }

  const refreshed = await refreshGscToken(conn.refreshToken);
  await prisma.gscConnection.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
  return refreshed.access_token;
}

export async function revokeGscConnection(userId: string): Promise<void> {
  const conn = await prisma.gscConnection.findUnique({ where: { userId } });
  if (!conn) return;

  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(conn.refreshToken)}`, {
    method: "POST",
  }).catch(() => {}); // revoke best-effort — соединение удаляем в любом случае

  await prisma.gscConnection.delete({ where: { userId } });
}

// ─────────────────────────────────────────
// Search Console API
// ─────────────────────────────────────────

export async function listGscProperties(accessToken: string): Promise<GscProperty[]> {
  const res = await fetch(GSC_SITES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`GSC sites list failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.siteEntry ?? []).map((s: { siteUrl: string; permissionLevel: string }) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));
}

// Подбираем property под URL страницы: url-prefix точнее, sc-domain — запасной вариант
export function findPropertyForUrl(properties: GscProperty[], pageUrl: string): string | null {
  let host: string;
  try {
    host = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const prefixMatch = properties
    .filter((p) => !p.siteUrl.startsWith("sc-domain:"))
    .filter((p) => pageUrl.toLowerCase().startsWith(p.siteUrl.toLowerCase()))
    .sort((a, b) => b.siteUrl.length - a.siteUrl.length)[0];
  if (prefixMatch) return prefixMatch.siteUrl;

  const domainMatch = properties
    .filter((p) => p.siteUrl.startsWith("sc-domain:"))
    .find((p) => {
      const domain = p.siteUrl.slice("sc-domain:".length).toLowerCase();
      return host === domain || host.endsWith(`.${domain}`);
    });
  return domainMatch?.siteUrl ?? null;
}

interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function queryGscSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`GSC query failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.rows ?? [];
}

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// Запросы конкретной страницы за последние 28 дней — тот же формат, что CSV-загрузка
export async function fetchGscRowsForPage(
  userId: string,
  pageUrl: string
): Promise<GscRow[] | null> {
  const conn = await prisma.gscConnection.findUnique({ where: { userId } });
  if (!conn) return null;

  const properties = (conn.properties as unknown as GscProperty[] | null) ?? [];
  const property = findPropertyForUrl(properties, pageUrl);
  if (!property) return null;

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const rows = await queryGscSearchAnalytics(accessToken, property, {
    startDate: isoDaysAgo(GSC_DATA_LAG_DAYS + GSC_RANGE_DAYS),
    endDate: isoDaysAgo(GSC_DATA_LAG_DAYS),
    dimensions: ["query"],
    dimensionFilterGroups: [
      {
        filters: [{ dimension: "page", operator: "equals", expression: pageUrl }],
      },
    ],
    rowLimit: 250,
  });

  return rows.map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

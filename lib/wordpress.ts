// WordPress REST API Client
// Supports: Posts, Pages, and basic metadata updates
// Auth: Application Passwords (WordPress 5.6+) via Basic Auth
// https://developer.wordpress.org/rest-api/

export interface WPCredentials {
  username: string;
  appPassword: string;
}

export interface WPPage {
  id: number;
  link: string;
  title: { rendered: string };
  content: { rendered: string; protected: boolean };
  excerpt: { rendered: string; protected: boolean };
  status: string;
  type: string; // "post" | "page" | "product" etc.
  modified: string;
  date: string;
  slug: string;
  yoast_head_json?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface WPUpdatePayload {
  title?: string;
  content?: string;
  excerpt?: string;
  status?: string;
  meta?: Record<string, unknown>;
}

function getAuthHeader(creds: WPCredentials): string {
  return "Basic " + Buffer.from(`${creds.username}:${creds.appPassword}`).toString("base64");
}

function joinUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");
  return `${cleanBase}/${cleanPath}`;
}

async function wpFetch<T>(
  siteUrl: string,
  creds: WPCredentials,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = joinUrl(siteUrl, path);
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(creds),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `WordPress API error: ${response.status} ${response.statusText} — ${text.slice(0, 300)}`
    );
  }

  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────
// PAGES & POSTS
// ─────────────────────────────────────────

export async function fetchWPPages(
  siteUrl: string,
  creds: WPCredentials,
  type: "pages" | "posts" = "pages",
  perPage = 100
): Promise<WPPage[]> {
  const results: WPPage[] = [];
  let page = 1;

  while (true) {
    const batch = await wpFetch<WPPage[]>(
      siteUrl,
      creds,
      `/wp-json/wp/v2/${type}?per_page=${perPage}&page=${page}&_embed=1`
    );

    if (batch.length === 0) break;
    results.push(...batch);

    if (batch.length < perPage) break;
    page++;

    // Safety: max 10 pages (1000 posts)
    if (page > 10) break;
  }

  return results;
}

export async function fetchWPPage(
  siteUrl: string,
  creds: WPCredentials,
  id: number,
  type: "pages" | "posts" = "pages"
): Promise<WPPage> {
  return wpFetch<WPPage>(siteUrl, creds, `/wp-json/wp/v2/${type}/${id}`);
}

export async function updateWPPage(
  siteUrl: string,
  creds: WPCredentials,
  id: number,
  type: "pages" | "posts" = "pages",
  payload: WPUpdatePayload
): Promise<WPPage> {
  return wpFetch<WPPage>(siteUrl, creds, `/wp-json/wp/v2/${type}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ─────────────────────────────────────────
// YOAST SEO META (if Yoast REST API is enabled)
// ─────────────────────────────────────────

export interface YoastMeta {
  title?: string;
  description?: string;
  focus_keyword?: string;
}

export async function fetchYoastMeta(
  siteUrl: string,
  creds: WPCredentials,
  id: number,
  type: "posts" | "pages" = "pages"
): Promise<YoastMeta | null> {
  try {
    const data = await wpFetch<Record<string, unknown>>(
      siteUrl,
      creds,
      `/wp-json/yoast/v1/${type}/${id}`
    );
    return {
      title: (data.title as string) || undefined,
      description: (data.description as string) || undefined,
      focus_keyword: (data.focus_keyword as string) || undefined,
    };
  } catch {
    // Yoast REST API may not be available
    return null;
  }
}

export async function updateYoastMeta(
  siteUrl: string,
  creds: WPCredentials,
  id: number,
  type: "posts" | "pages" = "pages",
  meta: YoastMeta
): Promise<boolean> {
  try {
    await wpFetch<unknown>(siteUrl, creds, `/wp-json/yoast/v1/${type}/${id}`, {
      method: "POST",
      body: JSON.stringify(meta),
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────
// ACF META FIELDS (fallback for meta)
// ─────────────────────────────────────────

export async function updateACFMeta(
  siteUrl: string,
  creds: WPCredentials,
  id: number,
  type: "posts" | "pages" = "pages",
  fields: Record<string, string>
): Promise<boolean> {
  try {
    await wpFetch<unknown>(siteUrl, creds, `/wp-json/acf/v3/${type}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ fields }),
    });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────

export async function checkWPConnection(
  siteUrl: string,
  creds: WPCredentials
): Promise<{ ok: true; siteName: string; userName: string } | { ok: false; error: string }> {
  try {
    const site = await wpFetch<{ name: string }>(siteUrl, creds, "/wp-json/");
    const user = await wpFetch<{ name: string }>(siteUrl, creds, "/wp-json/wp/v2/users/me");
    return { ok: true, siteName: site.name, userName: user.name };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─────────────────────────────────────────
// SYNC: pull all pages into our DB format
// ─────────────────────────────────────────

export interface SyncedPage {
  wpId: number;
  url: string;
  title: string;
  content: string;
  excerpt: string;
  status: string;
  type: string;
  modifiedAt: Date;
}

export async function syncWPSite(
  siteUrl: string,
  creds: WPCredentials
): Promise<SyncedPage[]> {
  const pages = await fetchWPPages(siteUrl, creds, "pages");
  const posts = await fetchWPPages(siteUrl, creds, "posts");
  const all = [...pages, ...posts];

  return all.map((p) => ({
    wpId: p.id,
    url: p.link,
    title: p.title.rendered,
    content: p.content.rendered,
    excerpt: p.excerpt.rendered,
    status: p.status,
    type: p.type,
    modifiedAt: new Date(p.modified),
  }));
}

const USE_MOCK = !process.env.ANTHROPIC_API_KEY;
const PSI_KEY = process.env.PAGESPEED_API_KEY ?? "";

export interface PageSpeedData {
  score: number | null;   // 0–100
  lcp: string | null;     // "2.1 s"
  cls: string | null;     // "0.05"
  tbt: string | null;     // "150 ms"
  fcp: string | null;     // "1.2 s"
  fetchError?: string;
}

async function fetchPageSpeed(url: string): Promise<PageSpeedData> {
  const base: PageSpeedData = { score: null, lcp: null, cls: null, tbt: null, fcp: null };
  try {
    const apiUrl =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
      `?url=${encodeURIComponent(url)}&strategy=mobile&category=performance` +
      (PSI_KEY ? `&key=${PSI_KEY}` : "");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(apiUrl, { signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );

    if (!res.ok) return { ...base, fetchError: `HTTP ${res.status}` };

    const data = await res.json();
    const lhr = data?.lighthouseResult;
    const audits = lhr?.audits ?? {};

    const rawScore = lhr?.categories?.performance?.score;
    return {
      score: rawScore != null ? Math.round(rawScore * 100) : null,
      lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
      cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
      tbt: audits["total-blocking-time"]?.displayValue ?? null,
      fcp: audits["first-contentful-paint"]?.displayValue ?? null,
    };
  } catch (err) {
    return { ...base, fetchError: err instanceof Error ? err.message : "error" };
  }
}

function getMockPageSpeed(isTarget = false): PageSpeedData {
  if (isTarget) {
    return { score: 54, lcp: "4.2 s", cls: "0.18", tbt: "820 ms", fcp: "3.1 s" };
  }
  return { score: 78, lcp: "2.1 s", cls: "0.04", tbt: "210 ms", fcp: "1.3 s" };
}

export async function fetchPageSpeeds(
  targetUrl: string,
  competitorUrls: string[]
): Promise<{ target: PageSpeedData; competitors: PageSpeedData[] }> {
  if (USE_MOCK) {
    return {
      target: getMockPageSpeed(true),
      competitors: competitorUrls.map(() => getMockPageSpeed(false)),
    };
  }

  // С ключом — параллельно. Без ключа — последовательно с паузой, иначе 429
  let target: PageSpeedData;
  let competitors: PageSpeedData[];

  if (PSI_KEY) {
    [target, ...competitors] = await Promise.all([
      fetchPageSpeed(targetUrl),
      ...competitorUrls.map(fetchPageSpeed),
    ]);
  } else {
    const results: PageSpeedData[] = [];
    for (const u of [targetUrl, ...competitorUrls]) {
      results.push(await fetchPageSpeed(u));
      if (results.length < 1 + competitorUrls.length) await new Promise((r) => setTimeout(r, 2000));
    }
    [target, ...competitors] = results;
  }

  return { target, competitors };
}

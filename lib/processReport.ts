import { prisma } from "@/lib/prisma";
import { fetchCompetitors, fetchKeywords, fetchDomainInfo } from "@/lib/dataforseo";
import { generateSEOBrief, generateComparisons, generateBlockMatrix, generateQuickFixes, generateReadyContent } from "@/lib/claude";
import type { SchemaResult } from "@/lib/claude";
import { generateSchemaWithGemini, analyzePageWithGemini } from "@/lib/gemini";
import type { PageStructureAnalysis } from "@/lib/gemini";
import { buildSchemaGraph } from "@/lib/schemaBuilder";
import { getPatternInsights, detectPageType } from "@/lib/nichePatterns";
import type { PatternInsight } from "@/lib/nichePatterns";
import { detectNiche } from "@/lib/nicheDetector";
import { accumulatePatterns } from "@/lib/patternAccumulator";
import { analyzeMissingTerms } from "@/lib/termAnalyzer";
import type { MissingTerm } from "@/lib/termAnalyzer";
import { computeAnalytics } from "@/lib/analytics";
import { htmlToText, sanitizeFacts } from "@/lib/factGuard";
import { markCoveredRecommendations, filterCoveredTexts } from "@/lib/dedupe";
import { buildCompetitorEvidence } from "@/lib/competitorEvidence";
import { fetchSitePaths, findSimilarExistingPath } from "@/lib/siteInventory";
import { computeSemanticAnalysis } from "@/lib/semantic";
import { scrapePages, BLOCK_LABELS_RU } from "@/lib/scraper";
import { fetchPageSpeeds } from "@/lib/pagespeed";
import type { PageSpeedData } from "@/lib/pagespeed";
import { isUrlQuery, type GscRow } from "@/lib/gsc";
import { fetchGscRowsForPage } from "@/lib/gscApi";
import type { Prisma } from "@prisma/client";
import { snapshotFromPage, diffSnapshots, computeRankingOutcomes } from "@/lib/pageMonitor";

// PageSpeed не блокирует отчёт — если не успел за 20s, возвращаем пустые данные
async function fetchPageSpeedsWithTimeout(
  targetUrl: string,
  competitorUrls: string[]
): Promise<{ target: PageSpeedData; competitors: PageSpeedData[] }> {
  const empty: PageSpeedData = { score: null, lcp: null, cls: null, tbt: null, fcp: null, fetchError: "timeout" };
  const emptyResult = {
    target: empty,
    competitors: competitorUrls.map(() => empty),
  };

  try {
    return await Promise.race([
      fetchPageSpeeds(targetUrl, competitorUrls),
      new Promise<typeof emptyResult>((resolve) =>
        setTimeout(() => resolve(emptyResult), 20_000)
      ),
    ]);
  } catch {
    return emptyResult;
  }
}

// Соответствие: id блока скрейпера → ключевые слова в названиях блоков от Gemini
const BLOCK_KEYWORDS: Record<string, RegExp> = {
  reviews: /отзыв|рейтинг|review/i,
  faq: /faq|вопрос|ответ/i,
  price: /цен|прайс|стоимост|price/i,
  calculator: /калькулятор|расчет|расчёт|calculator/i,
  gallery: /галере|портфолио|фото работ|примеры работ|выполненн/i,
  map: /карт[аы]|map/i,
  video: /видео|video/i,
  team: /команд|специалист|мастер/i,
  form: /форм[аы]|заявк/i,
  chat: /чат|chat/i,
  social_proof: /преимуществ|почему (нас|выбирают)|доказательств|счетчик|счётчик/i,
  comparison_table: /таблиц|сравнени/i,
};

function blockAlreadyDetected(recommendedName: string, detectedBlocks: string[]): boolean {
  return detectedBlocks.some((block) => BLOCK_KEYWORDS[block]?.test(recommendedName));
}

export async function processReport(reportId: string) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error(`Report ${reportId} not found`);

  // URL-строки из вкладки «Страницы» GSC — не запросы; фильтруем у источника,
  // иначе они утекают в бриф, семантику и кластеры
  let gscRows = ((report.gscData as GscRow[] | null) ?? []).filter((r) => !isUrlQuery(r.query));

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING" },
  });

  // CSV не загружен, но у юзера подключён Search Console — тянем данные по API
  if (gscRows.length === 0) {
    try {
      const liveRows = await fetchGscRowsForPage(report.userId, report.url);
      if (liveRows && liveRows.length > 0) {
        gscRows = liveRows;
        await prisma.report.update({
          where: { id: reportId },
          data: { gscData: liveRows as unknown as Prisma.InputJsonValue },
        });
      }
    } catch (err) {
      console.warn("[gsc] Live fetch failed, continuing without GSC data:", err);
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: report.userId },
      select: { plan: true, isAdmin: true },
    });
    const isPro = user?.isAdmin || user?.plan === "STARTER" || user?.plan === "PRO";

    // Сначала скрапим целевую страницу чтобы взять title/H1 для поискового запроса
    const { target: targetSnapshotPre } = await scrapePages(report.url, []);
    const serpQuery = [targetSnapshotPre.h1, targetSnapshotPre.title]
      .map((s) => s?.trim())
      .find((s) => s && s.length > 3) ?? new URL(report.url).hostname;

    // Кеш DataForSEO SERP: берём конкурентов из последнего отчёта (≤7 дней) для того же URL
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const cachedReport = await prisma.report.findFirst({
      where: {
        url: report.url,
        locationCode: report.locationCode,
        status: "DONE",
        id: { not: reportId },
        createdAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
      },
      include: { competitors: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    let competitors: import("@/lib/dataforseo").SerpResult[];
    let fromCache = false;

    if (cachedReport && cachedReport.competitors.length > 0) {
      competitors = cachedReport.competitors.map((c) => ({
        domain: c.domain,
        position: c.position,
        title: c.title,
        url: c.url,
        snippet: "",
      }));
      fromCache = true;
      // Копируем конкурентов в новый отчёт
      await prisma.competitor.createMany({
        data: competitors.map((c) => ({
          reportId,
          domain: c.domain,
          position: c.position,
          title: c.title,
          url: c.url,
        })),
      });
    } else {
      competitors = await fetchCompetitors(report.url, report.locationCode, serpQuery);
      await prisma.competitor.createMany({
        data: competitors.map((c) => ({
          reportId,
          domain: c.domain,
          position: c.position,
          title: c.title,
          url: c.url,
        })),
      });
    }

    console.log(`[processReport] competitors: ${fromCache ? "from cache" : "from DataForSEO"} (${competitors.length})`);

    const compareCount = isPro ? 3 : 1;
    const topCompetitors = competitors.slice(0, compareCount);
    const competitorDomains = [...new Set(competitors.map((c) => c.domain))];

    const fromTitles = competitors
      .flatMap((c) => c.title.toLowerCase().split(/\s+/))
      .filter((w) => w.length > 3);
    const fromGsc = gscRows.map((r) => r.query);
    const rawKeywords = [...new Set([...fromTitles, ...fromGsc])].slice(0, 30);

    // Всё параллельно: keywords, domains, скрапинг конкурентов, pagespeed
    // Таргет уже скрапнут выше (targetSnapshotPre), скрапим только конкурентов
    const competitorUrls = topCompetitors.map((c) => c.url);
    const [
      [_keywordData, domainInfo],
      compSnapshots,
      { target: targetSpeed, competitors: compSpeeds },
    ] = await Promise.all([
      Promise.all([fetchKeywords(rawKeywords, report.locationCode), fetchDomainInfo(competitorDomains)]),
      scrapePages(report.url, competitorUrls).then((r) => r.competitors),
      fetchPageSpeedsWithTimeout(report.url, competitorUrls),
    ]);
    const targetSnapshot = targetSnapshotPre;

    // Кеш keywords: берём из последнего отчёта если есть
    let keywordData = _keywordData;
    if (fromCache && keywordData.length === 0) {
      const cachedKeywords = await prisma.keyword.findMany({
        where: { reportId: cachedReport!.id },
        take: 30,
      });
      keywordData = cachedKeywords.map((k) => ({
        keyword: k.keyword,
        volume: k.volume,
        cpc: Number(k.cpc),
        competition: Number(k.competition),
      }));
    }

    if (keywordData.length > 0) {
      await prisma.keyword.createMany({
        data: keywordData.map((k) => ({
          reportId,
          keyword: k.keyword,
          volume: k.volume,
          cpc: k.cpc,
          competition: k.competition,
        })),
      });
    }

    const analytics = computeAnalytics(competitors, keywordData, domainInfo, gscRows);

    const siteType = targetSnapshot.siteType;

    // Вычисляем пропущенные термины синхронно — чистая CPU работа, ~5ms
    const missingTerms: MissingTerm[] = analyzeMissingTerms(targetSnapshot, compSnapshots);

    // Инвентаризация сайта: sitemap + внутренние ссылки — чтобы не советовать создать существующее
    const sitePaths = await fetchSitePaths(report.url, targetSnapshot.rawHtml).catch(() => [] as string[]);

    // Бриф параллельно с comparisons+blockMatrix — brief не зависит от snapshots
    const [
      { brief, costUsd: briefCost },
      [comparisons, blockMatrix],
    ] = await Promise.all([
      generateSEOBrief(report.url, competitors, keywordData, domainInfo, analytics, gscRows, siteType, targetSnapshot, compSnapshots, missingTerms, sitePaths),
      Promise.all([
        generateComparisons(targetSnapshot, compSnapshots, topCompetitors),
        generateBlockMatrix(targetSnapshot, compSnapshots, topCompetitors, siteType),
      ]),
    ]);

    // Страховка: contentGaps, для которых на сайте уже есть похожая страница, помечаем
    if (brief.contentGaps?.length && sitePaths.length > 0) {
      brief.contentGaps = brief.contentGaps.map((gap) => {
        const existing = findSimilarExistingPath(gap.suggestedSlug, sitePaths);
        return existing ? { ...gap, existingUrl: existing } : gap;
      });
    }

    brief.domainInfo = Object.fromEntries(
      domainInfo.map((d) => [d.domain, { domainAge: d.domainAge, referringDomains: d.referringDomains }])
    );

    // Текст страницы клиента — единственный разрешённый источник фактов о бизнесе
    const targetPageText = targetSnapshot.rawHtml ? htmlToText(targetSnapshot.rawHtml) : "";

    const existingBlockLabels = targetSnapshot.detectedBlocks.map((b) => BLOCK_LABELS_RU[b] ?? b);

    const [quickFixesRaw, pageStructureRaw, readyContentRaw, semanticAnalysis] = await Promise.all([
      generateQuickFixes(report.url, brief, comparisons, analytics, siteType, existingBlockLabels),
      analyzePageWithGemini(report.url, competitorDomains, targetSnapshot, sitePaths),
      isPro ? generateReadyContent(report.url, brief, siteType, targetPageText) : Promise.resolve(null),
      computeSemanticAnalysis({
        targetKeyword: brief.targetKeyword ?? serpQuery,
        targetPageText,
        targetHeadings: targetSnapshot.headings,
        competitors: compSnapshots.map((snap, i) => ({
          domain: topCompetitors[i]?.domain ?? "",
          position: topCompetitors[i]?.position ?? i + 1,
          pageText: snap.rawHtml && !snap.fetchError ? htmlToText(snap.rawHtml) : "",
          headings: snap.headings,
        })),
        gscRows,
      }).catch((err) => {
        console.warn("[semantic] non-fatal error:", err);
        return null;
      }),
    ]);

    // Страховка от галлюцинаций Gemini: блок, найденный скрейпером, не может быть «отсутствующим»
    const pageStructure = pageStructureRaw
      ? {
          ...pageStructureRaw,
          recommendedBlocks: pageStructureRaw.recommendedBlocks.filter(
            (rec) => !blockAlreadyDetected(rec.name, targetSnapshot.detectedBlocks)
          ),
        }
      : pageStructureRaw;

    // Страж фактов: выдуманные цены/гарантии/цифры → плейсхолдеры
    const quickFixes = quickFixesRaw.map((f) => ({
      ...f,
      action: sanitizeFacts(f.action, targetPageText),
    }));
    const readyContent = readyContentRaw
      ? {
          ...readyContentRaw,
          introParagraph: sanitizeFacts(readyContentRaw.introParagraph, targetPageText),
          faqItems: readyContentRaw.faqItems.map((item) => ({
            ...item,
            answer: sanitizeFacts(item.answer, targetPageText),
          })),
        }
      : null;

    // Дедупликация: рекомендации, уже попавшие в quickFixes, в сравнениях помечаем
    const dedupedComparisons = markCoveredRecommendations(comparisons, quickFixes);

    // Сквозная дедупликация тем: quickFixes + матрица блоков — канон,
    // из текстовых рекомендаций брифа и E-E-A-T убираем полностью покрытые темы
    const canonicalTexts = [
      ...quickFixes.map((f) => `${f.action} ${f.why}`),
      ...blockMatrix.map((b) => `${b.block} ${b.tip}`),
    ];
    if (brief.additionalRecommendations?.length) {
      brief.additionalRecommendations = filterCoveredTexts(brief.additionalRecommendations, canonicalTexts);
    }
    if (brief.eeatAnalysis?.recommendations?.length) {
      brief.eeatAnalysis.recommendations = filterCoveredTexts(
        brief.eeatAnalysis.recommendations,
        [...canonicalTexts, ...(brief.additionalRecommendations ?? [])]
      );
    }

    // Дословные улики с страниц конкурентов (без AI)
    const competitorEvidence = buildCompetitorEvidence(compSnapshots, topCompetitors);

    // Тип страницы + схема + паттерны
    const pageType = detectPageType(report.url);
    const schemaResult = buildSchemaGraph(report.url, targetSnapshot, brief, siteType, pageType);
    const existingBlocks = pageStructure?.existingBlocks ?? targetSnapshot.detectedBlocks;

    const detectedNiche = detectNiche(
      brief.targetKeyword ?? "",
      competitors.map((c) => c.title),
      siteType
    );

    // Fire-and-forget: накапливаем паттерны конкурентов в базу знаний ниш
    accumulatePatterns(detectedNiche, pageType, compSnapshots).catch((err) =>
      console.warn("[patternAccumulator] non-fatal error:", err)
    );

    const nichePatterns = await getPatternInsights(
      existingBlocks, siteType, brief.targetKeyword,
      targetSnapshot.detectedBlocks, pageType, detectedNiche
    );

    const compCost = comparisons.length * 0.015;
    const costUsd = briefCost + compCost + 0.01;

    const pageSpeed: Record<string, PageSpeedData> = {
      [report.url]: targetSpeed,
      ...Object.fromEntries(topCompetitors.map((c, i) => [c.url, compSpeeds[i]])),
    };

    const result = {
      brief,
      analytics,
      comparisons: dedupedComparisons,
      blockMatrix,
      quickFixes,
      schemaResult,
      pageStructure,
      nichePatterns,
      missingTerms,
      readyContent,
      competitors,
      competitorEvidence,
      semanticAnalysis,
      pageSpeed,
      siteType,
      domainInfo: Object.fromEntries(domainInfo.map((d) => [d.domain, d])),
    };

    await prisma.report.update({
      where: { id: reportId },
      data: { status: "DONE", result: result as unknown as Prisma.InputJsonValue, costUsd },
    });

    await prisma.user.update({
      where: { id: report.userId },
      data: { reportsUsed: { increment: 1 } },
    });

    // Outcome data: мониторинг страницы
    await setupMonitoring(reportId, report.userId, report.url, targetSnapshot, gscRows).catch((err) =>
      console.warn("[pageMonitor] non-fatal error:", err)
    );

    return { success: true, reportId, costUsd };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "FAILED", errorMessage: message },
    });
    throw error;
  }
}

// ─────────────────────────────────────────
// OUTCOME DATA: мониторинг + корреляция позиций
// ─────────────────────────────────────────

async function setupMonitoring(
  reportId: string,
  userId: string,
  url: string,
  targetSnapshot: import("@/lib/scraper").PageSnapshot,
  gscRows: GscRow[]
) {
  const snap = snapshotFromPage(targetSnapshot);

  const existingMonitor = await prisma.pageMonitor.findFirst({
    where: { userId, url },
    include: {
      snapshots: { orderBy: { takenAt: "desc" }, take: 1 },
      changes: { orderBy: { detectedAt: "desc" }, take: 10 },
      report: { select: { gscData: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!existingMonitor) {
    // Первый отчёт для этого URL — создаём монитор и начальный снапшот
    const monitor = await prisma.pageMonitor.create({
      data: { userId, reportId, url },
    });
    await prisma.pageSnapshotRecord.create({
      data: { monitorId: monitor.id, ...snap },
    });
    console.log(`[pageMonitor] Создан монитор для ${url}`);
    return;
  }

  // Повторный отчёт — деактивируем старый монитор, создаём новый привязанный к свежему отчёту
  await prisma.pageMonitor.update({
    where: { id: existingMonitor.id },
    data: { isActive: false },
  });

  const newMonitor = await prisma.pageMonitor.create({
    data: { userId, reportId, url },
  });

  await prisma.pageSnapshotRecord.create({
    data: { monitorId: newMonitor.id, ...snap },
  });

  // Диффим страницу с предыдущим снапшотом
  const prevSnap = existingMonitor.snapshots[0];
  if (prevSnap) {
    const diffs = diffSnapshots(prevSnap, snap);
    if (diffs.length > 0) {
      await prisma.detectedChange.createMany({
        data: diffs.map((d) => ({ monitorId: newMonitor.id, ...d })),
      });
      console.log(`[pageMonitor] ${url}: ${diffs.length} изменений с прошлого отчёта`);
    }
  }

  // Если есть GSC данные в обоих отчётах — вычисляем outcome
  const prevGscRows = (existingMonitor.report.gscData as GscRow[] | null) ?? [];
  if (prevGscRows.length > 0 && gscRows.length > 0) {
    const daysBetween = Math.round(
      (Date.now() - new Date(existingMonitor.report.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const outcomes = computeRankingOutcomes(prevGscRows, gscRows, daysBetween);

    if (outcomes.length > 0) {
      // Берём последнее изменение как атрибуцию (грубая, но рабочая эвристика)
      const lastChange = existingMonitor.changes[0];

      await prisma.rankingOutcome.createMany({
        data: outcomes.slice(0, 50).map((o) => ({
          monitorId: newMonitor.id,
          changeId: lastChange?.id ?? null,
          keyword: o.keyword,
          positionBefore: o.positionBefore,
          positionAfter: o.positionAfter,
          delta: o.delta,
          daysAfterChange: o.daysAfterChange,
        })),
      });

      const improved = outcomes.filter((o) => o.delta < -0.5).length;
      console.log(`[pageMonitor] ${url}: ${improved} запросов улучшились, ${outcomes.filter(o => o.delta > 0.5).length} упали`);
    }
  }
}

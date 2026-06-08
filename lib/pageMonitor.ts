import type { PageSnapshot } from "./scraper";
import type { GscRow } from "./gsc";

export interface PageDiff {
  changeType: string;
  field: string;
  valueBefore: string;
  valueAfter: string;
}

export interface SnapshotData {
  wordCount: number;
  title: string;
  h1: string;
  headings: string[];
  detectedBlocks: string[];
  schemaTypes: string[];
  internalLinks: number;
}

export interface GscOutcome {
  keyword: string;
  positionBefore: number;
  positionAfter: number;
  delta: number;
  daysAfterChange: number;
}

export function snapshotFromPage(snap: PageSnapshot): SnapshotData {
  return {
    wordCount: snap.wordCount,
    title: snap.title,
    h1: snap.h1,
    headings: snap.headings,
    detectedBlocks: snap.detectedBlocks,
    schemaTypes: snap.schemaTypes,
    internalLinks: snap.internalLinksCount,
  };
}

export function diffSnapshots(before: SnapshotData, after: SnapshotData): PageDiff[] {
  const changes: PageDiff[] = [];

  // Word count: значимо если > 15% и > 50 слов
  const wcDelta = after.wordCount - before.wordCount;
  const wcPct = before.wordCount > 0 ? Math.abs(wcDelta) / before.wordCount : 0;
  if (wcPct > 0.15 && Math.abs(wcDelta) > 50) {
    changes.push({
      changeType: "wordCount",
      field: "wordCount",
      valueBefore: String(before.wordCount),
      valueAfter: String(after.wordCount),
    });
  }

  // Title
  if (before.title && after.title && before.title !== after.title) {
    changes.push({
      changeType: "title_changed",
      field: "title",
      valueBefore: before.title,
      valueAfter: after.title,
    });
  }

  // H1
  if (before.h1 && after.h1 && before.h1 !== after.h1) {
    changes.push({
      changeType: "h1_changed",
      field: "h1",
      valueBefore: before.h1,
      valueAfter: after.h1,
    });
  }

  // Блоки добавлены
  const blocksAdded = after.detectedBlocks.filter((b) => !before.detectedBlocks.includes(b));
  for (const block of blocksAdded) {
    changes.push({
      changeType: "block_added",
      field: "detectedBlocks",
      valueBefore: "",
      valueAfter: block,
    });
  }

  // Блоки удалены
  const blocksRemoved = before.detectedBlocks.filter((b) => !after.detectedBlocks.includes(b));
  for (const block of blocksRemoved) {
    changes.push({
      changeType: "block_removed",
      field: "detectedBlocks",
      valueBefore: block,
      valueAfter: "",
    });
  }

  // Schema добавлена
  const schemasAdded = after.schemaTypes.filter((s) => !before.schemaTypes.includes(s));
  for (const schema of schemasAdded) {
    changes.push({
      changeType: "schema_added",
      field: "schemaTypes",
      valueBefore: "",
      valueAfter: schema,
    });
  }

  // Новые заголовки
  const beforeSet = new Set(before.headings);
  const newHeadings = after.headings.filter((h) => !beforeSet.has(h));
  if (newHeadings.length >= 2) {
    changes.push({
      changeType: "heading_added",
      field: "headings",
      valueBefore: String(before.headings.length),
      valueAfter: `${after.headings.length} (+${newHeadings.length}: ${newHeadings.slice(0, 3).join(", ")})`,
    });
  }

  return changes;
}

// Вычисляет дельты позиций между двумя наборами GSC данных
// Возвращает только запросы где позиция значимо изменилась (> 0.5)
export function computeRankingOutcomes(
  gscBefore: GscRow[],
  gscAfter: GscRow[],
  daysBetween: number
): GscOutcome[] {
  const beforeMap = new Map(gscBefore.map((r) => [r.query, r.position]));
  const outcomes: GscOutcome[] = [];

  for (const row of gscAfter) {
    const posBefore = beforeMap.get(row.query);
    if (posBefore == null) continue;

    const delta = row.position - posBefore; // отрицательный = улучшение
    if (Math.abs(delta) < 0.5) continue; // незначимые изменения пропускаем

    outcomes.push({
      keyword: row.query,
      positionBefore: posBefore,
      positionAfter: row.position,
      delta,
      daysAfterChange: daysBetween,
    });
  }

  return outcomes.sort((a, b) => a.delta - b.delta); // лучшие улучшения сверху
}

// Человекочитаемое описание изменения для UI
export function describeChange(change: PageDiff): string {
  switch (change.changeType) {
    case "wordCount": {
      const before = parseInt(change.valueBefore);
      const after = parseInt(change.valueAfter);
      return after > before
        ? `Текст вырос: ${before} → ${after} слов (+${after - before})`
        : `Текст сократился: ${before} → ${after} слов`;
    }
    case "title_changed":
      return `Title обновлён`;
    case "h1_changed":
      return `H1 обновлён`;
    case "block_added":
      return `Добавлен блок: ${change.valueAfter}`;
    case "block_removed":
      return `Удалён блок: ${change.valueBefore}`;
    case "schema_added":
      return `Добавлена schema.org разметка: ${change.valueAfter}`;
    case "heading_added":
      return `Добавлены заголовки: ${change.valueAfter}`;
    default:
      return `Изменение: ${change.field}`;
  }
}

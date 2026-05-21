export interface GscRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;      // 0–1 float
  position: number; // средняя позиция
}

export function parseGscCsv(text: string): GscRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // GSC экспортирует файл с мета-строками вида "# ..." или "Top queries" — пропускаем
  const dataLines = lines.filter((l) => !l.startsWith("#") && l !== "");

  // Ищем строку-заголовок: должна содержать "Query" и "Clicks"
  const headerIdx = dataLines.findIndex(
    (l) => /query/i.test(l) && /clicks/i.test(l)
  );
  if (headerIdx === -1) return [];

  const headers = dataLines[headerIdx].split(",").map((h) => h.trim().toLowerCase());
  const qi = headers.indexOf("query");
  const cli = headers.indexOf("clicks");
  const impi = headers.indexOf("impressions");
  const ctri = headers.indexOf("ctr");
  const posi = headers.indexOf("position");

  if (qi === -1 || posi === -1) return [];

  const rows: GscRow[] = [];

  for (let i = headerIdx + 1; i < dataLines.length; i++) {
    const cols = dataLines[i].split(",");
    if (cols.length < headers.length) continue;

    const query = cols[qi]?.trim().replace(/^"|"$/g, "");
    if (!query) continue;

    // CTR может быть "6.52%" или "0.065"
    const rawCtr = cols[ctri]?.trim().replace("%", "") ?? "0";
    const ctrVal = parseFloat(rawCtr);
    const ctr = ctrVal > 1 ? ctrVal / 100 : ctrVal;

    rows.push({
      query,
      clicks: parseInt(cols[cli] ?? "0", 10) || 0,
      impressions: parseInt(cols[impi] ?? "0", 10) || 0,
      ctr: isNaN(ctr) ? 0 : ctr,
      position: parseFloat(cols[posi] ?? "0") || 0,
    });
  }

  return rows;
}

export interface GscRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;      // 0–1 float
  position: number; // средняя позиция
}

// Правильный парсер CSV с поддержкой quoted fields (RFC 4180)
function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Определяем разделитель по первым строкам файла
function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join("\n");
  const commas    = (sample.match(/,/g)  ?? []).length;
  const semis     = (sample.match(/;/g)  ?? []).length;
  const tabs      = (sample.match(/\t/g) ?? []).length;
  if (tabs >= semis && tabs >= commas)   return "\t";
  if (semis > commas)                    return ";";
  return ",";
}

export interface ParseResult {
  rows: GscRow[];
  // заполняется при ошибке — показываем пользователю для диагностики
  debugInfo?: string;
}

export function parseGscCsv(text: string): GscRow[] {
  return parseGscCsvDetailed(text).rows;
}

export function parseGscCsvDetailed(text: string): ParseResult {
  // Снимаем UTF-8 BOM и UTF-16 BOM
  const cleaned = text.replace(/^﻿/, "").replace(/^￾/, "");

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Пропускаем мета-строки "# ..."
  const dataLines = lines.filter((l) => !l.startsWith("#"));

  if (dataLines.length === 0) {
    return { rows: [], debugInfo: "Файл пустой или содержит только комментарии (#)." };
  }

  const delimiter = detectDelimiter(dataLines);

  // Ищем строку-заголовок: RU или EN
  const headerIdx = dataLines.findIndex((l) => {
    const low = l.toLowerCase();
    return (
      /quer(y|ies)|запрос|популярные/i.test(low) ||
      /clicks|клики/i.test(low)
    ) && (
      /clicks|клики/i.test(low) ||
      /impressions|показы/i.test(low)
    );
  });

  if (headerIdx === -1) {
    const preview = dataLines.slice(0, 3).join(" | ");
    return {
      rows: [],
      debugInfo: `Не найдена строка с заголовками. Первые строки файла: «${preview}». Разделитель: «${delimiter === "\t" ? "TAB" : delimiter}».`,
    };
  }

  const headers = splitLine(dataLines[headerIdx], delimiter).map((h) =>
    h.toLowerCase().replace(/^"|"$/g, "").trim()
  );

  const qi   = headers.findIndex((h) => /quer(y|ies)|запрос|популярные/i.test(h));
  const cli  = headers.findIndex((h) => /^clicks$|^клики$|^клик$/i.test(h));
  const impi = headers.findIndex((h) => /^impressions$|^показы$|^показ$/i.test(h));
  const ctri = headers.findIndex((h) => /^ctr$/i.test(h));
  const posi = headers.findIndex((h) => /^position$|^позиция$|^поз$/i.test(h));

  if (qi === -1 || posi === -1) {
    return {
      rows: [],
      debugInfo: `Найдены заголовки: [${headers.join(", ")}]. Не удалось определить колонки "Запросы" (qi=${qi}) или "Позиция" (posi=${posi}).`,
    };
  }

  const rows: GscRow[] = [];

  for (let i = headerIdx + 1; i < dataLines.length; i++) {
    const cols = splitLine(dataLines[i], delimiter);
    if (cols.length < 2) continue;

    const query = (cols[qi] ?? "").replace(/^"|"$/g, "");
    if (!query) continue;

    // CTR: "6.52%", "0.065", "6,52%"
    const rawCtr = (cols[ctri] ?? "0").replace("%", "").replace(",", ".");
    const ctrVal = parseFloat(rawCtr);
    const ctr = ctrVal > 1 ? ctrVal / 100 : ctrVal;

    // Числа с пробелом как разделителем тысяч: "1 234"
    const parseNum    = (s: string) => parseInt((s ?? "0").replace(/[\s ]/g, ""), 10) || 0;
    const parseFloat2 = (s: string) => parseFloat((s ?? "0").replace(",", ".")) || 0;

    rows.push({
      query,
      clicks:      parseNum(cols[cli]  ?? "0"),
      impressions: parseNum(cols[impi] ?? "0"),
      ctr:         isNaN(ctr) ? 0 : ctr,
      position:    parseFloat2(cols[posi] ?? "0"),
    });
  }

  if (rows.length === 0) {
    return {
      rows: [],
      debugInfo: `Заголовки найдены (${headers.join(", ")}), но строк с данными нет.`,
    };
  }

  return { rows };
}

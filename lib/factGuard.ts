// Страж фактов: AI не имеет права публиковать выдуманные бизнес-факты
// (цены, гарантии, опыт, количество проектов). Проверяем сгенерированный текст
// против реального текста страницы клиента — чего там нет, заменяем плейсхолдером.

import * as cheerio from "cheerio";

// Рискованные числовые утверждения о бизнесе
const RISKY_PATTERNS: Array<{ re: RegExp; placeholder: string }> = [
  // "от 250 000 рублей", "1 500 000 ₽", "250000 руб."
  { re: /(?:от\s+)?\d[\d\s.,]*\s*(?:₽|руб(?:лей|ля|\.)?)/gi, placeholder: "[укажите вашу цену]" },
  // "гарантия 3 года", "гарантия на работы 2 года"
  { re: /гаранти[яию][^.!?]{0,30}?\d+\s*(?:лет|год[а-яё]*|мес(?:яц[а-яё]*)?)/gi, placeholder: "[укажите срок вашей гарантии]" },
  // "15 лет на рынке", "18 лет опыта"
  { re: /\d+\s*лет\s+(?:на\s+рынке|опыта|работы)/gi, placeholder: "[укажите ваш опыт]" },
  // "более 800 проектов/объектов/клиентов/заказов"
  { re: /(?:более|свыше|уже)?\s*\d[\d\s]*\+?\s*(?:выполненных\s+)?(?:проект|объект|клиент|заказ|квартир)[а-яё]*/gi, placeholder: "[укажите ваши цифры]" },
  // "рейтинг 4.9 из 5", "оценка 5.0"
  { re: /(?:рейтинг|оценк[а-яё]+|средн[а-яё]+ балл)\s*[:—-]?\s*\d[.,]\d(?:\s*из\s*\d)?/gi, placeholder: "[укажите ваш рейтинг]" },
  // сроки: "4–6 недель", "8-12 недель"
  { re: /\d+\s*[-–—]\s*\d+\s*(?:недел|дн|час)[а-яё]*/gi, placeholder: "[укажите ваши сроки]" },
];

export function htmlToText(rawHtml: string): string {
  const $ = cheerio.load(rawHtml);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "12 000" / "12.000" → "12000", чтобы числа сравнивались без форматирования
function normalizeNumbers(text: string): string {
  return text.replace(/(\d)[\s.,]+(?=\d)/g, "$1");
}

// Есть ли утверждение на странице клиента.
// Длинные числа (250000) ищем сами по себе; короткие (2, 15) — только рядом
// с той же единицей измерения, иначе "2" из "м2" легализует "гарантия 2 года".
function factInSource(match: string, normalizedSource: string): boolean {
  const pairs = [...match.matchAll(/(\d[\d\s.,]*)\s*([а-яёa-z₽$€]*)/gi)];
  if (pairs.length === 0) return true;

  return pairs.every(([, num, unit]) => {
    const n = num.replace(/[\s.,]/g, "");
    if (n.length >= 3) {
      return normalizedSource.includes(n);
    }
    const stem = escapeRe((unit || "").slice(0, 4));
    if (!stem) return normalizedSource.includes(n);
    return new RegExp(`${n}\\s*${stem}`, "i").test(normalizedSource);
  });
}

// Заменяет в сгенерированном тексте числовые бизнес-утверждения,
// которых нет на странице клиента, на плейсхолдеры.
export function sanitizeFacts(generated: string, sourcePageText: string): string {
  if (!generated) return generated;
  const normalizedSource = normalizeNumbers(sourcePageText);

  let out = generated;
  for (const { re, placeholder } of RISKY_PATTERNS) {
    out = out.replace(re, (match) =>
      factInSource(normalizeNumbers(match), normalizedSource) ? match : placeholder
    );
  }
  return out;
}

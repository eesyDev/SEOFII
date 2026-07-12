// Агрегаторы и маркетплейсы в выдаче: сравнивать локальный бизнес с profi.ru
// бессмысленно — они ранжируются авторитетом домена, а не качеством страницы.
// Исключаем их из сравнения/улик, но оставляем в таблице выдачи.

const AGGREGATOR_DOMAINS = [
  "profi.ru",
  "avito.ru",
  "youdo.com",
  "yandex.ru",
  "uslugi.yandex.ru",
  "market.yandex.ru",
  "zoon.ru",
  "2gis.ru",
  "flamp.ru",
  "yell.ru",
  "otzovik.com",
  "irecommend.ru",
  "prodoctorov.ru",
  "napopravku.ru",
  "remontnik.ru",
  "wildberries.ru",
  "ozon.ru",
  "tiu.ru",
  "pulscen.ru",
  "blizko.ru",
  "satom.ru",
  "hh.ru",
  "banki.ru",
  "sravni.ru",
];

// Паттерны заголовков каталогов-агрегаторов: «212 185 лучших мастеров…», «цены, отзывы»
const AGGREGATOR_TITLE_PATTERNS =
  /лучши[хе] (мастер|специалист|исполнител|компани)|частн\w+ мастер|исполнител[еиья]|\d{3,}[\s ]+(мастер|компани|специалист|предложени)|цены,?\s*отзывы|сравни(ть|те)? цен|каталог (компаний|товаров|услуг)/i;

export function isAggregator(domain: string, title?: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (AGGREGATOR_DOMAINS.some((agg) => d === agg || d.endsWith(`.${agg}`))) return true;
  if (title && AGGREGATOR_TITLE_PATTERNS.test(title)) return true;
  return false;
}

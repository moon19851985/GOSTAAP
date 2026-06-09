/** تطبيع عربي للمقارنة — ألف/ياء/تاء مربوطة */
export function normalizeArabicForMatch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

const COFFEE_KEYWORDS = [
  "قهوه",
  "قهوة",
  "كوفي",
  "coffee",
  "cafe",
  "كافيه",
  "كابتشينو",
  "كابتش",
  "لاتيه",
  "موكا",
  "اسبريسو",
  "ايسبريسو",
  "نسكافيه",
  "شاي",
  "tea",
  "مشروب",
  "مشروبات",
  "عصير",
  "عصائر",
  "سموذي",
  "فرابيه",
  "آيس",
  "ايس",
  "iced",
];

const SWEETS_KEYWORDS = [
  "حلويات",
  "حلاويات",
  "حلوي",
  "حلى",
  "حلوى",
  "حلو",
  "حلاوي",
  "sweet",
  "sweets",
  "dessert",
  "desserts",
  "cake",
  "كيك",
  "كعك",
  "كعكه",
  "تورت",
  "تورتة",
  "معجنات",
  "مخبوزات",
  "شوكولات",
  "شوكولاته",
  "شكلت",
  "بسكوت",
  "بسكويت",
  "كوكيز",
  "cookies",
  "cookie",
  "آيس كريم",
  "ايس كريم",
  "ايسكريم",
  "مثلجات",
  "بوظه",
  "بوظة",
  "وافل",
  "كرواس",
  "كرواسون",
  "دونات",
  "دونت",
  "براوني",
  "تشيز",
  "تارت",
  "مافن",
  "فطيره",
  "فطيرة",
  "بقلاوه",
  "بقلاوة",
  "كنافه",
  "كنافة",
  "معمول",
  "حلقوم",
  "بسبوسه",
  "بسبوسة",
  "لقيمات",
  "مهلبيه",
  "مهلبية",
  "سكر",
  "candy",
  "pastry",
  "bakery",
  "بانكيك",
  "بان كيك",
  "مكسرات",
  "حليب",
  "شوكولا",
];

function textMatchesKeywords(normalized: string, keywords: string[]): boolean {
  return keywords.some((kw) => normalized.includes(normalizeArabicForMatch(kw)));
}

export function matchesCoffeeText(text: string): boolean {
  const n = normalizeArabicForMatch(text);
  if (!n) return false;
  return textMatchesKeywords(n, COFFEE_KEYWORDS);
}

export function matchesSweetsText(text: string): boolean {
  const n = normalizeArabicForMatch(text);
  if (!n) return false;
  return textMatchesKeywords(n, SWEETS_KEYWORDS);
}

export function matchesCoffeeSweetsText(text: string): boolean {
  return matchesCoffeeText(text) || matchesSweetsText(text);
}

export function productMatchesCoffeeSweets(p: {
  name: string;
  category?: string;
}): boolean {
  const cat = p.category ?? "";
  return (
    matchesCoffeeSweetsText(cat) ||
    matchesCoffeeSweetsText(p.name) ||
    matchesCoffeeSweetsText(`${cat} ${p.name}`)
  );
}

/**
 * Analyse statistique d'un texte, sans IA.
 * Chaque indicateur est converti en "tendance IA" entre 0 et 1,
 * puis combiné en un score sur 100.
 */

export type Tendency = "ia" | "humain" | "neutre";

export type Signal = {
  label: string;
  value: string;
  tendency: Tendency;
  hint: string;
};

export type StatsResult = {
  score: number;
  metrics: {
    words: number;
    sentences: number;
    avgSentenceLength: number;
    burstiness: number;
    lexicalDiversity: number;
    repetition: number;
    markerDensity: number;
    aiMarkers: { phrase: string; count: number }[];
  };
  signals: Signal[];
};

// Tournures très fréquentes dans les textes générés (FR + EN).
const AI_MARKERS = [
  "il est important de noter",
  "il convient de noter",
  "il est essentiel de",
  "il est crucial de",
  "en outre",
  "par ailleurs",
  "de plus,",
  "en conclusion",
  "en résumé",
  "en somme",
  "jouer un rôle clé",
  "joue un rôle clé",
  "joue un rôle crucial",
  "joue un rôle essentiel",
  "un rôle crucial",
  "dans le paysage",
  "à l'ère du numérique",
  "à l’ère du numérique",
  "un véritable",
  "plonger dans",
  "naviguer dans",
  "un large éventail",
  "une myriade",
  "favoriser",
  "permet de garantir",
  "tirer parti",
  "s'avère",
  "s’avère",
  "force est de constater",
  "it is important to note",
  "it's worth noting",
  "furthermore",
  "moreover",
  "in conclusion",
  "in summary",
  "delve",
  "tapestry",
  "landscape",
  "plays a crucial role",
  "a testament to",
  "navigate the",
  "leverage",
  "seamless",
  "foster",
  "in today's fast-paced",
  "ever-evolving",
];

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ0-9«"“(\-–—])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []);
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdDev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Moving-Average Type-Token Ratio : diversité lexicale stable selon la longueur. */
function mattr(words: string[], window = 50) {
  if (words.length === 0) return 0;
  if (words.length <= window) return new Set(words).size / words.length;
  const ratios: number[] = [];
  for (let i = 0; i + window <= words.length; i += 5) {
    ratios.push(new Set(words.slice(i, i + window)).size / window);
  }
  return mean(ratios);
}

function trigramRepetition(words: string[]) {
  if (words.length < 6) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i + 3 <= words.length; i++) {
    const k = words.slice(i, i + 3).join(" ");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let repeated = 0;
  counts.forEach((c) => {
    if (c > 1) repeated += c - 1;
  });
  return repeated / (words.length - 2);
}

function countOccurrences(haystack: string, needle: string) {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

export function analyzeStats(text: string): StatsResult {
  const sentences = splitSentences(text);
  const words = tokenize(text);
  const lengths = sentences.map((s) => tokenize(s).length).filter((n) => n > 0);

  const avg = mean(lengths);
  const burstiness = avg > 0 ? stdDev(lengths) / avg : 0; // coefficient de variation
  const diversity = mattr(words);
  const repetition = trigramRepetition(words);

  const lower = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  const aiMarkers = AI_MARKERS.map((phrase) => ({ phrase, count: countOccurrences(lower, phrase) }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count);
  const markerTotal = aiMarkers.reduce((a, m) => a + m.count, 0);
  const markerDensity = words.length ? (markerTotal / words.length) * 100 : 0;

  // Ponctuation "humaine" : exclamations, questions, points de suspension, parenthèses.
  const informalPunct = (text.match(/[!?…()]|\.\.\./g) ?? []).length;
  const informalDensity = sentences.length ? informalPunct / sentences.length : 0;

  // --- Conversion en tendances IA (0 = humain, 1 = IA) ---
  const aiBurst = clamp((0.6 - burstiness) / 0.35); // phrases de longueur uniforme
  const aiMarker = clamp(markerDensity / 1.5); // ≥ 1,5 tournure / 100 mots = maximum
  const aiLength = avg >= 15 && avg <= 26 ? 1 : avg < 15 ? clamp(1 - (15 - avg) / 8) : clamp(1 - (avg - 26) / 10);
  const aiPunct = clamp(1 - informalDensity / 0.3);
  const aiRepeat = clamp(repetition / 0.05) * 0.5; // signal faible

  let score = 0.35 * aiBurst + 0.3 * aiMarker + 0.15 * aiLength + 0.15 * aiPunct + 0.05 * aiRepeat;

  // Peu de données = on ramène vers 50 (incertitude).
  const confidence = clamp(words.length / 150);
  score = 0.5 + (score - 0.5) * confidence;

  const tendency = (v: number): Tendency => (v >= 0.65 ? "ia" : v <= 0.35 ? "humain" : "neutre");

  const signals: Signal[] = [
    {
      label: "Variation des phrases",
      value: burstiness.toFixed(2),
      tendency: tendency(aiBurst),
      hint: "Les humains alternent phrases courtes et longues ; les IA produisent des longueurs régulières.",
    },
    {
      label: "Tournures typiques d'IA",
      value: `${markerTotal} (${markerDensity.toFixed(2)} / 100 mots)`,
      tendency: tendency(aiMarker),
      hint: "Connecteurs et expressions sur-représentés dans les textes générés.",
    },
    {
      label: "Longueur moyenne des phrases",
      value: `${avg.toFixed(1)} mots`,
      tendency: tendency(aiLength),
      hint: "Les IA tournent souvent autour de 15 à 26 mots par phrase.",
    },
    {
      label: "Ponctuation spontanée",
      value: informalPunct.toString(),
      tendency: tendency(aiPunct),
      hint: "Points d'exclamation, questions, parenthèses : plus rares dans un texte généré.",
    },
    {
      label: "Diversité lexicale",
      value: diversity.toFixed(2),
      tendency: "neutre",
      hint: "Indicateur informatif, peu discriminant seul.",
    },
  ];

  return {
    score: Math.round(score * 100),
    metrics: {
      words: words.length,
      sentences: sentences.length,
      avgSentenceLength: Number(avg.toFixed(1)),
      burstiness: Number(burstiness.toFixed(3)),
      lexicalDiversity: Number(diversity.toFixed(3)),
      repetition: Number(repetition.toFixed(3)),
      markerDensity: Number(markerDensity.toFixed(2)),
      aiMarkers,
    },
    signals,
  };
}

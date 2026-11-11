import { getClient, MODEL, extractText } from "./anthropic";

export const TONES = {
  naturel: "naturel et fluide, comme quelqu'un qui écrit simplement ce qu'il pense",
  academique: "académique mais personnel, comme un étudiant qui argumente avec sa propre voix",
  professionnel: "professionnel et direct, sans jargon creux",
  conversationnel: "conversationnel et détendu, proche de l'oral",
} as const;

export const INTENSITIES = {
  legere: "Modifie le moins possible : remplace seulement les tournures stéréotypées et casse la monotonie du rythme.",
  moyenne: "Réécris librement les phrases tout en gardant le plan et chaque idée.",
  forte: "Réécris entièrement avec tes propres mots ; tu peux réorganiser les phrases à l'intérieur des paragraphes.",
} as const;

export type Tone = keyof typeof TONES;
export type Intensity = keyof typeof INTENSITIES;

function systemPrompt(tone: Tone, intensity: Intensity) {
  return `Tu es un éditeur qui réécrit des textes pour qu'ils sonnent naturels et humains.

Ton visé : ${TONES[tone]}.
Niveau de réécriture : ${INTENSITIES[intensity]}

Règles :
- Garde la langue d'origine du texte.
- Conserve le sens, les faits, les chiffres et les noms. N'invente aucune information, source ou anecdote.
- Varie la longueur des phrases : mélange phrases courtes et longues.
- Supprime les connecteurs stéréotypés (« en outre », « par ailleurs », « il est important de noter », « en conclusion », « furthermore », « moreover »…) et les formules creuses (« jouer un rôle clé », « à l'ère du numérique »…).
- Préfère des verbes concrets et des mots simples ; évite les listes systématiques de trois éléments.
- Pas de conclusion récapitulative si le texte d'origine n'en a pas besoin.
- Garde la structure en paragraphes. Pas de titres, de markdown ni de commentaires.

Renvoie UNIQUEMENT le texte réécrit.`;
}

export async function humanize(text: string, tone: Tone, intensity: Intensity): Promise<string> {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: Math.min(8000, Math.ceil(text.length / 2) + 1000),
    temperature: 1,
    system: systemPrompt(tone, intensity),
    messages: [{ role: "user", content: `<texte>\n${text}\n</texte>` }],
  });

  return extractText(msg)
    .replace(/^\s*<texte>\s*/i, "")
    .replace(/\s*<\/texte>\s*$/i, "")
    .trim();
}

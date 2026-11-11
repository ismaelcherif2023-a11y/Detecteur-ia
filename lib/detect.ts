import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./anthropic";
import { analyzeStats, type StatsResult } from "./stats";

export type LlmPassage = { text: string; reason: string };

export type LlmResult = {
  score: number;
  reasons: string[];
  passages: LlmPassage[];
};

export type DetectResponse = {
  combined: number;
  verdict: string;
  reliability: "faible" | "moyenne" | "bonne";
  stats: StatsResult;
  llm: LlmResult | null;
  llmError: string | null;
};

const SYSTEM = `Tu es un analyste linguistique spécialisé dans la détection de textes générés par des modèles de langage.
Évalue la probabilité que le texte fourni ait été généré (en tout ou partie) par une IA.
Indices à considérer : régularité du rythme, connecteurs stéréotypés, absence d'opinion personnelle ou d'anecdote concrète,
généralités lisses, structure trop symétrique, vocabulaire « corporate », conclusions récapitulatives, absence d'erreurs naturelles.
Sois nuancé : un texte formel écrit par un humain peut ressembler à de l'IA. Ne surestime pas ta certitude.

Rapporte systématiquement ton analyse en appelant l'outil "rapport_detection".`;

const DETECT_TOOL: Anthropic.Tool = {
  name: "rapport_detection",
  description: "Enregistre le résultat de l'analyse de détection d'IA pour le texte fourni.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Probabilité, en pourcentage, que le texte soit généré par une IA.",
      },
      reasons: {
        type: "array",
        items: { type: "string" },
        description: "2 à 5 raisons courtes, en français, justifiant le score.",
      },
      passages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Extrait copié EXACTEMENT du texte d'origine, 5 à 30 mots.",
            },
            reason: { type: "string", description: "Pourquoi ce passage semble généré par IA." },
          },
          required: ["text", "reason"],
        },
        description: "Au plus 6 passages suspects. Tableau vide si le texte semble humain.",
      },
    },
    required: ["score", "reasons", "passages"],
  },
};

export async function llmDetect(text: string): Promise<LlmResult> {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    tools: [DETECT_TOOL],
    tool_choice: { type: "tool", name: DETECT_TOOL.name },
    messages: [{ role: "user", content: `<texte>\n${text}\n</texte>` }],
  });

  const block = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === DETECT_TOOL.name,
  );
  if (!block) throw new Error("Réponse du modèle sans appel d'outil");
  const data = block.input as Partial<LlmResult>;
  const score = Math.round(Math.min(100, Math.max(0, Number(data.score) || 0)));
  const reasons = Array.isArray(data.reasons) ? data.reasons.filter((r) => typeof r === "string").slice(0, 5) : [];
  // On ne garde que les passages réellement présents dans le texte (pour le surlignage).
  const passages = Array.isArray(data.passages)
    ? data.passages
        .filter((p): p is LlmPassage => !!p && typeof p.text === "string" && typeof p.reason === "string")
        .filter((p) => p.text.trim().length > 0 && text.includes(p.text.trim()))
        .map((p) => ({ text: p.text.trim(), reason: p.reason }))
        .slice(0, 6)
    : [];

  return { score, reasons, passages };
}

export function verdictFor(score: number): string {
  if (score >= 80) return "Très probablement généré par IA";
  if (score >= 60) return "Probablement généré par IA";
  if (score >= 40) return "Incertain / texte mixte";
  if (score >= 20) return "Probablement écrit par un humain";
  return "Très probablement écrit par un humain";
}

export async function detect(text: string): Promise<DetectResponse> {
  const stats = analyzeStats(text);

  let llm: LlmResult | null = null;
  let llmError: string | null = null;
  try {
    llm = await llmDetect(text);
  } catch (e) {
    console.error("[detect] analyse IA échouée :", e);
    llmError = "L'analyse par IA est indisponible ; seul le score statistique est affiché.";
  }

  const combined = llm ? Math.round(0.6 * llm.score + 0.4 * stats.score) : stats.score;
  const words = stats.metrics.words;
  const reliability = words < 80 ? "faible" : words < 200 ? "moyenne" : "bonne";

  return { combined, verdict: verdictFor(combined), reliability, stats, llm, llmError };
}

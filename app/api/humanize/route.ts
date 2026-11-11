import { NextRequest, NextResponse } from "next/server";
import { humanize, TONES, INTENSITIES, type Tone, type Intensity } from "@/lib/humanize";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_CHARS = 20;
const MAX_CHARS = 15000;

export async function POST(req: NextRequest) {
  if (!rateLimit(clientIp(req.headers), 10)) {
    return NextResponse.json({ error: "Trop de requêtes, réessaie dans une minute." }, { status: 429 });
  }

  let body: { text?: unknown; tone?: unknown; intensity?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const tone: Tone = typeof body.tone === "string" && body.tone in TONES ? (body.tone as Tone) : "naturel";
  const intensity: Intensity =
    typeof body.intensity === "string" && body.intensity in INTENSITIES ? (body.intensity as Intensity) : "moyenne";

  if (text.length < MIN_CHARS || text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Le texte doit faire entre ${MIN_CHARS} et ${MAX_CHARS} caractères.` },
      { status: 400 },
    );
  }

  try {
    const result = await humanize(text, tone, intensity);
    return NextResponse.json({ text: result });
  } catch (e) {
    console.error("[humanize] échec :", e);
    const message =
      e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")
        ? "Clé API non configurée sur le serveur."
        : "La réécriture a échoué, réessaie.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

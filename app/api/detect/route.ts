import { NextRequest, NextResponse } from "next/server";
import { detect } from "@/lib/detect";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_CHARS = 50;
const MAX_CHARS = 15000;

export async function POST(req: NextRequest) {
  if (!rateLimit(clientIp(req.headers))) {
    return NextResponse.json({ error: "Trop de requêtes, réessaie dans une minute." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text.trim() : "";
  if (text.length < MIN_CHARS) {
    return NextResponse.json({ error: `Le texte doit faire au moins ${MIN_CHARS} caractères.` }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: `Le texte ne doit pas dépasser ${MAX_CHARS} caractères.` }, { status: 400 });
  }

  const result = await detect(text);
  return NextResponse.json(result);
}

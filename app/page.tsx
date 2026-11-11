"use client";

import { useMemo, useState } from "react";
import type { DetectResponse, LlmPassage } from "@/lib/detect";
import type { Tendency } from "@/lib/stats";

const MAX_CHARS = 15000;

const TONE_LABELS: Record<string, string> = {
  naturel: "Naturel",
  academique: "Académique",
  professionnel: "Professionnel",
  conversationnel: "Conversationnel",
};
const INTENSITY_LABELS: Record<string, string> = {
  legere: "Légère (retouches)",
  moyenne: "Moyenne",
  forte: "Forte (réécriture complète)",
};

function tendencyOf(score: number): Tendency {
  return score >= 60 ? "ia" : score < 40 ? "humain" : "neutre";
}

function colorFor(score: number) {
  const t = tendencyOf(score);
  return t === "ia" ? "var(--ai)" : t === "humain" ? "var(--human)" : "var(--mid)";
}

function Gauge({ value }: { value: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  return (
    <div className="gauge" aria-label={`Score IA : ${value} sur 100`}>
      <svg width="116" height="116" viewBox="0 0 116 116">
        <circle cx="58" cy="58" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle
          cx="58"
          cy="58"
          r={r}
          fill="none"
          stroke={colorFor(value)}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="gauge-value">
        <div>
          <strong>{value}%</strong>
          <small>probabilité IA</small>
        </div>
      </div>
    </div>
  );
}

/** Découpe le texte en segments, en surlignant les passages suspects (sans chevauchement). */
function Highlighted({ text, passages }: { text: string; passages: LlmPassage[] }) {
  const segments = useMemo(() => {
    const ranges: { start: number; end: number; reason: string }[] = [];
    for (const p of passages) {
      const start = text.indexOf(p.text);
      if (start === -1) continue;
      const end = start + p.text.length;
      if (ranges.some((r) => start < r.end && end > r.start)) continue;
      ranges.push({ start, end, reason: p.reason });
    }
    ranges.sort((a, b) => a.start - b.start);

    const out: { text: string; reason?: string }[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start > cursor) out.push({ text: text.slice(cursor, r.start) });
      out.push({ text: text.slice(r.start, r.end), reason: r.reason });
      cursor = r.end;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor) });
    return out;
  }, [text, passages]);

  return (
    <div className="highlighted">
      {segments.map((s, i) =>
        s.reason ? (
          <mark key={i} title={s.reason}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </div>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  return data as T;
}

export default function Home() {
  const [text, setText] = useState("");
  const [analyzedText, setAnalyzedText] = useState("");
  const [result, setResult] = useState<DetectResponse | null>(null);

  const [tone, setTone] = useState("naturel");
  const [intensity, setIntensity] = useState("moyenne");
  const [humanized, setHumanized] = useState("");
  const [afterScore, setAfterScore] = useState<number | null>(null);

  const [loading, setLoading] = useState<"detect" | "humanize" | "recheck" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tooLong = text.length > MAX_CHARS;

  async function runDetect() {
    setError(null);
    setLoading("detect");
    try {
      const data = await postJson<DetectResponse>("/api/detect", { text });
      setResult(data);
      setAnalyzedText(text.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function runHumanize() {
    setError(null);
    setLoading("humanize");
    setAfterScore(null);
    try {
      const data = await postJson<{ text: string }>("/api/humanize", { text, tone, intensity });
      setHumanized(data.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function recheck() {
    setError(null);
    setLoading("recheck");
    try {
      const data = await postJson<DetectResponse>("/api/detect", { text: humanized });
      setAfterScore(data.combined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(humanized);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Impossible de copier automatiquement ; sélectionne le texte manuellement.");
    }
  }

  function useHumanized() {
    setText(humanized);
    setHumanized("");
    setResult(null);
    setAfterScore(null);
  }

  const busy = loading !== null;
  const canSubmit = text.trim().length >= 50 && !tooLong && !busy;

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1 className="brand">
            Lucide<span>.</span>
          </h1>
          <p className="tagline">
            Mesurez la probabilité qu&apos;un texte ait été généré par IA, repérez les passages suspects et réécrivez-le
            dans un style plus naturel.
          </p>
        </div>
      </header>

      <div className="grid">
        {/* Colonne gauche : saisie */}
        <section>
          <div className="card">
            <label className="field-label" htmlFor="input">
              Votre texte
            </label>
            <textarea
              id="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Collez ici le texte à analyser (50 caractères minimum, idéalement 150 mots ou plus)…"
            />
            <div className="counter">
              <span>{words} mots</span>
              <span className={tooLong ? "over" : ""}>
                {text.length.toLocaleString("fr-FR")} / {MAX_CHARS.toLocaleString("fr-FR")} caractères
              </span>
            </div>

            <div className="options">
              <div>
                <label className="field-label" htmlFor="tone">
                  Ton de la réécriture
                </label>
                <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                  {Object.entries(TONE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="intensity">
                  Intensité
                </label>
                <select id="intensity" value={intensity} onChange={(e) => setIntensity(e.target.value)}>
                  {Object.entries(INTENSITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="actions">
              <button className="primary" onClick={runDetect} disabled={!canSubmit}>
                {loading === "detect" && <span className="spinner" />}
                Détecter
              </button>
              <button onClick={runHumanize} disabled={!canSubmit}>
                {loading === "humanize" && <span className="spinner" />}
                Humaniser
              </button>
              {text && (
                <button
                  className="ghost"
                  onClick={() => {
                    setText("");
                    setResult(null);
                    setHumanized("");
                    setAfterScore(null);
                  }}
                  disabled={busy}
                >
                  Effacer
                </button>
              )}
            </div>
            {error && <div className="error">{error}</div>}
          </div>

          {humanized && (
            <div className="card">
              <h2>Texte réécrit</h2>
              <div className="output">{humanized}</div>
              <div className="actions">
                <button className="primary" onClick={copy}>
                  {copied ? "Copié ✓" : "Copier"}
                </button>
                <button onClick={recheck} disabled={busy}>
                  {loading === "recheck" && <span className="spinner" />}
                  Analyser le résultat
                </button>
                <button className="ghost" onClick={useHumanized} disabled={busy}>
                  Remplacer le texte d&apos;origine
                </button>
              </div>
              {afterScore !== null && (
                <div className="compare">
                  {result && analyzedText === text.trim() && (
                    <>
                      <span className={`pill ${tendencyOf(result.combined)}`}>Avant : {result.combined}%</span>
                      <span className="arrow">→</span>
                    </>
                  )}
                  <span className={`pill ${tendencyOf(afterScore)}`}>Après : {afterScore}%</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Colonne droite : résultats */}
        <section>
          <div className="card">
            <h2>Analyse</h2>
            {!result ? (
              <p className="empty">
                Lancez une détection pour voir le score, les indicateurs et les passages suspects.
              </p>
            ) : (
              <>
                <div className="score-row">
                  <Gauge value={result.combined} />
                  <div>
                    <p className="verdict">{result.verdict}</p>
                    <div className="sub-scores">
                      <span>
                        Statistiques : <b>{result.stats.score}%</b>
                      </span>
                      {result.llm && (
                        <span>
                          Modèle IA : <b>{result.llm.score}%</b>
                        </span>
                      )}
                      <span>
                        Fiabilité : <b>{result.reliability}</b>
                      </span>
                    </div>
                  </div>
                </div>
                {result.llmError && <p className="notice">{result.llmError}</p>}
                {result.reliability === "faible" && (
                  <p className="notice">Texte court : le résultat est peu fiable. Ajoutez du texte si possible.</p>
                )}

                {result.llm && result.llm.reasons.length > 0 && (
                  <>
                    <p className="section-title">Pourquoi</p>
                    <ul className="reasons">
                      {result.llm.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}

                {result.llm && result.llm.passages.length > 0 && (
                  <>
                    <p className="section-title">Passages suspects (survolez pour l&apos;explication)</p>
                    <Highlighted text={analyzedText} passages={result.llm.passages} />
                  </>
                )}

                <p className="section-title">Indicateurs statistiques</p>
                <ul className="signals">
                  {result.stats.signals.map((s) => (
                    <li key={s.label}>
                      <span className="signal-name">
                        {s.label}{" "}
                        <span className={`pill ${s.tendency}`}>
                          {s.tendency === "ia" ? "IA" : s.tendency === "humain" ? "humain" : "neutre"}
                        </span>
                      </span>
                      <span className="signal-value">{s.value}</span>
                      <span className="signal-hint">{s.hint}</span>
                    </li>
                  ))}
                </ul>

                {result.stats.metrics.aiMarkers.length > 0 && (
                  <>
                    <p className="section-title">Tournures repérées</p>
                    <div className="markers">
                      {result.stats.metrics.aiMarkers.map((m) => (
                        <code key={m.phrase}>
                          {m.phrase}
                          {m.count > 1 ? ` ×${m.count}` : ""}
                        </code>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="disclaimer">
        Aucun détecteur n&apos;est fiable à 100 % : un texte humain formel peut obtenir un score élevé, et inversement.
        Utilisez ce score comme un indice, jamais comme une preuve. La réécriture sert à améliorer le style ; elle ne
        remplace pas les règles de votre école ou de votre employeur sur l&apos;usage de l&apos;IA.
      </footer>
    </main>
  );
}

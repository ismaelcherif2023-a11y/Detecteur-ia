# Lucide — Détecteur et humaniseur de textes IA

Application Next.js qui :

1. **Détecte** la probabilité qu'un texte ait été généré par IA, en combinant :
   - une **analyse statistique** locale (variation de la longueur des phrases, tournures typiques d'IA, longueur moyenne, ponctuation spontanée, diversité lexicale) ;
   - une **analyse par Claude** (score, raisons, passages suspects surlignés dans le texte).
   Score final = 60 % modèle + 40 % statistiques. Si l'API est indisponible, seul le score statistique s'affiche.
2. **Humanise** le texte : réécriture avec choix du ton (naturel, académique, professionnel, conversationnel) et de l'intensité, puis ré-analyse pour comparer le score avant / après.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigne ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Tester le moteur statistique seul (sans clé API) :

```bash
npm run test:stats
```

## Déploiement sur Vercel

1. Pousse le dossier sur GitHub.
2. Importe le dépôt sur vercel.com (framework détecté automatiquement).
3. Dans *Settings → Environment Variables*, ajoute `ANTHROPIC_API_KEY` (et `ANTHROPIC_MODEL` si tu veux changer de modèle).
4. Déploie.

## Structure

```
app/
  page.tsx               Interface (saisie, score, surlignage, réécriture)
  api/detect/route.ts    POST { text } → score combiné + détails
  api/humanize/route.ts  POST { text, tone, intensity } → { text }
lib/
  stats.ts               Moteur statistique (aucune dépendance externe)
  detect.ts              Prompt de détection + combinaison des scores
  humanize.ts            Prompt de réécriture, tons et intensités
  anthropic.ts           Client Anthropic partagé
  rateLimit.ts           Limiteur de requêtes en mémoire
scripts/test-stats.ts    Test rapide du moteur statistique
```

## Pistes d'amélioration

- **Limiteur persistant** : le limiteur actuel est en mémoire (une instance) ; passer à Upstash Redis en production.
- **Comptes et quotas** : authentification (NextAuth / Clerk) + historique des analyses en PostgreSQL via Prisma.
- **Perplexité réelle** : ajouter un petit modèle de langage (ex. GPT-2 via un service Python) pour calculer la perplexité, l'un des meilleurs signaux statistiques.
- **Import de fichiers** : .docx et .pdf.
- **Calibration** : constituer un jeu de textes humains / IA étiquetés et ajuster les poids de `stats.ts`.

## Limites

Aucun détecteur n'est fiable à 100 %. Les textes courts, très formels ou écrits par des non-natifs peuvent être faussement signalés. Le score est un indice, pas une preuve — c'est affiché dans l'interface.

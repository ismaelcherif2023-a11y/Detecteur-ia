import { analyzeStats } from "../lib/stats";

const aiLike = `L'intelligence artificielle joue un rôle clé dans la transformation des entreprises modernes. En outre, elle permet d'automatiser de nombreuses tâches répétitives et d'améliorer la productivité des équipes. Par ailleurs, il est important de noter que l'adoption de ces technologies nécessite une stratégie claire et adaptée. De plus, les entreprises doivent former leurs collaborateurs afin de tirer parti de ces outils innovants. À l'ère du numérique, il est essentiel de rester compétitif sur un marché en constante évolution. Les organisations qui investissent dans l'IA bénéficient d'un avantage concurrentiel significatif et durable. En conclusion, l'intelligence artificielle représente une opportunité majeure pour les entreprises qui souhaitent innover et se développer.`;

const humanLike = `Hier j'ai enfin testé l'outil dont tout le monde parle au boulot. Verdict ? Mitigé. Ça va vite, c'est sûr. Mais la moitié des réponses étaient fausses sur notre code legacy (le module de facturation, évidemment), et j'ai passé plus de temps à corriger qu'à écrire moi-même. Bon. Je vais quand même réessayer la semaine prochaine, peut-être avec des prompts plus précis… Mon chef, lui, est déjà convaincu. Il veut qu'on l'utilise partout d'ici janvier, ce qui me paraît un peu ambitieux vu l'état de nos tests.`;

for (const [name, txt] of [["Texte de type IA", aiLike], ["Texte humain", humanLike]] as const) {
  const r = analyzeStats(txt);
  console.log(`\n=== ${name} : score ${r.score}/100 ===`);
  console.log(`mots=${r.metrics.words} phrases=${r.metrics.sentences} moy=${r.metrics.avgSentenceLength} cv=${r.metrics.burstiness}`);
  for (const s of r.signals) console.log(`- ${s.label}: ${s.value} [${s.tendency}]`);
  console.log("tournures:", r.metrics.aiMarkers.map((m) => m.phrase).join(", ") || "aucune");
}

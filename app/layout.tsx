import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucide — Détecter et humaniser les textes IA",
  description:
    "Analysez la probabilité qu'un texte ait été généré par IA, voyez les passages suspects et réécrivez-le dans un style naturel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

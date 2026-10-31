import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyFlow — Seu caminho para aprender melhor",
  description:
    "Organize seus estudos, descubra seu próximo passo e construa uma rotina de aprendizado no seu ritmo.",
  applicationName: "StudyFlow",
  openGraph: {
    title: "StudyFlow — Seu caminho para aprender melhor",
    description:
      "Um lugar para organizar seus estudos, revisar assuntos importantes e acompanhar sua evolução.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

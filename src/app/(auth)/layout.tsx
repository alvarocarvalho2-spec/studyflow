import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Brand />
        <div className="auth-topbar-actions">
          <ThemeToggle />
          <Link href="/">Voltar ao início</Link>
        </div>
      </header>
      <main className="auth-main">
        <div className="auth-decoration" aria-hidden="true">
          <span className="auth-decoration-dot dot-one" />
          <span className="auth-decoration-dot dot-two" />
          <span className="auth-decoration-ring" />
        </div>
        {children}
      </main>
      <footer className="auth-footer">StudyFlow · Seu caminho para aprender melhor.</footer>
    </div>
  );
}

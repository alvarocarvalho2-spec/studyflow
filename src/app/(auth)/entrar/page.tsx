import Link from "next/link";
import { AuthQueryNotice } from "@/components/auth/auth-query-notice";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Entrar — StudyFlow" };

export default function LoginPage() {
  return (
    <section className="auth-card">
      <span className="auth-kicker">SEU ESPAÇO DE ESTUDOS</span>
      <h1>Que bom ter você de volta.</h1>
      <p className="auth-intro">Entre para continuar de onde parou.</p>
      <AuthQueryNotice />
      <LoginForm />
      <p className="auth-bottom-note">Ainda conhecendo a plataforma? <Link href="/#produto">Veja como funciona</Link></p>
    </section>
  );
}

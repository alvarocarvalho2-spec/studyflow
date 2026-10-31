import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Criar conta — StudyFlow" };

export default function SignupPage() {
  return (
    <section className="auth-card">
      <span className="auth-kicker">COMECE NO SEU RITMO</span>
      <h1>Seu próximo passo começa aqui.</h1>
      <p className="auth-intro">Crie seu espaço gratuito para organizar os estudos.</p>
      <SignupForm />
      <p className="auth-bottom-note">Ao criar uma conta, você poderá acessar seus estudos neste dispositivo e em outros.</p>
      <Link className="auth-back-link" href="/#inicio">Voltar para a página inicial</Link>
    </section>
  );
}

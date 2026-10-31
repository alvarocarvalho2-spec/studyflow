"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthActionState } from "@/app/(auth)/actions";

const initialState: AuthActionState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initialState);
  const emailError = state.fieldErrors?.email?.[0];
  const passwordError = state.fieldErrors?.password?.[0];

  if (state.success) {
    return (
      <div className="signup-success" role="status">
        <span className="success-mark">✓</span>
        <p>{state.success}</p>
        <Link className="button button-outline auth-submit" href="/entrar">Ir para entrar</Link>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="auth-form">
        <label className="auth-field" htmlFor="signup-email">
          <span>E-mail</span>
          <input aria-describedby={emailError ? "signup-email-error" : undefined} aria-invalid={Boolean(emailError)} autoComplete="email" id="signup-email" name="email" placeholder="voce@exemplo.com" required type="email" />
          {emailError && <small className="field-error" id="signup-email-error">{emailError}</small>}
        </label>
        <label className="auth-field" htmlFor="signup-password">
          <span>Crie uma senha</span>
          <input aria-describedby={passwordError ? "signup-password-error" : undefined} aria-invalid={Boolean(passwordError)} autoComplete="new-password" id="signup-password" maxLength={128} minLength={10} name="password" placeholder="Pelo menos 10 caracteres" required type="password" />
          {passwordError && <small className="field-error" id="signup-password-error">{passwordError}</small>}
        </label>
        <p className="auth-privacy-note">Usamos apenas seu e-mail para criar o acesso. Não pedimos data de nascimento nem dados de pagamento.</p>
        {state.message && <p className="auth-message error-message" role="alert">{state.message}</p>}
        <button className="button button-primary auth-submit" disabled={pending} type="submit">
          {pending ? "Criando sua conta…" : "Criar conta gratuita"}
        </button>
      </form>
      <p className="auth-switch">Já tem uma conta? <Link href="/entrar">Entre aqui</Link></p>
    </>
  );
}

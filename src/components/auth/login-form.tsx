"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type AuthActionState } from "@/app/(auth)/actions";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";
  const emailError = state.fieldErrors?.email?.[0];
  const passwordError = state.fieldErrors?.password?.[0];

  return (
    <>
      <form action={action} className="auth-form">
        <input name="redirect_to" type="hidden" value={redirectTo} />
        <label className="auth-field" htmlFor="login-email">
          <span>E-mail</span>
          <input aria-describedby={emailError ? "login-email-error" : undefined} aria-invalid={Boolean(emailError)} autoComplete="email" id="login-email" name="email" placeholder="voce@exemplo.com" required type="email" />
          {emailError && <small className="field-error" id="login-email-error">{emailError}</small>}
        </label>
        <label className="auth-field" htmlFor="login-password">
          <span>Senha</span>
          <input aria-describedby={passwordError ? "login-password-error" : undefined} aria-invalid={Boolean(passwordError)} autoComplete="current-password" id="login-password" name="password" placeholder="Sua senha" required type="password" />
          {passwordError && <small className="field-error" id="login-password-error">{passwordError}</small>}
        </label>
        {state.message && <p className="auth-message error-message" role="alert">{state.message}</p>}
        <button className="button button-primary auth-submit" disabled={pending} type="submit">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="auth-switch">Ainda não tem uma conta? <Link href="/cadastro">Crie sua conta gratuita</Link></p>
    </>
  );
}

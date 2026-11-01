"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  message?: string;
  success?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(320, "E-mail muito longo.");
const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(128, "A senha deve ter até 128 caracteres."),
});
const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(10, "Use pelo menos 10 caracteres.").max(128, "A senha deve ter até 128 caracteres."),
});

function parseCredentials(formData: FormData, schema: typeof signInSchema | typeof signUpSchema) {
  return schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

function getSafeRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) {
    return null;
  }

  return value;
}

export async function signIn(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = parseCredentials(formData, signInSchema);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let errorMessage: string | undefined;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    errorMessage = error?.message;
  } catch {
    return { message: "O serviço de autenticação está indisponível no momento." };
  }

  if (errorMessage) {
    return { message: "Não foi possível entrar. Confira o e-mail e a senha e tente novamente." };
  }

  redirect(getSafeRedirectPath(formData.get("redirect_to")) ?? "/dashboard");
}

export async function signUp(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = parseCredentials(formData, signUpSchema);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    return { message: "A URL do site ainda não está configurada para confirmar o cadastro." };
  }

  let emailRedirectTo: string;
  try {
    const siteOrigin = new URL(siteUrl);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(siteOrigin.hostname);
    if (
      !siteOrigin.username && !siteOrigin.password
      && siteOrigin.protocol !== "https:"
      && !(process.env.NODE_ENV !== "production" && siteOrigin.protocol === "http:" && isLoopback)
    ) {
      throw new Error("The production site URL must use HTTPS.");
    }
    emailRedirectTo = new URL("/auth/callback", siteOrigin).toString();
  } catch {
    return { message: "A URL do site está inválida. Corrija NEXT_PUBLIC_SITE_URL no .env.local e reinicie o servidor." };
  }

  let failed = false;
  let signupErrorCode: string | undefined;
  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo },
    });
    failed = Boolean(error);
    signupErrorCode = error?.code;
    hasSession = Boolean(data.session);
  } catch {
    return { message: "O serviço de autenticação está indisponível no momento." };
  }

  if (failed) {
    if (signupErrorCode === "email_address_invalid") {
      return { message: "Este e-mail foi recusado pelo Supabase. Confira se o endereço está completo e correto." };
    }
    if (signupErrorCode === "over_email_send_rate_limit") {
      return { message: "O limite de e-mails de confirmação foi atingido. Aguarde antes de tentar novamente." };
    }
    if (signupErrorCode === "email_address_not_authorized") {
      return { message: "O envio de teste do Supabase só permite e-mails da equipe do projeto. Configure um SMTP próprio para aceitar outros endereços." };
    }
    if (signupErrorCode === "redirect_to_not_allowed") {
      return { message: "A URL de confirmação não está permitida no Supabase. Adicione a URL /auth/callback em Authentication > URL Configuration." };
    }
    if (signupErrorCode === "user_already_exists") {
      return { message: "Este e-mail já possui uma conta. Tente entrar em vez de criar outro cadastro." };
    }
    return { message: "Não foi possível concluir o cadastro. Confira os dados e tente novamente." };
  }
  if (hasSession) {
    redirect("/dashboard");
  }

  return { success: "Cadastro recebido. Confira seu e-mail para confirmar a conta e entrar." };
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } finally {
    redirect("/");
  }
}

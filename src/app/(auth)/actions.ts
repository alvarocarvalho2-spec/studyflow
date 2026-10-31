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

  redirect("/dashboard");
}

export async function signUp(_previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = parseCredentials(formData, signUpSchema);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return { message: "A URL do site ainda não está configurada para confirmar o cadastro." };
  }

  let failed = false;
  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: new URL("/auth/callback", siteUrl).toString() },
    });
    failed = Boolean(error);
    hasSession = Boolean(data.session);
  } catch {
    return { message: "O serviço de autenticação está indisponível no momento." };
  }

  if (failed) {
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

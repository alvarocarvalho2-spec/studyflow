"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import type { Tables } from "@/lib/supabase/database.types";

export type ActiveStudySession = Pick<
  Tables<"study_sessions">,
  "id" | "topic_id" | "planned_minutes" | "started_at"
>;

export type FocusSessionActionResult = {
  success: boolean;
  message: string;
  session?: ActiveStudySession;
  durationSeconds?: number;
};

const startSessionSchema = z.object({
  topicId: z.string().uuid().nullable(),
  plannedMinutes: z.union([z.literal(15), z.literal(25), z.literal(45)]),
});

const sessionIdSchema = z.string().uuid();

export async function startStudySessionAction(input: unknown): Promise<FocusSessionActionResult> {
  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Escolha um tempo válido para iniciar o foco." };
  }

  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("study_sessions")
    .insert({
      topic_id: parsed.data.topicId,
      planned_minutes: parsed.data.plannedMinutes,
    })
    .select("id,topic_id,planned_minutes,started_at")
    .maybeSingle();

  if (error || !data) {
    const message = error?.code === "23505"
      ? "Você já tem uma sessão de foco em andamento."
      : error?.code === "23503"
        ? "Esse assunto não está mais disponível. Atualize a página e tente novamente."
        : "Não foi possível iniciar o foco. Tente novamente.";
    return { success: false, message };
  }

  revalidatePath("/dashboard");
  return { success: true, message: "Sessão iniciada. Bom foco!", session: data };
}

export async function finishStudySessionAction(sessionId: string): Promise<FocusSessionActionResult> {
  const parsedId = sessionIdSchema.safeParse(sessionId);
  if (!parsedId.success) {
    return { success: false, message: "Esta sessão de foco não é válida." };
  }

  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("study_sessions")
    .update({ status: "completed" })
    .eq("id", parsedId.data)
    .eq("status", "active")
    .select("duration_seconds")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      message: "Não foi possível salvar a sessão. Se ela já terminou, atualize a página.",
    };
  }

  revalidatePath("/dashboard");
  return {
    success: true,
    message: "Sessão salva no seu histórico de foco.",
    durationSeconds: data.duration_seconds,
  };
}

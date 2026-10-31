"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { loadPlanAccessForPlan } from "@/lib/plans/access";

export type SubjectActionState = {
  kind?: "success" | "error";
  message?: string;
};

const subjectColors = ["violet", "blue", "teal", "amber", "rose", "slate"] as const;

const subjectSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(subjectColors),
});

const topicSchema = z.object({
  name: z.string().trim().min(1).max(100),
  difficulty: z.coerce.number().int().min(1).max(5),
});

function duplicateMessage(code: string | undefined) {
  return code === "23505" ? "Já existe um item com esse nome." : undefined;
}

function mutationError(code: string | undefined, message: string | undefined, fallback: string) {
  if (code === "P0001" && message?.includes("subject_limit_reached")) {
    return "Você atingiu o limite de matérias do seu plano atual.";
  }
  return duplicateMessage(code) ?? fallback;
}

async function loadSubjectLimit(userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) return { limit: null, error: true };

  const access = await loadPlanAccessForPlan(supabase, profile.plan);
  if (!access) return { limit: null, error: true };
  return { limit: access.limits.max_subjects, error: false };
}

export async function createSubjectAction(
  _previousState: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const parsed = subjectSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });

  if (!parsed.success) {
    return { kind: "error", message: "Informe um nome válido e escolha uma cor." };
  }

  const user = await requireUser();
  const { limit, error: limitError } = await loadSubjectLimit(user.id, user.supabase);
  if (limitError || limit === null) {
    return { kind: "error", message: "Não foi possível carregar os limites da conta. Tente novamente." };
  }

  const { count, error: countError } = await user.supabase
    .from("subjects")
    .select("id", { count: "exact", head: true });

  if (countError) {
    return { kind: "error", message: "Não foi possível verificar as matérias da conta. Tente novamente." };
  }
  if ((count ?? 0) >= limit) {
    return { kind: "error", message: `Seu plano permite até ${limit} matérias.` };
  }

  const { error } = await user.supabase.from("subjects").insert(parsed.data);
  if (error) {
    return {
      kind: "error",
      message: mutationError(error.code, error.message, "Não foi possível criar a matéria. Tente novamente."),
    };
  }

  revalidatePath("/dashboard");
  return { kind: "success", message: "Matéria adicionada." };
}

export async function updateSubjectAction(
  subjectId: string,
  _previousState: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const parsed = subjectSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) return { kind: "error", message: "Informe um nome válido e escolha uma cor." };

  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("subjects")
    .update(parsed.data)
    .eq("id", subjectId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      kind: "error",
      message: mutationError(error.code, error.message, "Não foi possível atualizar a matéria. Tente novamente."),
    };
  }
  if (!data) return { kind: "error", message: "Matéria não encontrada." };

  revalidatePath("/dashboard");
  return { kind: "success", message: "Matéria atualizada." };
}

export async function deleteSubjectAction(
  subjectId: string,
  _previousState: SubjectActionState,
  _formData: FormData,
): Promise<SubjectActionState> {
  void _previousState;
  void _formData;
  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { kind: "error", message: "Não foi possível excluir a matéria. Tente novamente." };
  }
  if (!data) return { kind: "error", message: "Matéria não encontrada." };

  revalidatePath("/dashboard");
  return { kind: "success", message: "Matéria e assuntos excluídos." };
}

export async function createTopicAction(
  subjectId: string,
  _previousState: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const parsed = topicSchema.safeParse({
    name: formData.get("name"),
    difficulty: formData.get("difficulty"),
  });
  if (!parsed.success) return { kind: "error", message: "Informe o nome e o nível de dificuldade do assunto." };

  const user = await requireUser();
  const { error } = await user.supabase.from("topics").insert({
    subject_id: subjectId,
    name: parsed.data.name,
    difficulty: parsed.data.difficulty,
  });

  if (error) {
    return {
      kind: "error",
      message: mutationError(error.code, error.message, "Não foi possível adicionar o assunto. Confira a matéria e tente novamente."),
    };
  }

  revalidatePath("/dashboard");
  return { kind: "success", message: "Assunto adicionado." };
}

export async function updateTopicAction(
  topicId: string,
  _previousState: SubjectActionState,
  formData: FormData,
): Promise<SubjectActionState> {
  const parsed = topicSchema.safeParse({
    name: formData.get("name"),
    difficulty: formData.get("difficulty"),
  });
  if (!parsed.success) return { kind: "error", message: "Informe o nome e o nível de dificuldade do assunto." };

  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("topics")
    .update(parsed.data)
    .eq("id", topicId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      kind: "error",
      message: mutationError(error.code, error.message, "Não foi possível atualizar o assunto. Tente novamente."),
    };
  }
  if (!data) return { kind: "error", message: "Assunto não encontrado." };

  revalidatePath("/dashboard");
  return { kind: "success", message: "Assunto atualizado." };
}

export async function deleteTopicAction(
  topicId: string,
  _previousState: SubjectActionState,
  _formData: FormData,
): Promise<SubjectActionState> {
  void _previousState;
  void _formData;
  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("topics")
    .delete()
    .eq("id", topicId)
    .select("id")
    .maybeSingle();

  if (error) return { kind: "error", message: "Não foi possível excluir o assunto. Tente novamente." };
  if (!data) return { kind: "error", message: "Assunto não encontrado." };

  revalidatePath("/dashboard");
  return { kind: "success", message: "Assunto excluído." };
}

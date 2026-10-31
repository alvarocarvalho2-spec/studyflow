"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { hasPlanFeature, loadUserPlanAccess } from "@/lib/plans/access";
import { generateSmartPlan, getDateInTimezone } from "@/lib/smartplan/engine";
import type { Json } from "@/lib/supabase/database.types";

export type SmartPlanActionState = {
  kind?: "success" | "error";
  message?: string;
};

const availabilitySchema = z.object({
  availableDays: z.array(z.number().int().min(1).max(7)).max(7)
    .refine((days) => new Set(days).size === days.length, "Dias repetidos."),
  dailyMinutes: z.number().int().min(5).max(720),
});
const goalSchema = z.object({
  kind: z.enum(["exam", "mastery", "custom"]),
  title: z.string().trim().min(1).max(120),
  topicId: z.string().uuid().nullable(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).refine((value) => !value.targetDate || isIsoDate(value.targetDate), {
  message: "Data inválida.",
});

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function isIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function errorState(message: string): SmartPlanActionState {
  return { kind: "error", message };
}

async function checkSmartPlanAccess(userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { access, error } = await loadUserPlanAccess(supabase, userId);
  return {
    allowed: !error && hasPlanFeature(access, "smart_plan"),
    error,
  };
}

function smartPlanAccessError(error: boolean) {
  return error
    ? "Não foi possível verificar o plano da conta. Tente novamente."
    : "O SmartPlan é um recurso Pro e ainda não está disponível para compra.";
}

function revalidateSmartPlan() {
  revalidatePath("/plano");
  revalidatePath("/dashboard");
}

export async function saveAvailabilityAction(
  _previousState: SmartPlanActionState,
  formData: FormData,
): Promise<SmartPlanActionState> {
  const dayValues = formData.getAll("available_days").filter((value): value is string => typeof value === "string");
  const parsed = availabilitySchema.safeParse({
    availableDays: dayValues.map(Number),
    dailyMinutes: Number(formString(formData.get("daily_available_minutes"))),
  });
  if (!parsed.success) return errorState("Confira os dias e o tempo disponível por dia.");

  const user = await requireUser();
  const access = await checkSmartPlanAccess(user.id, user.supabase);
  if (!access.allowed) return errorState(smartPlanAccessError(access.error));
  const { data, error } = await user.supabase
    .from("user_preferences")
    .update({
      available_days: parsed.data.availableDays,
      daily_available_minutes: parsed.data.dailyMinutes,
    })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();

  if (error || !data) return errorState("Não foi possível salvar sua disponibilidade. Tente novamente.");
  revalidateSmartPlan();
  return { kind: "success", message: "Disponibilidade atualizada." };
}

export async function createStudyGoalAction(
  _previousState: SmartPlanActionState,
  formData: FormData,
): Promise<SmartPlanActionState> {
  const topicValue = formString(formData.get("topic_id"));
  const dateValue = formString(formData.get("target_date"));
  const parsed = goalSchema.safeParse({
    kind: formString(formData.get("kind")),
    title: formString(formData.get("title")),
    topicId: topicValue ? topicValue : null,
    targetDate: dateValue ? dateValue : null,
  });
  if (!parsed.success) return errorState("Revise o nome, o assunto e a data da meta.");

  const user = await requireUser();
  const access = await checkSmartPlanAccess(user.id, user.supabase);
  if (!access.allowed) return errorState(smartPlanAccessError(access.error));
  const { error } = await user.supabase.from("study_goals").insert({
    kind: parsed.data.kind,
    title: parsed.data.title,
    topic_id: parsed.data.topicId,
    target_date: parsed.data.targetDate,
  });
  if (error) {
    return errorState(error.code === "23503"
      ? "O assunto selecionado não está mais disponível."
      : "Não foi possível criar a meta. Tente novamente.");
  }

  revalidateSmartPlan();
  return { kind: "success", message: "Meta adicionada ao seu planejamento." };
}

export async function completeStudyGoalAction(
  goalId: string,
  _previousState: SmartPlanActionState,
  _formData: FormData,
): Promise<SmartPlanActionState> {
  void _previousState;
  void _formData;
  const user = await requireUser();
  const access = await checkSmartPlanAccess(user.id, user.supabase);
  if (!access.allowed) return errorState(smartPlanAccessError(access.error));
  const { data, error } = await user.supabase
    .from("study_goals")
    .update({ status: "completed" })
    .eq("id", goalId)
    .select("id")
    .maybeSingle();
  if (error || !data) return errorState("Não foi possível concluir esta meta.");
  revalidateSmartPlan();
  return { kind: "success", message: "Meta concluída." };
}

export async function deleteStudyGoalAction(
  goalId: string,
  _previousState: SmartPlanActionState,
  _formData: FormData,
): Promise<SmartPlanActionState> {
  void _previousState;
  void _formData;
  const user = await requireUser();
  const access = await checkSmartPlanAccess(user.id, user.supabase);
  if (!access.allowed) return errorState(smartPlanAccessError(access.error));
  const { data, error } = await user.supabase
    .from("study_goals")
    .delete()
    .eq("id", goalId)
    .select("id")
    .maybeSingle();
  if (error || !data) return errorState("Não foi possível remover esta meta.");
  revalidateSmartPlan();
  return { kind: "success", message: "Meta removida." };
}

export async function completePlannedTaskAction(
  taskId: string,
  _previousState: SmartPlanActionState,
  _formData: FormData,
): Promise<SmartPlanActionState> {
  void _previousState;
  void _formData;
  const user = await requireUser();
  const access = await checkSmartPlanAccess(user.id, user.supabase);
  if (!access.allowed) return errorState(smartPlanAccessError(access.error));
  const { data, error } = await user.supabase
    .from("planned_tasks")
    .update({ status: "completed" })
    .eq("id", taskId)
    .select("id")
    .maybeSingle();
  if (error || !data) return errorState("Não foi possível concluir esta tarefa.");
  revalidateSmartPlan();
  return { kind: "success", message: "Tarefa concluída." };
}

export async function generateStudyPlanAction(
  _previousState: SmartPlanActionState,
  _formData: FormData,
): Promise<SmartPlanActionState> {
  void _previousState;
  void _formData;
  const user = await requireUser();
  const access = await checkSmartPlanAccess(user.id, user.supabase);
  if (!access.allowed) return errorState(smartPlanAccessError(access.error));
  const [preferencesResult, topicsResult, subjectsResult, goalsResult, cardsResult, sessionsResult, activePlanResult] = await Promise.all([
    user.supabase.from("user_preferences").select("available_days,daily_available_minutes,timezone").eq("user_id", user.id).maybeSingle(),
    user.supabase.from("topics").select("id,name,subject_id,difficulty").order("name", { ascending: true }),
    user.supabase.from("subjects").select("id,name"),
    user.supabase.from("study_goals").select("id,kind,title,target_date,topic_id").eq("status", "active").order("target_date", { ascending: true, nullsFirst: false }),
    user.supabase.from("flashcards").select("topic_id,next_review_at,last_reviewed_at"),
    user.supabase.from("study_sessions").select("topic_id,finished_at").eq("status", "completed").gte("finished_at", new Date(Date.now() - 90 * 86_400_000).toISOString()),
    user.supabase.from("study_plans").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);

  if (
    preferencesResult.error || !preferencesResult.data || topicsResult.error || subjectsResult.error
    || goalsResult.error || cardsResult.error || sessionsResult.error || activePlanResult.error
  ) {
    return errorState("Não foi possível carregar os dados para gerar o plano. Atualize a página e tente novamente.");
  }
  if (topicsResult.data.length === 0) return errorState("Adicione pelo menos um assunto antes de gerar seu plano.");

  const now = new Date();
  const today = getDateInTimezone(now, preferencesResult.data.timezone);
  const previousTasksResult = activePlanResult.data
    ? await user.supabase.from("planned_tasks").select("topic_id,task_date").eq("user_id", user.id).eq("study_plan_id", activePlanResult.data.id).eq("status", "scheduled")
    : { data: [], error: null };
  if (previousTasksResult.error) return errorState("Não foi possível carregar as tarefas pendentes para redistribuí-las.");

  const subjectNames = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
  const plan = generateSmartPlan({
    today,
    now: now.toISOString(),
    availableDays: preferencesResult.data.available_days,
    dailyMinutes: preferencesResult.data.daily_available_minutes,
    topics: topicsResult.data.map((topic) => ({
      id: topic.id,
      name: topic.name,
      difficulty: topic.difficulty,
      subjectName: subjectNames.get(topic.subject_id) ?? "Matéria",
    })),
    goals: (goalsResult.data ?? []).map((goal) => ({
      id: goal.id,
      kind: goal.kind,
      title: goal.title,
      targetDate: goal.target_date,
      topicId: goal.topic_id,
    })),
    cards: (cardsResult.data ?? []).map((card) => ({
      topicId: card.topic_id,
      nextReviewAt: card.next_review_at,
      lastReviewedAt: card.last_reviewed_at,
    })),
    sessions: (sessionsResult.data ?? []).flatMap((session) => session.finished_at
      ? [{ topicId: session.topic_id, finishedAt: session.finished_at }]
      : []),
    pendingTasks: (previousTasksResult.data ?? []).map((task) => ({ topicId: task.topic_id, taskDate: task.task_date })),
  });

  const { error } = await user.supabase.rpc("save_study_plan", {
    p_start_date: plan.startDate,
    p_end_date: plan.endDate,
    p_summary: plan.summary as unknown as Json,
    p_tasks: plan.tasks as unknown as Json,
  });
  if (error) {
    return errorState(error.code === "23505"
      ? "O plano foi atualizado em outra solicitação. Recarregue a página."
      : "Não foi possível salvar o plano gerado. Tente novamente.");
  }

  revalidateSmartPlan();
  return {
    kind: "success",
    message: plan.tasks.length > 0
      ? `Plano de 7 dias criado com ${plan.tasks.length} tarefas.`
      : "Plano criado. Ajuste seus dias ou adicione assuntos para preencher a agenda.",
  };
}

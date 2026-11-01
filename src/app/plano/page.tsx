import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen, CalendarDays, ClipboardList, CreditCard, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { SmartPlanWorkspace, type PlanGoal, type PlanTaskView, type PlanTopic } from "@/components/smartplan/smartplan-workspace";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/auth/require-user";
import { getDateInTimezone } from "@/lib/smartplan/engine";
import { hasPlanFeature, loadUserPlanAccess } from "@/lib/plans/access";

export const metadata = { title: "Meu plano de estudos — StudyFlow" };

async function SmartPlanAccount() {
  await connection();
  const user = await requireUser();
  const planAccess = await loadUserPlanAccess(user.supabase, user.id);
  if (planAccess.error) {
    return <SmartPlanNotice title="Não foi possível verificar seu plano" description="Atualize a página. Se o problema continuar, tente novamente mais tarde." />;
  }
  if (!hasPlanFeature(planAccess.access, "smart_plan")) {
    return <SmartPlanNotice title="O SmartPlan faz parte do plano Pro" description="O cronograma adaptativo, as metas e a agenda personalizada estão sendo preparados. O Pro ainda não está disponível para compra." />;
  }
  const [preferencesResult, subjectsResult, topicsResult, goalsResult, planResult] = await Promise.all([
    user.supabase
      .from("user_preferences")
      .select("available_days,daily_available_minutes,timezone")
      .eq("user_id", user.id)
      .maybeSingle(),
    user.supabase.from("subjects").select("id,name"),
    user.supabase.from("topics").select("id,name,subject_id").order("name", { ascending: true }),
    user.supabase
      .from("study_goals")
      .select("id,kind,title,target_date,topic_id,status,completed_at")
      .order("created_at", { ascending: false }),
    user.supabase.from("study_plans").select("id,start_date,end_date,generated_at,summary").eq("user_id", user.id).eq("status", "active").maybeSingle(),
  ]);

  const tasksResult = planResult.data
    ? await user.supabase
        .from("planned_tasks")
        .select("id,topic_id,goal_id,task_date,position,task_type,title,duration_minutes,priority_score,recommendation_reason,status,completed_at")
        .eq("user_id", user.id)
        .eq("study_plan_id", planResult.data.id)
        .order("task_date", { ascending: true })
        .order("position", { ascending: true })
    : { data: [], error: null };

  const timezone = preferencesResult.data?.timezone ?? "America/Sao_Paulo";
  const today = getDateInTimezone(new Date(), timezone);
  const subjectNames = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
  const topicById = new Map((topicsResult.data ?? []).map((topic) => [topic.id, topic]));
  const goalById = new Map((goalsResult.data ?? []).map((goal) => [goal.id, goal]));
  const topics: PlanTopic[] = (topicsResult.data ?? []).map((topic) => ({
    id: topic.id,
    name: topic.name,
    subjectName: subjectNames.get(topic.subject_id) ?? "Matéria",
  }));
  const goals: PlanGoal[] = (goalsResult.data ?? []).map((goal) => ({
    ...goal,
    topicName: goal.topic_id ? topicById.get(goal.topic_id)?.name ?? null : null,
  }));
  const tasks: PlanTaskView[] = (tasksResult.data ?? []).map((task) => {
    const topic = topicById.get(task.topic_id);
    return {
      ...task,
      topicName: topic?.name ?? "Assunto removido",
      subjectName: topic ? subjectNames.get(topic.subject_id) ?? "Matéria" : "Matéria",
      goalTitle: task.goal_id ? goalById.get(task.goal_id)?.title ?? null : null,
    };
  });
  const planSummary = planResult.data?.summary;
  const plan = planResult.data ? {
    startDate: planResult.data.start_date,
    endDate: planResult.data.end_date,
    generatedAt: planResult.data.generated_at,
    totalTasks: typeof planSummary === "object" && planSummary && "totalTasks" in planSummary && typeof planSummary.totalTasks === "number"
      ? planSummary.totalTasks
      : tasks.length,
    totalMinutes: typeof planSummary === "object" && planSummary && "totalMinutes" in planSummary && typeof planSummary.totalMinutes === "number"
      ? planSummary.totalMinutes
      : tasks.reduce((total, task) => total + task.duration_minutes, 0),
    tasks,
  } : null;

  return (
    <SmartPlanWorkspace
      availableDays={preferencesResult.data?.available_days ?? [1, 2, 3, 4, 5]}
      dailyMinutes={preferencesResult.data?.daily_available_minutes ?? 60}
      goals={goals}
      loadError={Boolean(
        preferencesResult.error || subjectsResult.error || topicsResult.error
          || goalsResult.error || planResult.error || tasksResult.error,
      )}
      plan={plan}
      today={today}
      timezone={timezone}
      topics={topics}
    />
  );
}

function SmartPlanNotice({ title, description }: { title: string; description: string }) {
  return (
    <section className="smartplan-access-notice" aria-labelledby="smartplan-access-title">
      <span className="smartplan-access-icon"><CalendarDays aria-hidden="true" size={23} /></span>
      <span className="auth-kicker">RECURSO DO STUDYFLOW PRO</span>
      <h1 id="smartplan-access-title">{title}</h1>
      <p>{description}</p>
      <Link className="button button-primary" href="/assinatura"><CreditCard aria-hidden="true" size={15} /> Ver planos e limites</Link>
    </section>
  );
}

function LoadingSmartPlan() {
  return <div aria-live="polite" aria-busy="true" className="dashboard-loading">Montando seu plano de estudos…</div>;
}

export default function SmartPlanPage() {
  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <nav aria-label="Navegação do espaço de estudos" className="workspace-header-left">
          <Brand href="/dashboard" />
          <Link className="workspace-nav-link" href="/dashboard"><BookOpen aria-hidden="true" size={15} /> Matérias</Link>
          <Link className="workspace-nav-link" href="/flashcards"><BookOpen aria-hidden="true" size={15} /> Flashcards</Link>
          <Link className="workspace-nav-link" href="/quizzes"><ClipboardList aria-hidden="true" size={15} /> Simulados</Link>
          <Link className="workspace-nav-link" href="/assinatura"><CreditCard aria-hidden="true" size={15} /> Planos</Link>
          <span aria-current="page" className="workspace-nav-link is-active"><CalendarDays aria-hidden="true" size={15} /> Plano</span>
        </nav>
        <div className="workspace-header-actions">
          <ThemeToggle />
          <form action={signOut}>
            <button className="workspace-logout" type="submit"><LogOut aria-hidden="true" size={15} /> Sair</button>
          </form>
        </div>
      </header>
      <main className="smartplan-page-main">
        <Suspense fallback={<LoadingSmartPlan />}>
          <SmartPlanAccount />
        </Suspense>
      </main>
    </div>
  );
}

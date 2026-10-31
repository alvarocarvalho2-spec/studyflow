import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Activity, BookOpen, BookOpenCheck, CalendarDays, ClipboardList, Clock3, CreditCard, LogOut, Trophy } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Brand } from "@/components/brand";
import { FocusTimer } from "@/components/dashboard/focus-timer";
import { SubjectManager, type SubjectWithTopics } from "@/components/subjects/subject-manager";
import { requireUser } from "@/lib/auth/require-user";
import { loadPlanAccessForPlan } from "@/lib/plans/access";
import type { ReactNode } from "react";

export const metadata = { title: "Seu espaço — StudyFlow" };

async function AccountOverview() {
  await connection();
  const user = await requireUser();
  const now = new Date();
  const [
    profileResult,
    preferencesResult,
    subjectsResult,
    topicsResult,
    dueReviewsResult,
    flashcardCountResult,
    quizCountResult,
    attemptCountResult,
    latestAttemptResult,
    weeklySummaryResult,
    activeSessionResult,
    latestSessionResult,
  ] = await Promise.all([
    user.supabase.from("profiles").select("display_name,plan").eq("id", user.id).maybeSingle(),
    user.supabase.from("user_preferences").select("timezone").eq("user_id", user.id).maybeSingle(),
    user.supabase.from("subjects").select("id,name,color,created_at").order("created_at", { ascending: true }),
    user.supabase.from("topics").select("id,subject_id,name,difficulty").order("created_at", { ascending: true }),
    user.supabase.from("flashcards").select("id", { count: "exact", head: true }).lte("next_review_at", now.toISOString()),
    user.supabase.from("flashcards").select("id", { count: "exact", head: true }),
    user.supabase.from("quizzes").select("id", { count: "exact", head: true }),
    user.supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
    user.supabase.from("quiz_attempts").select("id,quiz_title,score_percent,submitted_at").order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    user.supabase.rpc("get_study_session_summary"),
    user.supabase.from("study_sessions").select("id,topic_id,planned_minutes,started_at").eq("status", "active").limit(1).maybeSingle(),
    user.supabase.from("study_sessions").select("id,topic_id,duration_seconds,finished_at").eq("status", "completed").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: profile, error: profileError } = profileResult;
  const { data: preferences, error: preferencesError } = preferencesResult;
  const { data: subjectRows, error: subjectsError } = subjectsResult;
  const { data: topicRows, error: topicsError } = topicsResult;
  const planAccess = profile ? await loadPlanAccessForPlan(user.supabase, profile.plan) : null;
  const planLimits = planAccess?.limits ?? null;
  const limitsError = !planAccess;

  const name = profile?.display_name || user.email?.split("@")[0] || "estudante";
  const subjects: SubjectWithTopics[] = (subjectRows ?? []).map((subject) => ({
    ...subject,
    topics: (topicRows ?? []).filter((topic) => topic.subject_id === subject.id),
  }));
  const subjectNameById = new Map((subjectRows ?? []).map((subject) => [subject.id, subject.name]));
  const topicsForFocus = (topicRows ?? []).map((topic) => ({
    id: topic.id,
    label: `${subjectNameById.get(topic.subject_id) ?? "Matéria"} · ${topic.name}`,
  }));
  const weeklySummary = weeklySummaryResult.data?.[0];
  const weeklyFocusSeconds = Number(weeklySummary?.weekly_focus_seconds ?? 0);
  const weeklySessionCount = Number(weeklySummary?.weekly_session_count ?? 0);
  const latestAttempt = latestAttemptResult.data;
  const latestSession = latestSessionResult.data;
  const dueReviews = dueReviewsResult.count ?? 0;
  const focusDurationLabel = formatFocusDuration(weeklyFocusSeconds);
  const lastSessionLabel = latestSession
    ? `${formatFocusDuration(latestSession.duration_seconds)} · ${formatSessionDate(latestSession.finished_at, preferences?.timezone)}`
    : null;
  const latestSessionTopic = latestSession?.topic_id
    ? (topicRows ?? []).find((topic) => topic.id === latestSession.topic_id)?.name ?? null
    : null;
  const hasLoadError = Boolean(
    profileError
      || preferencesError
      || subjectsError
      || topicsError
      || dueReviewsResult.error
      || flashcardCountResult.error
      || quizCountResult.error
      || attemptCountResult.error
      || latestAttemptResult.error
      || weeklySummaryResult.error
      || activeSessionResult.error
      || latestSessionResult.error,
  );
  const hasLimitConfigurationError = Boolean(profileError || limitsError || !planLimits);

  return (
    <div className="dashboard-content">
      <div className="dashboard-greeting">
        <span className="auth-kicker">SEU RITMO, SEU PROGRESSO</span>
        <h1>Olá, {name}.</h1>
        <p>Veja onde você está e escolha um próximo passo para hoje.</p>
      </div>
      {hasLoadError && <p className="auth-message error-message" role="alert">Não foi possível carregar algumas informações. Atualize a página para tentar novamente.</p>}

      <section aria-label="Resumo de estudos" className="dashboard-metrics">
        <MetricCard
          detail={`${(topicRows ?? []).length} assunto${(topicRows ?? []).length === 1 ? "" : "s"} organizados`}
          icon={<BookOpen aria-hidden="true" size={17} />}
          label="Matérias"
          value={String((subjectRows ?? []).length)}
        />
        <MetricCard
          detail={dueReviews > 0 ? "Seu próximo passo é revisar" : "Nenhuma revisão vencida"}
          icon={<BookOpenCheck aria-hidden="true" size={17} />}
          label="Cartões para revisar"
          value={String(dueReviews)}
        />
        <MetricCard
          detail={`${weeklySessionCount} bloco${weeklySessionCount === 1 ? "" : "s"} concluído${weeklySessionCount === 1 ? "" : "s"} em 7 dias`}
          icon={<Clock3 aria-hidden="true" size={17} />}
          label="Foco na semana"
          value={focusDurationLabel}
        />
        <MetricCard
          detail={Number(attemptCountResult.count ?? 0) > 0 ? `${attemptCountResult.count} tentativa${attemptCountResult.count === 1 ? "" : "s"} registrada${attemptCountResult.count === 1 ? "" : "s"}` : "Seu primeiro resultado aparece aqui"}
          icon={<Trophy aria-hidden="true" size={17} />}
          label="Último simulado"
          value={latestAttempt ? `${Number(latestAttempt.score_percent).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "—"}
        />
      </section>

      <section aria-label="Produtividade e atividade" className="dashboard-productivity-grid">
        <FocusTimer activeSession={activeSessionResult.data ?? null} topics={topicsForFocus} />

        <div className="dashboard-activity-stack">
          <section aria-labelledby="dashboard-next-step" className="dashboard-next-card">
            <div className="dashboard-card-icon"><Activity aria-hidden="true" size={17} /></div>
            <span className="auth-kicker">PRÓXIMO PASSO</span>
            <h2 id="dashboard-next-step">
              {dueReviews > 0 ? "Retome o que já estudou" : flashcardCountResult.count ? "Sua fila está em dia" : "Prepare sua primeira revisão"}
            </h2>
            <p>
              {dueReviews > 0
                ? `${dueReviews} cartão${dueReviews === 1 ? "" : "s"} aguardando revisão espaçada.`
                : flashcardCountResult.count
                  ? "Quando algum cartão vencer, ele aparecerá aqui para você revisar."
                  : "Crie alguns flashcards para guardar conceitos e revisar no momento certo."}
            </p>
            <div className="dashboard-next-links">
              <Link className="button button-outline dashboard-next-link" href="/flashcards">
                {flashcardCountResult.count ? "Abrir flashcards" : "Criar flashcards"}
              </Link>
              <Link className="button button-outline dashboard-next-link" href="/assinatura"><CreditCard aria-hidden="true" size={14} /> Ver planos</Link>
            </div>
          </section>

          <section aria-labelledby="dashboard-recent-activity" className="dashboard-recent-card">
            <div className="dashboard-recent-heading">
              <span className="dashboard-card-icon"><Clock3 aria-hidden="true" size={17} /></span>
              <div>
                <span className="auth-kicker">ATIVIDADE RECENTE</span>
                <h2 id="dashboard-recent-activity">Seu progresso</h2>
              </div>
            </div>
            <div className="dashboard-recent-item">
              <span className="dashboard-recent-dot is-focus" />
              <div>
                <strong>{lastSessionLabel ? "Último bloco de foco" : "Nenhum bloco registrado ainda"}</strong>
                <p>{lastSessionLabel ? `${lastSessionLabel}${latestSessionTopic ? ` · ${latestSessionTopic}` : ""}` : "Inicie um bloco de foco para registrar seu tempo de estudo."}</p>
              </div>
            </div>
            <div className="dashboard-recent-item">
              <span className="dashboard-recent-dot is-quiz" />
              <div>
                <strong>{latestAttempt ? latestAttempt.quiz_title : "Nenhum simulado concluído"}</strong>
                <p>{latestAttempt ? `Último resultado: ${Number(latestAttempt.score_percent).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% · ${formatSessionDate(latestAttempt.submitted_at, preferences?.timezone)}` : "Conclua um simulado para ver sua evolução por assunto."}</p>
              </div>
            </div>
            <div className="dashboard-recent-footer">
              <span>{Number(quizCountResult.count ?? 0)} simulado{Number(quizCountResult.count ?? 0) === 1 ? "" : "s"} salvo{Number(quizCountResult.count ?? 0) === 1 ? "" : "s"}</span>
              <Link href="/quizzes">Ver simulados</Link>
            </div>
          </section>
        </div>
      </section>

      <SubjectManager
        configurationError={hasLimitConfigurationError}
        subjectLimit={planLimits?.max_subjects ?? null}
        subjects={subjects}
      />
    </div>
  );
}

function MetricCard({ detail, icon, label, value }: { detail: string; icon: ReactNode; label: string; value: string }) {
  return (
    <article className="dashboard-metric-card">
      <span className="dashboard-metric-icon">{icon}</span>
      <span className="dashboard-metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="dashboard-metric-detail">{detail}</span>
    </article>
  );
}

function formatFocusDuration(seconds: number) {
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

function formatSessionDate(value: string | null, timezone?: string) {
  if (!value) return "agora há pouco";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "America/Sao_Paulo",
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  }
}

function LoadingAccount() {
  return (
    <div aria-live="polite" aria-busy="true" className="dashboard-loading">
      <span>Preparando seu espaço de estudos…</span>
      <div className="dashboard-loading-metrics"><i /><i /><i /><i /></div>
      <div className="dashboard-loading-panels"><i /><i /></div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <nav aria-label="Navegação do espaço de estudos" className="workspace-header-left">
          <Brand />
          <Link className="workspace-nav-link" href="/flashcards"><BookOpen aria-hidden="true" size={15} /> Flashcards</Link>
          <Link className="workspace-nav-link" href="/quizzes"><ClipboardList aria-hidden="true" size={15} /> Simulados</Link>
          <Link className="workspace-nav-link" href="/plano"><CalendarDays aria-hidden="true" size={15} /> Plano</Link>
          <Link className="workspace-nav-link" href="/assinatura"><CreditCard aria-hidden="true" size={15} /> Planos</Link>
        </nav>
        <form action={signOut}>
          <button className="workspace-logout" type="submit"><LogOut size={15} /> Sair</button>
        </form>
      </header>
      <main className="dashboard-main">
        <Suspense fallback={<LoadingAccount />}>
          <AccountOverview />
        </Suspense>
      </main>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Crosshair,
  GraduationCap,
  ListChecks,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  completePlannedTaskAction,
  completeStudyGoalAction,
  createStudyGoalAction,
  deleteStudyGoalAction,
  generateStudyPlanAction,
  saveAvailabilityAction,
  type SmartPlanActionState,
} from "@/app/plano/actions";
import type { Tables } from "@/lib/supabase/database.types";

const initialState: SmartPlanActionState = {};
const weekdays = [
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 7, label: "Domingo", short: "Dom" },
];

export type PlanTopic = {
  id: string;
  name: string;
  subjectName: string;
};

export type PlanGoal = Pick<
  Tables<"study_goals">,
  "id" | "kind" | "title" | "target_date" | "topic_id" | "status" | "completed_at"
> & { topicName: string | null };

export type PlanTaskView = Pick<
  Tables<"planned_tasks">,
  | "id"
  | "topic_id"
  | "goal_id"
  | "task_date"
  | "position"
  | "task_type"
  | "title"
  | "duration_minutes"
  | "priority_score"
  | "recommendation_reason"
  | "status"
  | "completed_at"
> & {
  topicName: string;
  subjectName: string;
  goalTitle: string | null;
};

export type PlanView = {
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalTasks: number;
  totalMinutes: number;
  tasks: PlanTaskView[];
};

type Props = {
  availableDays: number[];
  dailyMinutes: number;
  goals: PlanGoal[];
  loadError: boolean;
  plan: PlanView | null;
  today: string;
  timezone: string;
  topics: PlanTopic[];
};

function Feedback({ state }: { state: SmartPlanActionState }) {
  if (!state.message) return null;
  return (
    <p className={`smartplan-feedback${state.kind === "error" ? " is-error" : " is-success"}`} role={state.kind === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

function addDays(value: string, count: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string, includeWeekday = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    ...(includeWeekday ? { weekday: "short" as const } : {}),
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatTime(value: string, timezone: string) {
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  };
  try {
    return new Intl.DateTimeFormat("pt-BR", options).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "America/Sao_Paulo" }).format(new Date(value));
  }
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

function AvailabilityForm({ availableDays, dailyMinutes }: Pick<Props, "availableDays" | "dailyMinutes">) {
  const [state, action, pending] = useActionState(saveAvailabilityAction, initialState);
  return (
    <form action={action} className="smartplan-settings-form">
      <fieldset className="smartplan-day-picker">
        <legend>Dias em que você pode estudar</legend>
        <div>
          {weekdays.map((day) => (
            <label className="smartplan-day-option" key={day.value}>
              <input defaultChecked={availableDays.includes(day.value)} name="available_days" type="checkbox" value={day.value} />
              <span><b>{day.short}</b><small>{day.label}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="smartplan-field">
        <span>Tempo disponível por dia</span>
        <span className="smartplan-number-field"><input defaultValue={dailyMinutes} max={720} min={5} name="daily_available_minutes" required type="number" /><small>minutos</small></span>
      </label>
      <button className="button button-outline smartplan-form-submit" disabled={pending} type="submit">
        {pending ? "Salvando…" : "Salvar disponibilidade"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function CreateGoalForm({ topics }: { topics: PlanTopic[] }) {
  const [state, action, pending] = useActionState(createStudyGoalAction, initialState);
  return (
    <form action={action} className="smartplan-goal-form">
      <label className="smartplan-field">
        <span>Tipo de meta</span>
        <select defaultValue="exam" name="kind">
          <option value="exam">Preparar para uma prova</option>
          <option value="mastery">Dominar um assunto</option>
          <option value="custom">Meta personalizada</option>
        </select>
      </label>
      <label className="smartplan-field">
        <span>Nome da meta</span>
        <input maxLength={120} name="title" placeholder="Ex.: ENEM — Ciências da Natureza" required />
      </label>
      <div className="smartplan-goal-fields-row">
        <label className="smartplan-field">
          <span>Assunto <small>opcional</small></span>
          <select defaultValue="" name="topic_id">
            <option value="">Todos os assuntos</option>
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subjectName} · {topic.name}</option>)}
          </select>
        </label>
        <label className="smartplan-field">
          <span>Data alvo <small>opcional</small></span>
          <input name="target_date" type="date" />
        </label>
      </div>
      <button className="button button-primary smartplan-form-submit" disabled={pending} type="submit">
        <Target aria-hidden="true" size={15} /> {pending ? "Adicionando…" : "Adicionar meta"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function GoalRow({ goal }: { goal: PlanGoal }) {
  const [completeState, completeAction, completing] = useActionState(completeStudyGoalAction.bind(null, goal.id), initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteStudyGoalAction.bind(null, goal.id), initialState);
  return (
    <li className={`smartplan-goal-row${goal.status === "completed" ? " is-complete" : ""}`}>
      <span className="smartplan-goal-icon">{goal.kind === "exam" ? <GraduationCap aria-hidden="true" size={16} /> : goal.kind === "mastery" ? <BookOpenCheck aria-hidden="true" size={16} /> : <Target aria-hidden="true" size={16} />}</span>
      <div className="smartplan-goal-copy">
        <strong>{goal.title}</strong>
        <span>{goal.topicName ? `${goal.topicName} · ` : "Geral · "}{goal.target_date ? `até ${formatDate(goal.target_date)}` : goal.status === "completed" ? "concluída" : "sem data alvo"}</span>
      </div>
      <div className="smartplan-goal-actions">
        {goal.status === "active" && (
          <form action={completeAction}>
            <button aria-label={`Concluir meta ${goal.title}`} className="smartplan-icon-action" disabled={completing} title="Concluir meta" type="submit"><Check aria-hidden="true" size={15} /></button>
          </form>
        )}
        <form action={deleteAction}>
          <button aria-label={`Remover meta ${goal.title}`} className="smartplan-icon-action is-delete" disabled={deleting} title="Remover meta" type="submit"><Trash2 aria-hidden="true" size={15} /></button>
        </form>
      </div>
      <Feedback state={completeState.kind === "error" ? completeState : deleteState.kind === "error" ? deleteState : {}} />
    </li>
  );
}

function TaskRow({ task, today }: { task: PlanTaskView; today: string }) {
  const [state, action, pending] = useActionState(completePlannedTaskAction.bind(null, task.id), initialState);
  const completed = task.status === "completed";
  const late = !completed && task.task_date < today;
  const typeLabel = task.task_type === "review" ? "Revisão" : task.task_type === "practice" ? "Prática" : "Estudo";
  const icon = task.task_type === "review"
    ? <BookOpenCheck aria-hidden="true" size={15} />
    : task.task_type === "practice"
      ? <Crosshair aria-hidden="true" size={15} />
      : <BookOpenCheck aria-hidden="true" size={15} />;

  return (
    <article className={`smartplan-task${completed ? " is-complete" : ""}${late ? " is-late" : ""}`}>
      <span className={`smartplan-task-icon is-${task.task_type}`}>{completed ? <CircleCheck aria-hidden="true" size={16} /> : icon}</span>
      <div className="smartplan-task-copy">
        <div className="smartplan-task-topline"><span>{typeLabel}</span>{late && <span className="smartplan-late-tag">Atrasada</span>}</div>
        <h4>{task.title}</h4>
        <p>{task.subjectName} · {task.topicName}</p>
        <small>{task.recommendation_reason}</small>
        <div className="smartplan-task-meta">
          <span><Clock3 aria-hidden="true" size={12} /> {task.duration_minutes} min</span>
          {task.goalTitle && <span><Target aria-hidden="true" size={12} /> {task.goalTitle}</span>}
        </div>
      </div>
      {!completed && (
        <form action={action}>
          <button aria-label={`Concluir ${task.title}`} className="smartplan-complete-button" disabled={pending} title="Marcar como concluída" type="submit">
            <Check aria-hidden="true" size={16} />
          </button>
        </form>
      )}
      {state.message && <Feedback state={state} />}
    </article>
  );
}

export function SmartPlanWorkspace({ availableDays, dailyMinutes, goals, loadError, plan, today, timezone, topics }: Props) {
  const [generateState, generateAction, generating] = useActionState(generateStudyPlanAction, initialState);
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const completedTaskCount = plan?.tasks.filter((task) => task.status === "completed").length ?? 0;
  const scheduledTaskCount = plan?.tasks.filter((task) => task.status === "scheduled").length ?? 0;
  const scheduledDates = Array.from({ length: 7 }, (_, index) => addDays(plan?.startDate ?? today, index));
  const planMinutes = plan?.tasks.reduce((sum, task) => sum + task.duration_minutes, 0) ?? 0;

  return (
    <div className="smartplan-workspace">
      <div className="smartplan-heading">
        <div>
          <span className="auth-kicker">UM PLANO NO SEU RITMO</span>
          <h1>Seu próximo passo, com clareza.</h1>
          <p>Uma agenda de sete dias que combina sua disponibilidade, revisões e metas para organizar o estudo.</p>
        </div>
        <form action={generateAction}>
          <button className="button button-primary smartplan-generate-button" disabled={generating || topics.length === 0 || availableDays.length === 0} type="submit">
            {generating ? <RefreshCw aria-hidden="true" className="smartplan-spin" size={16} /> : plan ? <RefreshCw aria-hidden="true" size={16} /> : <Sparkles aria-hidden="true" size={16} />}
            {generating ? "Organizando…" : plan ? "Gerar novo plano" : "Gerar meu plano"}
          </button>
        </form>
      </div>
      <Feedback state={generateState} />
      {loadError && <p className="smartplan-load-error" role="alert">Alguns dados não carregaram. Atualize a página para tentar novamente.</p>}

      <section aria-label="Resumo do planejamento" className="smartplan-stats">
        <article><span className="smartplan-stat-icon"><ListChecks aria-hidden="true" size={17} /></span><div><strong>{plan?.totalTasks ?? 0}</strong><small>Tarefas no plano</small></div></article>
        <article><span className="smartplan-stat-icon is-mint"><Clock3 aria-hidden="true" size={17} /></span><div><strong>{durationLabel(planMinutes)}</strong><small>Tempo distribuído</small></div></article>
        <article><span className="smartplan-stat-icon is-peach"><Target aria-hidden="true" size={17} /></span><div><strong>{activeGoals.length}</strong><small>Metas ativas</small></div></article>
        <article><span className="smartplan-stat-icon is-blue"><CalendarCheck2 aria-hidden="true" size={17} /></span><div><strong>{completedTaskCount}/{plan?.tasks.length ?? 0}</strong><small>Tarefas concluídas</small></div></article>
      </section>

      <section aria-label="Configurações e metas" className="smartplan-setup-grid">
        <article className="smartplan-panel">
          <div className="smartplan-panel-heading">
            <span className="smartplan-panel-icon"><CalendarDays aria-hidden="true" size={17} /></span>
            <div><span className="auth-kicker">SUA ROTINA</span><h2>Disponibilidade</h2></div>
          </div>
          <p className="smartplan-panel-description">Escolha quando estudar. O plano distribui blocos dentro desse limite.</p>
          <AvailabilityForm availableDays={availableDays} dailyMinutes={dailyMinutes} />
          {availableDays.length === 0 && <p className="smartplan-hint">Nenhum dia selecionado. Salve ao menos um dia para montar uma agenda.</p>}
        </article>

        <article className="smartplan-panel smartplan-goals-panel">
          <div className="smartplan-panel-heading">
            <span className="smartplan-panel-icon is-peach"><Target aria-hidden="true" size={17} /></span>
            <div><span className="auth-kicker">DIREÇÃO</span><h2>Metas de estudo</h2></div>
          </div>
          <p className="smartplan-panel-description">Provas próximas e assuntos prioritários influenciam a ordem das tarefas.</p>
          <CreateGoalForm topics={topics} />
          {goals.length > 0 ? (
            <ul className="smartplan-goal-list">{goals.map((goal) => <GoalRow goal={goal} key={goal.id} />)}</ul>
          ) : (
            <div className="smartplan-goals-empty"><span><Target aria-hidden="true" size={17} /></span><p>Suas metas aparecem aqui. Comece por uma prova ou por um assunto que quer dominar.</p></div>
          )}
        </article>
      </section>

      <section aria-labelledby="smartplan-agenda-heading" className="smartplan-agenda-section">
        <div className="smartplan-agenda-heading">
          <div><span className="auth-kicker">UMA SEMANA DE CADA VEZ</span><h2 id="smartplan-agenda-heading">Agenda de estudos</h2>
            <p>{plan ? `${formatDate(plan.startDate)} — ${formatDate(plan.endDate)} · Gerado ${formatTime(plan.generatedAt, timezone)}` : "Gere seu primeiro plano para ver as tarefas organizadas por dia."}</p>
          </div>
          {plan && <span className="smartplan-agenda-progress">{completedTaskCount} concluídas · {scheduledTaskCount} pendentes</span>}
        </div>

        {topics.length === 0 ? (
          <div className="smartplan-empty-state">
            <span><BookOpenCheck aria-hidden="true" size={23} /></span>
            <h3>Adicione assuntos para começar</h3>
            <p>O SmartPlan organiza o estudo a partir dos assuntos cadastrados nas suas matérias.</p>
            <Link className="button button-outline" href="/dashboard">Ir para matérias <ArrowRight aria-hidden="true" size={15} /></Link>
          </div>
        ) : !plan ? (
          <div className="smartplan-empty-state">
            <span><Sparkles aria-hidden="true" size={23} /></span>
            <h3>Sua semana começa com um plano</h3>
            <p>Vamos analisar seus assuntos, dificuldade, revisões e metas para recomendar o que estudar em cada dia disponível.</p>
            <form action={generateAction}>
              <button className="button button-primary" disabled={generating || availableDays.length === 0} type="submit"><Sparkles aria-hidden="true" size={15} /> {generating ? "Organizando…" : "Montar agenda de 7 dias"}</button>
            </form>
          </div>
        ) : (
          <div className="smartplan-week-grid">
            {scheduledDates.map((date) => {
              const dateTasks = plan.tasks.filter((task) => task.task_date === date);
              const dayName = weekdays[(new Date(`${date}T12:00:00.000Z`).getUTCDay() + 6) % 7].label;
              return (
                <article className={`smartplan-day-card${date === today ? " is-today" : ""}${dateTasks.length === 0 ? " is-rest" : ""}`} key={date}>
                  <header><span>{dayName}</span><time dateTime={date}>{formatDate(date)}</time></header>
                  {date === today && <span className="smartplan-today-tag">HOJE</span>}
                  <div className="smartplan-day-tasks">
                    {dateTasks.length > 0
                      ? dateTasks.map((task) => <TaskRow key={task.id} task={task} today={today} />)
                      : <p className="smartplan-rest-note">{availableDays.includes((new Date(`${date}T12:00:00.000Z`).getUTCDay() + 6) % 7 + 1) ? "Sem tarefas neste dia." : "Dia de pausa"}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="smartplan-method-note"><AlarmClock aria-hidden="true" size={14} /> O plano se atualiza quando você regenera a agenda. Cada tarefa mostra o motivo da recomendação, e as tarefas pendentes entram na próxima distribuição.</p>
    </div>
  );
}

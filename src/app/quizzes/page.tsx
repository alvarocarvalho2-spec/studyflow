import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen, CalendarDays, ClipboardList, CreditCard, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuizWorkspace, type QuizBankTopicOption, type QuizCardData, type QuizTopicOption } from "@/components/quizzes/quiz-workspace";
import { requireUser } from "@/lib/auth/require-user";
import { loadPlanAccessForPlan } from "@/lib/plans/access";
import type { QuizAttemptSummary } from "./actions";

export const metadata = { title: "Simulados — StudyFlow" };

async function QuizAccount() {
  await connection();
  const user = await requireUser();
  const [profileResult, quizzesResult, questionsResult, optionsResult, attemptsResult, topicsResult, subjectsResult, bankTopicsResult, bankSubjectsResult, bankCountResult] = await Promise.all([
    user.supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    user.supabase.from("quizzes").select("id,title,description,created_at,updated_at").order("updated_at", { ascending: false }),
    user.supabase.from("questions").select("id,quiz_id,topic_id,prompt,position").order("position", { ascending: true }),
    user.supabase.from("question_options").select("id,question_id,label,position").order("position", { ascending: true }),
    user.supabase
      .from("quiz_attempts")
      .select("id,quiz_id,quiz_title,total_questions,answered_count,correct_count,score_percent,submitted_at", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .limit(40),
    user.supabase.from("topics").select("id,name,subject_id").order("name", { ascending: true }),
    user.supabase.from("subjects").select("id,name").order("name", { ascending: true }),
    user.supabase.from("question_bank_topics").select("id,name,subject_id,position").order("position", { ascending: true }),
    user.supabase.from("question_bank_subjects").select("id,name,area,position").order("position", { ascending: true }),
    user.supabase.from("question_bank_questions").select("id", { count: "exact", head: true }),
  ]);

  const planAccess = profileResult.data
    ? await loadPlanAccessForPlan(user.supabase, profileResult.data.plan)
    : null;

  const subjectNames = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
  const topics: QuizTopicOption[] = (topicsResult.data ?? []).map((topic) => ({
    id: topic.id,
    name: topic.name,
    subjectName: subjectNames.get(topic.subject_id) ?? "Matéria",
  }));
  const bankSubjectNames = new Map((bankSubjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
  const bankSubjectAreas = new Map((bankSubjectsResult.data ?? []).map((subject) => [subject.id, subject.area]));
  const bankTopics: QuizBankTopicOption[] = (bankTopicsResult.data ?? []).map((topic) => ({
    id: topic.id,
    name: topic.name,
    subjectName: bankSubjectNames.get(topic.subject_id) ?? "Disciplina",
    area: bankSubjectAreas.get(topic.subject_id) ?? "",
    position: topic.position,
  }));
  const topicNames = new Map(topics.map((topic) => [topic.id, topic.name]));
  const optionsByQuestion = new Map<string, { id: string; label: string; position: number }[]>();
  for (const option of optionsResult.data ?? []) {
    const questionOptions = optionsByQuestion.get(option.question_id) ?? [];
    questionOptions.push({ id: option.id, label: option.label, position: option.position });
    optionsByQuestion.set(option.question_id, questionOptions);
  }

  const questionsByQuiz = new Map<string, QuizCardData["questions"]>();
  for (const question of questionsResult.data ?? []) {
    const quizQuestions = questionsByQuiz.get(question.quiz_id) ?? [];
    quizQuestions.push({
      id: question.id,
      prompt: question.prompt,
      position: question.position,
      topicName: question.topic_id ? topicNames.get(question.topic_id) ?? null : null,
      options: optionsByQuestion.get(question.id) ?? [],
    });
    questionsByQuiz.set(question.quiz_id, quizQuestions);
  }

  const quizzes: QuizCardData[] = (quizzesResult.data ?? []).map((quiz) => ({
    ...quiz,
    questions: questionsByQuiz.get(quiz.id) ?? [],
  }));
  const attempts = (attemptsResult.data ?? []) as QuizAttemptSummary[];
  const configurationError = Boolean(profileResult.error || !planAccess);
  const loadError = Boolean(
    quizzesResult.error || questionsResult.error || optionsResult.error
      || attemptsResult.error || topicsResult.error || subjectsResult.error
      || bankTopicsResult.error || bankSubjectsResult.error || bankCountResult.error,
  );

  return (
    <QuizWorkspace
      quizzes={quizzes}
      attempts={attempts}
      attemptCount={attemptsResult.count ?? attempts.length}
      topics={topics}
      bankTopics={bankTopics}
      bankQuestionCount={bankCountResult.count ?? 0}
      quizLimit={planAccess?.limits.max_saved_exams ?? null}
      loadError={loadError}
      configurationError={configurationError}
    />
  );
}

function LoadingQuizzes() {
  return <div aria-live="polite" className="dashboard-loading">Carregando seus simulados…</div>;
}

export default function QuizzesPage() {
  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <nav aria-label="Navegação do espaço de estudos" className="workspace-header-left">
          <Brand href="/dashboard" />
          <Link className="workspace-nav-link" href="/dashboard"><BookOpen aria-hidden="true" size={15} /> Matérias</Link>
          <Link className="workspace-nav-link" href="/flashcards"><BookOpen aria-hidden="true" size={15} /> Flashcards</Link>
          <span className="workspace-nav-link is-active" aria-current="page"><ClipboardList aria-hidden="true" size={15} /> Simulados</span>
          <Link className="workspace-nav-link" href="/plano"><CalendarDays aria-hidden="true" size={15} /> Plano</Link>
          <Link className="workspace-nav-link" href="/assinatura"><CreditCard aria-hidden="true" size={15} /> Planos</Link>
        </nav>
        <div className="workspace-header-actions">
          <ThemeToggle />
          <form action={signOut}>
            <button className="workspace-logout" type="submit"><LogOut aria-hidden="true" size={15} /> Sair</button>
          </form>
        </div>
      </header>
      <main className="flashcards-page-main">
        <Suspense fallback={<LoadingQuizzes />}>
          <QuizAccount />
        </Suspense>
      </main>
    </div>
  );
}

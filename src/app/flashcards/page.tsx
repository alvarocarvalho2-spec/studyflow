import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen, CalendarDays, ClipboardList, CreditCard, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { FlashcardWorkspace } from "@/components/flashcards/flashcard-workspace";
import { Brand } from "@/components/brand";
import { requireUser } from "@/lib/auth/require-user";
import { loadPlanAccessForPlan } from "@/lib/plans/access";
import type { FlashcardWithContext, ReviewHistoryItem, TopicOption } from "@/components/flashcards/flashcard-workspace";

export const metadata = { title: "Flashcards e revisão — StudyFlow" };

async function FlashcardAccount() {
  await connection();
  const user = await requireUser();
  const [profileResult, cardsResult, topicsResult, subjectsResult, reviewsResult] = await Promise.all([
    user.supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    user.supabase.from("flashcards").select("*").order("next_review_at", { ascending: true }),
    user.supabase.from("topics").select("id,name,subject_id").order("name", { ascending: true }),
    user.supabase.from("subjects").select("id,name").order("name", { ascending: true }),
    user.supabase
      .from("flashcard_reviews")
      .select("id,flashcard_id,rating,interval_before_days,interval_after_days,reviewed_at,next_review_at")
      .order("reviewed_at", { ascending: false })
      .limit(12),
  ]);

  const planAccess = profileResult.data
    ? await loadPlanAccessForPlan(user.supabase, profileResult.data.plan)
    : null;

  const now = new Date();
  const subjectNames = new Map((subjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
  const topics: TopicOption[] = (topicsResult.data ?? []).map((topic) => ({
    id: topic.id,
    name: topic.name,
    subjectName: subjectNames.get(topic.subject_id) ?? "Matéria",
  }));
  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  const cards: FlashcardWithContext[] = (cardsResult.data ?? []).map((card) => {
    const topic = card.topic_id ? topicById.get(card.topic_id) : null;
    return {
      ...card,
      topic_name: topic?.name ?? null,
      subject_name: topic?.subjectName ?? null,
    };
  });
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const reviews: ReviewHistoryItem[] = (reviewsResult.data ?? []).map((review) => ({
    ...review,
    front: cardById.get(review.flashcard_id)?.front ?? "Flashcard removido",
  }));
  const dueCardIds = cards
    .filter((card) => Date.parse(card.next_review_at) <= now.getTime())
    .map((card) => card.id);
  const configurationError = Boolean(profileResult.error || !planAccess);
  const loadError = Boolean(cardsResult.error || topicsResult.error || subjectsResult.error || reviewsResult.error);

  return (
    <FlashcardWorkspace
      cards={cards}
      dueCardIds={dueCardIds}
      flashcardLimit={planAccess?.limits.max_flashcards ?? null}
      history={reviews}
      loadError={loadError}
      topics={topics}
      configurationError={configurationError}
    />
  );
}

function LoadingFlashcards() {
  return <div aria-live="polite" className="dashboard-loading">Carregando seus flashcards…</div>;
}

export default function FlashcardsPage() {
  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <nav aria-label="Navegação do espaço de estudos" className="workspace-header-left">
          <Brand />
          <Link className="workspace-nav-link" href="/dashboard"><BookOpen aria-hidden="true" size={15} /> Matérias</Link>
          <Link className="workspace-nav-link" href="/quizzes"><ClipboardList aria-hidden="true" size={15} /> Simulados</Link>
          <Link className="workspace-nav-link" href="/plano"><CalendarDays aria-hidden="true" size={15} /> Plano</Link>
          <Link className="workspace-nav-link" href="/assinatura"><CreditCard aria-hidden="true" size={15} /> Planos</Link>
        </nav>
        <form action={signOut}>
          <button className="workspace-logout" type="submit"><LogOut aria-hidden="true" size={15} /> Sair</button>
        </form>
      </header>
      <main className="flashcards-page-main">
        <Suspense fallback={<LoadingFlashcards />}>
          <FlashcardAccount />
        </Suspense>
      </main>
    </div>
  );
}

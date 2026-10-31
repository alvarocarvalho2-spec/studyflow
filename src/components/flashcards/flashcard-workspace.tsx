"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, CirclePlus, Clock3, Eye, PencilLine, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import {
  createFlashcardAction,
  deleteFlashcardAction,
  reviewFlashcardAction,
  updateFlashcardAction,
  type FlashcardActionState,
  type FlashcardReviewActionState,
} from "@/app/flashcards/actions";
import type { Tables } from "@/lib/supabase/database.types";

type Flashcard = Pick<
  Tables<"flashcards">,
  "id" | "topic_id" | "front" | "back" | "interval_days" | "repetitions" | "next_review_at" | "last_reviewed_at"
>;
type FlashcardReview = Pick<
  Tables<"flashcard_reviews">,
  "id" | "flashcard_id" | "rating" | "interval_before_days" | "interval_after_days" | "reviewed_at" | "next_review_at"
>;
const initialActionState: FlashcardActionState = {};
const initialReviewState: FlashcardReviewActionState = {};

export type FlashcardWithContext = Flashcard & {
  topic_name: string | null;
  subject_name: string | null;
};

export type TopicOption = {
  id: string;
  name: string;
  subjectName: string;
};

export type ReviewHistoryItem = Pick<
  FlashcardReview,
  "id" | "flashcard_id" | "rating" | "interval_before_days" | "interval_after_days" | "reviewed_at" | "next_review_at"
> & { front: string };

const ratingLabels: Record<number, string> = {
  0: "Errei",
  1: "Difícil",
  2: "Lembrei",
  3: "Fácil",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function intervalLabel(days: number) {
  if (days === 0) return "10 minutos";
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function Feedback({ state }: { state: { kind?: "success" | "error"; message?: string } }) {
  if (!state.message) return null;
  return (
    <p className={`flashcard-feedback ${state.kind === "error" ? "is-error" : "is-success"}`} role={state.kind === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

function FlashcardEditor({
  card,
  topics,
  onUpdated,
  onNotify,
}: {
  card: FlashcardWithContext;
  topics: TopicOption[];
  onUpdated: (card: Flashcard) => void;
  onNotify: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(updateFlashcardAction.bind(null, card.id), initialActionState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const handledIdRef = useRef<string | null>(null);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [topicId, setTopicId] = useState(card.topic_id ?? "");

  useEffect(() => {
    if (!pending && state.kind === "success" && state.flashcard) {
      onUpdated(state.flashcard);
      if (handledIdRef.current !== state.flashcard.id) {
        handledIdRef.current = state.flashcard.id;
        onNotify("Flashcard atualizado.");
      }
      dialogRef.current?.close();
    }
  }, [onNotify, onUpdated, pending, state.flashcard, state.kind]);

  function openEditor() {
    setFront(card.front);
    setBack(card.back);
    setTopicId(card.topic_id ?? "");
    dialogRef.current?.showModal();
  }

  return (
    <>
      <button aria-label={`Editar flashcard: ${card.front}`} className="flashcard-icon-button" onClick={openEditor} title="Editar" type="button">
        <PencilLine aria-hidden="true" size={15} />
      </button>
      <dialog aria-labelledby={`edit-flashcard-title-${card.id}`} className="edit-dialog flashcard-dialog" ref={dialogRef}>
        <div className="edit-dialog-header">
          <div>
            <span className="edit-dialog-kicker">EDITAR FLASHCARD</span>
            <h3 id={`edit-flashcard-title-${card.id}`}>Revise seu cartão</h3>
            <p>Atualize a pergunta, a resposta ou o assunto relacionado.</p>
          </div>
          <button aria-label="Fechar edição" className="edit-dialog-close" onClick={() => dialogRef.current?.close()} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <form action={action} className="flashcard-form edit-dialog-form">
          <CardFields back={back} front={front} onBackChange={setBack} onFrontChange={setFront} onTopicChange={setTopicId} topicId={topicId} topics={topics} />
          <div className="edit-dialog-actions">
            <button className="button button-outline button-small" onClick={() => dialogRef.current?.close()} type="button">Cancelar</button>
            <button className="button button-small button-primary" disabled={pending} type="submit">{pending ? "Salvando…" : "Salvar alterações"}</button>
          </div>
          {state.kind === "error" && <Feedback state={state} />}
        </form>
      </dialog>
    </>
  );
}

function CardFields({
  front,
  back,
  topicId,
  topics,
  onFrontChange,
  onBackChange,
  onTopicChange,
}: {
  front: string;
  back: string;
  topicId: string;
  topics: TopicOption[];
  onFrontChange: (value: string) => void;
  onBackChange: (value: string) => void;
  onTopicChange: (value: string) => void;
}) {
  return (
    <>
      <label className="flashcard-field">
        <span>Pergunta</span>
        <textarea maxLength={2000} name="front" onChange={(event) => onFrontChange(event.target.value)} placeholder="Ex.: O que é fotossíntese?" required rows={3} value={front} />
      </label>
      <label className="flashcard-field">
        <span>Resposta</span>
        <textarea maxLength={5000} name="back" onChange={(event) => onBackChange(event.target.value)} placeholder="Escreva uma resposta curta e clara." required rows={4} value={back} />
      </label>
      <label className="flashcard-field">
        <span>Assunto <small>opcional</small></span>
        <select name="topic_id" onChange={(event) => onTopicChange(event.target.value)} value={topicId}>
          <option value="">Sem assunto específico</option>
          {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subjectName} · {topic.name}</option>)}
        </select>
      </label>
    </>
  );
}

function CreateFlashcardForm({
  topics,
  disabled,
  onCreated,
  onNotify,
}: {
  topics: TopicOption[];
  disabled: boolean;
  onCreated: (card: Flashcard) => void;
  onNotify: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(createFlashcardAction, initialActionState);
  const handledIdRef = useRef<string | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topicId, setTopicId] = useState("");

  useEffect(() => {
    const card = state.flashcard;
    if (!pending && state.kind === "success" && card && handledIdRef.current !== card.id) {
      handledIdRef.current = card.id;
      onCreated(card);
      onNotify("Flashcard criado e pronto para revisar.");
      setFront("");
      setBack("");
      setTopicId("");
    }
  }, [onCreated, onNotify, pending, state.flashcard, state.kind]);

  return (
    <form action={action} className="flashcard-form" id="create-flashcard">
      <div className="flashcard-form-intro">
        <span className="flashcard-panel-icon"><CirclePlus aria-hidden="true" size={19} /></span>
        <div><h3>Criar flashcard</h3><p>Uma pergunta por cartão ajuda a revisar com foco.</p></div>
      </div>
      <CardFields back={back} front={front} onBackChange={setBack} onFrontChange={setFront} onTopicChange={setTopicId} topicId={topicId} topics={topics} />
      <button className="button button-primary flashcard-submit" disabled={pending || disabled} type="submit">
        <CirclePlus aria-hidden="true" size={16} /> {pending ? "Criando…" : "Adicionar flashcard"}
      </button>
      {disabled && <p className="flashcard-limit-note">Você chegou ao limite gratuito de flashcards.</p>}
      {state.kind === "error" && <Feedback state={state} />}
    </form>
  );
}

function ReviewCard({
  card,
  position,
  onReviewed,
}: {
  card: FlashcardWithContext;
  position: number;
  onReviewed: (review: FlashcardReview) => void;
}) {
  const [state, action, pending] = useActionState(reviewFlashcardAction.bind(null, card.id), initialReviewState);
  const handledReviewRef = useRef<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const review = state.review;
    if (!pending && state.kind === "success" && review && handledReviewRef.current !== review.id) {
      handledReviewRef.current = review.id;
      onReviewed(review);
    }
  }, [onReviewed, pending, state.kind, state.review]);

  return (
    <div className="review-card-shell">
      <div className="review-card-topline">
        <div><span className="review-card-kicker">REVISÃO DO DIA</span><strong>Cartão {position}</strong></div>
        <span className="review-card-subject">{card.subject_name ?? "Geral"}</span>
      </div>
      <div className={`review-card-face${revealed ? " is-revealed" : ""}`}>
        <span className="review-face-label">{revealed ? "RESPOSTA" : "PERGUNTA"}</span>
        <p>{revealed ? card.back : card.front}</p>
      </div>
      {!revealed ? (
        <button className="button button-primary reveal-answer-button" onClick={() => setRevealed(true)} type="button">
          <Eye aria-hidden="true" size={17} /> Mostrar resposta
        </button>
      ) : (
        <div className="review-rating-area">
          <span>Como foi lembrar?</span>
          <form action={action} className="review-rating-buttons">
            <button disabled={pending} name="rating" type="submit" value="0"><strong>Errei</strong><small>10 min</small></button>
            <button disabled={pending} name="rating" type="submit" value="1"><strong>Difícil</strong><small>~1 dia</small></button>
            <button disabled={pending} name="rating" type="submit" value="2"><strong>Lembrei</strong><small>1–2 dias</small></button>
            <button disabled={pending} name="rating" type="submit" value="3"><strong>Fácil</strong><small>3 dias+</small></button>
          </form>
          {state.kind === "error" && <Feedback state={state} />}
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  card,
  topics,
  isDue,
  onUpdated,
  onDeleted,
  onNotify,
}: {
  card: FlashcardWithContext;
  topics: TopicOption[];
  isDue: boolean;
  onUpdated: (card: Flashcard) => void;
  onDeleted: (id: string) => void;
  onNotify: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(deleteFlashcardAction.bind(null, card.id), initialActionState);

  useEffect(() => {
    if (!pending && state.kind === "success") {
      onDeleted(card.id);
      onNotify("Flashcard excluído.");
    }
  }, [card.id, onDeleted, onNotify, pending, state.kind]);

  return (
    <article className="flashcard-library-item">
      <div className="flashcard-library-main">
        <span className="flashcard-library-marker"><BookOpen aria-hidden="true" size={17} /></span>
        <div className="flashcard-library-copy">
          <strong>{card.front}</strong>
          <span>{card.subject_name ? `${card.subject_name} · ${card.topic_name}` : "Sem assunto específico"}</span>
        </div>
        <span className={`flashcard-due-badge${isDue ? " is-due" : ""}`}>{isDue ? "Para revisar" : `Próxima · ${formatDate(card.next_review_at)}`}</span>
      </div>
      <div className="flashcard-library-actions">
        <FlashcardEditor card={card} onNotify={onNotify} onUpdated={onUpdated} topics={topics} />
        <form action={action} onSubmit={(event) => {
          if (!window.confirm("Excluir este flashcard e seu histórico de revisões?")) event.preventDefault();
        }}>
          <button aria-label={`Excluir flashcard: ${card.front}`} className="flashcard-icon-button is-danger" disabled={pending} title="Excluir" type="submit">
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </form>
        {state.kind === "error" && <Feedback state={state} />}
      </div>
    </article>
  );
}

function ReviewHistory({ items }: { items: ReviewHistoryItem[] }) {
  if (items.length === 0) {
    return <p className="flashcard-history-empty">Suas revisões concluídas aparecerão aqui.</p>;
  }

  return (
    <ul className="flashcard-history-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className={`history-rating rating-${item.rating}`}><Check aria-hidden="true" size={13} /> {ratingLabels[item.rating]}</span>
          <div><strong>{item.front}</strong><span>Revisado em {formatDate(item.reviewed_at)}</span></div>
          <small>Próxima · {formatDate(item.next_review_at)}</small>
        </li>
      ))}
    </ul>
  );
}

export function FlashcardWorkspace({
  cards: initialCards,
  dueCardIds,
  history: initialHistory,
  topics,
  flashcardLimit,
  configurationError,
  loadError,
}: {
  cards: FlashcardWithContext[];
  dueCardIds: string[];
  history: ReviewHistoryItem[];
  topics: TopicOption[];
  flashcardLimit: number | null;
  configurationError: boolean;
  loadError: boolean;
}) {
  const [cards, setCards] = useState(initialCards);
  const [queue, setQueue] = useState(() => initialCards.filter((card) => dueCardIds.includes(card.id)));
  const [history, setHistory] = useState(initialHistory);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const addCard = useCallback((saved: Flashcard) => {
    const topic = saved.topic_id ? topics.find((item) => item.id === saved.topic_id) : undefined;
    const card: FlashcardWithContext = {
      ...saved,
      topic_name: topic?.name ?? null,
      subject_name: topic?.subjectName ?? null,
    };
    setCards((current) => [card, ...current.filter((item) => item.id !== card.id)]);
    setQueue((current) => [card, ...current.filter((item) => item.id !== card.id)]);
  }, [topics]);

  const updateCard = useCallback((saved: Flashcard) => {
    const topic = saved.topic_id ? topics.find((item) => item.id === saved.topic_id) : undefined;
    const card: FlashcardWithContext = {
      ...saved,
      topic_name: topic?.name ?? null,
      subject_name: topic?.subjectName ?? null,
    };
    setCards((current) => current.map((item) => item.id === card.id ? card : item));
    setQueue((current) => current.map((item) => item.id === card.id ? card : item));
  }, [topics]);

  const deleteCard = useCallback((id: string) => {
    setCards((current) => current.filter((item) => item.id !== id));
    setQueue((current) => current.filter((item) => item.id !== id));
    setHistory((current) => current.filter((item) => item.flashcard_id !== id));
  }, []);

  const finishReview = useCallback((review: FlashcardReview) => {
    setQueue((current) => current.filter((item) => item.id !== review.flashcard_id));
    setCards((current) => current.map((card) => card.id === review.flashcard_id ? {
      ...card,
      interval_days: review.interval_after_days,
      repetitions: review.rating === 0 ? 0 : Math.min(card.repetitions + 1, 10000),
      next_review_at: review.next_review_at,
      last_reviewed_at: review.reviewed_at,
    } : card));
    const cardFront = cards.find((card) => card.id === review.flashcard_id)?.front ?? "Flashcard";
    setHistory((current) => [{
      id: review.id,
      flashcard_id: review.flashcard_id,
      rating: review.rating,
      interval_before_days: review.interval_before_days,
      interval_after_days: review.interval_after_days,
      reviewed_at: review.reviewed_at,
      next_review_at: review.next_review_at,
      front: cardFront,
    }, ...current].slice(0, 12));
    notify(`Próxima revisão: ${intervalLabel(review.interval_after_days)}.`);
  }, [cards, notify]);

  const currentCard = queue[0];
  const futureCard = cards
    .filter((card) => !queue.some((dueCard) => dueCard.id === card.id))
    .sort((a, b) => Date.parse(a.next_review_at) - Date.parse(b.next_review_at))[0];
  const limitReached = flashcardLimit !== null && cards.length >= flashcardLimit;
  const progress = cards.length === 0 ? 0 : Math.round((cards.length / (flashcardLimit ?? 100)) * 100);

  return (
    <div className="flashcards-content">
      <section className="flashcards-heading">
        <div>
          <span className="section-kicker">MEMÓRIA EM MOVIMENTO</span>
          <h1>Flashcards</h1>
          <p>Revise no momento certo e transforme perguntas curtas em aprendizado duradouro.</p>
        </div>
        <div className="flashcards-capacity" aria-label={`${cards.length} de ${flashcardLimit ?? "—"} cartões usados`}>
          <div><strong>{cards.length}</strong><span>/{flashcardLimit ?? "—"} cartões</span></div>
          <span className="capacity-track"><span style={{ width: `${Math.min(progress, 100)}%` }} /></span>
        </div>
      </section>

      {loadError && <p className="auth-message error-message" role="alert">Não foi possível carregar todos os flashcards. Atualize a página para tentar novamente.</p>}
      {configurationError && <p className="auth-message error-message" role="alert">Os limites da conta estão indisponíveis; a criação de cartões está pausada.</p>}

      <div className="flashcard-stats">
        <article><span className="flashcard-stat-icon is-violet"><RotateCcw aria-hidden="true" size={17} /></span><div><strong>{queue.length}</strong><span>na fila de hoje</span></div></article>
        <article><span className="flashcard-stat-icon is-green"><Check aria-hidden="true" size={17} /></span><div><strong>{history.length}</strong><span>revisões recentes</span></div></article>
        <article><span className="flashcard-stat-icon is-blue"><BookOpen aria-hidden="true" size={17} /></span><div><strong>{cards.length}</strong><span>cartões criados</span></div></article>
      </div>

      <div className="flashcards-primary-grid">
        <section aria-labelledby="review-heading" className="review-panel">
          <div className="flashcard-section-title">
            <div><span className="flashcard-section-kicker">REVISÃO ESPAÇADA</span><h2 id="review-heading">Sua fila</h2></div>
            <span className="review-queue-count">{queue.length} pendentes</span>
          </div>
          {currentCard ? (
            <ReviewCard card={currentCard} key={currentCard.id} onReviewed={finishReview} position={1} />
          ) : (
            <div className="review-empty-state">
              <span className="review-empty-icon">{cards.length === 0 ? <BookOpen aria-hidden="true" size={23} /> : <Sparkles aria-hidden="true" size={23} />}</span>
              <h3>{cards.length === 0 ? "Crie seu primeiro cartão" : "Você está em dia"}</h3>
              <p>{cards.length === 0
                ? "Adicione um flashcard para começar sua rotina de revisão."
                : futureCard ? `Seu próximo cartão está previsto para ${formatDate(futureCard.next_review_at)}.` : "Todos os cartões foram revisados por enquanto."}</p>
              {cards.length === 0 && <a className="button button-primary" href="#create-flashcard">Criar primeiro flashcard</a>}
            </div>
          )}
          {currentCard && <p className="review-scheduling-note"><Clock3 aria-hidden="true" size={14} /> As respostas determinam quando cada cartão volta à fila.</p>}
        </section>

        <aside className="flashcard-create-panel">
          <CreateFlashcardForm
            disabled={limitReached || configurationError}
            onCreated={addCard}
            onNotify={notify}
            topics={topics}
          />
          {limitReached && <p className="flashcard-limit-note">Seu plano atual permite até {flashcardLimit} cartões.</p>}
        </aside>
      </div>

      <div className="flashcards-secondary-grid">
        <section aria-labelledby="library-heading" className="flashcard-library-panel">
          <div className="flashcard-section-title">
            <div><span className="flashcard-section-kicker">SUA COLEÇÃO</span><h2 id="library-heading">Seus flashcards</h2></div>
            <span className="review-queue-count">{cards.length} cartões</span>
          </div>
          {cards.length > 0 ? (
            <div className="flashcard-library-list">
              {cards.map((card) => (
                <LibraryCard
                  card={card}
                  isDue={queue.some((item) => item.id === card.id)}
                  key={card.id}
                  onDeleted={deleteCard}
                  onNotify={notify}
                  onUpdated={updateCard}
                  topics={topics}
                />
              ))}
            </div>
          ) : (
            <p className="flashcard-history-empty">Seus cartões criados aparecerão aqui.</p>
          )}
        </section>

        <section aria-labelledby="history-heading" className="flashcard-history-panel">
          <div className="flashcard-section-title">
            <div><span className="flashcard-section-kicker">SEU PROGRESSO</span><h2 id="history-heading">Histórico</h2></div>
          </div>
          <ReviewHistory items={history} />
        </section>
      </div>

      <div aria-live="polite" className="flashcard-toast-region">
        {toast && (
          <div className="flashcard-toast" role="status">
            <span aria-hidden="true" className="flashcard-toast-icon"><Check size={19} strokeWidth={2.5} /></span>
            <span><strong>StudyFlow</strong><small>{toast}</small></span>
            <button aria-label="Dispensar aviso" className="flashcard-toast-close" onClick={() => setToast(null)} type="button"><X aria-hidden="true" size={17} /></button>
            <span aria-hidden="true" className="flashcard-toast-progress" />
          </div>
        )}
      </div>
    </div>
  );
}

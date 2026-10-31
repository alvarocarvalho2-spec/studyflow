"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, BookOpenCheck, Check, CheckCircle2,
  ClipboardList, Clock3, FileQuestion, History, LibraryBig, LoaderCircle,
  Plus, Save, Search, Sparkles, Trash2, X,
} from "lucide-react";
import {
  deleteQuizAction,
  loadQuizAttemptAction,
  loadQuizEditorAction,
  searchQuestionBankAction,
  saveQuizAction,
  submitQuizAttemptAction,
  type QuizAttemptAnswer,
  type QuizAttemptResult,
  type QuizAttemptSummary,
  type QuizEditorData,
  type QuestionBankSearchItem,
} from "@/app/quizzes/actions";
import type { Tables } from "@/lib/supabase/database.types";

export type QuizTopicOption = { id: string; name: string; subjectName: string };
export type QuizBankTopicOption = { id: string; name: string; subjectName: string; area: string; position: number };
export type QuizQuestionCard = {
  id: string;
  prompt: string;
  position: number;
  topicName: string | null;
  options: { id: string; label: string; position: number }[];
};
export type QuizCardData = Pick<Tables<"quizzes">, "id" | "title" | "description" | "created_at" | "updated_at"> & {
  questions: QuizQuestionCard[];
};

type DraftOption = { text: string };
type DraftQuestion = {
  sourceBankQuestionId: string | null;
  prompt: string;
  topicId: string;
  explanation: string;
  options: DraftOption[];
  correctIndex: number;
};
type QuizDraft = {
  quizId: string | null;
  title: string;
  description: string;
  questions: DraftQuestion[];
};
type QuizToast = { id: number; message: string; error: boolean };
type QuizResultView = {
  attemptId?: string;
  quizId?: string;
  title: string;
  total: number;
  answered: number;
  correct: number;
  percentage: number;
  answers: {
    position: number;
    topic: string | null;
    prompt: string;
    selected: string | null;
    correct: string;
    explanation: string | null;
    isCorrect: boolean;
  }[];
};

const optionLetters = ["A", "B", "C", "D", "E", "F"];

function blankQuestion(): DraftQuestion {
  return {
    sourceBankQuestionId: null,
    prompt: "",
    topicId: "",
    explanation: "",
    options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
    correctIndex: 0,
  };
}

function blankDraft(): QuizDraft {
  return { quizId: null, title: "", description: "", questions: [blankQuestion()] };
}

function draftFromEditor(editor: QuizEditorData): QuizDraft {
  return {
    quizId: editor.id,
    title: editor.title,
    description: editor.description ?? "",
    questions: editor.questions.map((question) => ({
      sourceBankQuestionId: question.source_bank_question_id,
      prompt: question.prompt,
      topicId: question.topic_id ?? "",
      explanation: question.explanation ?? "",
      options: question.options.map((option) => ({ text: option.text })),
      correctIndex: question.correct_option_index ?? -1,
    })),
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function normalizeCategoryName(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("pt-BR");
}

function difficultyLabel(value: number) {
  return ["", "Inicial", "Básica", "Intermediária", "Avançada", "Desafio"][value] ?? "Intermediária";
}

function resultFromAction(result: QuizAttemptResult): QuizResultView {
  return {
    attemptId: result.attempt_id,
    quizId: result.quiz_id,
    title: result.quiz_title,
    total: result.total_questions,
    answered: result.answered_count,
    correct: result.correct_count,
    percentage: result.score_percent,
    answers: result.answers.map((answer) => ({
      position: answer.position,
      topic: answer.topic,
      prompt: answer.prompt,
      selected: answer.selected,
      correct: answer.correct,
      explanation: answer.explanation,
      isCorrect: answer.is_correct,
    })),
  };
}

function resultFromHistory(
  attempt: QuizAttemptSummary,
  answers: QuizAttemptAnswer[],
): QuizResultView {
  return {
    attemptId: attempt.id,
    quizId: attempt.quiz_id,
    title: attempt.quiz_title,
    total: attempt.total_questions,
    answered: attempt.answered_count,
    correct: attempt.correct_count,
    percentage: attempt.score_percent,
    answers: answers.map((answer) => ({
      position: answer.question_position,
      topic: answer.topic_label,
      prompt: answer.question_prompt,
      selected: answer.selected_option_label,
      correct: answer.correct_option_label,
      explanation: answer.explanation,
      isCorrect: answer.is_correct,
    })),
  };
}

export function QuizWorkspace({
  quizzes,
  attempts,
  attemptCount,
  topics,
  bankTopics,
  bankQuestionCount,
  quizLimit,
  loadError,
  configurationError,
}: {
  quizzes: QuizCardData[];
  attempts: QuizAttemptSummary[];
  attemptCount: number;
  topics: QuizTopicOption[];
  bankTopics: QuizBankTopicOption[];
  bankQuestionCount: number;
  quizLimit: number | null;
  loadError: boolean;
  configurationError: boolean;
}) {
  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [toast, setToast] = useState<QuizToast | null>(null);
  const [screen, setScreen] = useState<"library" | "taking" | "result">("library");
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState<QuizResultView | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankTopicId, setBankTopicId] = useState(bankTopics[0]?.id ?? "");
  const [bankSearch, setBankSearch] = useState("");
  const [bankResults, setBankResults] = useState<QuestionBankSearchItem[]>([]);
  const [bankMessage, setBankMessage] = useState("");
  const [bankLoading, setBankLoading] = useState(false);
  const toastSequence = useRef(0);
  const activeQuiz = quizzes.find((quiz) => quiz.id === activeQuizId) ?? null;
  const visibleBankResults = draft
    ? bankResults.filter((item) => !draft.questions.some((question) => question.sourceBankQuestionId === item.id))
    : [];

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function notify(message: string, error = false) {
    toastSequence.current += 1;
    setToast({ id: toastSequence.current, message, error });
  }

  function startCreate() {
    if (quizLimit !== null && quizzes.length >= quizLimit) {
      notify(`Seu plano permite até ${quizLimit} simulados salvos.`, true);
      return;
    }
    setDraftError("");
    setBankOpen(false);
    setBankResults([]);
    setBankSearch("");
    setDraft(blankDraft());
  }

  async function startEdit(quizId: string) {
    setBusyItem(quizId);
    const response = await loadQuizEditorAction(quizId);
    setBusyItem(null);
    if (!response.data) {
      notify(response.message, true);
      return;
    }
    setDraftError("");
    setBankOpen(false);
    setBankResults([]);
    setDraft(draftFromEditor(response.data));
  }

  function closeEditor() {
    if (busy) return;
    setDraft(null);
    setDraftError("");
  }

  async function searchBankQuestions() {
    if (!bankTopicId) {
      setBankMessage("O catálogo ainda não tem assuntos disponíveis.");
      return;
    }
    setBankLoading(true);
    setBankMessage("");
    const response = await searchQuestionBankAction({ topicId: bankTopicId, query: bankSearch });
    setBankResults(response.items);
    setBankMessage(response.message);
    setBankLoading(false);
  }

  function addBankQuestion(item: QuestionBankSearchItem) {
    if (!draft) return;
    if (draft.questions.some((question) => question.sourceBankQuestionId === item.id)) return;
    if (draft.questions.length >= 30) {
      notify("Cada simulado pode ter até 30 questões.", true);
      return;
    }

    const catalogTopic = bankTopics.find((topic) => topic.id === item.topic_id);
    const matchingTopic = catalogTopic && topics.find((topic) =>
      normalizeCategoryName(topic.name) === normalizeCategoryName(catalogTopic.name)
      && normalizeCategoryName(topic.subjectName) === normalizeCategoryName(catalogTopic.subjectName),
    );
    const onlyBlankStarter = draft.questions.length === 1
      && !draft.questions[0].sourceBankQuestionId
      && !draft.questions[0].prompt.trim()
      && draft.questions[0].options.every((option) => !option.text.trim());
    const nextQuestions = onlyBlankStarter ? [] : draft.questions;
    setDraft({
      ...draft,
      questions: [...nextQuestions, {
        sourceBankQuestionId: item.id,
        prompt: item.prompt,
        topicId: matchingTopic?.id ?? "",
        explanation: "",
        options: item.options.map((option) => ({ text: option.label })),
        correctIndex: -1,
      }],
    });
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    const questions = draft.questions.map((question) => {
      if (question.sourceBankQuestionId) {
        return {
          bank_question_id: question.sourceBankQuestionId,
          topic_id: question.topicId || null,
        };
      }
      const options = question.options
        .map((option, index) => ({ text: option.text.trim(), originalIndex: index }))
        .filter((option) => option.text.length > 0);
      const correctOptionIndex = options.findIndex((option) => option.originalIndex === question.correctIndex);
      return {
        prompt: question.prompt.trim(),
        topic_id: question.topicId || null,
        explanation: question.explanation.trim() || null,
        options: options.map((option) => ({ text: option.text })),
        correct_option_index: correctOptionIndex,
      };
    });

    if (!draft.title.trim()) {
      setDraftError("Dê um título ao simulado para continuar.");
      return;
    }
    const incompleteQuestion = draft.questions.findIndex((question) => {
      if (question.sourceBankQuestionId) return false;
      const filledOptions = question.options.filter((option) => option.text.trim().length > 0);
      return !question.prompt.trim() || filledOptions.length < 2
        || question.correctIndex < 0 || question.correctIndex >= question.options.length
        || !question.options[question.correctIndex]?.text.trim();
    });
    if (incompleteQuestion >= 0) {
      setDraftError(`Revise a pergunta ${incompleteQuestion + 1}: inclua o enunciado, pelo menos duas alternativas e marque a correta.`);
      return;
    }

    setBusy(true);
    setDraftError("");
    const response = await saveQuizAction({
      quizId: draft.quizId,
      title: draft.title,
      description: draft.description.trim() || null,
      questions,
    });
    setBusy(false);
    if (!response.success) {
      setDraftError(response.message);
      return;
    }
    setDraft(null);
    notify(response.message);
  }

  async function deleteQuiz(quiz: QuizCardData) {
    if (!window.confirm(`Excluir “${quiz.title}” e todo o histórico deste simulado?`)) return;
    setBusyItem(quiz.id);
    const response = await deleteQuizAction(quiz.id);
    setBusyItem(null);
    notify(response.message, !response.success);
  }

  function beginAttempt(quiz: QuizCardData) {
    if (quiz.questions.length === 0) {
      notify("Adicione pelo menos uma pergunta antes de iniciar.", true);
      return;
    }
    setActiveQuizId(quiz.id);
    setSelectedAnswers({});
    setQuestionIndex(0);
    setResult(null);
    setScreen("taking");
  }

  async function submitAttempt() {
    if (!activeQuiz) return;
    if (Object.keys(selectedAnswers).length !== activeQuiz.questions.length) {
      notify("Responda todas as questões antes de enviar o simulado.", true);
      return;
    }
    setBusy(true);
    const response = await submitQuizAttemptAction({
      quizId: activeQuiz.id,
      answers: activeQuiz.questions
        .filter((question) => selectedAnswers[question.id])
        .map((question) => ({
          questionId: question.id,
          selectedOptionId: selectedAnswers[question.id],
        })),
    });
    setBusy(false);
    if (!response.data) {
      notify(response.message, true);
      return;
    }
    setResult(resultFromAction(response.data));
    setScreen("result");
  }

  async function viewAttempt(attempt: QuizAttemptSummary) {
    setBusyItem(attempt.id);
    const response = await loadQuizAttemptAction(attempt.id);
    setBusyItem(null);
    if (!response.data) {
      notify(response.message, true);
      return;
    }
    setActiveQuizId(attempt.quiz_id);
    setResult(resultFromHistory(response.data.attempt, response.data.answers));
    setScreen("result");
  }

  function returnToLibrary() {
    setScreen("library");
    setResult(null);
    setSelectedAnswers({});
    setQuestionIndex(0);
  }

  if (screen === "taking" && activeQuiz) {
    const question = activeQuiz.questions[questionIndex];
    const selectedOptionId = selectedAnswers[question.id];
    const progress = Math.round(((questionIndex + 1) / activeQuiz.questions.length) * 100);

    return (
      <div className="quiz-workspace">
        <div className="quiz-taking-topline">
          <button className="quiz-text-button" onClick={returnToLibrary} type="button"><ArrowLeft size={15} /> Voltar aos simulados</button>
          <span><Clock3 size={14} /> Sem tempo limite</span>
        </div>
        <section className="quiz-taking-card" aria-labelledby="quiz-taking-title">
          <div className="quiz-taking-heading">
            <div>
              <span className="auth-kicker">SIMULADO EM ANDAMENTO</span>
              <h1 id="quiz-taking-title">{activeQuiz.title}</h1>
            </div>
            <strong>{questionIndex + 1}<span> / {activeQuiz.questions.length}</span></strong>
          </div>
          <div className="quiz-progress-track" aria-label={`${progress}% concluído`}><span style={{ width: `${progress}%` }} /></div>
          <div className="quiz-question-content">
            <div className="quiz-question-meta">
              <span>QUESTÃO {String(questionIndex + 1).padStart(2, "0")}</span>
              {question.topicName && <span>{question.topicName}</span>}
            </div>
            <h2>{question.prompt}</h2>
            <div className="quiz-answer-options" role="radiogroup" aria-label="Alternativas">
              {question.options.map((option, index) => {
                const chosen = selectedOptionId === option.id;
                return (
                  <button
                    aria-checked={chosen}
                    className={`quiz-answer-option${chosen ? " is-selected" : ""}`}
                    key={option.id}
                    onClick={() => setSelectedAnswers((previous) => ({ ...previous, [question.id]: option.id }))}
                    role="radio"
                    type="button"
                  >
                    <span className="quiz-answer-letter">{optionLetters[index]}</span>
                    <span>{option.label}</span>
                    {chosen && <Check aria-hidden="true" className="quiz-answer-check" size={18} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="quiz-taking-footer">
            <button
              className="button button-secondary"
              disabled={questionIndex === 0 || busy}
              onClick={() => setQuestionIndex((value) => Math.max(0, value - 1))}
              type="button"
            ><ArrowLeft size={15} /> Anterior</button>
            <span>{Object.keys(selectedAnswers).length} respondida(s)</span>
            {questionIndex < activeQuiz.questions.length - 1 ? (
              <button className="button button-primary" onClick={() => setQuestionIndex((value) => value + 1)} type="button">
                Próxima <ArrowRight size={15} />
              </button>
            ) : (
              <button className="button button-primary" disabled={busy} onClick={() => void submitAttempt()} type="button">
                {busy ? <LoaderCircle className="quiz-spin" size={16} /> : <CheckCircle2 size={16} />}
                {busy ? "Corrigindo…" : "Enviar respostas"}
              </button>
            )}
          </div>
        </section>
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (screen === "result" && result) {
    const scoreTone = result.percentage >= 70 ? "is-strong" : result.percentage >= 40 ? "is-mid" : "is-low";
    const submittedAttempt = result.attemptId ? attempts.find((attempt) => attempt.id === result.attemptId) : null;
    return (
      <div className="quiz-workspace">
        <div className="quiz-taking-topline">
          <button className="quiz-text-button" onClick={returnToLibrary} type="button"><ArrowLeft size={15} /> Voltar aos simulados</button>
          <span><History size={14} /> Resultado e correção</span>
        </div>
        <section className="quiz-result-summary" aria-labelledby="quiz-result-title">
          <div className={`quiz-score-ring ${scoreTone}`}>
            <strong>{Math.round(result.percentage)}%</strong>
            <span>de acertos</span>
          </div>
          <div className="quiz-result-copy">
            <span className="auth-kicker">SIMULADO CONCLUÍDO</span>
            <h1 id="quiz-result-title">{result.title}</h1>
            <p>Você acertou <strong>{result.correct} de {result.total}</strong> questões e respondeu {result.answered}.</p>
            {submittedAttempt && <small>Salvo em {formatDate(submittedAttempt.submitted_at)}</small>}
          </div>
          <div className="quiz-result-actions">
            <button className="button button-secondary" onClick={returnToLibrary} type="button">Concluir</button>
            {activeQuiz && <button className="button button-primary" onClick={() => beginAttempt(activeQuiz)} type="button"><ArrowRight size={15} /> Tentar novamente</button>}
          </div>
        </section>
        <section className="quiz-correction-panel" aria-labelledby="quiz-correction-title">
          <div className="quiz-section-title">
            <div><span className="quiz-section-kicker">REVISÃO DAS RESPOSTAS</span><h2 id="quiz-correction-title">Veja o que acertou e o que pode rever</h2></div>
            <span className="quiz-correction-count">{result.answers.length} questões</span>
          </div>
          <div className="quiz-correction-list">
            {result.answers.map((answer) => (
              <article className={`quiz-correction-item${answer.isCorrect ? " is-correct" : " is-wrong"}`} key={`${answer.position}-${answer.prompt}`}>
                <div className="quiz-correction-marker">{answer.isCorrect ? <Check size={16} /> : <X size={16} />}</div>
                <div className="quiz-correction-body">
                  <div className="quiz-question-meta"><span>QUESTÃO {String(answer.position).padStart(2, "0")}</span>{answer.topic && <span>{answer.topic}</span>}</div>
                  <h3>{answer.prompt}</h3>
                  <p>Sua resposta: <strong>{answer.selected ?? "Não respondida"}</strong></p>
                  {!answer.isCorrect && <p>Resposta correta: <strong>{answer.correct}</strong></p>}
                  {answer.explanation && <small>{answer.explanation}</small>}
                </div>
              </article>
            ))}
          </div>
        </section>
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  const totalQuestions = quizzes.reduce((total, quiz) => total + quiz.questions.length, 0);
  const latestAttempt = attempts[0];

  return (
    <div className="quiz-workspace">
      <div className="quiz-heading">
        <div>
          <span className="auth-kicker">PRATIQUE E ACOMPANHE SUA EVOLUÇÃO</span>
          <h1>Simulados</h1>
          <p>Crie suas questões, teste o que aprendeu e revise cada resposta depois da correção.</p>
        </div>
        <button className="button button-primary quiz-create-button" disabled={configurationError} onClick={startCreate} type="button">
          <Plus size={17} /> Criar simulado
        </button>
      </div>

      {(loadError || configurationError) && (
        <p className="quiz-load-error" role="alert"><AlertCircle size={16} />
          {configurationError ? "Os limites da conta não estão disponíveis agora." : "Não foi possível carregar todos os simulados. Atualize a página para tentar novamente."}
        </p>
      )}

      <div className="quiz-capacity-row">
        <div className="quiz-capacity-card">
          <div><span>Simulados salvos</span><strong>{quizzes.length}{quizLimit !== null && <small> / {quizLimit}</small>}</strong></div>
          <div className="quiz-capacity-track"><span style={{ width: `${quizLimit ? Math.min(100, (quizzes.length / quizLimit) * 100) : 0}%` }} /></div>
          <small>Limite do plano atual</small>
        </div>
        <div className="quiz-stat-card"><span className="quiz-stat-icon is-violet"><FileQuestion size={18} /></span><div><strong>{totalQuestions}</strong><small>Questões criadas</small></div></div>
        <div className="quiz-stat-card"><span className="quiz-stat-icon is-green"><BookOpenCheck size={18} /></span><div><strong>{attemptCount}</strong><small>Tentativas registradas</small></div></div>
        <div className="quiz-stat-card"><span className="quiz-stat-icon is-blue"><Sparkles size={18} /></span><div><strong>{latestAttempt ? `${Math.round(latestAttempt.score_percent)}%` : "—"}</strong><small>Resultado mais recente</small></div></div>
      </div>

      <div className="quiz-content-grid">
        <section className="quiz-library-panel" aria-labelledby="quiz-library-title">
          <div className="quiz-section-title">
            <div><span className="quiz-section-kicker">SUA BIBLIOTECA</span><h2 id="quiz-library-title">Seus simulados</h2></div>
            <span className="quiz-count-pill">{quizzes.length}</span>
          </div>
          {quizzes.length === 0 ? (
            <div className="quiz-empty-state">
              <span><ClipboardList size={25} /></span>
              <h3>Seu primeiro simulado começa aqui</h3>
              <p>Adicione perguntas e alternativas para praticar no seu próprio ritmo. A correção aparece somente depois do envio.</p>
              <button className="button button-primary" disabled={configurationError} onClick={startCreate} type="button"><Plus size={15} /> Criar meu primeiro simulado</button>
            </div>
          ) : (
            <div className="quiz-library-list">
              {quizzes.map((quiz) => {
                const quizAttempts = attempts.filter((attempt) => attempt.quiz_id === quiz.id);
                const lastQuizAttempt = quizAttempts[0];
                return (
                  <article className="quiz-library-card" key={quiz.id}>
                    <div className="quiz-library-card-top">
                      <span className="quiz-library-icon"><ClipboardList size={18} /></span>
                      <div className="quiz-library-copy"><h3>{quiz.title}</h3><p>{quiz.description || "Simulado criado por você"}</p></div>
                      <span className="quiz-question-count"><FileQuestion size={13} /> {quiz.questions.length} {quiz.questions.length === 1 ? "questão" : "questões"}</span>
                    </div>
                    <div className="quiz-library-meta">
                      <span><History size={13} /> {quizAttempts.length} {quizAttempts.length === 1 ? "tentativa" : "tentativas"}</span>
                      {lastQuizAttempt && <span>Último resultado: <strong>{Math.round(lastQuizAttempt.score_percent)}%</strong></span>}
                    </div>
                    <div className="quiz-library-actions">
                      <button className="button button-primary" disabled={!quiz.questions.length} onClick={() => beginAttempt(quiz)} type="button"><ArrowRight size={15} /> Iniciar simulado</button>
                      <button className="quiz-icon-action" disabled={busyItem === quiz.id} onClick={() => void startEdit(quiz.id)} title="Editar simulado" type="button">
                        {busyItem === quiz.id ? <LoaderCircle className="quiz-spin" size={16} /> : <Save size={15} />}<span>Editar</span>
                      </button>
                      <button className="quiz-icon-action is-danger" disabled={busyItem === quiz.id} onClick={() => void deleteQuiz(quiz)} title="Excluir simulado" type="button"><Trash2 size={15} /><span>Excluir</span></button>
                    </div>
                    {quiz.questions[0] && <p className="quiz-first-question"><span>PRÉVIA</span>{quiz.questions[0].prompt}</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="quiz-history-panel" aria-labelledby="quiz-history-title">
          <div className="quiz-section-title">
            <div><span className="quiz-section-kicker">SEU PROGRESSO</span><h2 id="quiz-history-title">Histórico de tentativas</h2></div>
            <History aria-hidden="true" className="quiz-history-heading-icon" size={18} />
          </div>
          {attempts.length === 0 ? (
            <p className="quiz-history-empty">Quando concluir seu primeiro simulado, você encontrará aqui a nota e a correção para revisar.</p>
          ) : (
            <ol className="quiz-history-list">
              {attempts.slice(0, 8).map((attempt) => (
                <li key={attempt.id}>
                  <span className={`quiz-history-score${attempt.score_percent >= 70 ? " is-strong" : attempt.score_percent >= 40 ? " is-mid" : " is-low"}`}>{Math.round(attempt.score_percent)}%</span>
                  <div><strong>{attempt.quiz_title}</strong><small>{attempt.correct_count}/{attempt.total_questions} corretas · {formatDate(attempt.submitted_at)}</small></div>
                  <button aria-label={`Rever resultado de ${attempt.quiz_title}`} className="quiz-history-view" disabled={busyItem === attempt.id} onClick={() => void viewAttempt(attempt)} type="button">
                    {busyItem === attempt.id ? <LoaderCircle className="quiz-spin" size={15} /> : <ArrowRight size={15} />}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="quiz-history-note"><CheckCircle2 size={15} /><span>Cada tentativa guarda a versão das perguntas e o resultado daquele dia.</span></div>
        </section>
      </div>

      {draft && (
        <div className="quiz-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section aria-labelledby="quiz-editor-title" aria-modal="true" className="quiz-editor-dialog" onKeyDown={(event) => { if (event.key === "Escape") closeEditor(); }} role="dialog">
            <div className="quiz-editor-header">
              <div><span className="auth-kicker">{draft.quizId ? "ATUALIZE SEU CONTEÚDO" : "MONTE SEU MATERIAL DE PRÁTICA"}</span><h2 id="quiz-editor-title">{draft.quizId ? "Editar simulado" : "Novo simulado"}</h2><p>{draft.quizId ? "Para manter o gabarito protegido, marque novamente a alternativa correta em cada questão." : "As respostas corretas ficam ocultas durante a resolução."}</p></div>
              <button aria-label="Fechar editor" className="quiz-modal-close" disabled={busy} onClick={closeEditor} type="button"><X size={18} /></button>
            </div>
            <form className="quiz-editor-form" onSubmit={(event) => void saveDraft(event)}>
              <label className="quiz-field"><span>Título do simulado</span><input autoFocus maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Biologia — citologia" value={draft.title} /></label>
              <label className="quiz-field"><span>Descrição <small>opcional</small></span><input maxLength={1000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Uma nota para lembrar o foco deste simulado" value={draft.description} /></label>
              <button className="quiz-bank-toggle" disabled={!bankTopics.length} onClick={() => setBankOpen((open) => !open)} type="button">
                <span><LibraryBig size={17} /> {bankOpen ? "Fechar catálogo de questões" : "Buscar no catálogo de questões"}</span>
                <small>{bankQuestionCount ? `${bankQuestionCount} questões · ${bankTopics.length} assuntos` : "Catálogo indisponível"}</small>
              </button>
              {bankOpen && (
                <section aria-label="Buscar questões no catálogo do StudyFlow" className="quiz-bank-browser">
                  <div className="quiz-bank-browser-heading">
                    <span className="quiz-section-kicker">CATÁLOGO STUDYFLOW</span>
                    <p>Filtre por disciplina e assunto. O gabarito e os comentários ficam ocultos até a correção.</p>
                  </div>
                  <div className="quiz-bank-filter-row">
                    <label className="quiz-field"><span>Disciplina e assunto</span>
                      <select onChange={(event) => { setBankTopicId(event.target.value); setBankResults([]); setBankMessage(""); }} value={bankTopicId}>
                        {bankTopics.length === 0 && <option value="">Nenhum assunto disponível</option>}
                        {[...new Set(bankTopics.map((topic) => topic.subjectName))].map((subjectName) => (
                          <optgroup key={subjectName} label={`${bankTopics.find((topic) => topic.subjectName === subjectName)?.area ?? ""} · ${subjectName}`}>
                            {bankTopics.filter((topic) => topic.subjectName === subjectName).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label className="quiz-field"><span>Palavra-chave <small>opcional</small></span>
                      <span className="quiz-bank-search-field"><input maxLength={120} onChange={(event) => setBankSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchBankQuestions(); } }} placeholder="Ex.: porcentagem, ecologia…" value={bankSearch} /><button aria-label="Buscar questões" className="quiz-bank-search-button" disabled={bankLoading || !bankTopicId} onClick={() => void searchBankQuestions()} type="button">{bankLoading ? <LoaderCircle className="quiz-spin" size={16} /> : <Search size={16} />}</button></span>
                    </label>
                  </div>
                  {visibleBankResults.length > 0 ? (
                    <div className="quiz-bank-results">
                      {visibleBankResults.map((item, index) => {
                        return (
                          <article className="quiz-bank-result" key={item.id}>
                            <div className="quiz-bank-result-top"><span>QUESTÃO {String(index + 1).padStart(2, "0")}</span><span>{difficultyLabel(item.difficulty)}</span></div>
                            <h3>{item.prompt}</h3>
                            <p className={`quiz-bank-origin${item.origin_type === "official_adaptation" ? " is-official" : ""}`}>
                              <span>{item.origin_label}</span>
                              {item.origin_url && <a href={item.origin_url} rel="noreferrer" target="_blank">Ver fonte</a>}
                            </p>
                            <ol>{item.options.map((option, optionIndex) => <li key={option.id}><span>{optionLetters[optionIndex]}</span>{option.label}</li>)}</ol>
                            <button className="button button-secondary" disabled={draft.questions.length >= 30} onClick={() => addBankQuestion(item)} type="button"><Plus size={14} /> Adicionar ao simulado</button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={`quiz-bank-empty${bankMessage ? " has-message" : ""}`}>{bankLoading ? "Buscando quest\u00f5es\u2026" : bankMessage || (bankResults.length > 0 ? "Voc\u00ea j\u00e1 adicionou todas as quest\u00f5es desta busca." : "Escolha um assunto e busque para ver as quest\u00f5es dispon\u00edveis.")}</p>
                  )}
                </section>
              )}
              <div className="quiz-draft-question-list">
                {draft.questions.map((question, questionIndex) => (
                  <fieldset className="quiz-draft-question" key={questionIndex}>
                    <div className="quiz-draft-question-heading"><legend>Questão {String(questionIndex + 1).padStart(2, "0")}</legend>
                      {draft.questions.length > 1 && <button aria-label={`Remover questão ${questionIndex + 1}`} className="quiz-remove-question" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, index) => index !== questionIndex) })} type="button"><Trash2 size={14} /> Remover</button>}
                    </div>
                    {question.sourceBankQuestionId && <div className="quiz-bank-draft-label"><LibraryBig size={14} /><span>Questão do catálogo · gabarito protegido</span></div>}
                    <label className="quiz-field"><span>Enunciado</span><textarea disabled={Boolean(question.sourceBankQuestionId)} maxLength={3000} onChange={(event) => setDraft(updateQuestion(draft, questionIndex, { prompt: event.target.value }))} placeholder="Escreva a pergunta com clareza" rows={3} value={question.prompt} /></label>
                    <label className="quiz-field"><span>Assunto <small>opcional</small></span>
                      <select onChange={(event) => setDraft(updateQuestion(draft, questionIndex, { topicId: event.target.value }))} value={question.topicId}>
                        <option value="">Sem assunto</option>
                        {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subjectName} · {topic.name}</option>)}
                      </select>
                    </label>
                    <div className="quiz-options-editor">
                      <div className="quiz-options-editor-heading"><strong>Alternativas</strong>{!question.sourceBankQuestionId && <small>{"Marque a op\u00e7\u00e3o correta"}</small>}</div>
                      {question.options.map((option, optionIndex) => (
                        <div className={`quiz-draft-option${question.correctIndex === optionIndex ? " is-answer" : ""}`} key={optionIndex}>
                          <label className="quiz-correct-choice" title={`Marcar alternativa ${optionLetters[optionIndex]} como correta`}>
                            <input aria-label={`Alternativa ${optionLetters[optionIndex]} é a correta`} checked={question.correctIndex === optionIndex} disabled={Boolean(question.sourceBankQuestionId)} name={`correct-${questionIndex}`} onChange={() => setDraft(updateQuestion(draft, questionIndex, { correctIndex: optionIndex }))} type="radio" />
                            <span>{optionLetters[optionIndex]}</span>
                          </label>
                          <input aria-label={`Texto da alternativa ${optionLetters[optionIndex]}`} maxLength={500} readOnly={Boolean(question.sourceBankQuestionId)} onChange={(event) => setDraft(updateOption(draft, questionIndex, optionIndex, event.target.value))} placeholder={`Alternativa ${optionLetters[optionIndex]}`} value={option.text} />
                          {!question.sourceBankQuestionId && question.options.length > 2 && <button aria-label={`Remover alternativa ${optionLetters[optionIndex]}`} className="quiz-remove-option" onClick={() => setDraft(removeOption(draft, questionIndex, optionIndex))} type="button"><X size={14} /></button>}
                        </div>
                      ))}
                      {!question.sourceBankQuestionId && question.options.length < 6 && <button className="quiz-add-option" onClick={() => setDraft(updateQuestion(draft, questionIndex, { options: [...question.options, { text: "" }] }))} type="button"><Plus size={13} /> Adicionar alternativa</button>}
                    </div>
                    <label className="quiz-field"><span>Comentário da correção <small>opcional, aparece após o envio</small></span><textarea maxLength={2000} onChange={(event) => setDraft(updateQuestion(draft, questionIndex, { explanation: event.target.value }))} placeholder="Explique brevemente o raciocínio" rows={2} value={question.explanation} /></label>
                  </fieldset>
                ))}
              </div>
              {draft.questions.length < 30 && <button className="quiz-add-question" onClick={() => setDraft({ ...draft, questions: [...draft.questions, blankQuestion()] })} type="button"><Plus size={15} /> Adicionar questão <span>{draft.questions.length}/30</span></button>}
              {draftError && <p className="quiz-editor-error" role="alert"><AlertCircle size={15} /> {draftError}</p>}
              <div className="quiz-editor-footer">
                <span>{draft.quizId ? "Ao salvar, novas tentativas usam esta versão." : "Você pode editar o simulado depois."}</span>
                <div><button className="button button-secondary" disabled={busy} onClick={closeEditor} type="button">Cancelar</button>
                  <button className="button button-primary" disabled={busy} type="submit">{busy ? <LoaderCircle className="quiz-spin" size={16} /> : <Save size={15} />}{busy ? "Salvando…" : "Salvar simulado"}</button></div>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function updateQuestion(draft: QuizDraft, questionIndex: number, patch: Partial<DraftQuestion>): QuizDraft {
  return {
    ...draft,
    questions: draft.questions.map((question, index) => index === questionIndex ? { ...question, ...patch } : question),
  };
}

function updateOption(draft: QuizDraft, questionIndex: number, optionIndex: number, text: string): QuizDraft {
  return {
    ...draft,
    questions: draft.questions.map((question, index) => index === questionIndex
      ? { ...question, options: question.options.map((option, optionNumber) => optionNumber === optionIndex ? { text } : option) }
      : question),
  };
}

function removeOption(draft: QuizDraft, questionIndex: number, optionIndex: number): QuizDraft {
  return {
    ...draft,
    questions: draft.questions.map((question, index) => {
      if (index !== questionIndex) return question;
      const options = question.options.filter((_, optionNumber) => optionNumber !== optionIndex);
      const correctIndex = question.correctIndex === optionIndex
        ? 0
        : question.correctIndex > optionIndex ? question.correctIndex - 1 : question.correctIndex;
      return { ...question, options, correctIndex };
    }),
  };
}

function Toast({ toast, onClose }: { toast: QuizToast; onClose: () => void }) {
  return (
    <div aria-live={toast.error ? "assertive" : "polite"} className="quiz-toast-region">
      <div className={`quiz-toast${toast.error ? " is-error" : ""}`} key={toast.id} role={toast.error ? "alert" : "status"}>
        <span className="quiz-toast-icon">{toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}</span>
        <span className="quiz-toast-copy"><strong>{toast.error ? "Não foi possível concluir" : "Tudo certo"}</strong><small>{toast.message}</small></span>
        <button aria-label="Dispensar aviso" className="quiz-toast-close" onClick={onClose} type="button"><X size={16} /></button>
        <span aria-hidden="true" className="quiz-toast-progress" />
      </div>
    </div>
  );
}

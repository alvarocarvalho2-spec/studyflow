"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Check, Clock3, Play } from "lucide-react";
import {
  finishStudySessionAction,
  startStudySessionAction,
  type ActiveStudySession,
} from "@/app/dashboard/productivity-actions";

type FocusTopic = { id: string; label: string };
type FocusTimerProps = {
  activeSession: ActiveStudySession | null;
  topics: FocusTopic[];
};
type FocusTimerPanelProps = { initialSession: ActiveStudySession | null; topics: FocusTopic[] };

const minuteChoices = [15, 25, 45] as const;

function formatTimer(seconds: number | null) {
  if (seconds === null) return "--:--";
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export function FocusTimer({ activeSession: initialSession, topics }: FocusTimerProps) {
  return <FocusTimerPanel key={initialSession?.id ?? "idle"} initialSession={initialSession} topics={topics} />;
}

function FocusTimerPanel({ initialSession, topics }: FocusTimerPanelProps) {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState(initialSession);
  const [plannedMinutes, setPlannedMinutes] = useState<(typeof minuteChoices)[number]>(25);
  const [topicId, setTopicId] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(initialSession ? null : 25 * 60);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const autoFinishForSession = useRef<string | null>(null);
  const finishRequestInFlight = useRef(false);

  const finishSession = useCallback(async (sessionId: string) => {
    if (finishRequestInFlight.current) return false;
    finishRequestInFlight.current = true;
    setPending(true);
    try {
      const result = await finishStudySessionAction(sessionId);
      setNotice({ kind: result.success ? "success" : "error", message: result.message });
      if (!result.success) return false;

      setActiveSession(null);
      setSecondsLeft(0);
      router.refresh();
      return true;
    } catch {
      setNotice({ kind: "error", message: "A sessão não foi salva. Verifique sua conexão e tente novamente." });
      return false;
    } finally {
      setPending(false);
      finishRequestInFlight.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (!activeSession) return;

    const updateRemaining = () => {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - Date.parse(activeSession.started_at)) / 1000),
      );
      const remaining = Math.max(0, activeSession.planned_minutes * 60 - elapsedSeconds);
      setSecondsLeft(remaining);

      if (remaining === 0 && autoFinishForSession.current !== activeSession.id) {
        autoFinishForSession.current = activeSession.id;
        startTransition(() => { void finishSession(activeSession.id); });
      }
    };

    const firstUpdate = window.setTimeout(updateRemaining, 0);
    const interval = window.setInterval(updateRemaining, 1000);
    return () => {
      window.clearTimeout(firstUpdate);
      window.clearInterval(interval);
    };
  }, [activeSession, finishSession]);

  async function startSession() {
    setNotice(null);
    setPending(true);
    try {
      const result = await startStudySessionAction({
        topicId: topicId || null,
        plannedMinutes,
      });
      if (!result.success || !result.session) {
        setNotice({ kind: "error", message: result.message });
        return;
      }

      setActiveSession(result.session);
      setSecondsLeft(null);
      setNotice({ kind: "success", message: result.message });
      router.refresh();
    } catch {
      setNotice({ kind: "error", message: "Não foi possível iniciar a sessão. Tente novamente." });
    } finally {
      setPending(false);
    }
  }

  const targetSeconds = (activeSession?.planned_minutes ?? plannedMinutes) * 60;
  const elapsedPercent = activeSession && secondsLeft !== null
    ? Math.min(100, Math.max(0, ((targetSeconds - secondsLeft) / targetSeconds) * 100))
    : 0;
  const selectedTopicId = activeSession ? activeSession.topic_id ?? "" : topicId;

  return (
    <section aria-labelledby="focus-timer-title" className="focus-card">
      <div className="focus-card-heading">
        <span aria-hidden="true" className="focus-icon"><Clock3 size={18} /></span>
        <div>
          <span className="auth-kicker">PRODUTIVIDADE</span>
          <h2 id="focus-timer-title">Bloco de foco</h2>
        </div>
      </div>

      <div aria-label="Tempo restante" className="focus-clock" role="timer">
        {formatTimer(secondsLeft)}
      </div>
      <div
        aria-label={`${Math.round(elapsedPercent)}% do bloco concluído`}
        className="focus-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(elapsedPercent)}
      >
        <span style={{ width: `${elapsedPercent}%` }} />
      </div>

      <label className="focus-topic-field">
        <span><BookOpenCheck aria-hidden="true" size={14} /> Assunto deste bloco</span>
        <select
          disabled={Boolean(activeSession) || pending || topics.length === 0}
          onChange={(event) => setTopicId(event.target.value)}
          value={selectedTopicId}
        >
          <option value="">Estudo geral, sem assunto</option>
          {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
        </select>
      </label>

      {!activeSession && (
        <div aria-label="Duração do bloco" className="focus-duration-options" role="group">
          {minuteChoices.map((minutes) => (
            <button
              aria-pressed={plannedMinutes === minutes}
              className={plannedMinutes === minutes ? "is-selected" : ""}
              disabled={pending}
              key={minutes}
              onClick={() => {
                setPlannedMinutes(minutes);
                setSecondsLeft(minutes * 60);
              }}
              type="button"
            >
              {minutes} min
            </button>
          ))}
        </div>
      )}

      {activeSession ? (
        <button
          className="button button-primary focus-action"
          disabled={pending}
          onClick={() => void finishSession(activeSession.id)}
          type="button"
        >
          <Check aria-hidden="true" size={16} />
          {pending ? "Salvando sessão…" : secondsLeft === 0 ? "Salvar sessão" : "Encerrar e salvar"}
        </button>
      ) : (
        <button
          className="button button-primary focus-action"
          disabled={pending}
          onClick={() => void startSession()}
          type="button"
        >
          <Play aria-hidden="true" size={16} fill="currentColor" />
          {pending ? "Iniciando…" : "Começar a estudar"}
        </button>
      )}

      {activeSession && secondsLeft === 0 && !pending && (
        <p className="focus-expired"><Check aria-hidden="true" size={14} /> Tempo concluído. Registre a sessão para atualizar seu painel.</p>
      )}
      {notice && <p aria-live="polite" className={`focus-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.message}</p>}
      <p className="focus-caption">O tempo é registrado pelo servidor e aparece no seu resumo semanal.</p>
    </section>
  );
}

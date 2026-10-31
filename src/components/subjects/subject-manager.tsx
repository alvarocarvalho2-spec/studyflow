"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { BookOpen, Check, CirclePlus, PencilLine, Trash2, X } from "lucide-react";
import type { Tables } from "@/lib/supabase/database.types";
import {
  createSubjectAction,
  createTopicAction,
  deleteSubjectAction,
  deleteTopicAction,
  updateSubjectAction,
  updateTopicAction,
  type SubjectActionState,
} from "@/app/dashboard/subject-actions";

type Subject = Pick<Tables<"subjects">, "id" | "name" | "color" | "created_at">;
type Topic = Pick<Tables<"topics">, "id" | "subject_id" | "name" | "difficulty">;
type SubjectColor = Tables<"subjects">["color"];

export type SubjectWithTopics = Subject & { topics: Topic[] };
type DashboardToast = { id: number; message: string };

const initialState: SubjectActionState = {};
const colorNames: Record<SubjectColor, string> = {
  violet: "Violeta",
  blue: "Azul",
  teal: "Verde-água",
  amber: "Âmbar",
  rose: "Rosa",
  slate: "Ardósia",
};
const difficultyNames: Record<number, string> = {
  1: "Muito tranquilo",
  2: "Fácil",
  3: "Moderado",
  4: "Difícil",
  5: "Muito difícil",
};

function ActionFeedback({ state }: { state: SubjectActionState }) {
  if (!state.message) return null;
  return (
    <p className={`subject-feedback ${state.kind === "error" ? "is-error" : "is-success"}`} role={state.kind === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

function DifficultySelect({
  id,
  defaultValue = 3,
  value,
  onChange,
}: {
  id: string;
  defaultValue?: number;
  value?: number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="subject-field" htmlFor={id}>
      <span>Dificuldade percebida</span>
      <select {...(value === undefined ? { defaultValue } : { value, onChange })} id={id} name="difficulty">
        {Object.entries(difficultyNames).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}

function TopicRow({ topic, onUpdated }: { topic: Topic; onUpdated: (message: string) => void }) {
  const [updateState, updateAction, updating] = useActionState(
    updateTopicAction.bind(null, topic.id),
    initialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteTopicAction.bind(null, topic.id),
    initialState,
  );
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(topic.name);
  const [difficulty, setDifficulty] = useState(topic.difficulty);
  const savedTopicRef = useRef({ name: topic.name, difficulty: topic.difficulty });
  const submittedTopicRef = useRef({ name: topic.name, difficulty: topic.difficulty });

  useEffect(() => {
    if (!updating && updateState.kind === "success") {
      savedTopicRef.current = { ...submittedTopicRef.current, name: submittedTopicRef.current.name.trim() };
      editDialogRef.current?.close();
      onUpdated(updateState.message ?? "Assunto atualizado.");
    }
  }, [onUpdated, updateState.kind, updateState.message, updating]);

  function openEditor() {
    setName(savedTopicRef.current.name);
    setDifficulty(savedTopicRef.current.difficulty);
    editDialogRef.current?.showModal();
  }

  function closeEditor() {
    setName(savedTopicRef.current.name);
    setDifficulty(savedTopicRef.current.difficulty);
    editDialogRef.current?.close();
  }

  return (
    <li className="topic-row">
      <div className="topic-row-summary">
        <div>
          <strong>{topic.name}</strong>
          <span className="topic-difficulty">{difficultyNames[topic.difficulty] ?? "Moderado"}</span>
        </div>
        <button aria-label={`Editar ${topic.name}`} className="topic-edit-trigger" onClick={openEditor} title="Editar assunto" type="button">
          <PencilLine aria-hidden="true" size={15} />
        </button>
        <dialog aria-labelledby={`edit-topic-title-${topic.id}`} className="edit-dialog" ref={editDialogRef}>
          <div className="edit-dialog-header">
            <div>
              <span className="edit-dialog-kicker">EDITAR ASSUNTO</span>
              <h3 id={`edit-topic-title-${topic.id}`}>Atualize seu assunto</h3>
              <p>Ajuste o nome ou a dificuldade conforme seus estudos avançam.</p>
            </div>
            <button aria-label="Fechar edição" className="edit-dialog-close" onClick={closeEditor} type="button"><X aria-hidden="true" size={18} /></button>
          </div>
          <form action={updateAction} className="edit-dialog-form" onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            submittedTopicRef.current = {
              name: String(formData.get("name") ?? ""),
              difficulty: Number(formData.get("difficulty")),
            };
          }}>
            <label className="subject-field" htmlFor={`topic-name-${topic.id}`}>
              <span>Nome do assunto</span>
              <input id={`topic-name-${topic.id}`} maxLength={100} name="name" onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
            <DifficultySelect
              id={`topic-difficulty-${topic.id}`}
              onChange={(event) => setDifficulty(Number(event.target.value))}
              value={difficulty}
            />
            <div className="edit-dialog-actions">
              <button className="button button-outline button-small" onClick={closeEditor} type="button">Cancelar</button>
              <button className="button button-small button-primary" disabled={updating} type="submit">
                {updating ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
            {updateState.kind === "error" && <ActionFeedback state={updateState} />}
          </form>
        </dialog>
        <form action={deleteAction} onSubmit={(event) => {
          if (!window.confirm(`Excluir o assunto “${topic.name}”?`)) event.preventDefault();
        }}>
          <button aria-label={`Excluir ${topic.name}`} className="icon-button danger-button" disabled={deleting} title="Excluir assunto" type="submit">
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </form>
      </div>
      <ActionFeedback state={deleteState} />
    </li>
  );
}

function SubjectCard({ subject, onUpdated }: { subject: SubjectWithTopics; onUpdated: (message: string) => void }) {
  const [updateState, updateAction, updating] = useActionState(
    updateSubjectAction.bind(null, subject.id),
    initialState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteSubjectAction.bind(null, subject.id),
    initialState,
  );
  const [createTopicState, createTopicActionForSubject, creatingTopic] = useActionState(
    createTopicAction.bind(null, subject.id),
    initialState,
  );
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState<SubjectColor>(subject.color);
  const savedSubjectRef = useRef({ name: subject.name, color: subject.color });
  const submittedSubjectRef = useRef({ name: subject.name, color: subject.color });

  useEffect(() => {
    if (!updating && updateState.kind === "success") {
      savedSubjectRef.current = { ...submittedSubjectRef.current, name: submittedSubjectRef.current.name.trim() };
      editDialogRef.current?.close();
      onUpdated(updateState.message ?? "Matéria atualizada.");
    }
  }, [onUpdated, updateState.kind, updateState.message, updating]);

  function openEditor() {
    setName(savedSubjectRef.current.name);
    setColor(savedSubjectRef.current.color);
    editDialogRef.current?.showModal();
  }

  function closeEditor() {
    setName(savedSubjectRef.current.name);
    setColor(savedSubjectRef.current.color);
    editDialogRef.current?.close();
  }

  return (
    <article className={`subject-card subject-color-${subject.color}`}>
      <header className="subject-card-header">
        <div className="subject-title-group">
          <span aria-hidden="true" className="subject-color-dot" />
          <div>
            <span className="subject-card-kicker">MATÉRIA</span>
            <h3>{subject.name}</h3>
          </div>
        </div>
        <div className="subject-card-actions">
          <span className="subject-topic-count">{subject.topics.length} {subject.topics.length === 1 ? "assunto" : "assuntos"}</span>
          <button aria-label={`Editar matéria ${subject.name}`} className="subject-edit-trigger" onClick={openEditor} type="button">
            <PencilLine aria-hidden="true" size={14} /> <span>Editar</span>
          </button>
        </div>
      </header>

      <dialog aria-labelledby={`edit-subject-title-${subject.id}`} className="edit-dialog" ref={editDialogRef}>
        <div className="edit-dialog-header">
          <div>
            <span className="edit-dialog-kicker">EDITAR MATÉRIA</span>
            <h3 id={`edit-subject-title-${subject.id}`}>Personalize sua matéria</h3>
            <p>Escolha um nome e uma cor para encontrar seus estudos com facilidade.</p>
          </div>
          <button aria-label="Fechar edição" className="edit-dialog-close" onClick={closeEditor} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <form action={updateAction} className="edit-dialog-form" onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          submittedSubjectRef.current = {
            name: String(formData.get("name") ?? ""),
            color: formData.get("color") as SubjectColor,
          };
        }}>
          <label className="subject-field" htmlFor={`subject-name-${subject.id}`}>
            <span>Nome da matéria</span>
            <input id={`subject-name-${subject.id}`} maxLength={60} name="name" onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label className="subject-field" htmlFor={`subject-color-${subject.id}`}>
            <span>Cor</span>
            <select id={`subject-color-${subject.id}`} name="color" onChange={(event) => setColor(event.target.value as SubjectColor)} value={color}>
              {Object.entries(colorNames).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <div className="edit-dialog-actions">
            <button className="button button-outline button-small" onClick={closeEditor} type="button">Cancelar</button>
            <button className="button button-small button-primary" disabled={updating} type="submit">
              {updating ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
          {updateState.kind === "error" && <ActionFeedback state={updateState} />}
        </form>
      </dialog>
      <div className="subject-topics-section">
        <div className="topic-section-heading">
          <div>
            <span className="topic-section-eyebrow">SEU PLANO DE ESTUDO</span>
            <h4>Assuntos</h4>
          </div>
          <span className="topic-count-badge">{subject.topics.length}</span>
        </div>
        {subject.topics.length > 0 ? (
          <ul className="topic-list">
          {subject.topics.map((topic) => <TopicRow key={topic.id} onUpdated={onUpdated} topic={topic} />)}
          </ul>
        ) : (
          <p className="topic-empty">Adicione os tópicos que você quer estudar nesta matéria.</p>
        )}
        <form action={createTopicActionForSubject} className="topic-create-form">
          <label className="subject-field" htmlFor={`new-topic-${subject.id}`}>
            <span>Adicionar assunto</span>
            <input autoComplete="off" id={`new-topic-${subject.id}`} maxLength={100} name="name" placeholder="Ex.: Equações do 2º grau" required />
          </label>
          <DifficultySelect id={`new-topic-difficulty-${subject.id}`} />
          <button className="button button-outline button-small" disabled={creatingTopic} type="submit">
            <CirclePlus aria-hidden="true" size={15} /> {creatingTopic ? "Adicionando…" : "Adicionar assunto"}
          </button>
          <ActionFeedback state={createTopicState} />
        </form>
      </div>

      <footer className="subject-card-footer">
        <form action={deleteAction} onSubmit={(event) => {
          if (!window.confirm(`Excluir “${subject.name}” e todos os seus assuntos?`)) event.preventDefault();
        }}>
          <button className="subject-delete-button" disabled={deleting} type="submit">
            <Trash2 aria-hidden="true" size={14} />
            {deleting ? "Excluindo…" : "Excluir matéria"}
          </button>
        </form>
        <ActionFeedback state={deleteState} />
      </footer>
    </article>
  );
}

export function SubjectManager({
  subjects,
  subjectLimit,
  configurationError = false,
}: {
  subjects: SubjectWithTopics[];
  subjectLimit: number | null;
  configurationError?: boolean;
}) {
  const [createState, createAction, creating] = useActionState(createSubjectAction, initialState);
  const [toast, setToast] = useState<DashboardToast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCounterRef = useRef(0);
  const limitReached = subjectLimit !== null && subjects.length >= subjectLimit;

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastCounterRef.current += 1;
    setToast({ id: toastCounterRef.current, message });
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  return (
    <section aria-labelledby="subjects-heading" className="subjects-section">
      <div className="subjects-heading-row">
        <div>
          <span className="section-kicker">SUA ORGANIZAÇÃO</span>
          <h2 id="subjects-heading">Matérias e assuntos</h2>
          <p>Separe seus estudos em matérias e acompanhe os tópicos que quer dominar.</p>
        </div>
        {subjectLimit !== null && (
          <span className="subject-usage" aria-label={`${subjects.length} de ${subjectLimit} matérias usadas`}>
            {subjects.length}<span>/{subjectLimit}</span> matérias
          </span>
        )}
      </div>

      <form action={createAction} className="subject-create-form">
        <label className="subject-field" htmlFor="new-subject-name">
          <span>Nova matéria</span>
          <input autoComplete="off" id="new-subject-name" maxLength={60} name="name" placeholder="Ex.: Matemática" required />
        </label>
        <label className="subject-field" htmlFor="new-subject-color">
          <span>Cor de identificação</span>
          <select defaultValue="violet" id="new-subject-color" name="color">
            {Object.entries(colorNames).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button className="button button-primary" disabled={creating || limitReached || configurationError} type="submit">
          <CirclePlus aria-hidden="true" size={17} /> {creating ? "Criando…" : "Criar matéria"}
        </button>
        {configurationError && <p className="subject-feedback is-error" role="alert">Os limites da conta estão indisponíveis. Tente novamente mais tarde.</p>}
        {limitReached && !configurationError && <p className="subject-limit-note">Você atingiu o limite gratuito de {subjectLimit} matérias.</p>}
        <ActionFeedback state={createState} />
      </form>

      {subjects.length === 0 ? (
        <div className="subjects-empty-state">
          <span className="subjects-empty-icon"><BookOpen aria-hidden="true" size={22} /></span>
          <h3>Sua primeira matéria começa aqui</h3>
          <p>Crie uma matéria e adicione os assuntos que deseja estudar.</p>
        </div>
      ) : (
        <div className="subjects-grid">
          {subjects.map((subject) => <SubjectCard key={subject.id} onUpdated={showToast} subject={subject} />)}
        </div>
      )}

      {toast && (
        <div aria-live="polite" className="dashboard-toast-region">
          <div className="dashboard-toast" key={toast.id} role="status">
            <span aria-hidden="true" className="dashboard-toast-icon"><Check size={19} strokeWidth={2.5} /></span>
            <span className="dashboard-toast-copy">
              <strong>Alterações salvas</strong>
              <span>{toast.message}</span>
            </span>
            <button aria-label="Dispensar aviso" className="dashboard-toast-close" onClick={dismissToast} type="button">
              <X aria-hidden="true" size={17} />
            </button>
            <span aria-hidden="true" className="dashboard-toast-progress" />
          </div>
        </div>
      )}
    </section>
  );
}

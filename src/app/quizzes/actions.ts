"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";

const optionSchema = z.object({ text: z.string().trim().min(1).max(500) });
const manualQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(3000),
  topic_id: z.string().uuid().nullable(),
  explanation: z.string().trim().max(2000).nullable(),
  options: z.array(optionSchema).min(2).max(6),
  correct_option_index: z.number().int().min(0).max(5),
}).superRefine((question, context) => {
  if (question.correct_option_index >= question.options.length) {
    context.addIssue({ code: "custom", message: "Escolha uma alternativa correta." });
  }
});
const bankQuestionSchema = z.object({
  bank_question_id: z.string().uuid(),
  topic_id: z.string().uuid().nullable(),
});
const questionSchema = z.union([bankQuestionSchema, manualQuestionSchema]);

const quizInputSchema = z.object({
  quizId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable(),
  questions: z.array(questionSchema).min(1).max(30),
});

const attemptInputSchema = z.object({
  quizId: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionId: z.string().uuid().nullable(),
  })).max(30),
});

const editorSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  questions: z.array(z.object({
    prompt: z.string(),
    topic_id: z.string().uuid().nullable(),
    explanation: z.string().nullable(),
    options: z.array(optionSchema),
    correct_option_index: z.number().int().nullable(),
    source_bank_question_id: z.string().uuid().nullable(),
  })),
});

const bankSearchSchema = z.object({
  topicId: z.string().uuid(),
  query: z.string().trim().max(120).optional(),
});

const attemptResultSchema = z.object({
  attempt_id: z.string().uuid(),
  quiz_id: z.string().uuid(),
  quiz_title: z.string(),
  total_questions: z.number().int(),
  answered_count: z.number().int(),
  correct_count: z.number().int(),
  score_percent: z.number(),
  answers: z.array(z.object({
    position: z.number().int(),
    topic: z.string().nullable(),
    prompt: z.string(),
    selected: z.string().nullable(),
    correct: z.string(),
    explanation: z.string().nullable(),
    is_correct: z.boolean(),
  })),
});

export type QuizActionResult = {
  success: boolean;
  message: string;
  quizId?: string;
};

export type QuizEditorData = z.infer<typeof editorSchema>;
export type QuizAttemptResult = z.infer<typeof attemptResultSchema>;
export type QuizAttemptSummary = {
  id: string;
  quiz_id: string;
  quiz_title: string;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  score_percent: number;
  submitted_at: string;
};
export type QuizAttemptAnswer = {
  id: string;
  question_position: number;
  topic_label: string | null;
  question_prompt: string;
  selected_option_label: string | null;
  correct_option_label: string;
  explanation: string | null;
  is_correct: boolean;
};
export type QuestionBankSearchItem = {
  id: string;
  topic_id: string;
  prompt: string;
  difficulty: number;
  origin_type: "original" | "official_adaptation";
  origin_label: string;
  origin_exam: string | null;
  origin_url: string | null;
  options: { id: string; label: string; position: number }[];
};

function quizErrorMessage(code: string | undefined, fallback: string) {
  if (code === "P0001") return "Você atingiu o limite de simulados do seu plano.";
  if (code === "P0002") return "Este simulado não está disponível para sua conta.";
  if (code === "23503") return "A matéria ou assunto selecionado não está mais disponível.";
  if (code === "42501") return "Sua sessão não permite esta operação. Entre novamente.";
  if (code === "22023") return "Responda todas as questões e confira as alternativas antes de enviar.";
  return fallback;
}

export async function saveQuizAction(input: unknown): Promise<QuizActionResult> {
  const parsed = quizInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Revise o título, as perguntas e as alternativas do simulado." };
  }

  const user = await requireUser();
  const { data, error } = await user.supabase.rpc("save_quiz", {
    p_quiz_id: parsed.data.quizId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_questions: parsed.data.questions,
  });

  if (error || !data) {
    return {
      success: false,
      message: quizErrorMessage(error?.code, "Não foi possível salvar o simulado. Tente novamente."),
    };
  }

  revalidatePath("/quizzes");
  return { success: true, message: "Simulado salvo.", quizId: data };
}

export async function searchQuestionBankAction(input: unknown): Promise<{
  items: QuestionBankSearchItem[];
  message: string;
}> {
  const parsed = bankSearchSchema.safeParse(input);
  if (!parsed.success) return { items: [], message: "Selecione um assunto válido para buscar questões." };

  const user = await requireUser();
  const { topicId, query } = parsed.data;
  let questionQuery = user.supabase
    .from("question_bank_questions")
    .select("id,topic_id,prompt,difficulty,origin_type,origin_label,origin_exam,origin_url")
    .eq("topic_id", topicId)
    .order("difficulty", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (query) questionQuery = questionQuery.ilike("prompt", `%${query}%`);

  const { data: questions, error } = await questionQuery;
  if (error) return { items: [], message: "Não foi possível carregar o banco de questões." };
  if (!questions?.length) return { items: [], message: "Nenhuma questão encontrada nesse assunto." };

  const { data: options, error: optionsError } = await user.supabase
    .from("question_bank_options")
    .select("id,question_id,label,position")
    .in("question_id", questions.map((question) => question.id))
    .order("position", { ascending: true });
  if (optionsError || !options) return { items: [], message: "Não foi possível carregar as alternativas." };

  const optionsByQuestion = new Map<string, QuestionBankSearchItem["options"]>();
  for (const option of options) {
    const grouped = optionsByQuestion.get(option.question_id) ?? [];
    grouped.push({ id: option.id, label: option.label, position: option.position });
    optionsByQuestion.set(option.question_id, grouped);
  }

  return {
    items: questions.map((question) => ({
      ...question,
      options: optionsByQuestion.get(question.id) ?? [],
    })),
    message: "",
  };
}

export async function deleteQuizAction(quizId: string): Promise<QuizActionResult> {
  const parsedId = z.string().uuid().safeParse(quizId);
  if (!parsedId.success) return { success: false, message: "Simulado inválido." };

  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("quizzes")
    .delete()
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { success: false, message: "Não foi possível excluir o simulado." };
  }

  revalidatePath("/quizzes");
  return { success: true, message: "Simulado excluído com seu histórico." };
}

export async function loadQuizEditorAction(quizId: string) {
  const parsedId = z.string().uuid().safeParse(quizId);
  if (!parsedId.success) return { data: null, message: "Simulado inválido." };

  const user = await requireUser();
  const { data, error } = await user.supabase.rpc("load_quiz_editor", { p_quiz_id: parsedId.data });
  if (error || !data) return { data: null, message: quizErrorMessage(error?.code, "Não foi possível abrir a edição.") };

  const parsed = editorSchema.safeParse(data);
  if (!parsed.success) return { data: null, message: "Não foi possível carregar os dados de edição." };
  return { data: parsed.data, message: "" };
}

export async function submitQuizAttemptAction(input: unknown) {
  const parsed = attemptInputSchema.safeParse(input);
  if (!parsed.success) return { data: null, message: "Respostas inválidas. Confira o simulado e tente novamente." };

  const user = await requireUser();
  const { data: attemptId, error } = await user.supabase.rpc("submit_quiz_attempt", {
    p_quiz_id: parsed.data.quizId,
    p_answers: parsed.data.answers.map((answer) => ({
      question_id: answer.questionId,
      selected_option_id: answer.selectedOptionId,
    })),
  });

  if (error || !attemptId) {
    return { data: null, message: quizErrorMessage(error?.code, "Não foi possível corrigir o simulado.") };
  }

  const [attemptResult, answersResult] = await Promise.all([
    user.supabase
      .from("quiz_attempts")
      .select("id,quiz_id,quiz_title,total_questions,answered_count,correct_count,score_percent")
      .eq("id", attemptId)
      .maybeSingle(),
    user.supabase
      .from("attempt_answers")
      .select("question_position,topic_label,question_prompt,selected_option_label,correct_option_label,explanation,is_correct")
      .eq("attempt_id", attemptId)
      .order("question_position", { ascending: true }),
  ]);

  if (attemptResult.error || !attemptResult.data || answersResult.error || !answersResult.data) {
    return { data: null, message: "O resultado foi salvo, mas não foi possível carregar a correção. Abra o histórico para tentar novamente." };
  }

  const parsedResult = attemptResultSchema.safeParse({
    attempt_id: attemptResult.data.id,
    quiz_id: attemptResult.data.quiz_id,
    quiz_title: attemptResult.data.quiz_title,
    total_questions: attemptResult.data.total_questions,
    answered_count: attemptResult.data.answered_count,
    correct_count: attemptResult.data.correct_count,
    score_percent: attemptResult.data.score_percent,
    answers: answersResult.data.map((answer) => ({
      position: answer.question_position,
      topic: answer.topic_label,
      prompt: answer.question_prompt,
      selected: answer.selected_option_label,
      correct: answer.correct_option_label,
      explanation: answer.explanation,
      is_correct: answer.is_correct,
    })),
  });
  if (!parsedResult.success) return { data: null, message: "Não foi possível carregar o resultado." };

  revalidatePath("/quizzes");
  return { data: parsedResult.data, message: "" };
}

export async function loadQuizAttemptAction(attemptId: string) {
  const parsedId = z.string().uuid().safeParse(attemptId);
  if (!parsedId.success) return { data: null, message: "Tentativa inválida." };

  const user = await requireUser();
  const { data: attempt, error: attemptError } = await user.supabase
    .from("quiz_attempts")
    .select("id,quiz_id,quiz_title,total_questions,answered_count,correct_count,score_percent,submitted_at")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (attemptError || !attempt) return { data: null, message: "Este resultado não está disponível." };

  const { data: answers, error: answersError } = await user.supabase
    .from("attempt_answers")
    .select("id,question_position,topic_label,question_prompt,selected_option_label,correct_option_label,explanation,is_correct")
    .eq("attempt_id", attempt.id)
    .order("question_position", { ascending: true });

  if (answersError || !answers) return { data: null, message: "Não foi possível carregar as respostas desta tentativa." };

  return {
    data: { attempt: attempt as QuizAttemptSummary, answers: answers as QuizAttemptAnswer[] },
    message: "",
  };
}

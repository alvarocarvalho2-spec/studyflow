"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { loadUserPlanAccess } from "@/lib/plans/access";
import type { Tables } from "@/lib/supabase/database.types";

type Flashcard = Pick<
  Tables<"flashcards">,
  "id" | "topic_id" | "front" | "back" | "interval_days" | "repetitions" | "next_review_at" | "last_reviewed_at"
>;
type FlashcardReview = Pick<
  Tables<"flashcard_reviews">,
  "id" | "flashcard_id" | "rating" | "interval_before_days" | "interval_after_days" | "reviewed_at" | "next_review_at"
>;
const flashcardReturnColumns = "id,topic_id,front,back,interval_days,repetitions,next_review_at,last_reviewed_at";
const reviewReturnColumns = "id,flashcard_id,rating,interval_before_days,interval_after_days,reviewed_at,next_review_at";

export type FlashcardActionState = {
  kind?: "success" | "error";
  message?: string;
  flashcard?: Flashcard;
};

export type FlashcardReviewActionState = {
  kind?: "success" | "error";
  message?: string;
  review?: FlashcardReview;
};

const cardSchema = z.object({
  topic_id: z.string().uuid().nullable(),
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().min(1).max(5000),
});

function parseCard(formData: FormData) {
  const topicValue = formData.get("topic_id");
  return cardSchema.safeParse({
    topic_id: topicValue === "" || topicValue === null ? null : topicValue,
    front: formData.get("front"),
    back: formData.get("back"),
  });
}

function cardMutationError(code: string | undefined, fallback: string) {
  if (code === "P0001") return "Você atingiu o limite de flashcards do seu plano.";
  if (code === "23503") return "O assunto selecionado não está disponível.";
  if (code === "23505") return "Este cartão já existe.";
  return fallback;
}

export async function createFlashcardAction(
  _previousState: FlashcardActionState,
  formData: FormData,
): Promise<FlashcardActionState> {
  const parsed = parseCard(formData);
  if (!parsed.success) {
    return { kind: "error", message: "Preencha a pergunta e a resposta do cartão." };
  }

  const user = await requireUser();
  const { access, error: accessError } = await loadUserPlanAccess(user.supabase, user.id);
  if (accessError || !access) {
    return { kind: "error", message: "Os limites do plano estão indisponíveis. Tente novamente." };
  }

  const { count, error: countError } = await user.supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true });

  if (countError) {
    return { kind: "error", message: "Não foi possível verificar seus flashcards." };
  }
  if ((count ?? 0) >= access.limits.max_flashcards) {
    return { kind: "error", message: `Seu plano permite até ${access.limits.max_flashcards} flashcards.` };
  }

  const { data: flashcard, error } = await user.supabase
    .from("flashcards")
    .insert(parsed.data)
    .select(flashcardReturnColumns)
    .maybeSingle();

  if (error || !flashcard) {
    return {
      kind: "error",
      message: cardMutationError(error?.code, "Não foi possível criar o flashcard. Tente novamente."),
    };
  }

  revalidatePath("/flashcards");
  return { kind: "success", message: "Flashcard criado e adicionado à fila de revisão.", flashcard };
}

export async function updateFlashcardAction(
  flashcardId: string,
  _previousState: FlashcardActionState,
  formData: FormData,
): Promise<FlashcardActionState> {
  const parsed = parseCard(formData);
  if (!parsed.success) {
    return { kind: "error", message: "Preencha a pergunta e a resposta do cartão." };
  }

  const user = await requireUser();
  const { data: flashcard, error } = await user.supabase
    .from("flashcards")
    .update(parsed.data)
    .eq("id", flashcardId)
    .select(flashcardReturnColumns)
    .maybeSingle();

  if (error || !flashcard) {
    return {
      kind: "error",
      message: cardMutationError(error?.code, "Não foi possível atualizar o flashcard."),
    };
  }

  revalidatePath("/flashcards");
  return { kind: "success", message: "Flashcard atualizado.", flashcard };
}

export async function deleteFlashcardAction(
  flashcardId: string,
  _previousState: FlashcardActionState,
  _formData: FormData,
): Promise<FlashcardActionState> {
  void _previousState;
  void _formData;
  const user = await requireUser();
  const { data, error } = await user.supabase
    .from("flashcards")
    .delete()
    .eq("id", flashcardId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { kind: "error", message: "Não foi possível excluir o flashcard." };
  }

  revalidatePath("/flashcards");
  return { kind: "success", message: "Flashcard excluído." };
}

export async function reviewFlashcardAction(
  flashcardId: string,
  _previousState: FlashcardReviewActionState,
  formData: FormData,
): Promise<FlashcardReviewActionState> {
  const rating = z.coerce.number().int().min(0).max(3).safeParse(formData.get("rating"));
  if (!rating.success) {
    return { kind: "error", message: "Escolha como foi sua lembrança do cartão." };
  }

  const user = await requireUser();
  const { data: review, error } = await user.supabase
    .from("flashcard_reviews")
    .insert({ flashcard_id: flashcardId, rating: rating.data })
    .select(reviewReturnColumns)
    .maybeSingle();

  if (error || !review) {
    return {
      kind: "error",
      message: error?.code === "P0002"
        ? "Este flashcard não está disponível para revisão."
        : "Não foi possível registrar a revisão. Tente novamente.",
    };
  }

  revalidatePath("/flashcards");
  return { kind: "success", message: "Revisão registrada.", review };
}

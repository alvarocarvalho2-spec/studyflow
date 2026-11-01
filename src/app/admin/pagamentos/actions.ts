"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudyFlowAdmin } from "@/lib/auth/studyflow-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ManualPaymentActionState } from "@/app/assinatura/payment-actions";

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function reviewManualPaymentAction(
  _previousState: ManualPaymentActionState,
  formData: FormData,
): Promise<ManualPaymentActionState> {
  const parsed = reviewSchema.safeParse({
    requestId: formString(formData.get("request_id")),
    decision: formString(formData.get("decision")),
  });

  if (!parsed.success) {
    return { kind: "error", message: "Pedido inválido. Atualize a página e tente novamente." };
  }

  const admin = await requireStudyFlowAdmin();
  let supabaseAdmin;

  try {
    supabaseAdmin = createAdminClient();
  } catch {
    return { kind: "error", message: "Configure a chave secreta do Supabase no servidor." };
  }

  const { data, error } = await supabaseAdmin.rpc("review_manual_payment_request", {
    p_request_id: parsed.data.requestId,
    p_reviewer_id: admin.id,
    p_decision: parsed.data.decision,
  });

  if (error) {
    return { kind: "error", message: "Não foi possível analisar este pedido. Atualize a fila e tente novamente." };
  }

  revalidatePath("/admin/pagamentos");
  revalidatePath("/assinatura");
  revalidatePath("/dashboard");

  return {
    kind: "success",
    message: data === "approved" ? "Pagamento aprovado; o Pro foi ativado." : "Pedido recusado.",
  };
}

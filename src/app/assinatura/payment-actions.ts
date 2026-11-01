"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";

export type ManualPaymentActionState = {
  kind?: "success" | "error";
  message?: string;
};

const requestSchema = z.object({
  billingInterval: z.enum(["monthly", "annual"]),
  payerName: z.string().trim().min(2).max(100),
});

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function requestManualPaymentAction(
  _previousState: ManualPaymentActionState,
  formData: FormData,
): Promise<ManualPaymentActionState> {
  const parsed = requestSchema.safeParse({
    billingInterval: formString(formData.get("billing_interval")),
    payerName: formString(formData.get("payer_name")),
  });

  if (!parsed.success) {
    return { kind: "error", message: "Informe o plano e o nome que aparecerá no pagamento." };
  }

  const pixPayload = parsed.data.billingInterval === "monthly"
    ? process.env.STUDYFLOW_PIX_COPIA_E_COLA_MONTHLY
    : process.env.STUDYFLOW_PIX_COPIA_E_COLA_ANNUAL;

  if (!pixPayload?.trim()) {
    return { kind: "error", message: "O QR Code Pix deste período ainda não foi configurado." };
  }

  const user = await requireUser();
  const { error } = await user.supabase.from("manual_payment_requests").insert({
    user_id: user.id,
    billing_interval: parsed.data.billingInterval,
    payer_name: parsed.data.payerName,
  });

  if (error?.code === "23505") {
    return { kind: "error", message: "Você já tem um pagamento aguardando aprovação." };
  }

  if (error) {
    return { kind: "error", message: "Não foi possível registrar o pagamento. Tente novamente." };
  }

  revalidatePath("/assinatura");
  revalidatePath("/admin/pagamentos");
  return { kind: "success", message: "Pedido registrado. Seu Pro será liberado após a conferência do Pix." };
}

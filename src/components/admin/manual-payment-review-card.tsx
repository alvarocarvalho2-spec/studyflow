"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { reviewManualPaymentAction } from "@/app/admin/pagamentos/actions";
import type { ManualPaymentActionState } from "@/app/assinatura/payment-actions";
import type { Tables } from "@/lib/supabase/database.types";

const initialState: ManualPaymentActionState = {};

export function ManualPaymentReviewCard({
  request,
  email,
}: {
  request: Pick<
    Tables<"manual_payment_requests">,
    "id" | "amount_cents" | "billing_interval" | "created_at" | "payer_name"
  >;
  email: string | null;
}) {
  const [state, action, pending] = useActionState(reviewManualPaymentAction, initialState);
  const price = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(request.amount_cents / 100);
  const createdAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(request.created_at));

  return (
    <article className="manual-payment-review-card">
      <div className="manual-payment-review-heading">
        <div>
          <span className="auth-kicker">{request.billing_interval === "monthly" ? "PLANO MENSAL" : "PLANO ANUAL"}</span>
          <h2>{price}</h2>
        </div>
        <span className="manual-payment-pending-badge">Aguardando conferência</span>
      </div>
      <dl className="manual-payment-review-details">
        <div><dt>Conta StudyFlow</dt><dd>{email ?? "E-mail indisponível"}</dd></div>
        <div><dt>Nome informado no Pix</dt><dd>{request.payer_name}</dd></div>
        <div><dt>Pedido enviado</dt><dd>{createdAt}</dd></div>
      </dl>
      <p className="manual-payment-review-reminder">Confira no app do Inter se o valor entrou antes de aprovar.</p>
      <form action={action} className="manual-payment-review-actions">
        <input name="request_id" type="hidden" value={request.id} />
        <button className="button button-primary" disabled={pending} name="decision" type="submit" value="approve">
          <Check aria-hidden="true" size={15} /> Aprovar
        </button>
        <button className="button button-outline" disabled={pending} name="decision" type="submit" value="reject">
          <X aria-hidden="true" size={15} /> Recusar
        </button>
      </form>
      {state.message && (
        <p className={`manual-pix-feedback${state.kind === "error" ? " is-error" : " is-success"}`} role={state.kind === "error" ? "alert" : "status"}>
          {state.message}
        </p>
      )}
    </article>
  );
}

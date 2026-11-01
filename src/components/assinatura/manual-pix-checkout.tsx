"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Clipboard, CreditCard, QrCode, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  requestManualPaymentAction,
  type ManualPaymentActionState,
} from "@/app/assinatura/payment-actions";
import type { Tables } from "@/lib/supabase/database.types";

type PaymentRequestSummary = Pick<
  Tables<"manual_payment_requests">,
  "amount_cents" | "billing_interval" | "created_at" | "payer_name" | "status"
>;

const initialState: ManualPaymentActionState = {};

export function ManualPixCheckout({
  monthlyPrice,
  annualPrice,
  monthlyPixCopyPaste,
  annualPixCopyPaste,
  latestRequest,
}: {
  monthlyPrice: string;
  annualPrice: string;
  monthlyPixCopyPaste: string;
  annualPixCopyPaste: string;
  latestRequest: PaymentRequestSummary | null;
}) {
  const [state, action, pending] = useActionState(requestManualPaymentAction, initialState);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [copied, setCopied] = useState(false);
  const pixPayload = (billingInterval === "monthly" ? monthlyPixCopyPaste : annualPixCopyPaste).trim();
  const selectedPrice = billingInterval === "monthly" ? monthlyPrice : annualPrice;
  const selectedIntervalLabel = billingInterval === "monthly" ? "mensal" : "anual";
  const hasPendingRequest = latestRequest?.status === "pending";
  const latestRequestPrice = latestRequest
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(latestRequest.amount_cents / 100)
    : null;

  useEffect(() => {
    if (window.location.hash === "#checkout-pro") {
      document.getElementById("checkout-pro")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  async function copyPixCode() {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="manual-pix-checkout" id="checkout-pro">
      <div className="manual-pix-intro">
        <span className="auth-kicker">PIX COM APROVAÇÃO MANUAL</span>
        <p>Escolha mensal ou anual: o QR Code e o valor são atualizados juntos. Faça o Pix e informe o nome do pagador para pedir a conferência.</p>
      </div>

      {latestRequest && (
        <p className={`manual-pix-request-status is-${latestRequest.status}`} role="status">
          {latestRequest.status === "pending" && `Pedido de ${latestRequestPrice} aguardando conferência.`}
          {latestRequest.status === "approved" && "Seu último pedido foi aprovado."}
          {latestRequest.status === "rejected" && "Seu último pedido não foi aprovado. Você pode enviar outro após conferir o pagamento."}
        </p>
      )}

      {hasPendingRequest ? (
        <div className="manual-pix-pending-box">
          <ShieldCheck aria-hidden="true" size={17} />
          <p>Seu pedido está na fila. A liberação acontece depois da confirmação do crédito no Inter.</p>
        </div>
      ) : (
        <form action={action} className="manual-pix-request-form">
          <label className="manual-pix-field" htmlFor="manual-pix-interval">
            <span>Período</span>
            <select
              id="manual-pix-interval"
              name="billing_interval"
              onChange={(event) => {
                setBillingInterval(event.target.value as "monthly" | "annual");
                setCopied(false);
              }}
              value={billingInterval}
            >
              <option value="monthly">Mensal · {monthlyPrice}</option>
              <option value="annual">Anual · {annualPrice}</option>
            </select>
          </label>
          <p className="manual-pix-selected-price">Valor do Pix {selectedIntervalLabel}: <strong>{selectedPrice}</strong></p>
          {pixPayload ? (
            <div className="manual-pix-qr-card">
              <div className="manual-pix-qr" role="img" aria-label={`QR Code Pix do plano ${selectedIntervalLabel} por ${selectedPrice}`}>
                <QRCodeSVG value={pixPayload} size={208} level="M" title={`Pix StudyFlow ${selectedIntervalLabel}`} />
              </div>
              <div className="manual-pix-copy-code">
                <label htmlFor="studyflow-pix-code">Pix {selectedIntervalLabel} · copia e cola</label>
                <textarea id="studyflow-pix-code" readOnly rows={3} value={pixPayload} />
                <button className="button button-outline button-full" onClick={copyPixCode} type="button">
                  {copied ? <Check aria-hidden="true" size={15} /> : <Clipboard aria-hidden="true" size={15} />}
                  {copied ? "Código copiado" : "Copiar código Pix"}
                </button>
              </div>
            </div>
          ) : (
            <div className="manual-pix-setup-note" role="status">
              <QrCode aria-hidden="true" size={18} />
              <span>O QR Code {selectedIntervalLabel} ainda será configurado pelo administrador.</span>
            </div>
          )}
          <label className="manual-pix-field" htmlFor="manual-pix-payer-name">
            <span>Nome que aparecerá no Pix</span>
            <input
              autoComplete="name"
              id="manual-pix-payer-name"
              maxLength={100}
              minLength={2}
              name="payer_name"
              placeholder="Nome do pagador"
              required
            />
          </label>
          <button className="button button-primary button-full" disabled={!pixPayload || pending} type="submit">
            <CreditCard aria-hidden="true" size={15} />
            {pending ? "Enviando pedido…" : "Já fiz o Pix · pedir aprovação"}
          </button>
          {state.message && (
            <p className={`manual-pix-feedback${state.kind === "error" ? " is-error" : " is-success"}`} role={state.kind === "error" ? "alert" : "status"}>
              {state.message}
            </p>
          )}
        </form>
      )}

      <p className="manual-pix-footnote">A assinatura não renova sozinha. Cada novo período precisa de outro Pix e outra conferência.</p>
    </div>
  );
}

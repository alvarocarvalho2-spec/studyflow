import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, BadgeCheck, CreditCard, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { ManualPaymentReviewCard } from "@/components/admin/manual-payment-review-card";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireStudyFlowAdmin } from "@/lib/auth/studyflow-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Aprovação de Pix — StudyFlow" };

async function ManualPaymentApprovalsContent() {
  await connection();
  await requireStudyFlowAdmin();

  const adminClient = (() => {
    try {
      return createAdminClient();
    } catch {
      return null;
    }
  })();

  if (!adminClient) {
    return <AdminPageMessage message="Configure a chave secreta do Supabase no servidor para abrir a fila de pagamentos." />;
  }

  const { data, error } = await adminClient
    .from("manual_payment_requests")
    .select("id,user_id,billing_interval,amount_cents,payer_name,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const requests = await Promise.all((data ?? []).map(async (request) => {
    const { data: userResult } = await adminClient.auth.admin.getUserById(request.user_id);
    return { request, email: userResult.user?.email ?? null };
  }));

  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <nav aria-label="Navegação administrativa" className="workspace-header-left">
          <Brand href="/dashboard" />
          <Link className="workspace-nav-link" href="/assinatura"><ArrowLeft aria-hidden="true" size={15} /> Planos</Link>
        </nav>
        <div className="workspace-header-actions">
          <ThemeToggle />
          <form action={signOut}><button className="workspace-logout" type="submit"><LogOut aria-hidden="true" size={15} /> Sair</button></form>
        </div>
      </header>
      <main className="manual-payment-admin-main">
        <section className="manual-payment-admin-heading">
          <span className="manual-payment-admin-icon"><CreditCard aria-hidden="true" size={19} /></span>
          <div>
            <span className="auth-kicker">ADMINISTRAÇÃO</span>
            <h1>Aprovação de pagamentos Pix</h1>
            <p>Confira o crédito no Inter antes de aprovar. A aprovação ativa o Pro e registra seu usuário como responsável.</p>
          </div>
        </section>

        {error ? (
          <p className="auth-message error-message" role="alert">A fila de pagamentos ainda não está disponível. Aplique a migration manual_pix_approval no Supabase.</p>
        ) : requests.length ? (
          <section aria-label="Pedidos aguardando aprovação" className="manual-payment-review-list">
            {requests.map(({ request, email }) => (
              <ManualPaymentReviewCard email={email} key={request.id} request={request} />
            ))}
          </section>
        ) : (
          <div className="manual-payment-empty-state">
            <BadgeCheck aria-hidden="true" size={22} />
            <strong>Nenhum Pix aguardando conferência</strong>
            <p>Novos pedidos aparecerão aqui depois que o pagador enviar a solicitação.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ManualPaymentApprovalsPage() {
  return (
    <Suspense fallback={<AdminPageLoading />}>
      <ManualPaymentApprovalsContent />
    </Suspense>
  );
}

function AdminPageLoading() {
  return (
    <div className="workspace-page">
      <main className="manual-payment-admin-main">
        <p aria-busy="true" aria-live="polite" className="dashboard-loading">Carregando fila de pagamentos…</p>
      </main>
    </div>
  );
}

function AdminPageMessage({ message }: { message: string }) {
  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <nav aria-label="Navegação administrativa" className="workspace-header-left">
          <Brand href="/dashboard" />
          <Link className="workspace-nav-link" href="/assinatura"><ArrowLeft aria-hidden="true" size={15} /> Planos</Link>
        </nav>
        <div className="workspace-header-actions">
          <ThemeToggle />
          <form action={signOut}><button className="workspace-logout" type="submit"><LogOut aria-hidden="true" size={15} /> Sair</button></form>
        </div>
      </header>
      <main className="manual-payment-admin-main">
        <p className="auth-message error-message" role="alert">{message}</p>
      </main>
    </div>
  );
}

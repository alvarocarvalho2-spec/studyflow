import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BadgeCheck, BookOpen, BrainCircuit, CalendarDays, Check, ClipboardList, CreditCard, Crown, LogOut, Sparkles } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { ManualPixCheckout } from "@/components/assinatura/manual-pix-checkout";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { isStudyFlowAdmin } from "@/lib/auth/studyflow-admin";
import { requireUser } from "@/lib/auth/require-user";
import { formatPlanPrice, loadUserPlanAccess } from "@/lib/plans/access";
import type { Tables } from "@/lib/supabase/database.types";

export const metadata = { title: "Planos e assinatura — StudyFlow" };

type PlanCard = Pick<
  Tables<"plan_catalog">,
  "plan" | "display_name" | "description" | "monthly_price_cents" | "annual_price_cents" | "currency" | "benefits" | "pricing_note" | "display_order"
>;

async function SubscriptionAccount() {
  await connection();
  const user = await requireUser("/assinatura#checkout-pro");
  const accessResult = await loadUserPlanAccess(user.supabase, user.id);
  const [catalogResult, limitsResult, subscriptionResult, subjectsResult, flashcardsResult, quizzesResult, paymentRequestResult] = await Promise.all([
    user.supabase
      .from("plan_catalog")
      .select("plan,display_name,description,monthly_price_cents,annual_price_cents,currency,benefits,pricing_note,display_order")
      .order("display_order", { ascending: true }),
    user.supabase.from("plan_limits").select("plan,max_subjects,max_flashcards,max_saved_exams"),
    user.supabase
      .from("subscriptions")
      .select("plan,status,billing_interval,started_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at,updated_at")
      .maybeSingle(),
    user.supabase.from("subjects").select("id", { count: "exact", head: true }),
    user.supabase.from("flashcards").select("id", { count: "exact", head: true }),
    user.supabase.from("quizzes").select("id", { count: "exact", head: true }),
    user.supabase
      .from("manual_payment_requests")
      .select("amount_cents,billing_interval,created_at,payer_name,status")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const plans = (catalogResult.data ?? []) as PlanCard[];
  const currentPlan = accessResult.access?.catalog;
  const freePlan = plans.find((plan) => plan.plan === "free");
  const proPlan = plans.find((plan) => plan.plan === "pro");
  const limitsByPlan = new Map((limitsResult.data ?? []).map((limit) => [limit.plan, limit]));
  const currentPlanLimits = accessResult.access?.limits;
  const hasConfigurationError = accessResult.error || catalogResult.error || limitsResult.error || !freePlan || !proPlan;
  const subscription = subscriptionResult.data;
  const latestPaymentRequest = paymentRequestResult.data?.[0] ?? null;
  const monthlyPixCopyPaste = process.env.STUDYFLOW_PIX_COPIA_E_COLA_MONTHLY ?? "";
  const annualPixCopyPaste = process.env.STUDYFLOW_PIX_COPIA_E_COLA_ANNUAL ?? "";

  return (
    <div className="subscription-content">
      <section className="subscription-hero" aria-labelledby="subscription-title">
        <div>
          <span className="auth-kicker">PLANOS STUDYFLOW</span>
          <h1 id="subscription-title">Seu plano, com tudo claro.</h1>
          <p>Veja seus limites atuais e conheça os recursos previstos para cada etapa.</p>
        </div>
        <div className="subscription-current-plan">
          <span className="subscription-current-icon"><BadgeCheck aria-hidden="true" size={19} /></span>
          <span><small>PLANO ATUAL</small><strong>{currentPlan?.display_name ?? "Indisponível"}</strong></span>
        </div>
      </section>

      {hasConfigurationError && (
        <p className="auth-message error-message" role="alert">Não foi possível carregar toda a configuração dos planos. Atualize a página para tentar novamente.</p>
      )}

      <section className="subscription-overview-grid" aria-label="Uso atual da conta">
        <article className="subscription-panel subscription-usage-panel">
          <div className="subscription-panel-heading">
            <span className="subscription-panel-icon"><Sparkles aria-hidden="true" size={17} /></span>
            <div><span className="auth-kicker">SEU USO</span><h2>Limites do plano atual</h2></div>
          </div>
          {currentPlanLimits ? (
            <dl className="subscription-usage-list">
              <div><dt><BookOpen aria-hidden="true" size={15} /> Matérias</dt><dd>{subjectsResult.count ?? 0} <span>/ {currentPlanLimits.max_subjects}</span></dd></div>
              <div><dt><BrainCircuit aria-hidden="true" size={15} /> Flashcards</dt><dd>{flashcardsResult.count ?? 0} <span>/ {currentPlanLimits.max_flashcards}</span></dd></div>
              <div><dt><ClipboardList aria-hidden="true" size={15} /> Simulados salvos</dt><dd>{quizzesResult.count ?? 0} <span>/ {currentPlanLimits.max_saved_exams}</span></dd></div>
            </dl>
          ) : <p className="subscription-muted-copy">Os limites não estão disponíveis no momento.</p>}
          {(subjectsResult.error || flashcardsResult.error || quizzesResult.error) && <p className="subscription-inline-error">Não foi possível carregar todo o uso da conta.</p>}
        </article>

        <article className="subscription-panel subscription-status-panel">
          <div className="subscription-panel-heading">
            <span className="subscription-panel-icon is-soft"><CreditCard aria-hidden="true" size={17} /></span>
            <div><span className="auth-kicker">PAGAMENTOS</span><h2>Situação da assinatura</h2></div>
          </div>
          {subscription ? (
            <div className="subscription-status-copy">
              <strong>{subscriptionStatusLabel(subscription.status)}</strong>
              <p>{subscription.cancel_at_period_end ? "Cancelamento programado ao fim do período." : "Status informado pelo cadastro de assinatura."}</p>
              {subscription.current_period_end && <small>Período até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(subscription.current_period_end))}</small>}
            </div>
          ) : (
            <div className="subscription-status-copy">
              <strong>Nenhuma cobrança ativa</strong>
              <p>O Pro é pago por Pix e liberado após a conferência manual do recebimento.</p>
            </div>
          )}
          <span className="subscription-no-checkout"><CreditCard aria-hidden="true" size={14} /> Pix com aprovação manual</span>
        </article>
      </section>

      {freePlan && proPlan && (
        <section className="subscription-plans-section" aria-labelledby="subscription-plans-title">
          <div className="subscription-section-heading">
            <span className="auth-kicker">COMPARE AS OPÇÕES</span>
            <h2 id="subscription-plans-title">Escolha o ritmo que combina com você.</h2>
            <p>Benefícios, preços e limites são apresentados a partir da configuração do produto.</p>
          </div>
          <div className="subscription-plan-grid">
            {[freePlan, proPlan].map((plan) => {
              const limits = limitsByPlan.get(plan.plan);
              const isCurrent = accessResult.access?.plan === plan.plan;
              const isPro = plan.plan === "pro";
              return (
                <article className={`subscription-plan-card${isPro ? " is-pro" : ""}`} key={plan.plan}>
                  <div className="subscription-plan-topline">
                    <span className={`subscription-plan-icon${isPro ? " is-pro" : ""}`}>{isPro ? <Crown aria-hidden="true" size={18} /> : <BookOpen aria-hidden="true" size={18} />}</span>
                    {isCurrent ? <span className="subscription-current-badge">Plano atual</span> : isPro ? <span className="subscription-preparing-badge"><Sparkles aria-hidden="true" size={11} /> Pix manual</span> : null}
                  </div>
                  <h3>{plan.display_name}</h3>
                  <p className="subscription-plan-description">{plan.description}</p>
                  <div className="subscription-plan-price"><strong>{formatPlanPrice(plan.monthly_price_cents, plan.currency)}</strong><span>{isPro ? "/ mês*" : "/ sempre"}</span></div>
                  {isPro && <p className="subscription-annual-price">{formatPlanPrice(plan.annual_price_cents, plan.currency)} por ano*</p>}
                  {limits && <p className="subscription-plan-limits">{limits.max_subjects} matérias · {limits.max_flashcards} flashcards · {limits.max_saved_exams} simulados</p>}
                  <ul className="subscription-benefit-list">{plan.benefits.map((benefit) => <li key={benefit}><Check aria-hidden="true" size={15} />{benefit}</li>)}</ul>
                  {isPro ? (
                    <ManualPixCheckout
                      annualPrice={formatPlanPrice(plan.annual_price_cents, plan.currency)}
                      annualPixCopyPaste={annualPixCopyPaste}
                      latestRequest={latestPaymentRequest}
                      monthlyPrice={formatPlanPrice(plan.monthly_price_cents, plan.currency)}
                      monthlyPixCopyPaste={monthlyPixCopyPaste}
                    />
                  ) : <Link className="button button-outline button-full" href="/dashboard">Voltar aos estudos <CalendarDays aria-hidden="true" size={15} /></Link>}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function subscriptionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    incomplete: "Cadastro incompleto",
    trialing: "Período de teste",
    active: "Ativa",
    past_due: "Pagamento pendente",
    canceled: "Cancelada",
    expired: "Encerrada",
  };
  return labels[status] ?? "Status indisponível";
}

function LoadingSubscription() {
  return <div aria-live="polite" aria-busy="true" className="dashboard-loading">Carregando seus planos…</div>;
}

async function AdminPaymentsNavLink() {
  await connection();
  const user = await requireUser("/assinatura#checkout-pro");
  if (!isStudyFlowAdmin(user.email)) return null;
  return <Link className="workspace-nav-link" href="/admin/pagamentos"><CreditCard aria-hidden="true" size={15} /> Aprovar Pix</Link>;
}

export default function SubscriptionPage() {
  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <nav aria-label="Navegação do espaço de estudos" className="workspace-header-left">
          <Brand href="/dashboard" />
          <Link className="workspace-nav-link" href="/dashboard"><BookOpen aria-hidden="true" size={15} /> Matérias</Link>
          <Link className="workspace-nav-link" href="/flashcards"><BrainCircuit aria-hidden="true" size={15} /> Flashcards</Link>
          <Link className="workspace-nav-link" href="/quizzes"><ClipboardList aria-hidden="true" size={15} /> Simulados</Link>
          <Link className="workspace-nav-link" href="/plano"><CalendarDays aria-hidden="true" size={15} /> Plano</Link>
          <span aria-current="page" className="workspace-nav-link is-active"><CreditCard aria-hidden="true" size={15} /> Planos</span>
          <Suspense fallback={null}><AdminPaymentsNavLink /></Suspense>
        </nav>
        <div className="workspace-header-actions">
          <ThemeToggle />
          <form action={signOut}><button className="workspace-logout" type="submit"><LogOut aria-hidden="true" size={15} /> Sair</button></form>
        </div>
      </header>
      <main className="subscription-page-main">
        <Suspense fallback={<LoadingSubscription />}><SubscriptionAccount /></Suspense>
      </main>
    </div>
  );
}

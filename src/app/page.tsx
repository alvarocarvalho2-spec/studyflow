import { Suspense } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Focus,
  GraduationCap,
  Layers3,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { connection } from "next/server";
import { MobileMenu } from "@/components/mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Brand } from "@/components/brand";
import { formatPlanPrice } from "@/lib/plans/access";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    icon: CalendarDays,
    title: "Um plano que cabe no seu dia",
    description:
      "Organize matérias e metas de acordo com o tempo que você realmente tem.",
    tone: "lilac",
  },
  {
    icon: BrainCircuit,
    title: "Revisões na hora certa",
    description:
      "Volte aos assuntos importantes com flashcards e revisões espaçadas.",
    tone: "mint",
  },
  {
    icon: TrendingUp,
    title: "Progresso que faz sentido",
    description:
      "Acompanhe suas sessões e perceba onde vale concentrar energia.",
    tone: "peach",
  },
];

function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav aria-label="Navegação principal" className="desktop-nav">
          <a href="#produto">Produto</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <a className="header-login" href="/entrar">Entrar</a>
          <a className="button button-small button-primary header-cta" href="/cadastro">
            Criar conta grátis <ArrowRight aria-hidden="true" size={15} />
          </a>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

function DashboardPreview() {
  return (
    <div aria-label="Prévia demonstrativa da interface do StudyFlow" className="preview-wrap">
      <div className="preview-orbit orbit-one" />
      <div className="preview-orbit orbit-two" />
      <div className="floating-note floating-note-top">
        <span className="floating-icon note-purple"><Sparkles size={16} /></span>
        <span><strong>Seu próximo passo</strong><small>Revisar com calma</small></span>
      </div>
      <div className="dashboard-preview">
        <div className="preview-sidebar">
          <div className="preview-brand"><span className="mini-mark"><GraduationCap size={14} /></span><span>studyflow</span></div>
          <div className="preview-side-label">MENU</div>
          <div className="preview-side-item active"><Layers3 size={14} /> Visão geral</div>
          <div className="preview-side-item"><BookOpen size={14} /> Matérias</div>
          <div className="preview-side-item"><BrainCircuit size={14} /> Flashcards</div>
          <div className="preview-side-item"><Target size={14} /> Meu plano</div>
          <div className="preview-profile"><span className="profile-avatar">A</span><span><b>Seu espaço</b><small>Estudo em foco</small></span></div>
        </div>
        <div className="preview-main">
          <div className="preview-topline"><span>UM DIA DE CADA VEZ</span><span className="preview-dot" /></div>
          <h3>Um passo de cada vez<span>.</span></h3>
          <p className="preview-subtitle">Uma prévia de como seus estudos podem se organizar.</p>
          <div className="preview-progress-card">
            <div className="progress-copy"><span>Seu ritmo de hoje</span><b>1 <small>de 3 blocos</small></b></div>
            <div className="progress-track"><span /></div>
            <div className="progress-foot"><span>Um começo consistente</span><span>25 min</span></div>
          </div>
          <div className="preview-task-title"><b>Uma sugestão para começar</b><span>EXEMPLO</span></div>
          <div className="preview-task">
            <span className="task-icon task-lilac"><BookOpen size={16} /></span>
            <span className="task-copy"><b>Revisar funções</b><small>Matemática · 20 min</small></span>
            <span className="task-check"><Check size={14} /></span>
          </div>
          <div className="preview-task muted-task">
            <span className="task-icon task-mint"><BrainCircuit size={16} /></span>
            <span className="task-copy"><b>Rever cartões marcados</b><small>Biologia · 10 min</small></span>
            <span className="task-arrow"><ArrowUpRight size={14} /></span>
          </div>
        </div>
      </div>
      <div className="floating-note floating-note-bottom">
        <span className="streak-icon"><Flame size={17} fill="currentColor" /></span>
        <span><strong>Ritmo sustentável</strong><small>Constância vale mais</small></span>
      </div>
      <span className="preview-caption">PRÉVIA ILUSTRATIVA · SEM DADOS DE USUÁRIOS</span>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero section-shell" id="inicio">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-spark"><Sparkles size={13} /></span> Menos correria. Mais clareza.</div>
        <h1>Estude com intenção. <span>Avance no seu ritmo.</span></h1>
        <p className="hero-description">
          Um lugar para organizar seus estudos, descobrir o próximo passo e construir uma rotina que funciona para você.
        </p>
        <div className="hero-actions">
          <a className="button button-primary button-large" href="/cadastro">
            Criar conta gratuita <ArrowRight aria-hidden="true" size={17} />
          </a>
          <a className="text-link" href="#produto"><span className="play-circle"><ArrowDown size={14} /></span> Explore a plataforma</a>
        </div>
        <div className="hero-proof"><span className="proof-check"><Check size={13} /></span> Comece de graça <span className="proof-divider">·</span> sem cartão de crédito</div>
      </div>
      <DashboardPreview />
    </section>
  );
}

function TrustStrip() {
  return (
    <section aria-label="Princípios do StudyFlow" className="trust-strip">
      <div className="trust-inner">
        <span><CheckCircle2 size={16} /> Seu ritmo, suas metas</span>
        <i />
        <span><Focus size={16} /> Foco no que importa</span>
        <i />
        <span><Lightbulb size={16} /> Um próximo passo claro</span>
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section className="product-section section-shell" id="produto">
      <div className="section-heading centered-heading">
        <span className="section-kicker">ESTUDO COM MAIS INTENÇÃO</span>
        <h2>Seu estudo, com um plano que <span>faz sentido.</span></h2>
        <p>Ferramentas simples para transformar o “preciso estudar” em um próximo passo possível.</p>
      </div>
      <div className="feature-grid">
        {features.map(({ icon: Icon, title, description, tone }, index) => (
          <article className="feature-card" key={title}>
            <div className={`feature-icon ${tone}`}><Icon size={20} strokeWidth={1.9} /></div>
            <span className="feature-number">0{index + 1}</span>
            <h3>{title}</h3>
            <p>{description}</p>
            <a className="feature-link" href="#como-funciona">Saiba como funciona <ArrowRight size={14} /></a>
          </article>
        ))}
      </div>
    </section>
  );
}

function MethodSection() {
  return (
    <section className="method-section" id="como-funciona">
      <div className="method-inner section-shell">
        <div className="method-copy">
          <span className="section-kicker light-kicker">APRESENTAMOS O SMARTPLAN</span>
          <h2>Um plano de estudos que <span>se adapta a você.</span></h2>
          <p>O SmartPlan considera sua disponibilidade, suas metas e os assuntos que pedem mais atenção para sugerir por onde começar.</p>
          <ul className="method-list">
            <li><span><Check size={14} /></span> Você define seus dias e seu tempo.</li>
            <li><span><Check size={14} /></span> Assuntos prioritários ganham espaço no plano.</li>
            <li><span><Check size={14} /></span> Pendências podem ser reorganizadas.</li>
          </ul>
          <p className="method-note">Recomendações explicáveis, sem promessas de resultado garantido.</p>
          <a className="button button-light button-large" href="#planos">Veja os planos <ArrowRight size={16} /></a>
        </div>
        <div aria-hidden="true" className="plan-illustration">
          <div className="plan-window">
            <div className="plan-window-top"><span className="window-dots"><i /><i /><i /></span><span>SEU PLANO DA SEMANA</span><CalendarDays size={15} /></div>
            <div className="plan-window-title"><div><small>UMA ROTINA POSSÍVEL</small><h3>Seu próximo dia</h3></div><span className="date-chip">SEU PLANO</span></div>
            <div className="plan-block block-done"><span className="plan-block-icon"><Check size={14} /></span><span><b>Revisão rápida</b><small>Biologia · 15 minutos</small></span><span className="block-status">CONCLUÍDO</span></div>
            <div className="plan-block block-current"><span className="plan-block-icon"><BookOpen size={14} /></span><span><b>Funções e gráficos</b><small>Matemática · 25 minutos</small></span><span className="block-now">AGORA</span></div>
            <div className="plan-block block-next"><span className="plan-block-icon"><Clock3 size={14} /></span><span><b>Próxima revisão</b><small>Química · 10 minutos</small></span><span className="block-time">+ DEPOIS</span></div>
            <div className="plan-window-foot"><span><Sparkles size={14} /> Plano demonstrativo</span><span>3 blocos leves</span></div>
          </div>
          <div className="plan-decor plan-decor-one"><Target size={18} /></div>
          <div className="plan-decor plan-decor-two"><CalendarDays size={18} /></div>
        </div>
      </div>
    </section>
  );
}

async function PlansSection() {
  await connection();
  const supabase = await createClient();
  const [catalogResult, limitsResult] = await Promise.all([
    supabase
      .from("plan_catalog")
      .select("plan,display_name,description,monthly_price_cents,annual_price_cents,currency,benefits,pricing_note,display_order")
      .order("display_order", { ascending: true }),
    supabase.from("plan_limits").select("plan,max_subjects,max_flashcards,max_saved_exams"),
  ]);
  const catalog = catalogResult.data ?? [];
  const free = catalog.find((plan) => plan.plan === "free");
  const pro = catalog.find((plan) => plan.plan === "pro");
  const limits = new Map((limitsResult.data ?? []).map((item) => [item.plan, item]));
  const freeLimits = limits.get("free");
  const proLimits = limits.get("pro");

  return (
    <section className="plans-section section-shell" id="planos">
      <div className="section-heading centered-heading">
        <span className="section-kicker">COMECE DO SEU JEITO</span>
        <h2>Um bom começo cabe <span>no seu bolso.</span></h2>
        <p>O essencial para organizar sua rotina é gratuito. O Pro amplia as ferramentas para quem precisa de mais.</p>
      </div>
      {catalogResult.error || limitsResult.error || !free || !pro || !freeLimits || !proLimits ? (
        <p className="pricing-disclaimer" role="status">As informações dos planos estão temporariamente indisponíveis.</p>
      ) : <div className="pricing-grid">
        <article className="pricing-card">
          <div className="pricing-top"><div><span className="pricing-icon free-pricing-icon"><BookOpen size={17} /></span><span className="plan-label">PARA COMEÇAR</span></div></div>
          <h3>{free.display_name}</h3>
          <p className="pricing-description">{free.description}</p>
          <p className="price"><strong>{formatPlanPrice(free.monthly_price_cents, free.currency)}</strong><span>/ sempre</span></p>
          <ul className="benefit-list">{free.benefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}</ul>
          <p className="pricing-limits">{freeLimits.max_subjects} matérias · {freeLimits.max_flashcards} flashcards · {freeLimits.max_saved_exams} simulados</p>
          <a className="button button-outline button-full" href="/cadastro">Criar conta gratuita <ArrowRight size={15} /></a>
        </article>
        <article className="pricing-card pro-card">
          <span className="popular-badge"><Sparkles size={12} /> MAIS POSSIBILIDADES</span>
          <div className="pricing-top"><div><span className="pricing-icon pro-pricing-icon"><BrainCircuit size={17} /></span><span className="plan-label">PARA IR MAIS LONGE</span></div></div>
          <h3>{pro.display_name}</h3>
          <p className="pricing-description">{pro.description}</p>
          <p className="price"><strong>{formatPlanPrice(pro.monthly_price_cents, pro.currency)}</strong><span>/ mês*</span></p>
          <p className="pricing-annual">{formatPlanPrice(pro.annual_price_cents, pro.currency)} por ano*</p>
          <ul className="benefit-list">{pro.benefits.map((benefit) => <li key={benefit}><Check size={15} />{benefit}</li>)}</ul>
          <p className="pricing-limits">{proLimits.max_subjects} matérias · {proLimits.max_flashcards} flashcards · {proLimits.max_saved_exams} simulados</p>
          <a className="button button-pro button-full" href="#aviso-planos">Ver situação do Pro <ArrowRight size={15} /></a>
        </article>
      </div>}
      <p className="pricing-disclaimer" id="aviso-planos">{pro?.pricing_note ?? "Os pagamentos ainda não estão disponíveis."}</p>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="final-cta section-shell">
      <div className="cta-spark cta-spark-one"><Sparkles size={16} /></div>
      <div className="cta-spark cta-spark-two"><span /></div>
      <div className="cta-content">
        <span className="section-kicker">O SEU PRÓXIMO PASSO COMEÇA AQUI</span>
        <h2>Aprender melhor começa <span>com um plano possível.</span></h2>
        <p>Menos pressão para fazer tudo. Mais clareza para começar por algo.</p>
        <a className="button button-primary button-large" href="/cadastro">Começar gratuitamente <ArrowRight size={16} /></a>
      </div>
    </section>
  );
}

function PlansLoading() {
  return (
    <section className="plans-section section-shell" id="planos" aria-busy="true">
      <div className="section-heading centered-heading">
        <span className="section-kicker">COMECE DO SEU JEITO</span>
        <h2>Conheça os planos StudyFlow.</h2>
        <p>Carregando benefícios, preços e limites atuais…</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner section-shell">
        <Brand href="/#inicio" />
        <p>Seu caminho para aprender melhor.</p>
        <span>© 2026 StudyFlow</span>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <ProductSection />
        <MethodSection />
        <Suspense fallback={<PlansLoading />}><PlansSection /></Suspense>
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

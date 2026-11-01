# StudyFlow

**Seu caminho para aprender melhor.**

StudyFlow é uma plataforma de estudos em desenvolvimento para ajudar estudantes a organizar matérias, revisar conteúdos e definir o próximo passo. O produto está sendo construído em fases.

> Fases 1–8 estão implementadas: fundação visual, autenticação, matérias, assuntos, flashcards, revisão espaçada, simulados, histórico, dashboard, SmartPlan e catálogo de planos. Cobranças ainda não estão disponíveis.

## Stack e requisitos

- Next.js App Router, React e TypeScript.
- Tailwind CSS 4, estilos próprios e Lucide React.
- Supabase Auth e PostgreSQL com Row Level Security (RLS).
- Netlify como destino de hospedagem planejado.
- Node.js 22 ou superior recomendado; a versão atual do Next.js exige no mínimo 20.9.

As dependências da aplicação estão fixadas em `package.json` e `package-lock.json`. Os comandos Supabase usam CLI 2.122.0 via `npx`.

## Rodar localmente

1. Instale as dependências: `npm install`.
2. Copie `.env.example` para `.env.local` e preencha URL e chave publicável do seu projeto Supabase.
3. Configure o endereço local de callback (ver **Configuração do Supabase** abaixo).
4. Rode `npm run dev` e abra [http://localhost:3000](http://localhost:3000).

Verificações da aplicação:

```bash
npm run lint
npm run build
```

Rotas de autenticação: `/cadastro` e `/entrar`. Áreas autenticadas: `/dashboard`, `/flashcards`, `/quizzes`, `/plano` e `/assinatura`.

## Configuração do Supabase

No projeto Supabase, em **Authentication → URL Configuration**:

- Defina `Site URL` para `http://localhost:3000` durante desenvolvimento local.
- Inclua `http://localhost:3000/auth/callback` entre os redirect URLs permitidos.
- Antes do deploy, configure o domínio de produção e inclua o callback de produção.
- `NEXT_PUBLIC_SITE_URL` deve ser a origem exata usada para construir o link de confirmação.

O fluxo usa confirmação por e-mail quando ela está habilitada no Supabase. O app usa apenas a chave **publishable** do projeto e não precisa da `service_role` para cadastro, login ou consultas protegidas por RLS.

## Banco e migrations

A migration `supabase/migrations/20261030203934_profile_preferences_auth.sql` cria:

- `public.profiles`, ligada a `auth.users.id`, sem duplicar credenciais.
- `public.user_preferences`, com fuso horário, dias/minutos disponíveis e tema.
- RLS nas duas tabelas, leitura e atualização apenas do próprio usuário.
- Trigger de criação de perfil e preferências no cadastro. A função de trigger fica no schema não exposto `private`; usuários do Data API não podem executá-la diretamente.

O cadastro não coleta nome, data de nascimento ou dados de pagamento. Um nome de exibição pode ser informado depois. A migration foi aplicada ao projeto Supabase `studyflow` conectado para esta implementação.

A fase 3 adiciona `profiles.plan` (gerenciado no servidor), `plan_limits`, `subjects` e `topics`. O limite gratuito de 3 matérias fica centralizado em `plan_limits`; uma Server Action apresenta o estado do limite e um trigger atômico no schema não exposto `private` impede excedê-lo mesmo com requisições simultâneas. Matérias e assuntos têm RLS por usuário, nomes únicos por proprietário e chaves estrangeiras que mantêm cada assunto ligado a uma matéria do mesmo usuário. Os limites iniciais do Pro são cadastrados na fase 8; não há cobranças ativas.

As migrations incrementais da fase 3 são `supabase/migrations/20261030211753_subjects_topics.sql` e `supabase/migrations/20261030211842_subjects_private_limit.sql`.

A fase 4 adiciona `flashcards` e `flashcard_reviews`, com RLS por proprietário, histórico de revisão e limite Free de 100 cartões centralizado em `plan_limits` e aplicado atomicamente por trigger privado. A função privada de revisão registra a avaliação e atualiza o intervalo do cartão na mesma transação. O algoritmo é determinístico: “Errei” agenda em 10 minutos e zera a sequência; “Difícil” multiplica o intervalo por 1,2; “Lembrei” dobra; “Fácil” triplica, com intervalo inicial de 1 dia para Difícil/Lembrei, 3 dias para Fácil e teto de 10 anos. Revisões bem-sucedidas incrementam a sequência; uma resposta errada reinicia.

As migrations da fase 4 são `supabase/migrations/20261030220116_flashcards_spaced_repetition.sql` e `supabase/migrations/20261030220207_flashcard_review_insert_defaults.sql`. Ambas concedem somente os privilégios necessários à Data API e mantêm RLS habilitada. O logo recebido está em `public/brand/studyflow-logo-v3-vertical.png` e é usado pela marca reutilizável.

A fase 5 adiciona a rota `/quizzes`, editor de simulados com até 30 questões e alternativas, associação opcional a assuntos, resolução passo a passo, correção no banco e histórico com snapshots. O limite Free de 3 simulados vem de `plan_limits` e é aplicado atomicamente no banco. O gabarito fica no schema privado; a tela de resolução recebe apenas enunciados e alternativas, o banco exige que todas as questões sejam respondidas e só grava a correção ao enviar. Ao editar um simulado, é necessário marcar novamente a alternativa correta em cada questão. O histórico guarda o texto e o resultado da versão usada naquela tentativa.

As migrations incrementais da fase 5 são `supabase/migrations/20261030221417_quizzes_and_attempts.sql`, `supabase/migrations/20261030222401_harden_quiz_answer_access.sql` e `supabase/migrations/20261030222706_quiz_integrity_and_indexes.sql`. Os testes de isolamento, gabarito, correção, histórico e limite Free estão em `supabase/tests/quizzes_attempts_rls_test.sql`.

A fase 6 transforma o dashboard em um resumo dos dados reais da conta: matérias e assuntos, cartões vencidos, foco nos últimos sete dias, último resultado de simulado e atividade recente. O temporizador oferece blocos de 15, 25 ou 45 minutos e associação opcional a um assunto. `study_sessions` tem RLS por proprietário, grants somente para leitura, início e conclusão, uma sessão ativa por usuário e índice para filtrar o histórico semanal. A duração é calculada pelo banco a partir dos horários registrados pelo servidor. O resumo semanal usa uma função `SECURITY INVOKER`, limitada à conta autenticada.

As migrations da fase 6 são `supabase/migrations/20261031002302_study_sessions_focus_timer.sql` e `supabase/migrations/20261031002337_study_sessions_topic_fk_index.sql`.

A fase 7 adiciona `/plano`, com disponibilidade semanal editável, metas de prova/domínio e um cronograma determinístico de sete dias. O SmartPlan combina revisões vencidas, dificuldade informada nos assuntos, tempo desde a última atividade, metas com data e tarefas pendentes. Os blocos usam durações de 15, 25 ou 45 minutos, exibem o motivo da recomendação e podem ser marcados como concluídos. Cada regeneração cria uma nova versão do plano e arquiva a anterior; tarefas pendentes são redistribuídas. Preferências, metas, planos e tarefas usam RLS por proprietário e grants explícitos. A função `save_study_plan` é `SECURITY INVOKER` e grava o plano e as tarefas na mesma transação.

As migrations da fase 7 são `supabase/migrations/20261031004359_smartplan_plans_goals.sql` e `supabase/migrations/20261031004424_planned_tasks_user_id_index.sql`.

A fase 8 centraliza nome, benefícios, preços e permissões em `plan_catalog`, e os limites de uso em `plan_limits`. `/assinatura` mostra o plano atual, uso da conta e benefícios. O acesso ao SmartPlan é consultado no servidor e protegido novamente pelas policies RLS. O próprio usuário não pode promover seu plano.

A migration da fase 8 é `supabase/migrations/20261031010110_plan_catalog_subscriptions_entitlements.sql`. Ela adiciona o catálogo Free/Pro, os limites Pro iniciais, a tabela de assinatura com leitura apenas de campos não sensíveis pelo próprio titular e o registro privado de eventos de cobrança. `supabase/migrations/20261031010147_plan_entitlement_indexes_and_private_policy.sql` adiciona índices para as referências de plano e uma policy restrita ao `service_role` no histórico privado de eventos.

A cobrança usa um QR Code Pix com valor fixo para cada período e uma fila de aprovação manual. No Inter, gere um Pix estático personalizado para o valor mensal e outro para o anual; configure os respectivos códigos copia e cola em `STUDYFLOW_PIX_COPIA_E_COLA_MONTHLY` e `STUDYFLOW_PIX_COPIA_E_COLA_ANNUAL`. Os valores devem corresponder aos preços de `plan_catalog`; se os preços mudarem, gere novos códigos. Configure também `STUDYFLOW_ADMIN_EMAILS` e `SUPABASE_SECRET_KEY` (ou a chave antiga `SUPABASE_SERVICE_ROLE_KEY`) somente no servidor. Depois de conferir o crédito diretamente no Inter, um administrador acessa `/admin/pagamentos` e aprova ou recusa o pedido. A aprovação registra o responsável e ativa/extende o período Pro na mesma transação. Não há renovação automática; cada novo período exige outro Pix e outra aprovação.

A migration de cobrança manual é `supabase/migrations/20261101142717_manual_pix_approval.sql`. Ela guarda o pedido e o valor calculado pelo banco, limita a leitura ao próprio titular, impede alterações do estado pelo usuário e restringe a revisão à chave administrativa do servidor.

Com Docker Desktop disponível para o stack local:

```bash
npm run db:local:start
npm run db:test
npm run db:local:stop
```

Para criar uma migration, use `npm run db:new -- nome_da_migration`. Para aplicar migrations com a CLI, autentique e vincule o projeto primeiro (`npx --yes supabase@2.122.0 login` e `npx --yes supabase@2.122.0 link --project-ref <project-ref>`), depois rode `npm run db:push`.

Os testes pgTAP em `supabase/tests/` cobrem criação de perfil, RLS, limites de matérias, flashcards e simulados, isolamento entre usuários, gabarito privado, histórico e progressão dos intervalos de revisão. Eles rodam no banco local por `npm run db:test`.

## Segurança da autenticação

- `@supabase/ssr` gerencia a sessão em cookies; `proxy.ts` atualiza tokens com `auth.getClaims()`.
- A página privada verifica novamente as claims no servidor. O proxy sozinho não é a autorização dos dados.
- As policies usam `auth.uid()` em `USING` e `WITH CHECK`; atualizações de perfil só podem alterar `display_name`.
- O cliente não pode inserir, apagar ou transferir perfis e preferências.
- Respostas corretas de simulados ficam em schema privado; a submissão é corrigida no banco e as respostas só aparecem no histórico após uma tentativa completa.
- Chaves de servidor não têm prefixo `NEXT_PUBLIC_` e não são usadas no navegador.
- A role Pro nunca é derivada de `user_metadata` ou de um valor controlável no cliente.

## Publicação na Netlify

O projeto usa Next.js 16 com App Router. A Netlify detecta e configura o adaptador Next.js automaticamente; não é necessário exportar o app como site estático nem fixar um plugin de Next.js. O arquivo `.nvmrc` seleciona Node.js 22 durante a build.

Antes do deploy, conecte o repositório Git na Netlify e configure as variáveis de ambiente para o contexto **Production**:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` com a origem HTTPS oficial do site, sem caminho de callback.

Use apenas a chave publishable do Supabase no app. Não cadastre `service_role` ou secret keys como variáveis `NEXT_PUBLIC_`. Depois de criar o domínio Netlify, configure o **Site URL** do Supabase com a origem do site e permita a URL exata `https://<dominio>/auth/callback`; mantenha `http://localhost:3000/**` para desenvolvimento local. Adicione um padrão de preview somente se os deploys de preview forem usados. Consulte a [configuração de redirects do Supabase Auth](https://supabase.com/docs/guides/auth/redirect-urls).

Valide cadastro, confirmação de e-mail, login, recuperação de senha e acesso às rotas privadas em um deploy de preview antes de promover para produção. A abertura pública do cadastro depende também de definir política de retenção e fluxo de exclusão de conta.

## Estrutura do projeto

```text
src/
  app/
    (auth)/             telas e Server Actions de cadastro/login
    auth/callback/      troca o código de confirmação por sessão
    dashboard/          resumo real, temporizador, matérias e rota protegida
    flashcards/         cartões, revisão e histórico
    quizzes/            simulados, correção e tentativas
    plano/              metas, disponibilidade e geração da agenda SmartPlan
    assinatura/         plano atual, limites e oferta Pro informativa
    globals.css         identidade visual, temas e estilos responsivos
    layout.tsx          idioma, metadados e fonte
    page.tsx            landing page
  components/
    auth/               formulários de acesso
    brand.tsx           marca reutilizável
    dashboard/          produtividade e temporizador de foco
    flashcards/         fluxo de revisão e biblioteca de cartões
    quizzes/            editor, resolução e histórico de simulados
    smartplan/          disponibilidade, metas, agenda e progresso semanal
    mobile-menu.tsx     navegação móvel
    theme-toggle.tsx    tema claro/escuro
  lib/
    auth/               verificação de sessão no servidor
    plans/              catálogo, limites e consulta de permissões no servidor
    supabase/           clientes browser/server/proxy e tipos gerados
supabase/
  migrations/           alterações versionadas do banco
  tests/                testes pgTAP
.env.example
```

## Modelo relacional atual e planejado

Todas as entidades de usuário levam um `user_id` ou pertencem por uma chave composta a uma entidade do mesmo proprietário. Chaves estrangeiras em cascata serão usadas quando apagar o pai também deve apagar os dados dependentes. Histórico que precise ser preservado terá política de retenção explícita.

| Tabela | Relações e finalidade |
| --- | --- |
| `profiles` | Uma linha por `auth.users.id`; perfil mínimo, sem credenciais. |
| `user_preferences` | Uma linha por perfil; fuso horário, disponibilidade e tema. |
| `subjects` | Matérias do usuário, com cor e limite aplicado no banco. |
| `topics` | Assuntos ligados a uma matéria do mesmo usuário, com dificuldade percebida de 1 a 5. |
| `flashcards` | Pergunta e resposta do cartão, assunto opcional e próxima data de revisão. |
| `flashcard_reviews` | Histórico imutável de avaliação, intervalo anterior/seguinte e próxima data recomendada. |
| `quizzes` | Simulados do usuário, com limite Free de 3. |
| `questions` | Questões de um simulado e assunto opcional. |
| `question_options` | Alternativas visíveis; não inclui a correção. |
| `private.quiz_answer_keys` | Respostas corretas em schema privado, sem leitura pela Data API. |
| `quiz_attempts` | Tentativas e resultados calculados no banco após o envio completo. |
| `attempt_answers` | Snapshots das respostas e da correção por tentativa concluída. |
| `study_sessions` | Sessões de foco. |
| `study_goals` | Metas e períodos de aprendizado. |
| `study_plans` | Versões do plano, datas e parâmetros de geração. |
| `planned_tasks` | Blocos planejados, estado e razão da recomendação. |
| `subscriptions` | Estado comercial controlado pelo servidor; o titular lê somente os campos de status e período. |
| `manual_payment_requests` | Pedidos Pix do titular e estado de revisão; a aprovação é feita pelo administrador. |
| `private.subscription_events` | Histórico privado de eventos, escrito por processo confiável. |

Gabaritos de simulados ficarão em schema não exposto ou serão lidos exclusivamente pelo servidor. Índices, unicidade por usuário e constraints serão adicionados junto dos módulos correspondentes.

## Free, Pro e preços

Os preços mensais e anuais vêm de `plan_catalog`. O pedido Pix registra o preço vigente no momento do pedido; o administrador confere a entrada no Inter antes de aprovar. Benefícios e permissões ficam no catálogo; limites numéricos ficam em `plan_limits`.

| Recurso | Gratuito | Pro (futuro) |
| --- | --- | --- |
| Matérias | Até 3 | Até 20, configurável |
| Flashcards | Até 100 | Até 2.000, configurável |
| Simulados salvos | Até 3 | Até 50, configurável |
| Revisão | Fila e histórico básicos | Integrada ao cronograma e desempenho |
| Planejamento | Organização manual | SmartPlan e cronograma adaptativo, atualmente bloqueados até a ativação confiável do Pro |
| Estatísticas | Essenciais | Detalhadas, relatórios e exportação |

## SmartPlan: regras implementadas

O algoritmo é determinístico para o mesmo conjunto de dados e versão. Ele calcula uma prioridade a partir de revisões vencidas, dificuldade percebida, tempo desde a atividade, prazo de prova, metas de domínio e tarefas pendentes. Depois distribui blocos de 15, 25 ou 45 minutos nos dias e limites diários configurados, com penalidade de repetição para favorecer a alternância entre assuntos. Cada tarefa salva a justificativa usada. Ao regenerar, a versão anterior é arquivada e tarefas ainda pendentes entram como fator de prioridade. O plano organiza a rotina, sem prometer resultados acadêmicos.

## Etapas de implementação

1. **Concluída — fundação e landing:** identidade responsiva, tema claro/escuro e navegação. Lint e build de produção aprovados.
2. **Concluída — banco e autenticação:** migrations, perfil mínimo, cadastro/login/logout, confirmação de e-mail, sessão verificada no servidor e RLS. Teste transacional verificou isolamento entre dois usuários.
3. **Concluída — matérias e assuntos:** CRUD por usuário, RLS, limite Free de 3 matérias validado no banco e dificuldade percebida nos assuntos.
4. **Concluída — flashcards e revisão:** criação, edição e exclusão; fila de cartões vencidos; histórico e espaçamento inicial, com intervalo controlado no banco. Limite Free de 100 aplicado no servidor e no banco.
5. **Concluída — simulados e histórico:** editor, correção no banco, gabarito privado e limite Free de 3 aplicado no banco.
6. **Concluída — dashboard e produtividade:** cartões de resumo com dados reais, revisões pendentes, atividade recente, temporizador persistente de foco associado a um assunto e estado de carregamento responsivo.
7. **Concluída — SmartPlan:** disponibilidade, metas, agenda determinística de sete dias, justificativas e conclusão de tarefas.
8. **Concluída — Pro e permissões:** catálogo configurável, limites centralizados e bloqueio do SmartPlan no servidor e no RLS.
9. **Implementada — Pix manual:** QR Code configurável, pedidos pendentes e painel administrativo para conferir e aprovar pagamentos. A migration foi aplicada ao projeto Supabase conectado; as variáveis de ambiente ainda precisam ser configuradas.
10. **Concluída — testes e segurança:** suíte pgTAP com 65 verificações de planos, SmartPlan, assinaturas, limites, isolamento e gabaritos; aplicada a migration `20261031012027_profile_update_column_grants.sql`, que impede usuários de alterar o próprio plano; navegação com landmarks semânticos. A suíte passou no projeto conectado dentro de uma transação com `ROLLBACK`; `npm run lint` e `npx tsc --noEmit` também passaram. Para rodar pgTAP localmente, é necessário iniciar o Supabase local com Docker.
11. **Em preparação:** deploy Netlify e checklist de produção antes de abrir cadastro público, incluindo a proteção contra senhas vazadas no [Supabase Auth](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), disponível nos projetos Supabase Pro ou superiores.

## Privacidade

O produto minimiza dados pessoais; o fluxo Pix pede apenas o nome que aparece no pagamento para ajudar na conferência e não solicita comprovante, senha ou dados de acesso bancário. Exclusão de conta e política de retenção precisam ser implementadas antes de operar com usuários reais. O uso comercial e a cobrança de menores dependem de validação das regras do Inter e da participação do responsável legal, quando aplicável.

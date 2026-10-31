create table public.question_bank_subjects (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in (
    'Linguagens e suas tecnologias',
    'Matemática e suas tecnologias',
    'Ciências da Natureza e suas tecnologias',
    'Ciências Humanas e Sociais Aplicadas'
  )),
  name text not null unique,
  slug text not null unique,
  position smallint not null unique check (position > 0),
  created_at timestamptz not null default now()
);

create table public.question_bank_topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.question_bank_subjects (id) on delete cascade,
  name text not null,
  slug text not null unique,
  position smallint not null check (position > 0),
  created_at timestamptz not null default now(),
  constraint question_bank_topics_subject_name_unique unique (subject_id, name),
  constraint question_bank_topics_subject_position_unique unique (subject_id, position)
);

create table public.question_bank_questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.question_bank_topics (id) on delete restrict,
  prompt text not null,
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  created_at timestamptz not null default now(),
  constraint question_bank_questions_prompt_length check (char_length(btrim(prompt)) between 1 and 3000),
  constraint question_bank_questions_topic_prompt_unique unique (topic_id, prompt),
  constraint question_bank_questions_id_topic_unique unique (id, topic_id)
);

create index question_bank_questions_topic_idx
  on public.question_bank_questions (topic_id, difficulty, created_at desc);

create table public.question_bank_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank_questions (id) on delete cascade,
  label text not null,
  position smallint not null check (position between 1 and 6),
  created_at timestamptz not null default now(),
  constraint question_bank_options_label_length check (char_length(btrim(label)) between 1 and 500),
  constraint question_bank_options_question_position_unique unique (question_id, position),
  constraint question_bank_options_id_question_unique unique (id, question_id)
);

create table private.question_bank_answer_keys (
  question_id uuid primary key references public.question_bank_questions (id) on delete cascade,
  correct_option_id uuid not null,
  explanation text,
  created_at timestamptz not null default now(),
  constraint question_bank_answer_keys_explanation_length check (explanation is null or char_length(explanation) <= 2000),
  constraint question_bank_answer_keys_option_fk
    foreign key (correct_option_id, question_id)
    references public.question_bank_options (id, question_id)
    on delete cascade
);

comment on table public.question_bank_subjects is
  'Predefined StudyFlow curriculum based on Brazilian high-school knowledge areas.';
comment on table public.question_bank_questions is
  'Curated multiple-choice questions. Answer keys and explanations are kept in the private schema.';
comment on table private.question_bank_answer_keys is
  'Private answer keys for the shared question bank. Never granted to Data API roles.';

alter table public.questions
  add column source_bank_question_id uuid
    references public.question_bank_questions (id) on delete set null;
create index questions_source_bank_question_idx
  on public.questions (source_bank_question_id)
  where source_bank_question_id is not null;

alter table public.question_bank_subjects enable row level security;
alter table public.question_bank_topics enable row level security;
alter table public.question_bank_questions enable row level security;
alter table public.question_bank_options enable row level security;
alter table private.question_bank_answer_keys enable row level security;

revoke all on table public.question_bank_subjects, public.question_bank_topics,
  public.question_bank_questions, public.question_bank_options
  from public, anon, authenticated;
revoke all on table private.question_bank_answer_keys
  from public, anon, authenticated;

grant select on table public.question_bank_subjects, public.question_bank_topics,
  public.question_bank_questions, public.question_bank_options to authenticated;

create policy "question_bank_subjects_select_authenticated"
  on public.question_bank_subjects for select to authenticated using (true);
create policy "question_bank_topics_select_authenticated"
  on public.question_bank_topics for select to authenticated using (true);
create policy "question_bank_questions_select_authenticated"
  on public.question_bank_questions for select to authenticated using (true);
create policy "question_bank_options_select_authenticated"
  on public.question_bank_options for select to authenticated using (true);

insert into public.question_bank_subjects (area, name, slug, position) values
  ('Linguagens e suas tecnologias', 'Língua Portuguesa', 'lingua-portuguesa', 1),
  ('Linguagens e suas tecnologias', 'Literatura', 'literatura', 2),
  ('Linguagens e suas tecnologias', 'Língua Inglesa', 'lingua-inglesa', 3),
  ('Linguagens e suas tecnologias', 'Artes', 'artes', 4),
  ('Linguagens e suas tecnologias', 'Educação Física', 'educacao-fisica', 5),
  ('Linguagens e suas tecnologias', 'Redação e argumentação', 'redacao-argumentacao', 6),
  ('Matemática e suas tecnologias', 'Matemática', 'matematica', 7),
  ('Ciências da Natureza e suas tecnologias', 'Biologia', 'biologia', 8),
  ('Ciências da Natureza e suas tecnologias', 'Física', 'fisica', 9),
  ('Ciências da Natureza e suas tecnologias', 'Química', 'quimica', 10),
  ('Ciências Humanas e Sociais Aplicadas', 'História', 'historia', 11),
  ('Ciências Humanas e Sociais Aplicadas', 'Geografia', 'geografia', 12),
  ('Ciências Humanas e Sociais Aplicadas', 'Filosofia', 'filosofia', 13),
  ('Ciências Humanas e Sociais Aplicadas', 'Sociologia', 'sociologia', 14);

insert into public.question_bank_topics (subject_id, name, slug, position)
select subject.id, topic.name, topic.slug, topic.position
from (values
  ('lingua-portuguesa', 'Interpretação de textos', 'portugues-interpretacao', 1),
  ('lingua-portuguesa', 'Gramática e sintaxe', 'portugues-gramatica', 2),
  ('lingua-portuguesa', 'Gêneros e linguagem', 'portugues-generos', 3),
  ('literatura', 'Literatura brasileira', 'literatura-brasileira', 1),
  ('literatura', 'Escolas literárias', 'escolas-literarias', 2),
  ('literatura', 'Leitura e recursos expressivos', 'leitura-recursos-expressivos', 3),
  ('lingua-inglesa', 'Compreensão de leitura', 'ingles-reading', 1),
  ('lingua-inglesa', 'Tempos verbais', 'ingles-tempos-verbais', 2),
  ('lingua-inglesa', 'Vocabulário em contexto', 'ingles-vocabulario', 3),
  ('artes', 'Artes visuais', 'artes-visuais', 1),
  ('artes', 'Arte brasileira', 'arte-brasileira', 2),
  ('artes', 'Música, teatro e dança', 'artes-musica-teatro-danca', 3),
  ('educacao-fisica', 'Corpo e movimento', 'educacao-fisica-movimento', 1),
  ('educacao-fisica', 'Esportes e jogos', 'educacao-fisica-esportes', 2),
  ('educacao-fisica', 'Saúde e qualidade de vida', 'educacao-fisica-saude', 3),
  ('redacao-argumentacao', 'Tese e argumentação', 'redacao-tese-argumentacao', 1),
  ('redacao-argumentacao', 'Coesão e coerência', 'redacao-coesao-coerencia', 2),
  ('redacao-argumentacao', 'Proposta de intervenção', 'redacao-intervencao', 3),
  ('matematica', 'Aritmética, razão e porcentagem', 'matematica-aritmetica-porcentagem', 1),
  ('matematica', 'Álgebra e funções', 'matematica-algebra-funcoes', 2),
  ('matematica', 'Geometria, estatística e probabilidade', 'matematica-geometria-estatistica', 3),
  ('biologia', 'Citologia e metabolismo', 'biologia-citologia', 1),
  ('biologia', 'Ecologia e ambiente', 'biologia-ecologia', 2),
  ('biologia', 'Genética e evolução', 'biologia-genetica-evolucao', 3),
  ('fisica', 'Mecânica e movimento', 'fisica-mecanica', 1),
  ('fisica', 'Energia e termologia', 'fisica-energia-termologia', 2),
  ('fisica', 'Eletricidade e ondas', 'fisica-eletricidade-ondas', 3),
  ('quimica', 'Estrutura atômica e tabela periódica', 'quimica-atomos-tabela', 1),
  ('quimica', 'Ligações e reações químicas', 'quimica-ligacoes-reacoes', 2),
  ('quimica', 'Soluções e química orgânica', 'quimica-solucoes-organica', 3),
  ('historia', 'História antiga e medieval', 'historia-antiga-medieval', 1),
  ('historia', 'Brasil Colônia e Império', 'historia-brasil-colonia-imperio', 2),
  ('historia', 'Brasil República e mundo contemporâneo', 'historia-republica-contemporanea', 3),
  ('geografia', 'Cartografia e geografia física', 'geografia-cartografia-fisica', 1),
  ('geografia', 'População e urbanização', 'geografia-populacao-urbanizacao', 2),
  ('geografia', 'Economia, globalização e ambiente', 'geografia-globalizacao-ambiente', 3),
  ('filosofia', 'Filosofia antiga e moderna', 'filosofia-antiga-moderna', 1),
  ('filosofia', 'Ética e conhecimento', 'filosofia-etica-conhecimento', 2),
  ('filosofia', 'Política e sociedade', 'filosofia-politica-sociedade', 3),
  ('sociologia', 'Cultura e identidade', 'sociologia-cultura-identidade', 1),
  ('sociologia', 'Cidadania e participação social', 'sociologia-cidadania', 2),
  ('sociologia', 'Trabalho e desigualdade', 'sociologia-trabalho-desigualdade', 3)
) as topic(subject_slug, name, slug, position)
join public.question_bank_subjects as subject on subject.slug = topic.subject_slug;

-- Bank entries are original StudyFlow practice questions, not copied exam items.
with question_seed as (
  select * from jsonb_to_recordset($bank$
  [
    {"subject_name":"Língua Portuguesa","topic_name":"Interpretação de textos","prompt":"Leia: ‘A praça ganhou novas árvores e bancos, e os moradores passaram a usá-la também à noite.’ Qual mudança o texto associa às melhorias?","difficulty":1,"explanation":"O trecho relaciona diretamente as melhorias ao aumento do uso da praça pelos moradores.","correct":2,"options":["A praça deixou de ser frequentada.","Os moradores evitaram o espaço à noite.","A praça passou a ser usada também à noite.","As árvores foram retiradas."]},
    {"subject_name":"Língua Portuguesa","topic_name":"Gramática e sintaxe","prompt":"Na frase ‘Os estudantes revisaram cuidadosamente o conteúdo’, a palavra ‘cuidadosamente’ indica: ","difficulty":1,"explanation":"‘Cuidadosamente’ modifica o verbo ‘revisaram’ e indica o modo como a ação ocorreu.","correct":3,"options":["um substantivo no plural.","uma característica dos estudantes.","uma ação futura.","o modo da revisão."]},
    {"subject_name":"Língua Portuguesa","topic_name":"Gêneros e linguagem","prompt":"Uma notícia que informa um acontecimento recente, apresenta dados e atribui declarações a fontes tem como finalidade principal:","difficulty":1,"explanation":"A notícia relata fatos de interesse público com informações verificáveis e fontes identificadas.","correct":1,"options":["informar o leitor sobre um fato.","ensinar uma sequência de instruções.","defender sempre uma opinião pessoal.","criar personagens fictícios."]},
    {"subject_name":"Língua Portuguesa","topic_name":"Interpretação de textos","prompt":"Em ‘Embora estivesse cansada, Ana terminou a atividade’, a palavra ‘embora’ introduz uma ideia de:","difficulty":2,"explanation":"A conjunção ‘embora’ apresenta uma concessão: o cansaço não impediu a conclusão da atividade.","correct":4,"options":["causa.","finalidade.","conclusão.","concessão."]},
    {"subject_name":"Língua Portuguesa","topic_name":"Gramática e sintaxe","prompt":"Assinale a frase em que a concordância verbal está adequada:","difficulty":1,"explanation":"O sujeito ‘as propostas’ está no plural, por isso o verbo também fica no plural.","correct":2,"options":["As proposta foi aprovada.","As propostas foram aprovadas.","As propostas foi aprovadas.","A proposta foram aprovada."]},
    {"subject_name":"Língua Portuguesa","topic_name":"Gêneros e linguagem","prompt":"Em um anúncio de campanha de vacinação, o uso de verbos no imperativo costuma servir para:","difficulty":1,"explanation":"O imperativo é usado para orientar ou convidar o público a realizar uma ação.","correct":1,"options":["convidar o público a agir.","narrar um fato passado.","descrever uma paisagem.","apresentar uma hipótese científica."]},
    {"subject_name":"Literatura","topic_name":"Literatura brasileira","prompt":"Uma característica marcante da primeira fase do Modernismo brasileiro foi:","difficulty":2,"explanation":"O Modernismo de 1922 buscou romper padrões acadêmicos e aproximar a linguagem literária da experiência brasileira.","correct":2,"options":["a rejeição de temas nacionais.","a ruptura com padrões acadêmicos e a experimentação.","a imitação obrigatória dos modelos clássicos portugueses.","o uso exclusivo de linguagem científica."]},
    {"subject_name":"Literatura","topic_name":"Escolas literárias","prompt":"No Romantismo brasileiro, especialmente na primeira geração, a figura do indígena foi frequentemente apresentada como:","difficulty":2,"explanation":"O indianismo romântico idealizou o indígena como herói ligado à origem da nação.","correct":3,"options":["um personagem sem relação com a identidade nacional.","um retrato documental sem idealização.","um herói idealizado associado à formação nacional.","um símbolo da industrialização urbana."]},
    {"subject_name":"Literatura","topic_name":"Leitura e recursos expressivos","prompt":"Quando um poema atribui voz ou ação humana a um objeto, como em ‘a janela observa a rua’, ocorre:","difficulty":1,"explanation":"A personificação atribui características humanas a seres inanimados ou abstratos.","correct":4,"options":["hipérbole.","eufemismo.","metonímia.","personificação."]},
    {"subject_name":"Língua Inglesa","topic_name":"Compreensão de leitura","prompt":"Read: ‘Maya usually walks to school, but today she is taking the bus because it is raining.’ Why is Maya taking the bus today?","difficulty":1,"explanation":"The sentence gives the reason directly: it is raining.","correct":2,"options":["She missed school yesterday.","It is raining.","The school is closed.","She never walks to school."]},
    {"subject_name":"Língua Inglesa","topic_name":"Tempos verbais","prompt":"Choose the correct completion: ‘Last weekend, we ___ a science museum.’","difficulty":1,"explanation":"‘Last weekend’ indica passado; o passado simples de ‘visit’ é ‘visited’.","correct":1,"options":["visited","visit","are visiting","will visit"]},
    {"subject_name":"Língua Inglesa","topic_name":"Vocabulário em contexto","prompt":"In the sentence ‘The instructions were clear, so everyone understood the task’, the word ‘clear’ means:","difficulty":1,"explanation":"Nesse contexto, ‘clear’ significa fácil de entender ou claro.","correct":3,"options":["expensive.","late.","easy to understand.","dangerous."]},
    {"subject_name":"Língua Inglesa","topic_name":"Tempos verbais","prompt":"Choose the correct question in the simple past:","difficulty":2,"explanation":"Perguntas no simple past usam ‘Did’ + sujeito + verbo na forma base.","correct":4,"options":["Did she went home?","Does she went home?","Was she go home?","Did she go home?"]},
    {"subject_name":"Língua Inglesa","topic_name":"Compreensão de leitura","prompt":"Read: ‘The library will be closed on Monday for repairs. It will reopen on Tuesday morning.’ When will the library reopen?","difficulty":1,"explanation":"O aviso informa que a biblioteca reabre na manhã de terça-feira.","correct":2,"options":["Monday morning.","Tuesday morning.","Wednesday afternoon.","It will remain closed."]},
    {"subject_name":"Língua Inglesa","topic_name":"Vocabulário em contexto","prompt":"In ‘You can borrow three books at a time’, the verb ‘borrow’ means:","difficulty":2,"explanation":"‘Borrow’ significa pegar algo emprestado, com intenção de devolver.","correct":1,"options":["take something temporarily and return it.","buy something permanently.","write something down.","throw something away."]},
    {"subject_name":"Artes","topic_name":"Artes visuais","prompt":"Em uma composição visual, o contraste entre claro e escuro pode ajudar a:","difficulty":1,"explanation":"O contraste tonal diferencia elementos e pode direcionar o olhar do observador.","correct":2,"options":["eliminar toda diferença entre formas.","destacar elementos e criar profundidade visual.","impedir a leitura da imagem.","transformar uma imagem em som."]},
    {"subject_name":"Artes","topic_name":"Arte brasileira","prompt":"O movimento antropofágico, associado ao Modernismo brasileiro, propunha principalmente:","difficulty":2,"explanation":"A antropofagia cultural defendia apropriar-se criticamente de referências externas para criar algo próprio.","correct":3,"options":["reproduzir literalmente a arte europeia.","proibir influências de outras culturas.","assimilar influências externas de forma crítica e criativa.","substituir toda arte por documentos históricos."]},
    {"subject_name":"Artes","topic_name":"Música, teatro e dança","prompt":"A marcação de pulsos regulares em uma música está mais diretamente relacionada ao:","difficulty":1,"explanation":"O pulso é a referência regular que organiza o andamento musical.","correct":1,"options":["ritmo.","cenário.","figurino.","enquadramento."]},
    {"subject_name":"Educação Física","topic_name":"Corpo e movimento","prompt":"O aquecimento antes de uma atividade física tem como objetivo principal:","difficulty":1,"explanation":"O aquecimento prepara gradualmente o organismo para o esforço que virá.","correct":4,"options":["substituir a hidratação.","garantir que não haverá fadiga.","eliminar a necessidade de descanso.","preparar o corpo para o esforço de forma gradual."]},
    {"subject_name":"Educação Física","topic_name":"Esportes e jogos","prompt":"Em um jogo coletivo, respeitar regras e adversários contribui para:","difficulty":1,"explanation":"O respeito às regras e às pessoas torna a prática mais segura, justa e colaborativa.","correct":2,"options":["impedir qualquer cooperação.","promover uma prática segura e justa.","eliminar a participação da equipe.","garantir que apenas uma pessoa jogue."]},
    {"subject_name":"Educação Física","topic_name":"Saúde e qualidade de vida","prompt":"Para uma pessoa saudável, uma rotina de atividade física deve ser:","difficulty":2,"explanation":"A regularidade e a adequação à condição individual são mais importantes do que esforços extremos.","correct":3,"options":["sempre extenuante, sem pausas.","feita apenas uma vez por mês.","regular e adequada às condições individuais.","igual para todas as pessoas."]},
    {"subject_name":"Redação e argumentação","topic_name":"Tese e argumentação","prompt":"Em um texto dissertativo-argumentativo, a tese é:","difficulty":1,"explanation":"A tese apresenta a posição central que o texto desenvolverá e defenderá.","correct":2,"options":["uma lista de palavras difíceis.","o ponto de vista central defendido pelo autor.","a assinatura do texto.","um exemplo sem relação com o tema."]},
    {"subject_name":"Redação e argumentação","topic_name":"Coesão e coerência","prompt":"Qual conectivo expressa melhor uma relação de oposição entre duas ideias?","difficulty":1,"explanation":"‘Entretanto’ é um conectivo adversativo que introduz contraste ou oposição.","correct":4,"options":["portanto.","porque.","além disso.","entretanto."]},
    {"subject_name":"Redação e argumentação","topic_name":"Proposta de intervenção","prompt":"Uma proposta de intervenção bem definida deve indicar, entre outros elementos:","difficulty":2,"explanation":"A proposta precisa tornar claro quem executa a ação e o que será feito, além de detalhamento pertinente.","correct":1,"options":["um agente responsável e uma ação relacionada ao problema.","apenas uma citação sem explicação.","uma nova tese sem ação.","uma pergunta retórica no título."]},
    {"subject_name":"Matemática","topic_name":"Aritmética, razão e porcentagem","prompt":"Uma mochila custa R$ 240 e recebe desconto de 15%. Qual é o preço após o desconto?","difficulty":2,"explanation":"15% de 240 é 36; então 240 − 36 = 204 reais.","correct":3,"options":["R$ 196.","R$ 200.","R$ 204.","R$ 216."]},
    {"subject_name":"Matemática","topic_name":"Aritmética, razão e porcentagem","prompt":"A razão entre 12 meninas e 18 meninos pode ser simplificada para:","difficulty":1,"explanation":"Dividindo os dois termos por 6, obtemos 12:18 = 2:3.","correct":2,"options":["1:2.","2:3.","3:2.","6:9."]},
    {"subject_name":"Matemática","topic_name":"Álgebra e funções","prompt":"Se 3x − 7 = 11, qual é o valor de x?","difficulty":1,"explanation":"Somando 7 aos dois lados, 3x = 18; dividindo por 3, x = 6.","correct":4,"options":["4.","5.","8.","6."]},
    {"subject_name":"Matemática","topic_name":"Álgebra e funções","prompt":"Uma função linear é dada por f(x) = 2x + 1. Quanto vale f(4)?","difficulty":1,"explanation":"Substituindo x por 4: f(4) = 2·4 + 1 = 9.","correct":1,"options":["9.","7.","8.","10."]},
    {"subject_name":"Matemática","topic_name":"Geometria, estatística e probabilidade","prompt":"Um retângulo tem lados de 8 cm e 5 cm. Qual é sua área?","difficulty":1,"explanation":"A área de um retângulo é base × altura: 8 × 5 = 40 cm².","correct":3,"options":["13 cm².","26 cm².","40 cm².","80 cm²."]},
    {"subject_name":"Matemática","topic_name":"Geometria, estatística e probabilidade","prompt":"Ao lançar um dado comum, qual é a probabilidade de obter um número par?","difficulty":2,"explanation":"Há três resultados pares (2, 4, 6) entre seis resultados igualmente possíveis: 3/6 = 1/2.","correct":2,"options":["1/6.","1/2.","2/3.","5/6."]},
    {"subject_name":"Biologia","topic_name":"Citologia e metabolismo","prompt":"A principal função das mitocôndrias nas células eucarióticas é:","difficulty":1,"explanation":"As mitocôndrias participam da respiração celular e da produção de ATP.","correct":4,"options":["armazenar a informação hereditária exclusivamente no núcleo.","produzir a parede celular de plantas.","realizar a fotossíntese em animais.","participar da respiração celular e produzir ATP."]},
    {"subject_name":"Biologia","topic_name":"Ecologia e ambiente","prompt":"Em uma cadeia alimentar, os produtores são organismos que:","difficulty":1,"explanation":"Produtores, como plantas e algas, formam matéria orgânica a partir de fontes inorgânicas de energia e matéria.","correct":1,"options":["produzem matéria orgânica, geralmente por fotossíntese.","se alimentam somente de consumidores terciários.","decompõem apenas rochas.","não participam do fluxo de energia."]},
    {"subject_name":"Biologia","topic_name":"Genética e evolução","prompt":"Em um cruzamento entre dois indivíduos heterozigotos Aa, com dominância completa, qual proporção genotípica é esperada?","difficulty":3,"explanation":"Aa × Aa produz AA, Aa, Aa e aa, resultando em proporção 1:2:1.","correct":2,"options":["3 AA : 1 aa.","1 AA : 2 Aa : 1 aa.","1 Aa : 1 aa.","100% AA."]},
    {"subject_name":"Biologia","topic_name":"Citologia e metabolismo","prompt":"A osmose corresponde ao movimento líquido de água através de uma membrana semipermeável em direção à solução:","difficulty":2,"explanation":"A água tende a se deslocar para o lado com maior concentração de solutos, considerando as condições usuais de osmose.","correct":3,"options":["com menor concentração de solutos.","com temperatura necessariamente menor.","com maior concentração de solutos.","sem qualquer diferença de concentração."]},
    {"subject_name":"Biologia","topic_name":"Ecologia e ambiente","prompt":"O aumento excessivo de nutrientes em um lago pode favorecer florações de algas e reduzir o oxigênio dissolvido. Esse processo é chamado:","difficulty":2,"explanation":"A eutrofização resulta do enriquecimento por nutrientes e pode levar à queda do oxigênio na água.","correct":4,"options":["sucessão primária.","mutualismo.","biomagnificação.","eutrofização."]},
    {"subject_name":"Biologia","topic_name":"Genética e evolução","prompt":"A seleção natural tende a aumentar a frequência de características que, em determinado ambiente:","difficulty":2,"explanation":"Características que elevam sobrevivência e reprodução podem tornar-se mais frequentes ao longo das gerações.","correct":1,"options":["favorecem o sucesso reprodutivo dos indivíduos que as possuem.","são sempre adquiridas por esforço individual.","impedem qualquer variação hereditária.","aparecem porque os organismos antecipam suas necessidades."]},
    {"subject_name":"Física","topic_name":"Mecânica e movimento","prompt":"Um ciclista percorre 120 km em 3 horas, mantendo velocidade média constante. Qual é essa velocidade média?","difficulty":1,"explanation":"Velocidade média = distância/tempo = 120/3 = 40 km/h.","correct":2,"options":["30 km/h.","40 km/h.","60 km/h.","90 km/h."]},
    {"subject_name":"Física","topic_name":"Mecânica e movimento","prompt":"Um objeto parte do repouso e acelera uniformemente a 2 m/s² durante 4 s. Qual é sua velocidade final?","difficulty":2,"explanation":"v = v₀ + at = 0 + 2·4 = 8 m/s.","correct":4,"options":["2 m/s.","4 m/s.","6 m/s.","8 m/s."]},
    {"subject_name":"Física","topic_name":"Energia e termologia","prompt":"O trabalho realizado por uma força constante de 10 N que desloca um objeto 3 m na mesma direção é:","difficulty":2,"explanation":"W = F·d quando força e deslocamento têm a mesma direção: 10·3 = 30 J.","correct":1,"options":["30 J.","13 J.","3 J.","0,3 J."]},
    {"subject_name":"Física","topic_name":"Eletricidade e ondas","prompt":"Um aparelho ligado a 12 V é percorrido por uma corrente de 2 A. Pela relação V = R·I, sua resistência é:","difficulty":2,"explanation":"R = V/I = 12/2 = 6 ohms.","correct":3,"options":["4 Ω.","5 Ω.","6 Ω.","24 Ω."]},
    {"subject_name":"Física","topic_name":"Energia e termologia","prompt":"Ao aquecer uma substância, a temperatura aumenta de 20 °C para 35 °C. A variação de temperatura é:","difficulty":1,"explanation":"A variação é a temperatura final menos a inicial: 35 − 20 = 15 °C.","correct":2,"options":["10 °C.","15 °C.","20 °C.","55 °C."]},
    {"subject_name":"Física","topic_name":"Eletricidade e ondas","prompt":"Uma onda realiza 5 oscilações completas por segundo. Sua frequência é:","difficulty":1,"explanation":"Frequência é o número de oscilações por segundo; portanto, 5 Hz.","correct":4,"options":["0,2 Hz.","2 Hz.","4 Hz.","5 Hz."]},
    {"subject_name":"Química","topic_name":"Estrutura atômica e tabela periódica","prompt":"O número atômico de um elemento corresponde ao número de:","difficulty":1,"explanation":"O número atômico (Z) é definido pelo número de prótons no núcleo.","correct":1,"options":["prótons no núcleo.","nêutrons mais elétrons.","camadas eletrônicas.","isótopos conhecidos."]},
    {"subject_name":"Química","topic_name":"Ligações e reações químicas","prompt":"A ligação predominante entre os átomos de sódio e cloro no cloreto de sódio é:","difficulty":2,"explanation":"O sódio transfere elétron ao cloro, formando íons atraídos eletrostaticamente: ligação iônica.","correct":3,"options":["metálica.","covalente apolar.","iônica.","ponte de hidrogênio."]},
    {"subject_name":"Química","topic_name":"Soluções e química orgânica","prompt":"Uma solução contém 10 g de sal em 2 L de solução. Qual é sua concentração comum em g/L?","difficulty":1,"explanation":"Concentração comum = massa/volume = 10/2 = 5 g/L.","correct":2,"options":["2 g/L.","5 g/L.","10 g/L.","20 g/L."]},
    {"subject_name":"Química","topic_name":"Estrutura atômica e tabela periódica","prompt":"Elementos de uma mesma família (grupo) da tabela periódica tendem a apresentar propriedades químicas semelhantes porque possuem:","difficulty":2,"explanation":"Nos elementos representativos, a semelhança está ligada à configuração de elétrons de valência.","correct":4,"options":["o mesmo número de nêutrons.","massas atômicas idênticas.","o mesmo número de camadas em todos os casos.","configurações semelhantes de elétrons de valência."]},
    {"subject_name":"Química","topic_name":"Ligações e reações químicas","prompt":"Na reação balanceada 2 H₂ + O₂ → 2 H₂O, quantas moléculas de água são formadas para cada molécula de oxigênio consumida?","difficulty":1,"explanation":"Os coeficientes indicam a proporção: 1 molécula de O₂ reage para formar 2 moléculas de H₂O.","correct":1,"options":["2.","1.","3.","4."]},
    {"subject_name":"Química","topic_name":"Soluções e química orgânica","prompt":"Uma solução aquosa com pH 3 é, em condições usuais:","difficulty":1,"explanation":"Valores de pH menores que 7 indicam caráter ácido em soluções aquosas usuais.","correct":3,"options":["neutra.","básica.","ácida.","metálica."]},
    {"subject_name":"História","topic_name":"História antiga e medieval","prompt":"Na democracia ateniense da Antiguidade, a participação política direta era restrita principalmente a:","difficulty":2,"explanation":"A cidadania ateniense era limitada; mulheres, escravizados e estrangeiros não participavam como cidadãos políticos.","correct":2,"options":["todas as pessoas residentes, sem distinção.","homens considerados cidadãos, excluindo vários grupos.","apenas comerciantes estrangeiros.","somente pessoas escravizadas."]},
    {"subject_name":"História","topic_name":"Brasil Colônia e Império","prompt":"A produção açucareira colonial brasileira esteve historicamente associada a:","difficulty":2,"explanation":"A economia açucareira se organizou em grandes propriedades, monocultura exportadora e trabalho escravizado.","correct":4,"options":["pequenas propriedades autossuficientes sem exportação.","industrialização urbana baseada em trabalho assalariado.","produção voltada apenas ao consumo local.","latifúndio, monocultura exportadora e escravidão."]},
    {"subject_name":"História","topic_name":"Brasil República e mundo contemporâneo","prompt":"A abolição legal da escravidão no Brasil foi promulgada em 13 de maio de 1888 pela:","difficulty":1,"explanation":"A Lei Áurea, assinada em 13 de maio de 1888, aboliu juridicamente a escravidão no Brasil.","correct":1,"options":["Lei Áurea.","Lei Eusébio de Queirós.","Lei de Terras.","Constituição de 1824."]},
    {"subject_name":"História","topic_name":"História antiga e medieval","prompt":"Na sociedade feudal europeia, a relação de suserania e vassalagem envolvia principalmente:","difficulty":2,"explanation":"Era uma relação entre nobres baseada em juramentos, concessão de benefícios e obrigações recíprocas.","correct":3,"options":["eleição de representantes por voto universal.","contratos de trabalho industrial.","obrigações recíprocas entre nobres, ligadas a benefícios e fidelidade.","propriedade coletiva das fábricas."]},
    {"subject_name":"História","topic_name":"Brasil Colônia e Império","prompt":"A transferência da corte portuguesa para o Rio de Janeiro, em 1808, ocorreu no contexto das:","difficulty":1,"explanation":"A corte fugiu das invasões napoleônicas a Portugal, deslocando a sede do governo para o Brasil.","correct":2,"options":["guerras de independência hispano-americanas.","invasões napoleônicas na Península Ibérica.","revoluções de 1848.","cruzadas medievais."]},
    {"subject_name":"História","topic_name":"Brasil República e mundo contemporâneo","prompt":"A Constituição brasileira de 1988 é conhecida como ‘Constituição Cidadã’ por ampliar e consolidar:","difficulty":4,"explanation":"A Constituição de 1988 fortaleceu direitos e garantias fundamentais no processo de redemocratização.","correct":4,"options":["o poder hereditário da monarquia.","a censura prévia como regra geral.","a escravidão por dívida.","direitos e garantias fundamentais."]},
    {"subject_name":"Geografia","topic_name":"Cartografia e geografia física","prompt":"Em um mapa na escala 1:100.000, 1 cm representa 1 km no terreno. Uma distância de 4 cm no mapa corresponde a:","difficulty":2,"explanation":"Cada centímetro representa 1 km; assim, 4 cm representam 4 km.","correct":3,"options":["400 m.","2 km.","4 km.","40 km."]},
    {"subject_name":"Geografia","topic_name":"População e urbanização","prompt":"O deslocamento diário de pessoas entre municípios para trabalhar ou estudar é chamado de:","difficulty":2,"explanation":"Movimento pendular é o deslocamento cotidiano entre o local de residência e outros municípios por trabalho ou estudo.","correct":1,"options":["movimento pendular.","êxodo rural.","migração sazonal internacional.","transumância."]},
    {"subject_name":"Geografia","topic_name":"Economia, globalização e ambiente","prompt":"A substituição de vegetação nativa por atividades agropecuárias pode causar, entre outros efeitos:","difficulty":2,"explanation":"A retirada da cobertura vegetal altera habitats, solo e ciclos hidrológicos, aumentando riscos de erosão e perda de biodiversidade.","correct":2,"options":["aumento garantido da biodiversidade local.","perda de habitats e maior erosão do solo.","fim do escoamento superficial.","redução automática de toda emissão de gases."]},
    {"subject_name":"Geografia","topic_name":"Cartografia e geografia física","prompt":"As linhas imaginárias paralelas ao Equador são usadas principalmente para determinar a:","difficulty":1,"explanation":"Os paralelos permitem medir a latitude, distância angular ao norte ou ao sul do Equador.","correct":4,"options":["altitude.","longitude.","escala.","latitude."]},
    {"subject_name":"Geografia","topic_name":"População e urbanização","prompt":"O crescimento urbano sem planejamento pode contribuir para:","difficulty":1,"explanation":"A ocupação desigual e sem infraestrutura pode ampliar congestionamentos, falta de saneamento e segregação socioespacial.","correct":3,"options":["a distribuição igualitária de serviços automaticamente.","o desaparecimento das periferias.","problemas de infraestrutura e segregação socioespacial.","a eliminação de deslocamentos pendulares."]},
    {"subject_name":"Geografia","topic_name":"Economia, globalização e ambiente","prompt":"A globalização econômica é marcada, entre outros aspectos, pela intensificação de:","difficulty":1,"explanation":"A globalização envolve fluxos mais intensos de mercadorias, capitais, informações e pessoas entre lugares.","correct":2,"options":["isolamento completo das economias nacionais.","fluxos internacionais de mercadorias, capitais e informações.","fim de todas as redes de comunicação.","desaparecimento das diferenças regionais."]},
    {"subject_name":"Filosofia","topic_name":"Filosofia antiga e moderna","prompt":"Na filosofia de Sócrates, o diálogo e as perguntas eram usados para:","difficulty":2,"explanation":"O método socrático investiga ideias e pressupostos por meio de perguntas, buscando examinar o conhecimento.","correct":3,"options":["evitar qualquer discussão sobre conceitos.","substituir argumentos por autoridade política.","examinar ideias e pressupostos criticamente.","provar que toda opinião é igualmente demonstrada."]},
    {"subject_name":"Filosofia","topic_name":"Ética e conhecimento","prompt":"Uma decisão ética considera principalmente:","difficulty":1,"explanation":"A reflexão ética analisa valores, deveres, consequências e impactos das ações sobre outras pessoas.","correct":1,"options":["valores, responsabilidades e efeitos das ações.","somente a vantagem imediata de quem decide.","apenas a tradição, sem questionamento.","a impossibilidade de justificar escolhas."]},
    {"subject_name":"Filosofia","topic_name":"Política e sociedade","prompt":"Para o contratualismo, a ideia de contrato social procura explicar:","difficulty":2,"explanation":"Teorias contratualistas usam a ideia de acordo para explicar a origem ou a legitimidade da organização política.","correct":4,"options":["a origem biológica da linguagem.","a formação das espécies por seleção natural.","a estrutura química dos metais.","a legitimidade da organização política por um acordo."]},
    {"subject_name":"Filosofia","topic_name":"Filosofia antiga e moderna","prompt":"A alegoria da caverna, de Platão, discute especialmente a relação entre:","difficulty":2,"explanation":"A alegoria contrasta aparências e conhecimento, usando a saída da caverna como imagem de transformação intelectual.","correct":2,"options":["som e silêncio na música.","aparência, conhecimento e realidade.","produção industrial e comércio.","clima e relevo."]},
    {"subject_name":"Filosofia","topic_name":"Ética e conhecimento","prompt":"A expressão ‘penso, logo existo’, de Descartes, é usada como ponto de partida para:","difficulty":3,"explanation":"Descartes toma a certeza da própria atividade de pensar como fundamento inicial da investigação do conhecimento.","correct":3,"options":["negar que qualquer conhecimento seja possível.","defender que os sentidos nunca falham.","fundamentar a certeza na atividade de pensar.","explicar a origem do Estado democrático."]},
    {"subject_name":"Filosofia","topic_name":"Política e sociedade","prompt":"A noção de cidadania está ligada à relação entre indivíduos e comunidade política, incluindo:","difficulty":1,"explanation":"Cidadania envolve direitos, deveres e participação na vida pública.","correct":1,"options":["direitos, deveres e participação.","somente o pagamento de impostos.","a ausência de leis comuns.","a proibição de participar de decisões coletivas."]},
    {"subject_name":"Sociologia","topic_name":"Cultura e identidade","prompt":"Na Sociologia, cultura pode ser entendida como:","difficulty":1,"explanation":"Cultura inclui práticas, valores, símbolos e conhecimentos aprendidos e compartilhados socialmente.","correct":2,"options":["um conjunto de características biológicas imutáveis.","práticas, valores e significados aprendidos e compartilhados.","apenas obras expostas em museus.","uma característica exclusiva de sociedades urbanas."]},
    {"subject_name":"Sociologia","topic_name":"Cidadania e participação social","prompt":"A participação em conselhos, associações ou consultas públicas é uma forma de:","difficulty":1,"explanation":"Esses espaços permitem participação social em debates e decisões coletivas.","correct":4,"options":["mobilidade social automática.","socialização primária.","controle informal exclusivamente familiar.","participação cidadã na vida pública."]},
    {"subject_name":"Sociologia","topic_name":"Trabalho e desigualdade","prompt":"A desigualdade social envolve diferenças sistemáticas no acesso a recursos como renda, educação e poder. Uma forma de estudá-la é analisar:","difficulty":2,"explanation":"A Sociologia investiga como recursos e oportunidades são distribuídos e como as estruturas sociais produzem desigualdades.","correct":3,"options":["apenas as preferências individuais de consumo.","somente o clima de cada região.","a distribuição de recursos e oportunidades entre grupos.","a quantidade de espécies em um ecossistema."]},
    {"subject_name":"Sociologia","topic_name":"Cultura e identidade","prompt":"O processo pelo qual as pessoas aprendem normas, valores e formas de convivência de sua sociedade é chamado de:","difficulty":1,"explanation":"Socialização é o processo de aprendizagem e internalização de normas, valores e práticas sociais.","correct":1,"options":["socialização.","sedimentação.","fotossíntese.","urbanização vertical."]},
    {"subject_name":"Sociologia","topic_name":"Cidadania e participação social","prompt":"Uma política pública é, em termos gerais, uma ação organizada pelo poder público para:","difficulty":1,"explanation":"Políticas públicas são ações e programas estatais voltados a necessidades ou problemas coletivos.","correct":2,"options":["substituir todas as relações sociais.","enfrentar necessidades ou problemas coletivos.","impedir a existência de direitos.","garantir benefícios exclusivamente privados."]},
    {"subject_name":"Sociologia","topic_name":"Trabalho e desigualdade","prompt":"A divisão social do trabalho diz respeito à:","difficulty":2,"explanation":"A divisão social do trabalho descreve a distribuição de atividades e funções entre indivíduos e grupos.","correct":4,"options":["separação entre áreas rurais e oceanos.","classificação dos seres vivos por espécie.","distribuição das chuvas ao longo do ano.","distribuição de atividades e funções na sociedade."]},
    {"subject_name":"Redação e argumentação","topic_name":"Tese e argumentação","prompt":"Qual recurso fortalece um argumento em uma redação?","difficulty":2,"explanation":"Dados e exemplos pertinentes ajudam a sustentar uma tese, desde que sejam explicados e relacionados ao tema.","correct":2,"options":["repetir a mesma afirmação sem justificativa.","apresentar evidências pertinentes e explicar sua relação com a tese.","usar palavras difíceis sem clareza.","mudar de assunto no desenvolvimento."]},
    {"subject_name":"Matemática","topic_name":"Aritmética, razão e porcentagem","prompt":"Uma receita para 4 pessoas usa 300 g de farinha. Mantida a proporção, quanto será necessário para 10 pessoas?","difficulty":2,"explanation":"O fator de escala é 10/4 = 2,5; então 300 × 2,5 = 750 g.","correct":4,"options":["600 g.","650 g.","700 g.","750 g."]},
    {"subject_name":"Matemática","topic_name":"Álgebra e funções","prompt":"Qual é a raiz da equação x² − 9 = 0 que é positiva?","difficulty":2,"explanation":"x² = 9 tem soluções x = 3 e x = −3; a positiva é 3.","correct":1,"options":["3.","−3.","9.","0."]},
    {"subject_name":"Biologia","topic_name":"Genética e evolução","prompt":"Uma mutação é uma alteração que ocorre no material genético. Ela pode:","difficulty":2,"explanation":"Mutações introduzem variação genética; seus efeitos podem ser neutros, prejudiciais ou, em certos ambientes, vantajosos.","correct":3,"options":["ser sempre vantajosa.","ocorrer apenas por decisão consciente do organismo.","gerar variação genética com efeitos diferentes.","eliminar toda diversidade de uma população."]},
    {"subject_name":"Biologia","topic_name":"Citologia e metabolismo","prompt":"Os ribossomos participam diretamente da:","difficulty":1,"explanation":"Ribossomos realizam a síntese de proteínas a partir da informação trazida pelo RNA mensageiro.","correct":4,"options":["digestão de luz solar.","produção de lipídios na membrana.","armazenagem de água em plantas.","síntese de proteínas."]},
    {"subject_name":"Física","topic_name":"Mecânica e movimento","prompt":"Um carro mantém velocidade constante de 15 m/s por 20 s. Qual distância percorre nesse intervalo?","difficulty":1,"explanation":"Com velocidade constante, distância = velocidade × tempo = 15 × 20 = 300 m.","correct":2,"options":["35 m.","300 m.","750 m.","1.200 m."]},
    {"subject_name":"Química","topic_name":"Ligações e reações químicas","prompt":"Em uma ligação covalente, os átomos geralmente:","difficulty":1,"explanation":"Na ligação covalente, os átomos compartilham pares de elétrons.","correct":1,"options":["compartilham pares de elétrons.","transferem prótons entre núcleos.","perdem todos os nêutrons.","formam necessariamente uma liga metálica."]},
    {"subject_name":"História","topic_name":"Brasil República e mundo contemporâneo","prompt":"A Revolução Industrial iniciada na Inglaterra no século XVIII foi acompanhada pela expansão de:","difficulty":1,"explanation":"A industrialização ampliou o sistema fabril e alterou a produção e as relações de trabalho.","correct":3,"options":["trabalho exclusivamente doméstico artesanal.","economia sem máquinas.","fábricas, mecanização e trabalho assalariado.","feudalismo rural como única forma de produção."]},
    {"subject_name":"Geografia","topic_name":"Cartografia e geografia física","prompt":"A longitude é medida a partir do meridiano de referência de Greenwich e indica posições a leste ou oeste. Ela é expressa em:","difficulty":1,"explanation":"Longitude é uma coordenada angular, expressa em graus a leste ou oeste do meridiano de Greenwich.","correct":4,"options":["metros por segundo.","quilômetros quadrados.","porcentagem.","graus."]},
    {"subject_name":"Filosofia","topic_name":"Ética e conhecimento","prompt":"Na ética, analisar as consequências de uma ação significa considerar:","difficulty":2,"explanation":"Abordagens consequencialistas avaliam ações considerando seus efeitos ou resultados.","correct":1,"options":["os resultados que ela produz para os envolvidos.","apenas a intenção, ignorando qualquer efeito.","somente a forma gramatical da decisão.","o número de palavras usadas para justificá-la."]},
    {"subject_name":"Sociologia","topic_name":"Cultura e identidade","prompt":"O etnocentrismo ocorre quando alguém:","difficulty":2,"explanation":"Etnocentrismo é julgar outras culturas a partir dos valores da própria, tomando-os como padrão superior ou universal.","correct":2,"options":["estuda uma sociedade sem fazer perguntas.","julga outras culturas usando a própria como padrão universal.","reconhece que práticas culturais variam.","aprende um idioma estrangeiro."]},
    {"subject_name":"Literatura","topic_name":"Escolas literárias","prompt":"O Realismo do século XIX buscou, em linhas gerais, representar a sociedade com:","difficulty":2,"explanation":"O Realismo privilegiou observação crítica e representação menos idealizada das relações sociais.","correct":4,"options":["idealização sentimental como regra exclusiva.","temas mitológicos sem referência social.","linguagem apenas oral e improvisada.","observação crítica e menor idealização."]},
    {"subject_name":"Artes","topic_name":"Arte brasileira","prompt":"O uso de materiais cotidianos em uma obra contemporânea pode levar o público a refletir sobre:","difficulty":2,"explanation":"A arte contemporânea frequentemente questiona limites entre arte, cotidiano, objeto e participação do público.","correct":3,"options":["a impossibilidade de interpretação.","apenas a técnica de pintura a óleo.","os limites entre arte e cotidiano.","a necessidade de uma única resposta visual."]},
    {"subject_name":"Educação Física","topic_name":"Esportes e jogos","prompt":"No trabalho em equipe, a comunicação entre participantes ajuda a:","difficulty":1,"explanation":"Comunicação favorece coordenação, cooperação e tomada de decisão coletiva.","correct":1,"options":["coordenar ações e cooperar.","impedir a troca de estratégias.","eliminar as regras do jogo.","tornar todos os participantes idênticos."]},
    {"subject_name":"Redação e argumentação","topic_name":"Coesão e coerência","prompt":"A retomada de um termo anterior por pronomes ou expressões equivalentes contribui para a coesão porque:","difficulty":2,"explanation":"A retomada referencial conecta partes do texto e evita repetições desnecessárias.","correct":2,"options":["sempre muda o assunto.","conecta ideias e evita repetições desnecessárias.","elimina a necessidade de pontuação.","substitui todos os verbos."]},
    {"subject_name":"Matemática","topic_name":"Geometria, estatística e probabilidade","prompt":"As notas de um grupo foram 6, 7, 7 e 10. Qual é a média aritmética?","difficulty":1,"explanation":"A média é (6 + 7 + 7 + 10)/4 = 30/4 = 7,5.","correct":3,"options":["7.","7,25.","7,5.","8."]},
    {"subject_name":"Biologia","topic_name":"Ecologia e ambiente","prompt":"A principal fonte de energia que sustenta a maioria das cadeias alimentares terrestres é:","difficulty":1,"explanation":"A energia solar é capturada por produtores fotossintetizantes e entra na maior parte das cadeias alimentares.","correct":1,"options":["o Sol.","o núcleo da Terra exclusivamente.","o som ambiente.","a água sem qualquer transformação."]},
    {"subject_name":"Física","topic_name":"Eletricidade e ondas","prompt":"Em um circuito simples, se a resistência permanece constante e a tensão dobra, a corrente elétrica, pela lei de Ohm:","difficulty":2,"explanation":"Pela lei de Ohm I = V/R; com R constante, dobrar V dobra I.","correct":4,"options":["cai pela metade.","permanece sempre zero.","não pode ser determinada.","dobra."]},
    {"subject_name":"Química","topic_name":"Soluções e química orgânica","prompt":"Diluir uma solução adicionando água, sem perder soluto, provoca normalmente:","difficulty":2,"explanation":"Ao aumentar o volume mantendo a quantidade de soluto, a concentração diminui.","correct":2,"options":["aumentar a quantidade de soluto.","diminuir a concentração.","transformar todo soluto em gás.","manter a concentração sempre igual."]},
    {"subject_name":"História","topic_name":"História antiga e medieval","prompt":"A invenção da imprensa de tipos móveis na Europa do século XV contribuiu para:","difficulty":2,"explanation":"A imprensa ampliou a reprodução e circulação de textos, favorecendo a difusão de ideias e conhecimentos.","correct":3,"options":["impedir a circulação de livros.","encerrar imediatamente todas as guerras.","ampliar a reprodução e circulação de textos.","substituir a escrita por transmissão oral."]},
    {"subject_name":"Geografia","topic_name":"População e urbanização","prompt":"A densidade demográfica é calculada dividindo-se:","difficulty":1,"explanation":"Densidade demográfica é a população total dividida pela área do território.","correct":2,"options":["a área pela altitude média.","a população pela área.","o número de cidades pela renda.","a natalidade pela extensão da costa."]},
    {"subject_name":"Filosofia","topic_name":"Filosofia antiga e moderna","prompt":"Para Aristóteles, a virtude ética está relacionada à formação de hábitos e à busca de:","difficulty":3,"explanation":"Aristóteles associa a virtude à prática habitual e ao equilíbrio adequado nas escolhas, orientado pela razão.","correct":1,"options":["um meio adequado entre excessos, orientado pela razão.","uma regra que proíbe qualquer escolha.","a busca exclusiva de riqueza.","a rejeição de toda convivência política."]},
    {"subject_name":"Sociologia","topic_name":"Trabalho e desigualdade","prompt":"A mobilidade social se refere a mudanças na posição de indivíduos ou grupos dentro da:","difficulty":2,"explanation":"Mobilidade social descreve deslocamentos entre posições ou estratos sociais ao longo do tempo.","correct":4,"options":["cadeia alimentar.","escala cartográfica.","tabela periódica.","estrutura social."]},
    {"subject_name":"Redação e argumentação","topic_name":"Proposta de intervenção","prompt":"Uma proposta de intervenção respeitosa aos direitos humanos deve:","difficulty":2,"explanation":"A intervenção deve enfrentar o problema sem violar dignidade, liberdade ou outros direitos fundamentais.","correct":3,"options":["punir coletivamente grupos vulneráveis.","retirar direitos de quem discorda.","buscar uma solução sem violar direitos fundamentais.","substituir argumentos por ameaças."]}
  ]
  $bank$::jsonb) as seed(
    subject_name text,
    topic_name text,
    prompt text,
    difficulty smallint,
    explanation text,
    correct integer,
    options jsonb
  )
), inserted_questions as (
  insert into public.question_bank_questions (topic_id, prompt, difficulty)
  select topic.id, seed.prompt, seed.difficulty
  from question_seed as seed
  join public.question_bank_subjects as subject on subject.name = seed.subject_name
  join public.question_bank_topics as topic on topic.subject_id = subject.id and topic.name = seed.topic_name
  returning id, topic_id, prompt
), inserted_options as (
  insert into public.question_bank_options (question_id, label, position)
  select question.id, option_row.label, option_row.position::smallint
  from inserted_questions as question
  join question_seed as seed on seed.prompt = question.prompt
  cross join lateral jsonb_array_elements_text(seed.options) with ordinality as option_row(label, position)
  returning id, question_id, position
)
insert into private.question_bank_answer_keys (question_id, correct_option_id, explanation)
select option_row.question_id, option_row.id, seed.explanation
from inserted_options as option_row
join inserted_questions as question on question.id = option_row.question_id
join question_seed as seed on seed.prompt = question.prompt
where option_row.position = seed.correct;

create function private.copy_question_bank_item_to_quiz(
  p_quiz_id uuid,
  p_user_id uuid,
  p_bank_question_id uuid,
  p_topic_id uuid,
  p_position integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.question_bank_questions%rowtype;
  v_answer_key private.question_bank_answer_keys%rowtype;
  v_question_id uuid;
  v_option_id uuid;
  v_correct_option_id uuid;
  v_option record;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'question_bank_owner_mismatch' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.quizzes as quiz
    where quiz.id = p_quiz_id and quiz.user_id = p_user_id
  ) then
    raise exception 'quiz_not_found' using errcode = 'P0002';
  end if;

  select bank_question.* into v_question
  from public.question_bank_questions as bank_question
  where bank_question.id = p_bank_question_id;
  if not found then
    raise exception 'question_bank_item_not_found' using errcode = 'P0002';
  end if;

  if p_topic_id is not null and not exists (
    select 1 from public.topics as topic
    where topic.id = p_topic_id and topic.user_id = p_user_id
  ) then
    raise exception 'topic_not_owned' using errcode = '23503';
  end if;

  select answer_key.* into v_answer_key
  from private.question_bank_answer_keys as answer_key
  where answer_key.question_id = v_question.id;
  if not found then
    raise exception 'question_bank_answer_key_missing' using errcode = '23514';
  end if;

  insert into public.questions (
    quiz_id, user_id, topic_id, prompt, explanation, position, source_bank_question_id
  ) values (
    p_quiz_id, p_user_id, p_topic_id, v_question.prompt, v_answer_key.explanation,
    p_position, v_question.id
  ) returning id into v_question_id;

  for v_option in
    select bank_option.id, bank_option.label, bank_option.position
    from public.question_bank_options as bank_option
    where bank_option.question_id = v_question.id
    order by bank_option.position
  loop
    insert into public.question_options (question_id, quiz_id, user_id, label, position)
    values (v_question_id, p_quiz_id, p_user_id, v_option.label, v_option.position)
    returning id into v_option_id;

    if v_option.id = v_answer_key.correct_option_id then
      v_correct_option_id := v_option_id;
    end if;
  end loop;

  if v_correct_option_id is null then
    raise exception 'question_bank_answer_option_missing' using errcode = '23514';
  end if;

  insert into private.quiz_answer_keys (question_id, quiz_id, user_id, correct_option_id)
  values (v_question_id, p_quiz_id, p_user_id, v_correct_option_id);

  return v_question_id;
end;
$$;

revoke all on function private.copy_question_bank_item_to_quiz(uuid, uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.copy_question_bank_item_to_quiz(uuid, uuid, uuid, uuid, integer)
  to authenticated;

create or replace function public.save_quiz(
  p_quiz_id uuid,
  p_title text,
  p_description text,
  p_questions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz_id uuid;
  v_question jsonb;
  v_option jsonb;
  v_options jsonb;
  v_question_id uuid;
  v_option_id uuid;
  v_title text := pg_catalog.btrim(p_title);
  v_description text := nullif(pg_catalog.btrim(p_description), '');
  v_correct_index integer;
  v_option_count integer;
  v_option_position integer;
  v_question_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if v_title is null or char_length(v_title) not between 1 and 120
    or (v_description is not null and char_length(v_description) > 1000)
    or pg_catalog.jsonb_typeof(p_questions) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_questions) not between 1 and 30 then
    raise exception 'invalid_quiz' using errcode = '22023';
  end if;

  if p_quiz_id is null then
    insert into public.quizzes (user_id, title, description)
    values (v_user_id, v_title, v_description)
    returning id into v_quiz_id;
  else
    update public.quizzes as quiz
    set title = v_title, description = v_description
    where quiz.id = p_quiz_id and quiz.user_id = v_user_id
    returning quiz.id into v_quiz_id;
    if not found then
      raise exception 'quiz_not_found' using errcode = 'P0002';
    end if;
    delete from public.questions as question
    where question.quiz_id = v_quiz_id and question.user_id = v_user_id;
  end if;

  for v_question in select item.value from pg_catalog.jsonb_array_elements(p_questions) as item(value)
  loop
    v_question_position := v_question_position + 1;

    if pg_catalog.jsonb_typeof(v_question) is distinct from 'object' then
      raise exception 'invalid_question' using errcode = '22023';
    end if;

    if v_question ? 'bank_question_id' then
      if coalesce(v_question ->> 'bank_question_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'invalid_question_bank_id' using errcode = '22023';
      end if;
      perform private.copy_question_bank_item_to_quiz(
        v_quiz_id,
        v_user_id,
        (v_question ->> 'bank_question_id')::uuid,
        nullif(v_question ->> 'topic_id', '')::uuid,
        v_question_position
      );
      continue;
    end if;

    v_options := v_question -> 'options';
    if pg_catalog.jsonb_typeof(v_options) is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_options) not between 2 and 6
      or nullif(v_question ->> 'prompt', '') is null
      or char_length(pg_catalog.btrim(v_question ->> 'prompt')) > 3000
      or (v_question ->> 'explanation' is not null and char_length(v_question ->> 'explanation') > 2000)
      or coalesce(v_question ->> 'correct_option_index', '') !~ '^[0-5]$' then
      raise exception 'invalid_question' using errcode = '22023';
    end if;

    v_correct_index := (v_question ->> 'correct_option_index')::integer;
    v_option_count := pg_catalog.jsonb_array_length(v_options);
    if v_correct_index >= v_option_count then
      raise exception 'invalid_correct_option' using errcode = '22023';
    end if;

    insert into public.questions (quiz_id, user_id, topic_id, prompt, explanation, position)
    values (
      v_quiz_id, v_user_id, nullif(v_question ->> 'topic_id', '')::uuid,
      pg_catalog.btrim(v_question ->> 'prompt'),
      nullif(pg_catalog.btrim(v_question ->> 'explanation'), ''),
      v_question_position
    ) returning id into v_question_id;

    for v_option, v_option_position in
      select item.value, (item.ordinality - 1)::integer
      from pg_catalog.jsonb_array_elements(v_options) with ordinality as item(value, ordinality)
    loop
      if pg_catalog.jsonb_typeof(v_option) is distinct from 'object'
        or nullif(pg_catalog.btrim(v_option ->> 'text'), '') is null
        or char_length(pg_catalog.btrim(v_option ->> 'text')) > 500 then
        raise exception 'invalid_question_option' using errcode = '22023';
      end if;
      insert into public.question_options (question_id, quiz_id, user_id, label, position)
      values (v_question_id, v_quiz_id, v_user_id, pg_catalog.btrim(v_option ->> 'text'), v_option_position + 1)
      returning id into v_option_id;
      if v_option_position = v_correct_index then
        insert into private.quiz_answer_keys (question_id, quiz_id, user_id, correct_option_id)
        values (v_question_id, v_quiz_id, v_user_id, v_option_id);
      end if;
    end loop;
  end loop;

  return v_quiz_id;
end;
$$;

create or replace function public.load_quiz_editor(p_quiz_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_questions jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select quiz.* into v_quiz
  from public.quizzes as quiz
  where quiz.id = p_quiz_id and quiz.user_id = v_user_id;
  if not found then
    raise exception 'quiz_not_found' using errcode = 'P0002';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'prompt', question.prompt,
        'topic_id', question.topic_id,
        'explanation', case when question.source_bank_question_id is null then question.explanation else null end,
        'source_bank_question_id', question.source_bank_question_id,
        'options', (
          select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('text', option_row.label) order by option_row.position), '[]'::jsonb)
          from public.question_options as option_row
          where option_row.question_id = question.id and option_row.user_id = v_user_id
        ),
        'correct_option_index', null
      ) order by question.position
    ), '[]'::jsonb
  ) into v_questions
  from public.questions as question
  where question.quiz_id = p_quiz_id and question.user_id = v_user_id;

  return pg_catalog.jsonb_build_object(
    'id', v_quiz.id,
    'title', v_quiz.title,
    'description', v_quiz.description,
    'questions', v_questions
  );
end;
$$;

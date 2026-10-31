-- Repair UTF-8 catalog text that was stored after a Windows-1252 decoding pass.
-- Translating Windows-1252 punctuation back to its Latin-1 byte values also
-- preserves C1 bytes such as 0x81, which appear in the mojibake for "A".
create or replace function private.question_bank_text_has_mojibake(input_text text)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select pg_catalog.strpos(input_text, pg_catalog.chr(194)) > 0
      or pg_catalog.strpos(input_text, pg_catalog.chr(195)) > 0
      or exists (
        select 1
        from pg_catalog.generate_series(
          1,
          pg_catalog.char_length(input_text) - 1
        ) as character_positions(position)
        where pg_catalog.ascii(
                pg_catalog.substr(input_text, character_positions.position, 1)
              ) in (206, 226)
          and (
            pg_catalog.ascii(
              pg_catalog.substr(input_text, character_positions.position + 1, 1)
            ) between 128 and 191
            or pg_catalog.strpos(
              pg_catalog.chr(8364) || pg_catalog.chr(8218) || pg_catalog.chr(402) ||
              pg_catalog.chr(8222) || pg_catalog.chr(8230) || pg_catalog.chr(8224) ||
              pg_catalog.chr(8225) || pg_catalog.chr(710) || pg_catalog.chr(8240) ||
              pg_catalog.chr(352) || pg_catalog.chr(8249) || pg_catalog.chr(338) ||
              pg_catalog.chr(381) || pg_catalog.chr(8216) || pg_catalog.chr(8217) ||
              pg_catalog.chr(8220) || pg_catalog.chr(8221) || pg_catalog.chr(8226) ||
              pg_catalog.chr(8211) || pg_catalog.chr(8212) || pg_catalog.chr(732) ||
              pg_catalog.chr(8482) || pg_catalog.chr(353) || pg_catalog.chr(8250) ||
              pg_catalog.chr(339) || pg_catalog.chr(382) || pg_catalog.chr(376),
              pg_catalog.substr(input_text, character_positions.position + 1, 1)
            ) > 0
          )
      );
$$;

create or replace function private.repair_question_bank_text(input_text text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select pg_catalog.convert_from(
    pg_catalog.convert_to(
      pg_catalog.translate(
        input_text,
        pg_catalog.chr(8364) || pg_catalog.chr(8218) || pg_catalog.chr(402) ||
        pg_catalog.chr(8222) || pg_catalog.chr(8230) || pg_catalog.chr(8224) ||
        pg_catalog.chr(8225) || pg_catalog.chr(710) || pg_catalog.chr(8240) ||
        pg_catalog.chr(352) || pg_catalog.chr(8249) || pg_catalog.chr(338) ||
        pg_catalog.chr(381) || pg_catalog.chr(8216) || pg_catalog.chr(8217) ||
        pg_catalog.chr(8220) || pg_catalog.chr(8221) || pg_catalog.chr(8226) ||
        pg_catalog.chr(8211) || pg_catalog.chr(8212) || pg_catalog.chr(732) ||
        pg_catalog.chr(8482) || pg_catalog.chr(353) || pg_catalog.chr(8250) ||
        pg_catalog.chr(339) || pg_catalog.chr(382) || pg_catalog.chr(376),
        pg_catalog.chr(128) || pg_catalog.chr(130) || pg_catalog.chr(131) ||
        pg_catalog.chr(132) || pg_catalog.chr(133) || pg_catalog.chr(134) ||
        pg_catalog.chr(135) || pg_catalog.chr(136) || pg_catalog.chr(137) ||
        pg_catalog.chr(138) || pg_catalog.chr(139) || pg_catalog.chr(140) ||
        pg_catalog.chr(142) || pg_catalog.chr(145) || pg_catalog.chr(146) ||
        pg_catalog.chr(147) || pg_catalog.chr(148) || pg_catalog.chr(149) ||
        pg_catalog.chr(150) || pg_catalog.chr(151) || pg_catalog.chr(152) ||
        pg_catalog.chr(153) || pg_catalog.chr(154) || pg_catalog.chr(155) ||
        pg_catalog.chr(156) || pg_catalog.chr(158) || pg_catalog.chr(159)
      ),
      'LATIN1'
    ),
    'UTF8'
  );
$$;

alter table public.question_bank_subjects
  drop constraint if exists question_bank_subjects_area_check;

update public.question_bank_subjects
set area = private.repair_question_bank_text(area),
    name = private.repair_question_bank_text(name)
where private.question_bank_text_has_mojibake(area)
   or private.question_bank_text_has_mojibake(name);

alter table public.question_bank_subjects
  add constraint question_bank_subjects_area_check
  check (area in (
    'Linguagens e suas tecnologias',
    U&'Matem\00E1tica e suas tecnologias',
    U&'Ci\00EAncias da Natureza e suas tecnologias',
    U&'Ci\00EAncias Humanas e Sociais Aplicadas'
  ));

update public.question_bank_topics
set name = private.repair_question_bank_text(name)
where private.question_bank_text_has_mojibake(name);

update public.question_bank_questions
set prompt = private.repair_question_bank_text(prompt)
where private.question_bank_text_has_mojibake(prompt);

update public.question_bank_options
set label = private.repair_question_bank_text(label)
where private.question_bank_text_has_mojibake(label);

update private.question_bank_answer_keys
set explanation = private.repair_question_bank_text(explanation)
where explanation is not null
  and (
    private.question_bank_text_has_mojibake(explanation)
  );

drop function private.repair_question_bank_text(text);
drop function private.question_bank_text_has_mojibake(text);

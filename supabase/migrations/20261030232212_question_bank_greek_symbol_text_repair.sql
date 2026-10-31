-- Restore the Greek omega character in answer choices with electrical units.
update public.question_bank_options
set label = pg_catalog.replace(
  label,
  pg_catalog.chr(206) || pg_catalog.chr(169),
  pg_catalog.chr(937)
)
where pg_catalog.strpos(label, pg_catalog.chr(206) || pg_catalog.chr(169)) > 0;

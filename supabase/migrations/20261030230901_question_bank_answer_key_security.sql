create policy "question_bank_answer_keys_block_api_roles"
  on private.question_bank_answer_keys
  for all
  to anon, authenticated
  using (false)
  with check (false);

create index question_bank_answer_keys_option_idx
  on private.question_bank_answer_keys (correct_option_id, question_id);

alter table public.flashcard_reviews
  alter column interval_before_days set default 0,
  alter column interval_after_days set default 0,
  alter column next_review_at set default now();

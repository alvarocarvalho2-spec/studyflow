create index study_sessions_topic_owner_idx
  on public.study_sessions (topic_id, user_id);

-- Cover the owner foreign key so account deletion does not scan every plan task.
create index planned_tasks_user_id_idx
  on public.planned_tasks (user_id);

alter table public.exercises
  add column if not exists superset_group text;
  
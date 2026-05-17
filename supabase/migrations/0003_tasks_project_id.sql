-- =====================================================================
-- Migration 0003 — tasks.project_id (Fix-&-Flip-Verknüpfung)
-- =====================================================================
-- Im SQL-Editor einmal ausführen.

alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

create index if not exists tasks_project_idx on public.tasks(project_id);

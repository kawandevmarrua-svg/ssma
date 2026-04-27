-- Review comments for tracking issues on checklists and activities
create table if not exists review_comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('checklist', 'activity')),
  entity_id uuid not null,
  author_id uuid references auth.users(id),
  author_name text,
  content text not null,
  created_at timestamptz default now()
);

-- RLS
alter table review_comments enable row level security;

create policy "Authenticated users can view comments"
  on review_comments for select
  to authenticated
  using (true);

create policy "Authenticated users can insert comments"
  on review_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Authors can delete own comments"
  on review_comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- Realtime
alter publication supabase_realtime add table review_comments;

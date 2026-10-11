create table public.agent_memories (
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null check (char_length(agent_id) between 1 and 64),
  memory_key text not null check (char_length(memory_key) between 1 and 64),
  content text not null check (char_length(content) between 1 and 1000),
  source text not null check (char_length(source) between 1 and 200),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, agent_id, memory_key)
);
alter table public.agent_memories enable row level security;
revoke all on public.agent_memories from anon, authenticated;
grant select, insert, update, delete on public.agent_memories to authenticated;
create policy memory_owner on public.agent_memories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.stamp_memory() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger stamp_memory before insert or update on public.agent_memories
for each row execute function public.stamp_memory();

create function public.recall_memories(p_agent_id text, p_limit integer default 5)
returns table(memory_key text, content text, source text)
language sql stable security invoker set search_path = '' as $$
  select m.memory_key, m.content, m.source
  from public.agent_memories m
  where m.user_id = (select auth.uid())
    and m.agent_id = p_agent_id
    and (m.expires_at is null or m.expires_at > now())
  order by m.updated_at desc, m.memory_key asc
  limit greatest(1, least(coalesce(p_limit, 5), 5));
$$;
revoke all on function public.recall_memories(text, integer) from public, anon;
grant execute on function public.recall_memories(text, integer) to authenticated;

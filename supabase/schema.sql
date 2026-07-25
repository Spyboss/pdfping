create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  key text,
  key_hash text unique not null,
  key_prefix text,
  email text not null,
  user_id uuid references auth.users(id),
  plan text not null default 'free',
  limit_count integer not null default 10000,
  used_count integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_api_keys_key_hash on api_keys(key_hash);
create index if not exists idx_api_keys_user on api_keys(user_id);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references api_keys(id),
  endpoint text not null,
  status integer not null,
  created_at timestamptz default now()
);

create index if not exists idx_usage_logs_key_id on usage_logs(api_key_id);
create index if not exists idx_usage_logs_created on usage_logs(created_at);

alter table api_keys enable row level security;
alter table usage_logs enable row level security;

create policy "Users can view own API key" on api_keys
  for select using (auth.uid() = user_id);
create policy "Users can insert own API key" on api_keys
  for insert with check (auth.uid() = user_id);
create policy "Users can update own API key" on api_keys
  for update using (auth.uid() = user_id);

create policy "Users can view own usage" on usage_logs
  for select using (
    api_key_id in (
      select id from api_keys where user_id = auth.uid()
    )
  );

create or replace function increment(api_key_id uuid)
returns int
language plpgsql
as $$
begin
  update api_keys set used_count = used_count + 1 where id = api_key_id;
  return (select used_count from api_keys where id = api_key_id);
end;
$$;

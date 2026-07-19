create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  email text not null,
  user_id uuid references auth.users(id),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  limit_count integer not null default 10,
  used_count integer not null default 0,
  lemonsqueezy_customer_id text,
  created_at timestamptz default now()
);

create index if not exists idx_api_keys_key on api_keys(key);
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

create or replace function reset_monthly_usage()
returns void
language plpgsql
as $$
begin
  update api_keys set used_count = 0;
end;
$$;

create or replace function increment(api_key_id uuid)
returns int
language plpgsql
as $$
declare
  current int;
begin
  select used_count into current from api_keys where id = api_key_id;
  update api_keys set used_count = current + 1 where id = api_key_id;
  return current + 1;
end;
$$;

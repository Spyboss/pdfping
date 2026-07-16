-- Run this in your Supabase SQL editor
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  limit_count integer not null default 10,
  used_count integer not null default 0,
  stripe_customer_id text,
  created_at timestamptz default now()
);

create index if not exists idx_api_keys_key on api_keys(key);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references api_keys(id),
  endpoint text not null,
  status integer not null,
  created_at timestamptz default now()
);

create index if not exists idx_usage_logs_key_id on usage_logs(api_key_id);
create index if not exists idx_usage_logs_created on usage_logs(created_at);

-- Drop and recreate the function for monthly usage reset
create or replace function reset_monthly_usage()
returns void
language plpgsql
as $$
begin
  update api_keys set used_count = 0;
end;
$$;

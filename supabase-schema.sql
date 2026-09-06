-- Схема спільної бази Worship Hub.
-- Виконати один раз у Supabase → SQL Editor → New query → Run.

create table if not exists members  (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists songs    (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists setlists (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists personal (id text primary key, data jsonb not null, updated_at timestamptz default now());
create table if not exists prefs    (id text primary key, data jsonb not null, updated_at timestamptz default now());
-- спільні значення, які не є окремими сутностями (напр. порядок пісень)
create table if not exists shared   (id text primary key, data jsonb not null, updated_at timestamptz default now());

-- Доступ мають лише ті, хто має ключ підключення.
-- Ключ ніде не публікується: кожен вводить його у застосунку вручну.
alter table members  enable row level security;
alter table songs    enable row level security;
alter table setlists enable row level security;
alter table personal enable row level security;
alter table prefs    enable row level security;
alter table shared   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['members','songs','setlists','personal','prefs','shared'] loop
    execute format('drop policy if exists "group access" on %I', t);
    execute format(
      'create policy "group access" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;

-- Щоб зміни одного учасника одразу з'являлися в решти
alter publication supabase_realtime add table members;
alter publication supabase_realtime add table songs;
alter publication supabase_realtime add table setlists;
alter publication supabase_realtime add table personal;
alter publication supabase_realtime add table prefs;
alter publication supabase_realtime add table shared;

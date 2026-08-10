-- Ejecutar esto en Supabase: SQL Editor > New query > pegar > Run

create table entries (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  monto numeric not null,
  categoria text not null,
  persona text not null,
  descripcion text,
  fecha date not null,
  created_at timestamptz default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  target numeric not null,
  current numeric default 0,
  fecha_limite date,
  created_at timestamptz default now()
);

create table settings (
  id int primary key default 1,
  people jsonb not null default '["Persona 1", "Persona 2"]'
);
insert into settings (id, people) values (1, '["Persona 1", "Persona 2"]');

alter table entries enable row level security;
alter table goals enable row level security;
alter table settings enable row level security;

create policy "allow all entries" on entries for all using (true) with check (true);
create policy "allow all goals" on goals for all using (true) with check (true);
create policy "allow all settings" on settings for all using (true) with check (true);

-- Habilitar realtime (para que ambos vean cambios en vivo sin refrescar)
alter publication supabase_realtime add table entries;
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table settings;

create table public.ranking (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(nombre) between 1 and 16),
  tiempo real not null check (tiempo between 10 and 3600),
  creado timestamptz not null default now()
);

alter table public.ranking enable row level security;

create policy "Todos pueden ver el ranking"
  on public.ranking for select
  to anon
  using (true);

create policy "Todos pueden guardar su tiempo"
  on public.ranking for insert
  to anon
  with check (true);

grant select, insert on public.ranking to anon;

create index ranking_tiempo_idx on public.ranking (tiempo);

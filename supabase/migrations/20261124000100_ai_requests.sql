-- Yapay zekâ çağrı kaydı: kota, maliyet takibi ve denetim için.
-- İçerik (şikâyet metni, model cevabı) saklanmaz; yalnız ölçümler tutulur.
create table ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  feature text not null,
  engine text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  duration_ms integer not null default 0,
  ok boolean not null,
  error text,
  at timestamptz not null default now()
);
create index ai_requests_user_day on ai_requests (user_id, at desc);
alter table ai_requests enable row level security;
revoke all on ai_requests from anon, authenticated;
grant select on ai_requests to authenticated;
grant all on ai_requests to service_role;
create policy ai_requests_admin on ai_requests for select to authenticated using (my_role() = 'admin');

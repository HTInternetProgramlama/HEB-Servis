-- Customer evaluations may be independent of any vehicle or visit.
alter table visit_evaluations alter column job_id drop not null;
create unique index evaluations_customer_general on visit_evaluations(customer_id) where job_id is null;
create function check_evaluation_customer() returns trigger language plpgsql set search_path = public as $$
begin
  if new.job_id is not null and not exists(select 1 from jobs where id=new.job_id and customer_id=new.customer_id) then
    raise exception 'Evaluation customer does not match job' using errcode='23514';
  end if;
  return new;
end $$;
create trigger evaluation_customer before insert or update on visit_evaluations for each row execute function check_evaluation_customer();

create table stock_items (
  id uuid primary key default gen_random_uuid(), code text not null check(length(code) between 1 and 50),
  name text not null check(length(name) between 2 and 150), unit text not null check(length(unit) between 1 and 30),
  minimum integer not null default 0 check(minimum between 0 and 100000000), active boolean not null default true,
  position integer not null default 0
);
create unique index stock_items_code on stock_items(lower(code));
create table stock_movements (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references stock_items,
  kind text not null check(kind in ('Giriş','Çıkış')), quantity integer not null check(quantity between 1 and 100000000),
  reason text not null check(length(reason) between 3 and 500), job_id uuid references jobs,
  at timestamptz not null default now(), by uuid references profiles, by_name text not null default '',
  position integer not null default 0
);
create index stock_movements_item on stock_movements(item_id);
-- Lock the card before checking the ledger, also for writers outside the app transaction.
create function guard_stock_movement() returns trigger language plpgsql set search_path = public as $$
declare total bigint;
begin
  -- INSERT ... ON CONFLICT updates still run BEFORE INSERT; the update guard
  -- below checks immutable fields without counting an existing row twice.
  if tg_op = 'INSERT' and exists(select 1 from stock_movements where id=new.id) then return new; end if;
  if tg_op <> 'INSERT' then
    if tg_op = 'DELETE' then raise exception 'Stock history cannot be deleted' using errcode='23514'; end if;
    if (to_jsonb(new) - 'position') is distinct from (to_jsonb(old) - 'position') then
      raise exception 'Stock history is immutable; add a compensating movement' using errcode='23514';
    end if;
    return new;
  end if;
  perform id from stock_items where id=new.item_id and active for update;
  if not found then raise exception 'Active stock card required' using errcode='23514'; end if;
  select coalesce(sum(case when kind='Giriş' then quantity else -quantity end),0) into total from stock_movements where item_id=new.item_id;
  total := total + case when new.kind='Giriş' then new.quantity else -new.quantity end;
  if total < 0 or total > 100000000 then raise exception 'Stock balance outside allowed range' using errcode='23514'; end if;
  return new;
end $$;
create trigger stock_balance_guard before insert or update or delete on stock_movements for each row execute function guard_stock_movement();
create function guard_stock_unit() returns trigger language plpgsql set search_path = public as $$
begin
  if new.unit <> old.unit and exists(select 1 from stock_movements where item_id=old.id) then
    raise exception 'Cannot change unit after a movement' using errcode='23514';
  end if;
  return new;
end $$;
create trigger stock_unit_guard before update on stock_items for each row execute function guard_stock_unit();

create table technician_awards (
  id uuid primary key default gen_random_uuid(), technician_id uuid not null references profiles,
  badge text not null check(badge in ('Kalite','Dakiklik','İşbirliği','Ustalık')),
  title text not null check(length(title) between 3 and 100), reason text not null check(length(reason) between 5 and 500),
  reward text not null default '' check(length(reward)<=200), job_id uuid references jobs,
  at timestamptz not null default now(), by uuid references profiles, by_name text not null default '',
  position integer not null default 0
);
create index technician_awards_technician on technician_awards(technician_id);
create function check_award_technician() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists(select 1 from profiles where id=new.technician_id and role='technician') then
    raise exception 'Technician profile required' using errcode='23514';
  end if;
  if new.job_id is not null and not exists(select 1 from jobs where id=new.job_id and technician_id=new.technician_id) then
    raise exception 'Award job must belong to technician' using errcode='23514';
  end if;
  return new;
end $$;
create trigger award_technician before insert or update on technician_awards for each row execute function check_award_technician();

alter table stock_items enable row level security;
alter table stock_movements enable row level security;
alter table technician_awards enable row level security;
revoke all on stock_items,stock_movements,technician_awards from anon,authenticated;
grant select on stock_items,stock_movements,technician_awards to authenticated;
grant all on stock_items,stock_movements,technician_awards to service_role;
create policy stock_items_staff on stock_items for select to authenticated using(is_staff());
create policy stock_movements_staff on stock_movements for select to authenticated using(is_staff());
create policy awards_staff_self on technician_awards for select to authenticated using(is_staff() or (my_role()='technician' and technician_id=auth.uid()));
revoke all on function check_evaluation_customer(),guard_stock_movement(),guard_stock_unit(),check_award_technician() from public;

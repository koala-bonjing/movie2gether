-- Duet initial schema (ARCHITECTURE.md §11)
create table rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table room_members (
  room_code text not null references rooms(code) on delete cascade,
  user_id uuid not null default auth.uid(),
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (room_code, user_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  user_id uuid not null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index on messages (room_code, created_at);

create or replace function is_member(code text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from room_members where room_code = code and user_id = auth.uid());
$$;

create or replace function member_count(code text) returns int
language sql security definer set search_path = public as $$
  select count(*)::int from room_members where room_code = code;
$$;

alter table rooms enable row level security;
alter table room_members enable row level security;
alter table messages enable row level security;

create policy rooms_select  on rooms for select to authenticated using (true);
create policy rooms_insert  on rooms for insert to authenticated with check (created_by = auth.uid());
create policy members_select on room_members for select to authenticated using (is_member(room_code));
create policy members_insert on room_members for insert to authenticated
  with check (user_id = auth.uid() and member_count(room_code) < 2);
create policy messages_select on messages for select to authenticated using (is_member(room_code));
create policy messages_insert on messages for insert to authenticated
  with check (user_id = auth.uid() and is_member(room_code));

-- Mission Forge multi-user collaboration schema.
-- Apply in Supabase SQL Editor. Requires Supabase Auth and pgcrypto.
create extension if not exists pgcrypto;

create table if not exists public.mission_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.mission_team_members (
  team_id uuid not null references public.mission_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('mission_architect','spacecraft_engineer','science_lead','flight_operations')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.mission_designs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.mission_teams(id) on delete cascade,
  design jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.mission_teams(id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('mission_architect','spacecraft_engineer','science_lead','flight_operations')),
  invited_email text not null,
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses between 1 and 20),
  uses integer not null default 0 check (uses >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);


create table if not exists public.mission_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Mission team member',
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname='mission_team_members_profile_fkey') then
    alter table public.mission_team_members add constraint mission_team_members_profile_fkey
      foreign key(user_id) references public.mission_profiles(user_id) on delete cascade;
  end if;
end $$;
insert into public.mission_profiles(user_id,email,display_name)
select id,coalesce(email,''),coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(coalesce(email,''),'@',1))
from auth.users on conflict(user_id) do nothing;

create or replace function public.sync_mission_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.mission_profiles(user_id,email,display_name,updated_at)
  values(new.id,coalesce(new.email,''),coalesce(nullif(new.raw_user_meta_data->>'display_name',''),split_part(coalesce(new.email,''),'@',1)),now())
  on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name,updated_at=now();
  return new;
end; $$;
drop trigger if exists on_auth_user_mission_profile on auth.users;
create trigger on_auth_user_mission_profile after insert or update of email,raw_user_meta_data on auth.users
for each row execute procedure public.sync_mission_profile();

alter table public.mission_teams enable row level security;
alter table public.mission_team_members enable row level security;
alter table public.mission_designs enable row level security;
alter table public.mission_invites enable row level security;
alter table public.mission_profiles enable row level security;

create or replace function public.is_mission_team_member(p_team_id uuid)
returns boolean language sql stable security definer set search_path=public,auth as $$
  select exists(select 1 from public.mission_team_members where team_id=p_team_id and user_id=auth.uid());
$$;
revoke all on function public.is_mission_team_member(uuid) from public;
grant execute on function public.is_mission_team_member(uuid) to authenticated;

create policy "team members can read their teams" on public.mission_teams for select
  using (public.is_mission_team_member(id));
create policy "members can read team membership" on public.mission_team_members for select
  using (public.is_mission_team_member(team_id));
create policy "team members can read teammate profiles" on public.mission_profiles for select
  using (exists (select 1 from public.mission_team_members m where m.user_id=mission_profiles.user_id and public.is_mission_team_member(m.team_id)));
create policy "users can update their own profile" on public.mission_profiles for update
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "members can read mission design" on public.mission_designs for select
  using (public.is_mission_team_member(team_id));
create policy "members can create mission design" on public.mission_designs for insert
  with check (public.is_mission_team_member(team_id));
create policy "members can update mission design" on public.mission_designs for update
  using (public.is_mission_team_member(team_id))
  with check (public.is_mission_team_member(team_id));

create or replace function public.create_mission_team(p_name text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare new_team uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.mission_teams(name,owner_id) values (trim(p_name),auth.uid()) returning id into new_team;
  insert into public.mission_team_members(team_id,user_id,role) values (new_team,auth.uid(),'mission_architect');
  insert into public.mission_designs(team_id,design,updated_by) values (new_team,'{}'::jsonb,auth.uid());
  return new_team;
end; $$;

create or replace function public.create_mission_invite(p_team_id uuid,p_role text,p_email text)
returns text language plpgsql security definer set search_path=public,auth,extensions as $$
declare raw_token text; member_role text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_role not in ('mission_architect','spacecraft_engineer','science_lead','flight_operations') then raise exception 'Invalid role'; end if;
  if p_email is null or position('@' in p_email)=0 then raise exception 'A valid invitee email is required'; end if;
  select role into member_role from public.mission_team_members where team_id=p_team_id and user_id=auth.uid();
  if member_role is null or member_role <> 'mission_architect' then raise exception 'Only the team architect can invite members'; end if;
  raw_token := encode(gen_random_bytes(24),'hex');
  insert into public.mission_invites(team_id,token_hash,role,invited_email,expires_at,created_by)
    values(p_team_id,encode(digest(raw_token,'sha256'),'hex'),p_role,lower(trim(p_email)),now()+interval '7 days',auth.uid());
  return raw_token;
end; $$;

create or replace function public.join_mission_team(p_token text)
returns uuid language plpgsql security definer set search_path=public,auth,extensions as $$
declare invite_row public.mission_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into invite_row from public.mission_invites
    where token_hash=encode(digest(p_token,'sha256'),'hex') and expires_at>now() and uses<max_uses for update;
  if not found then raise exception 'Invite is invalid, expired or already used'; end if;
  if lower(invite_row.invited_email) <> lower(coalesce(auth.jwt()->>'email','')) then raise exception 'This invitation was issued to a different email address'; end if;
  insert into public.mission_team_members(team_id,user_id,role) values(invite_row.team_id,auth.uid(),invite_row.role)
    on conflict(team_id,user_id) do update set role=excluded.role;
  update public.mission_invites set uses=uses+1 where id=invite_row.id;
  return invite_row.team_id;
end; $$;

revoke all on function public.create_mission_team(text) from public;
revoke all on function public.create_mission_invite(uuid,text,text) from public;
revoke all on function public.join_mission_team(text) from public;
grant execute on function public.create_mission_team(text) to authenticated;
grant execute on function public.create_mission_invite(uuid,text,text) to authenticated;
grant execute on function public.join_mission_team(text) to authenticated;
grant select,insert,update on public.mission_designs to authenticated;
grant select on public.mission_teams,public.mission_team_members,public.mission_profiles to authenticated;
grant update on public.mission_profiles to authenticated;

-- Enable Postgres Changes for live mission-design synchronization.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mission_designs') then
    alter publication supabase_realtime add table public.mission_designs;
  end if;
end $$;

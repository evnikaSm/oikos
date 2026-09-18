-- Run once in the Supabase SQL Editor. No service-role key is used by the app.
begin;
create table public.oikos_households (
 id uuid primary key default gen_random_uuid(),
 state jsonb not null,
 revision bigint not null default 1,
 invite_token uuid not null unique default gen_random_uuid()
);
create table public.oikos_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 house_id uuid not null references public.oikos_households(id) on delete cascade
);
create index on public.oikos_memberships(house_id);
alter table public.oikos_households enable row level security;
alter table public.oikos_memberships enable row level security;
create policy own_membership on public.oikos_memberships for select to authenticated using (user_id = auth.uid());
create policy household_read on public.oikos_households for select to authenticated using (
 exists(select 1 from public.oikos_memberships m where m.house_id = id and m.user_id = auth.uid())
);
revoke all on public.oikos_households, public.oikos_memberships from anon, authenticated;
grant select on public.oikos_households, public.oikos_memberships to authenticated;

create function public.oikos_create_house(house_name text, member_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare hid uuid := gen_random_uuid(); uid uuid := auth.uid(); token uuid := gen_random_uuid();
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if length(trim(house_name)) not between 1 and 100 or length(trim(member_name)) not between 1 and 80 then raise exception 'Invalid name'; end if;
 insert into public.oikos_households(id, invite_token, state) values(hid, token, jsonb_build_object(
 'house', jsonb_build_object('id', hid, 'name', trim(house_name), 'currency', 'PLN'),
 'monthlyBudget', jsonb_build_object('monthKey', to_char(current_date,'YYYY-MM'), 'currency','PLN','budgetAmount',0),
 'members', jsonb_build_array(jsonb_build_object('id',uid,'name',trim(member_name),'avatar',upper(left(trim(member_name),1)),
 'includeInCleaning',true,'contributionAmount',0,'contributionStatus','unpaid','contributionPaidAt',null)),
 'shoppingItems','[]'::jsonb,'shoppingTrips','[]'::jsonb,'groceryExpenses','[]'::jsonb,
 'cleaningZones','[]'::jsonb,'cleaningAssignments','[]'::jsonb,'priceMemory','{}'::jsonb));
 insert into public.oikos_memberships values(uid,hid);
 return hid;
end $$;

create function public.oikos_join_house(token uuid, member_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare h public.oikos_households; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if length(trim(member_name)) not between 1 and 80 then raise exception 'Invalid name'; end if;
 select * into h from public.oikos_households where invite_token = token for update;
 if not found then raise exception 'Invalid invitation'; end if;
 if exists(select 1 from public.oikos_memberships where user_id = uid and house_id = h.id) then return h.id; end if;
 insert into public.oikos_memberships values(uid,h.id);
 update public.oikos_households set state=jsonb_set(state,'{members}',state->'members' || jsonb_build_array(jsonb_build_object(
 'id',uid,'name',trim(member_name),'avatar',upper(left(trim(member_name),1)), 'includeInCleaning',true,
 'contributionAmount',0,'contributionStatus','unpaid','contributionPaidAt',null))),revision=revision+1 where id=h.id;
 return h.id;
end $$;

-- Optimistic concurrency: a stale client may never overwrite another device's changes.
create function public.oikos_save_house(house_id uuid, expected_revision bigint, next_state jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare h public.oikos_households; entry jsonb; previous jsonb; updated jsonb := '[]'; uid uuid := auth.uid(); key text;
begin
 select * into h from public.oikos_households where id=house_id for update;
 if not found or not exists(select 1 from public.oikos_memberships m where m.house_id=h.id and m.user_id=uid) then raise exception 'Access denied'; end if;
 if h.revision <> expected_revision then raise exception 'OIKOS_CONFLICT'; end if;
 if next_state is null or jsonb_typeof(next_state) <> 'object' or octet_length(next_state::text)>2000000 then raise exception 'Invalid state'; end if;
 if next_state->'house' is distinct from h.state->'house' then raise exception 'House identity cannot be changed'; end if;
 foreach key in array array['members','shoppingItems','shoppingTrips','groceryExpenses','cleaningZones','cleaningAssignments'] loop
  if jsonb_typeof(next_state->key) is distinct from 'array' then raise exception 'Invalid collection'; end if;
 end loop;
 if jsonb_typeof(next_state->'monthlyBudget') is distinct from 'object' or jsonb_typeof(next_state->'priceMemory') is distinct from 'object' then raise exception 'Invalid settings'; end if;
 if (next_state#>>'{monthlyBudget,budgetAmount}')::numeric < 0 then raise exception 'Invalid budget'; end if;
 -- Membership/identity changes only happen through the invitation/removal functions.
 if (select jsonb_agg(jsonb_build_array(e->'id',e->'name',e->'avatar') order by e->>'id') from jsonb_array_elements(next_state->'members') e)
 is distinct from (select jsonb_agg(jsonb_build_array(e->'id',e->'name',e->'avatar') order by e->>'id') from jsonb_array_elements(h.state->'members') e)
 then raise exception 'Invalid membership change'; end if;
 -- Existing completion evidence is immutable. First completion uses database time and authenticated identity.
 for previous in select value from jsonb_array_elements(h.state->'cleaningAssignments') loop
  if previous->>'status'='completed' and not exists(select 1 from jsonb_array_elements(next_state->'cleaningAssignments') e where e=previous)
  then raise exception 'Completed duties must be preserved'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(next_state->'cleaningAssignments') loop
  select value into previous from jsonb_array_elements(h.state->'cleaningAssignments') where value->>'id'=entry->>'id';
  if entry->>'status'='completed' and (previous is null or previous->>'status'<>'completed') then
   entry := entry || jsonb_build_object('completedAt',clock_timestamp(),'completedById',uid);
  end if;
  updated := updated || jsonb_build_array(entry);
 end loop;
 next_state := jsonb_set(next_state - 'activeMemberId','{cleaningAssignments}',updated);
 update public.oikos_households set state=next_state,revision=revision+1 where id=h.id;
 return h.revision+1;
end $$;

create function public.oikos_remove_member(target_id uuid, expected_revision bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare h public.oikos_households; target_name text;
begin
 if target_id=auth.uid() then raise exception 'Cannot remove yourself'; end if;
 select h1.* into h from public.oikos_households h1 join public.oikos_memberships m on m.house_id=h1.id where m.user_id=auth.uid() for update of h1;
 if not found then raise exception 'Access denied'; end if;
 if h.revision<>expected_revision then raise exception 'OIKOS_CONFLICT'; end if;
 if not exists(select 1 from public.oikos_memberships m where m.user_id=target_id and m.house_id=h.id) then raise exception 'Member not found'; end if;
 select e->>'name' into target_name from jsonb_array_elements(h.state->'members') e where e->>'id'=target_id::text;
 delete from public.oikos_memberships where user_id=target_id and house_id=h.id;
 -- Keep historical authors and completed duties intact after membership removal.
 h.state := jsonb_set(h.state,'{formerMembers}',coalesce(h.state->'formerMembers','{}') || jsonb_build_object(target_id::text,target_name));
 h.state := jsonb_set(h.state,'{members}',(select coalesce(jsonb_agg(e),'[]') from jsonb_array_elements(h.state->'members') e where e->>'id'<>target_id::text));
 h.state := jsonb_set(h.state,'{cleaningAssignments}',(select coalesce(jsonb_agg(case when e->>'assignedMemberId'=target_id::text and e->>'status'<>'completed' then e || '{"assignedMemberId":null,"assignedMemberName":"Nieprzypisane"}'::jsonb else e end),'[]') from jsonb_array_elements(h.state->'cleaningAssignments') e));
 update public.oikos_households set state=h.state,revision=revision+1,invite_token=gen_random_uuid() where id=h.id;
end $$;

revoke all on function public.oikos_create_house(text,text), public.oikos_join_house(uuid,text), public.oikos_save_house(uuid,bigint,jsonb), public.oikos_remove_member(uuid,bigint) from public, anon;
grant execute on function public.oikos_create_house(text,text), public.oikos_join_house(uuid,text), public.oikos_save_house(uuid,bigint,jsonb), public.oikos_remove_member(uuid,bigint) to authenticated;
commit;

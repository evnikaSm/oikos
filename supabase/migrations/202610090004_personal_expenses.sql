-- Protect expense ownership while allowing members to remove their own expenses.
-- Includes the preceding cleaning and contribution save-function fixes.
begin;
create or replace function public.oikos_save_house(house_id uuid, expected_revision bigint, next_state jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare h public.oikos_households; entry jsonb; previous jsonb; updated jsonb := '[]'; uid uuid := auth.uid(); key text; current_week text := to_char(clock_timestamp() at time zone 'Europe/Warsaw', 'IYYY-"W"IW');
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
-- Only the authenticated member may edit their contribution, confirmation or timestamp.
-- Do not trust next_state.activeMemberId: clients can forge it.
for entry in select value from jsonb_array_elements(next_state->'members') loop
select value into previous from jsonb_array_elements(h.state->'members') where value->>'id'=entry->>'id';
if entry->>'id' is distinct from uid::text and (
entry->'contributionAmount' is distinct from previous->'contributionAmount' or
entry->'contributionStatus' is distinct from previous->'contributionStatus' or
entry->'contributionPaidAt' is distinct from previous->'contributionPaidAt'
) then raise exception 'OIKOS_OWN_CONTRIBUTION_ONLY' using errcode = '42501'; end if;
end loop;
-- Expense ownership is taken from saved data and the authenticated identity.
-- Another member cannot delete, rewrite or claim an existing expense.
for previous in select value from jsonb_array_elements(h.state->'groceryExpenses') loop
 if previous->>'purchaserId' is distinct from uid::text
    and not exists(select 1 from jsonb_array_elements(next_state->'groceryExpenses') e where e=previous)
 then raise exception 'OIKOS_OWN_EXPENSE_ONLY' using errcode = '42501'; end if;
end loop;
if exists(select 1 from jsonb_array_elements(next_state->'groceryExpenses') e
          group by e->>'id' having count(*) > 1)
then raise exception 'Duplicate expense'; end if;
for entry in select value from jsonb_array_elements(next_state->'groceryExpenses') loop
 select value into previous from jsonb_array_elements(h.state->'groceryExpenses') where value->>'id'=entry->>'id';
 if (previous is null and entry->>'purchaserId' is distinct from uid::text)
    or (previous is not null and entry->'purchaserId' is distinct from previous->'purchaserId')
 then raise exception 'OIKOS_OWN_EXPENSE_ONLY' using errcode = '42501'; end if;
 -- Validate new/changed amounts without blocking unrelated edits to legacy records.
 if previous is null or entry->'amount' is distinct from previous->'amount' then
  if jsonb_typeof(entry->'amount') is distinct from 'number' then raise exception 'Invalid expense amount'; end if;
  if (entry->>'amount')::numeric <= 0 or (entry->>'amount')::numeric <> round((entry->>'amount')::numeric, 2)
     or (entry->>'amount')::numeric * 100 > 9007199254740991
  then raise exception 'Invalid expense amount'; end if;
 end if;
end loop;
-- Shared automatic planning may change only the assignee and current zone name.
-- Explicit replanning may release manual assignments by setting manualOverride to false.
-- Keep IDs, slots, history and completion evidence protected; direct manual edits remain owner-only.
for previous in select value from jsonb_array_elements(h.state->'cleaningAssignments') loop
 if previous->>'status' <> 'completed' and previous->>'assignedMemberId' is not null
    and previous->>'assignedMemberId' is distinct from uid::text
    and not (previous->>'status' = 'pending' and previous->>'weekKey' >= current_week
      and not exists(select 1 from jsonb_array_elements(next_state->'cleaningZones') z where z->>'id'=previous->>'zoneId'))
    and not (previous->>'status' = 'pending' and previous->>'weekKey' >= current_week
      and exists(select 1 from jsonb_array_elements(next_state->'cleaningAssignments') e
        where e - array['assignedMemberId','assignedMemberName','zoneName','manualOverride']
            = previous - array['assignedMemberId','assignedMemberName','zoneName','manualOverride']
          and e->'manualOverride' = 'false'::jsonb
          and exists(select 1 from jsonb_array_elements(next_state->'cleaningZones') z
            where z->>'id'=e->>'zoneId' and z->'name'=e->'zoneName')
          and (exists(select 1 from jsonb_array_elements(next_state->'members') m
            where m->>'id'=e->>'assignedMemberId' and m->'includeInCleaning'='true'::jsonb
              and m->'name'=e->'assignedMemberName')
            or (e->'assignedMemberId'='null'::jsonb and not exists(
              select 1 from jsonb_array_elements(next_state->'members') m where m->'includeInCleaning'='true'::jsonb)))))
    and not exists(select 1 from jsonb_array_elements(next_state->'cleaningAssignments') e where e=previous)
 then raise exception 'OIKOS_OWN_CLEANING_ONLY' using errcode = '42501'; end if;
end loop;
-- A new ID cannot duplicate another person's week/zone slot or completion evidence.
if exists(select 1 from jsonb_array_elements(next_state->'cleaningAssignments') e
          group by e->>'id' having count(*) > 1)
   or exists(select 1 from jsonb_array_elements(next_state->'cleaningAssignments') e
             group by e->>'weekKey', e->>'zoneId' having count(*) > 1)
then raise exception 'Duplicate cleaning duty'; end if;
-- Completed duties may only be reopened by the member who confirmed them.
-- Reopening clears completion evidence and cannot change any other duty fields.
for previous in select value from jsonb_array_elements(h.state->'cleaningAssignments') loop
if previous->>'status'='completed' and not exists(select 1 from jsonb_array_elements(next_state->'cleaningAssignments') e where e=previous)
then
 if previous->>'completedById' is distinct from uid::text then
  raise exception 'OIKOS_OWN_CLEANING_ONLY' using errcode = '42501';
 end if;
 if not exists(select 1 from jsonb_array_elements(next_state->'cleaningAssignments') e
   where e = (previous || jsonb_build_object('status','pending','completedAt',null,'completedById',null)))
 then raise exception 'Completed duties must be preserved'; end if;
end if;
end loop;
for entry in select value from jsonb_array_elements(next_state->'cleaningAssignments') loop
select value into previous from jsonb_array_elements(h.state->'cleaningAssignments') where value->>'id'=entry->>'id';
if entry->>'status'='completed' and (previous is null or previous->>'status'<>'completed') then
if previous is null or previous->>'assignedMemberId' is distinct from uid::text
   or entry->>'assignedMemberId' is distinct from uid::text
then raise exception 'OIKOS_OWN_CLEANING_ONLY' using errcode = '42501'; end if;
entry := entry || jsonb_build_object('completedAt',clock_timestamp(),'completedById',uid);
end if;
updated := updated || jsonb_build_array(entry);
end loop;
next_state := jsonb_set(next_state - 'activeMemberId','{cleaningAssignments}',updated);
-- Retiring a shared zone cancels its unfinished current/future duties for everyone.
-- Normalize on the server as well, including zones deleted by older app versions.
next_state := jsonb_set(next_state, '{cleaningAssignments}', (
 select coalesce(jsonb_agg(e order by position), '[]'::jsonb)
 from jsonb_array_elements(next_state->'cleaningAssignments') with ordinality as assignments(e, position)
 where not (e->>'status' = 'pending' and e->>'weekKey' >= current_week
   and not exists(select 1 from jsonb_array_elements(next_state->'cleaningZones') z where z->>'id'=e->>'zoneId'))
));
update public.oikos_households set state=next_state,revision=revision+1 where id=h.id;
return h.revision+1;
end $$;

revoke all on function public.oikos_save_house(uuid,bigint,jsonb) from public, anon;
grant execute on function public.oikos_save_house(uuid,bigint,jsonb) to authenticated;
commit;

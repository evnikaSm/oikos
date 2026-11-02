-- Reset only the remaining balance; keep contributions, budget and expenses.
begin;
create or replace function public.oikos_reset_remaining(house_id uuid, expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare h public.oikos_households; uid uuid := auth.uid(); budget jsonb; balance numeric;
begin
select * into h from public.oikos_households where id=house_id for update;
if not found or not exists(select 1 from public.oikos_memberships m where m.house_id=h.id and m.user_id=uid)
then raise exception 'Access denied'; end if;
if h.revision <> expected_revision then raise exception 'OIKOS_CONFLICT'; end if;
budget := h.state->'monthlyBudget';
select coalesce(sum((e->>'contributionAmount')::numeric),0) into balance
from jsonb_array_elements(h.state->'members') e;
balance := (
 select coalesce(sum((e->>'amount')::numeric),0)
 from jsonb_array_elements(h.state->'groceryExpenses') e
 where not (coalesce(budget->'previousExpenseIds','[]'::jsonb) ? (e->>'id'))
) - balance;
budget := budget || jsonb_build_object('carryOver',round(balance,2));
update public.oikos_households set state=jsonb_set(h.state,'{monthlyBudget}',budget),revision=revision+1 where id=h.id;
return h.revision+1;
end $$;
revoke all on function public.oikos_reset_remaining(uuid,bigint) from public, anon;
grant execute on function public.oikos_reset_remaining(uuid,bigint) to authenticated;
commit;

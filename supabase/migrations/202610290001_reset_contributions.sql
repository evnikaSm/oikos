-- A household member may explicitly reset everyone's contributions, without
-- granting general permission to edit another member's contribution.
begin;
create or replace function public.oikos_reset_contributions(house_id uuid, expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare h public.oikos_households; uid uuid := auth.uid(); members jsonb;
begin
select * into h from public.oikos_households where id=house_id for update;
if not found or not exists(select 1 from public.oikos_memberships m where m.house_id=h.id and m.user_id=uid)
then raise exception 'Access denied'; end if;
if h.revision <> expected_revision then raise exception 'OIKOS_CONFLICT'; end if;
select coalesce(jsonb_agg(entry || jsonb_build_object(
 'contributionAmount',0,'contributionStatus','unpaid','contributionPaidAt',null
) order by position), '[]'::jsonb) into members
from jsonb_array_elements(h.state->'members') with ordinality as entries(entry, position);
update public.oikos_households set state=jsonb_set(h.state,'{members}',members),revision=revision+1 where id=h.id;
return h.revision+1;
end $$;
revoke all on function public.oikos_reset_contributions(uuid,bigint) from public, anon;
grant execute on function public.oikos_reset_contributions(uuid,bigint) to authenticated;
commit;

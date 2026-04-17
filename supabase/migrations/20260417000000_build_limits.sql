create or replace function public.enforce_build_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_build_count int;
  public_build_count int;
begin
  if TG_OP = 'INSERT' then
    select count(*) into saved_build_count
    from public.builds
    where owner_id = new.owner_id;

    if saved_build_count >= 50 then
      raise exception 'You can save up to 50 builds. Delete an older build before saving another.';
    end if;
  end if;

  if new.visibility = 'public' then
    select count(*) into public_build_count
    from public.builds
    where owner_id = new.owner_id
      and visibility = 'public'
      and (TG_OP = 'INSERT' or id <> new.id);

    if public_build_count >= 20 then
      raise exception 'You can publish up to 20 builds. Unpublish another build before publishing this one.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists builds_enforce_build_limits on public.builds;
create trigger builds_enforce_build_limits
before insert or update of owner_id, visibility on public.builds
for each row execute function public.enforce_build_limits();

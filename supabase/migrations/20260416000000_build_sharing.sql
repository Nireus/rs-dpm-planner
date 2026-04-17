create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  youtube_url text null,
  twitch_url text null,
  x_url text null,
  discord_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.builds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  config jsonb not null,
  schema_version int not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  style_tags text[] not null default '{}',
  include_profile_socials boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null
);

create table if not exists public.build_votes (
  build_id uuid not null references public.builds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);

alter table public.profiles add column if not exists youtube_url text null;
alter table public.profiles add column if not exists twitch_url text null;
alter table public.profiles add column if not exists x_url text null;
alter table public.profiles add column if not exists discord_url text null;
alter table public.builds add column if not exists include_profile_socials boolean not null default false;

create index if not exists builds_owner_updated_idx on public.builds(owner_id, updated_at desc);
create index if not exists builds_public_published_idx on public.builds(visibility, published_at desc);
create index if not exists builds_style_tags_idx on public.builds using gin(style_tags);
create index if not exists build_votes_build_idx on public.build_votes(build_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists builds_touch_updated_at on public.builds;
create trigger builds_touch_updated_at
before update on public.builds
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preferred_name text;
begin
  preferred_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(new.email, '@', 1), ''),
    'RuneScape Planner'
  );

  insert into public.profiles (id, display_name)
  values (new.id, preferred_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user on auth.users;
create trigger create_profile_for_new_user
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.builds enable row level security;
alter table public.build_votes enable row level security;

drop policy if exists "Profiles are public for display names" on public.profiles;
create policy "Profiles are public for display names"
on public.profiles for select
using (true);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Public builds and own builds are readable" on public.builds;
create policy "Public builds and own builds are readable"
on public.builds for select
using (visibility = 'public' or owner_id = auth.uid());

drop policy if exists "Users can insert own builds" on public.builds;
create policy "Users can insert own builds"
on public.builds for insert
with check (owner_id = auth.uid());

drop policy if exists "Users can update own builds" on public.builds;
create policy "Users can update own builds"
on public.builds for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Users can delete own builds" on public.builds;
create policy "Users can delete own builds"
on public.builds for delete
using (owner_id = auth.uid());

drop policy if exists "Users can read votes on public builds" on public.build_votes;
create policy "Users can read votes on public builds"
on public.build_votes for select
using (
  exists (
    select 1
    from public.builds
    where builds.id = build_votes.build_id
      and builds.visibility = 'public'
  )
);

drop policy if exists "Users can vote on public builds" on public.build_votes;
create policy "Users can vote on public builds"
on public.build_votes for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.builds
    where builds.id = build_votes.build_id
      and builds.visibility = 'public'
  )
);

drop policy if exists "Users can remove own votes" on public.build_votes;
create policy "Users can remove own votes"
on public.build_votes for delete
using (user_id = auth.uid());

create or replace view public.public_builds_with_stats as
select
  builds.id,
  builds.owner_id,
  profiles.display_name as author_name,
  builds.title,
  builds.description,
  builds.style_tags,
  builds.include_profile_socials,
  case when builds.include_profile_socials then profiles.youtube_url else null end as author_youtube_url,
  case when builds.include_profile_socials then profiles.twitch_url else null end as author_twitch_url,
  case when builds.include_profile_socials then profiles.x_url else null end as author_x_url,
  case when builds.include_profile_socials then profiles.discord_url else null end as author_discord_url,
  builds.created_at,
  builds.updated_at,
  builds.published_at,
  count(build_votes.user_id)::int as like_count,
  coalesce(bool_or(build_votes.user_id = auth.uid()), false) as voted_by_me
from public.builds
join public.profiles on profiles.id = builds.owner_id
left join public.build_votes on build_votes.build_id = builds.id
where builds.visibility = 'public'
group by builds.id, profiles.display_name, profiles.youtube_url, profiles.twitch_url, profiles.x_url, profiles.discord_url;

create or replace function public.toggle_build_vote(target_build_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to vote.';
  end if;

  if not exists (
    select 1 from public.builds
    where id = target_build_id
      and visibility = 'public'
  ) then
    raise exception 'Build is not public.';
  end if;

  if exists (
    select 1 from public.build_votes
    where build_id = target_build_id
      and user_id = current_user_id
  ) then
    delete from public.build_votes
    where build_id = target_build_id
      and user_id = current_user_id;
  else
    insert into public.build_votes (build_id, user_id)
    values (target_build_id, current_user_id);
  end if;
end;
$$;

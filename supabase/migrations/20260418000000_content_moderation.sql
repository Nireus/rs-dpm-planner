create or replace function public.contains_blocked_language(input_value text)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select
      regexp_replace(
        translate(lower(coalesce(input_value, '')), '013457$@!', 'oieastsai'),
        '[^a-z0-9]+',
        ' ',
        'g'
      ) as spaced_value,
      regexp_replace(
        translate(lower(coalesce(input_value, '')), '013457$@!', 'oieastsai'),
        '[^a-z0-9]+',
        '',
        'g'
      ) as compact_value
  )
  select
    spaced_value ~ '(^| )(arsehole|asshole|bastard|bitch|bollocks|bullshit|cock|cocksucker|cunt|dick|dickhead|fuck|fucker|fucking|motherfucker|piss|prick|shit|shitty|slut|twat|wanker)( |$)'
    or spaced_value ~ '(^| )a r s e h o l e( |$)'
    or spaced_value ~ '(^| )a s s h o l e( |$)'
    or spaced_value ~ '(^| )b a s t a r d( |$)'
    or spaced_value ~ '(^| )b i t c h( |$)'
    or spaced_value ~ '(^| )b o l l o c k s( |$)'
    or spaced_value ~ '(^| )b u l l s h i t( |$)'
    or spaced_value ~ '(^| )c o c k( |$)'
    or spaced_value ~ '(^| )c o c k s u c k e r( |$)'
    or spaced_value ~ '(^| )c u n t( |$)'
    or spaced_value ~ '(^| )d i c k( |$)'
    or spaced_value ~ '(^| )d i c k h e a d( |$)'
    or spaced_value ~ '(^| )f u c k( |$)'
    or spaced_value ~ '(^| )f u c k e r( |$)'
    or spaced_value ~ '(^| )f u c k i n g( |$)'
    or spaced_value ~ '(^| )m o t h e r f u c k e r( |$)'
    or spaced_value ~ '(^| )p i s s( |$)'
    or spaced_value ~ '(^| )p r i c k( |$)'
    or spaced_value ~ '(^| )s h i t( |$)'
    or spaced_value ~ '(^| )s h i t t y( |$)'
    or spaced_value ~ '(^| )s l u t( |$)'
    or spaced_value ~ '(^| )t w a t( |$)'
    or spaced_value ~ '(^| )w a n k e r( |$)'
    or compact_value in (
      'arsehole',
      'asshole',
      'bastard',
      'bitch',
      'bollocks',
      'bullshit',
      'cock',
      'cocksucker',
      'cunt',
      'dick',
      'dickhead',
      'fuck',
      'fucker',
      'fucking',
      'motherfucker',
      'piss',
      'prick',
      'shit',
      'shitty',
      'slut',
      'twat',
      'wanker'
    )
  from normalized;
$$;

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

  if public.contains_blocked_language(preferred_name) then
    preferred_name := 'RuneScape Planner';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, preferred_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

alter table public.profiles
drop constraint if exists profiles_display_name_no_blocked_language;

alter table public.profiles
add constraint profiles_display_name_no_blocked_language
check (not public.contains_blocked_language(display_name))
not valid;

alter table public.builds
drop constraint if exists builds_public_title_no_blocked_language;

alter table public.builds
add constraint builds_public_title_no_blocked_language
check (visibility <> 'public' or not public.contains_blocked_language(title))
not valid;

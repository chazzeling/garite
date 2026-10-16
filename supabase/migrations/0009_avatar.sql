-- 캐릭터 꾸미기: 머리·옷·악세서리 아이템 카탈로그 + 아바타 문자열 검증.
-- avatar_id 형식: v1.{피부0-5}.{머리id}.{머리색0-11}.{옷id}.{옷색0-11}.{악세서리id|none}  (또는 예전 값 'default')
--   * 각 아이템은 카탈로그에 있고 해당 카테고리여야 한다.
--   * 가격이 있는 아이템은 unlock_item으로 해금한 사용자만 쓸 수 있다 (무료 아이템은 해금 불필요).
-- 아이템 목록의 원본은 src/config/items.json (scripts/check-catalog.mjs 로 일치 확인).
-- 이 파일은 다시 실행해도 안전하다.

insert into public.item_catalog (item_id, category, unlock_level, cost) values
  ('hair-short',      'hair',      1, 0),
  ('hair-long',       'hair',      1, 0),
  ('hair-bob',        'hair',      2, 60),
  ('hair-twin',       'hair',      3, 120),
  ('hair-bun',        'hair',      4, 150),
  ('outfit-tee',      'outfit',    1, 0),
  ('outfit-hoodie',   'outfit',    2, 80),
  ('outfit-overalls', 'outfit',    3, 150),
  ('outfit-dress',    'outfit',    4, 200),
  ('acc-glasses',     'accessory', 2, 40),
  ('acc-ribbon',      'accessory', 2, 60),
  ('acc-hat',         'accessory', 3, 90),
  ('acc-headphones',  'accessory', 4, 180)
on conflict (item_id) do nothing;

create or replace function public.check_avatar_item(p_user uuid, p_item text, p_category text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cost int;
begin
  select cost into v_cost from public.item_catalog where item_id = p_item and category = p_category;
  if not found then raise exception 'AVATAR_INVALID'; end if;
  if v_cost > 0 and not exists (select 1 from public.unlocks where user_id = p_user and item_id = p_item) then
    raise exception 'AVATAR_ITEM_LOCKED';
  end if;
end $$;

create or replace function public.validate_avatar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p text[];
begin
  if new.avatar_id = 'default' then return new; end if;
  p := string_to_array(new.avatar_id, '.');
  if array_length(p, 1) is distinct from 7 or p[1] <> 'v1' then raise exception 'AVATAR_INVALID'; end if;
  if p[2] !~ '^[0-5]$' or p[4] !~ '^([0-9]|1[01])$' or p[6] !~ '^([0-9]|1[01])$' then
    raise exception 'AVATAR_INVALID';
  end if;
  perform public.check_avatar_item(new.id, p[3], 'hair');
  perform public.check_avatar_item(new.id, p[5], 'outfit');
  if p[7] <> 'none' then perform public.check_avatar_item(new.id, p[7], 'accessory'); end if;
  return new;
end $$;

drop trigger if exists profiles_avatar_trg on public.profiles;
create trigger profiles_avatar_trg before insert or update of avatar_id on public.profiles
  for each row execute function public.validate_avatar();

revoke execute on function public.check_avatar_item(uuid, text, text), public.validate_avatar()
  from public, anon, authenticated;

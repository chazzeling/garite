-- 마일스톤 2: 프로필 · 방 · 멤버 · 채팅 · Realtime 권한
-- 원칙: 클라이언트는 최소한만 직접 쓰고, 권한이 필요한 동작은 전부 RPC(security definer).

-- ─────────────────────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 12),
  avatar_id  text not null default 'default',
  created_at timestamptz not null default now()
);

create table public.rooms (
  owner_id   uuid primary key references public.profiles (id) on delete cascade,
  code       text not null unique check (code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  is_open    boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 남의 방에 들어간 기록만 남는다. 자기 방에 있을 때는 행이 없다.
create table public.room_members (
  id             bigint generated always as identity primary key,
  room_owner_id  uuid not null references public.rooms (owner_id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  is_active      boolean not null default true
);
-- 사용자당 활성 행은 최대 1개
create unique index room_members_one_active on public.room_members (user_id) where is_active;
create index room_members_room_active on public.room_members (room_owner_id) where is_active;

create table public.messages (
  id             bigint generated always as identity primary key,
  room_owner_id  uuid not null references public.rooms (owner_id) on delete cascade,
  user_id        uuid references public.profiles (id) on delete set null,
  kind           text not null check (kind in ('chat', 'system')),
  body           text not null check (char_length(body) between 1 and 200),
  created_at     timestamptz not null default now()
);
create index messages_room_id on public.messages (room_owner_id, id desc);
create index messages_user_chat on public.messages (user_id, created_at desc) where kind = 'chat';

-- ─────────────────────────────────────────────────────────────
-- 헬퍼 함수
-- ─────────────────────────────────────────────────────────────
-- 헷갈리는 글자(0/O, 1/I/L) 제외 31자. 코드는 비밀번호가 아니라 입장 편의 수단.
create or replace function public.generate_room_code()
returns text language plpgsql volatile as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(alphabet, 1 + floor(random() * 31)::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = result);
  end loop;
  return result;
end $$;

-- 내 방이거나, 그 방의 활성 멤버인가
create or replace function public.is_room_member(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner is not null and (
    p_owner = auth.uid()
    or exists (
      select 1 from public.room_members m
      where m.room_owner_id = p_owner and m.user_id = auth.uid() and m.is_active
    )
  );
$$;

-- 같은 방에 있는 사람인가 (프로필 읽기용)
create or replace function public.shares_room(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_other = auth.uid()
  or exists (
    select 1 from public.room_members m
    where m.is_active and (
      -- 상대가 내가 속한 방의 멤버
      (m.user_id = p_other and (
        m.room_owner_id = auth.uid()
        or exists (
          select 1 from public.room_members me
          where me.is_active and me.user_id = auth.uid() and me.room_owner_id = m.room_owner_id
        )))
      -- 상대가 내가 들어간 방의 방장
      or (m.user_id = auth.uid() and m.room_owner_id = p_other)
    )
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 채팅 트리거: 쿨다운 2초, 방별 최근 200개 유지
-- (RLS 때문에 다른 방에서 보낸 메시지가 안 보이면 쿨다운이 우회되므로 security definer)
-- ─────────────────────────────────────────────────────────────
create or replace function public.messages_cooldown()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
begin
  if new.kind = 'chat' then
    select max(created_at) into v_last
    from public.messages where user_id = new.user_id and kind = 'chat';
    if v_last is not null and new.created_at - v_last < interval '2 seconds' then
      raise exception 'CHAT_COOLDOWN';
    end if;
  end if;
  return new;
end $$;

create trigger messages_cooldown_trg before insert on public.messages
  for each row execute function public.messages_cooldown();

create or replace function public.messages_trim()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.messages
  where room_owner_id = new.room_owner_id
    and id <= (
      select id from public.messages
      where room_owner_id = new.room_owner_id
      order by id desc offset 200 limit 1
    );
  return null;
end $$;

create trigger messages_trim_trg after insert on public.messages
  for each row execute function public.messages_trim();

-- ─────────────────────────────────────────────────────────────
-- RPC
-- ─────────────────────────────────────────────────────────────
-- 내 방을 보장한다 (프로필이 있어야 함). 없으면 코드와 함께 만든다.
create or replace function public.ensure_my_room()
returns table (room_code text, room_is_open boolean)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'PROFILE_REQUIRED';
  end if;
  insert into public.rooms (owner_id, code)
  values (auth.uid(), public.generate_room_code())
  on conflict (owner_id) do nothing;
  return query select r.code, r.is_open from public.rooms r where r.owner_id = auth.uid();
end $$;

create or replace function public.regenerate_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.rooms set code = public.generate_room_code()
  where owner_id = auth.uid()
  returning code into v_code;
  if v_code is null then raise exception 'ROOM_NOT_FOUND'; end if;
  return v_code;
end $$;

create or replace function public.leave_room()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.room_members set is_active = false, left_at = now()
  where user_id = auth.uid() and is_active;
end $$;

-- 코드로 입장. 성공하면 방장의 user id를 돌려준다. 정원: 방장 포함 6인 (방장 + 멤버 5).
create or replace function public.join_room(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Za-z]', '', 'g'));
  v_room  public.rooms%rowtype;
  v_count int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'PROFILE_REQUIRED';
  end if;

  select * into v_room from public.rooms where code = v_code;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- 내 방 코드를 입력하면 그냥 내 방으로
  if v_room.owner_id = v_uid then
    perform public.leave_room();
    return v_uid;
  end if;

  if not v_room.is_open then raise exception 'ROOM_CLOSED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_room.owner_id::text, 0));

  if exists (
    select 1 from public.room_members
    where room_owner_id = v_room.owner_id and user_id = v_uid and is_active
  ) then
    return v_room.owner_id;
  end if;

  select count(*) into v_count
  from public.room_members where room_owner_id = v_room.owner_id and is_active;
  if v_count >= 5 then raise exception 'ROOM_FULL'; end if;

  update public.room_members set is_active = false, left_at = now()
  where user_id = v_uid and is_active;

  insert into public.room_members (room_owner_id, user_id) values (v_room.owner_id, v_uid);
  return v_room.owner_id;
end $$;

-- 지금 내가 있는 방(남의 방에 들어가 있으면 그 방장, 아니면 나)
create or replace function public.get_my_room()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select room_owner_id from public.room_members where user_id = auth.uid() and is_active),
    auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 권한 / RLS
-- ─────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;

-- profiles: 같은 방 멤버 + 본인 읽기, 본인만 만들기·수정
create policy profiles_select on public.profiles for select to authenticated
  using (public.shares_room(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke delete on public.profiles from anon, authenticated;

-- rooms: 본인만 읽기, is_open만 수정 (코드 재발급은 RPC)
create policy rooms_select on public.rooms for select to authenticated
  using (owner_id = auth.uid());
create policy rooms_update on public.rooms for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke insert, update, delete on public.rooms from anon, authenticated;
grant update (is_open) on public.rooms to authenticated;

-- room_members: 읽기만. 쓰기는 RPC만
create policy room_members_select on public.room_members for select to authenticated
  using (public.is_room_member(room_owner_id));
revoke insert, update, delete on public.room_members from anon, authenticated;

-- messages: 멤버만 읽기, chat 종류의 본인 메시지만 insert. system은 RPC/트리거만.
create policy messages_select on public.messages for select to authenticated
  using (public.is_room_member(room_owner_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (kind = 'chat' and user_id = auth.uid() and public.is_room_member(room_owner_id));
revoke insert, update, delete on public.messages from anon, authenticated;
grant insert (room_owner_id, user_id, kind, body) on public.messages to authenticated;

-- anon 롤은 아무것도 못 한다 (익명 로그인 사용자도 authenticated 롤)
revoke all on public.profiles, public.rooms, public.room_members, public.messages from anon;

-- RPC는 로그인한 사용자만 호출
-- (RLS 정책 안에서 호출되는 헬퍼도 authenticated 권한으로 실행되므로 함께 허용)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.ensure_my_room(), public.regenerate_code(), public.leave_room(),
  public.join_room(text), public.get_my_room(),
  public.is_room_member(uuid), public.shares_room(uuid)
  to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Realtime: 비공개 채널 접근 제어
--   room:{ownerId}  방 멤버만 (Presence + 채팅)
--   user:{userId}   본인만   (내 창들끼리 "방이 바뀌었다" 알림)
-- ─────────────────────────────────────────────────────────────
create or replace function public.topic_owner(p_topic text)
returns uuid language sql immutable as $$
  select case
    when p_topic ~ '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then substr(p_topic, 6)::uuid
  end;
$$;

create or replace function public.can_use_topic(p_topic text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_topic like 'room:%' then public.is_room_member(public.topic_owner(p_topic))
    when p_topic like 'user:%' then p_topic = 'user:' || auth.uid()::text
    else false
  end;
$$;

revoke execute on function public.topic_owner(text), public.can_use_topic(text) from public, anon;
grant execute on function public.topic_owner(text), public.can_use_topic(text) to authenticated;

create policy realtime_topic_read on realtime.messages for select to authenticated
  using (public.can_use_topic(realtime.topic()));
create policy realtime_topic_write on realtime.messages for insert to authenticated
  with check (public.can_use_topic(realtime.topic()));

-- 새 채팅 메시지를 postgres_changes로 전달 (RLS가 그대로 적용됨)
alter publication supabase_realtime add table public.messages;

-- ============================================================
--  wedding-photo-share  本番セットアップ（Supabase SQL Editor 用）
--
--  使い方：Supabase ダッシュボード → SQL Editor → New query に
--  このファイル全体を貼り付けて Run してください。
--  12テーブル・インデックス・RLS・Storage・Realtime・RPC と
--  初期イベント（椙村・亘 結婚式 / 2026-11-15）まで一括で作成します。
--  何度実行しても壊れないよう if not exists / or replace で統一しています。
-- ============================================================



-- ---------- supabase/migrations/20261017000001_init.sql ----------

-- ============================================================
--  wedding-photo-share  初期スキーマ
--  要件定義書 全17章 / 基本設計書 DB 12テーブル に対応
--  Supabase（Postgres 15）想定
-- ============================================================

-- gen_random_uuid() は Postgres 13+ の標準機能だが、明示しておく
create extension if not exists "pgcrypto";

-- ---------- 1. events ---------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  join_code text not null unique,
  title text not null,
  couple_names text not null default '',
  venue_name text not null default '',
  ceremony_date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft','open','closed','archived')),
  accept_uploads boolean not null default true,
  post_approval_required boolean not null default false,
  retention_days integer not null default 180 check (retention_days between 1 and 3650),
  keep_originals boolean not null default true,
  welcome_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2. guests ---------------------------------------
-- ログイン不要。端末に保存したランダムトークンで識別する。
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  device_token text not null,
  consent_version text not null,
  consented_at timestamptz not null default now(),
  is_blocked boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, device_token)
);

-- ---------- 3. posts ----------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  nickname_snapshot text not null,
  comment text not null default '' check (char_length(comment) <= 200),
  status text not null default 'pending'
    check (status in ('pending','approved','hidden','deleted')),
  moderation_note text,
  is_visible_in_album boolean not null default false,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 4. post_assets ----------------------------------
create table if not exists public.post_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null default '',
  display_path text not null default '',
  thumb_path text not null default '',
  width integer not null default 0,
  height integer not null default 0,
  bytes bigint not null default 0,
  mime text not null default 'image/jpeg',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 5. monitor_devices ------------------------------
create table if not exists public.monitor_devices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  code text not null unique,
  resolution_w integer not null default 1920,
  resolution_h integer not null default 1080,
  mode text not null default 'idle' check (mode in ('idle','large','background')),
  is_online boolean not null default false,
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- 6. monitor_queue --------------------------------
create table if not exists public.monitor_queue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  monitor_id uuid references public.monitor_devices(id) on delete set null,
  post_id uuid not null references public.posts(id) on delete cascade,
  kind text not null default 'large' check (kind in ('large','background','zoom')),
  state text not null default 'queued' check (state in ('queued','playing','done','skipped')),
  priority integer not null default 1,
  requested_by text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- ---------- 7. monitor_settings -----------------------------
create table if not exists public.monitor_settings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  monitor_id uuid references public.monitor_devices(id) on delete cascade,
  large_seconds integer not null default 5 check (large_seconds between 3 and 30),
  background_seconds integer not null default 8 check (background_seconds between 5 and 60),
  safe_area_percent integer not null default 5 check (safe_area_percent between 0 and 20),
  show_nickname boolean not null default true,
  show_comment boolean not null default true,
  auto_play boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (event_id, monitor_id)
);

-- ---------- 8. albums ---------------------------------------
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_asset_id uuid references public.post_assets(id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private','guest','public')),
  share_token text not null unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 9. album_items ----------------------------------
create table if not exists public.album_items (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  asset_id uuid not null references public.post_assets(id) on delete cascade,
  sort_order integer not null default 0,
  caption text not null default '',
  added_at timestamptz not null default now(),
  unique (album_id, asset_id)
);

-- ---------- 10. admin_users ---------------------------------
-- Supabase Auth のユーザーと 1:1 で対応させる。
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'operator' check (role in ('owner','operator','viewer')),
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- メールアドレスは大文字小文字を区別せず一意にする
-- （citext 拡張に依存するとスキーマ解決で失敗しやすいため lower() で代替）
create unique index if not exists idx_admin_users_email_lower
  on public.admin_users (event_id, lower(email));

-- ---------- 11. audit_logs ----------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  actor_type text not null check (actor_type in ('guest','admin','system')),
  actor_id uuid,
  actor_label text not null default '',
  action text not null,
  target_type text,
  target_id text,
  detail jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ---------- 12. notifications -------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  channel text not null check (channel in ('email','line','webhook')),
  kind text not null,
  payload jsonb,
  state text not null default 'scheduled' check (state in ('scheduled','sent','failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- ============================================================
--  インデックス（基本設計書 15本）
-- ============================================================
create index if not exists idx_events_slug on public.events (slug);
create index if not exists idx_events_status on public.events (status);
create index if not exists idx_guests_event on public.guests (event_id, created_at desc);
create index if not exists idx_guests_token on public.guests (event_id, device_token);
create index if not exists idx_posts_event_posted on public.posts (event_id, posted_at desc);
create index if not exists idx_posts_event_status on public.posts (event_id, status);
create index if not exists idx_posts_guest on public.posts (guest_id, posted_at desc);
create index if not exists idx_posts_album on public.posts (event_id, is_visible_in_album)
  where status = 'approved';
create index if not exists idx_assets_post on public.post_assets (post_id, sort_order);
create index if not exists idx_queue_pending on public.monitor_queue (event_id, state, priority desc, requested_at);
create index if not exists idx_monitors_code on public.monitor_devices (code);
create index if not exists idx_album_items_order on public.album_items (album_id, sort_order);
create index if not exists idx_albums_token on public.albums (share_token);
create index if not exists idx_audit_event_created on public.audit_logs (event_id, created_at desc);
create index if not exists idx_notifications_pending on public.notifications (state, scheduled_at);

-- ============================================================
--  更新日時の自動更新
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['events','posts','albums','monitor_settings'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- 投稿の公開時、アルバム掲載フラグを自動同期する
create or replace function public.sync_album_visibility()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    new.is_visible_in_album = true;
  elsif new.status in ('hidden','deleted') then
    new.is_visible_in_album = false;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_album_visibility on public.posts;
create trigger trg_sync_album_visibility before update on public.posts
for each row execute function public.sync_album_visibility();

-- ============================================================
--  RLS（全テーブル有効化）
-- ============================================================
alter table public.events            enable row level security;
alter table public.guests            enable row level security;
alter table public.posts             enable row level security;
alter table public.post_assets       enable row level security;
alter table public.monitor_devices   enable row level security;
alter table public.monitor_queue     enable row level security;
alter table public.monitor_settings  enable row level security;
alter table public.albums            enable row level security;
alter table public.album_items       enable row level security;
alter table public.admin_users       enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.notifications     enable row level security;

-- 管理者判定ヘルパー
create or replace function public.is_admin(target_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users au
    where au.event_id = target_event
      and au.auth_user_id = auth.uid()
      and au.is_active
  );
$$;

create or replace function public.admin_role(target_event uuid)
returns text language sql stable security definer set search_path = public as $$
  select au.role from public.admin_users au
  where au.event_id = target_event and au.auth_user_id = auth.uid() and au.is_active
  limit 1;
$$;

create or replace function public.can_write(target_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.admin_role(target_event) in ('owner','operator'), false);
$$;

-- ---- events ------------------------------------------------
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select using (status <> 'draft' or public.is_admin(id));

drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events
  for update using (public.admin_role(id) = 'owner');

-- ---- guests ------------------------------------------------
-- ゲストは自分の device_token を持つ行のみ参照できる（投稿履歴の表示に使用）。
drop policy if exists guests_insert on public.guests;
create policy guests_insert on public.guests
  for insert with check (true);

drop policy if exists guests_update_self on public.guests;
create policy guests_update_self on public.guests
  for update using (
    device_token = current_setting('request.headers', true)::json ->> 'x-device-token'
    or public.can_write(event_id)
  );

drop policy if exists guests_admin_read on public.guests;
create policy guests_admin_read on public.guests
  for select using (public.is_admin(event_id));

-- ---- posts -------------------------------------------------
drop policy if exists posts_guest_read_approved on public.posts;
create policy posts_guest_read_approved on public.posts
  for select using (status = 'approved' or public.is_admin(event_id));

drop policy if exists posts_guest_insert on public.posts;
create policy posts_guest_insert on public.posts
  for insert with check (
    exists (select 1 from public.events e where e.id = event_id and e.accept_uploads)
  );

drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts
  for update using (public.can_write(event_id));

drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts
  for delete using (public.admin_role(event_id) = 'owner');

-- ---- post_assets -------------------------------------------
drop policy if exists assets_read on public.post_assets;
create policy assets_read on public.post_assets
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and (p.status = 'approved' or public.is_admin(p.event_id))
    )
  );

drop policy if exists assets_insert on public.post_assets;
create policy assets_insert on public.post_assets
  for insert with check (
    exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists assets_admin_delete on public.post_assets;
create policy assets_admin_delete on public.post_assets
  for delete using (
    exists (select 1 from public.posts p where p.id = post_id and public.can_write(p.event_id))
  );

-- ---- monitor_devices ---------------------------------------
drop policy if exists monitors_read on public.monitor_devices;
create policy monitors_read on public.monitor_devices for select using (true);

drop policy if exists monitors_write on public.monitor_devices;
create policy monitors_write on public.monitor_devices
  for all using (public.can_write(event_id)) with check (public.can_write(event_id));

-- ---- monitor_queue -----------------------------------------
drop policy if exists queue_read on public.monitor_queue;
create policy queue_read on public.monitor_queue for select using (true);

drop policy if exists queue_write on public.monitor_queue;
create policy queue_write on public.monitor_queue
  for all using (public.can_write(event_id)) with check (public.can_write(event_id));

-- ---- monitor_settings --------------------------------------
drop policy if exists settings_read on public.monitor_settings;
create policy settings_read on public.monitor_settings for select using (true);

drop policy if exists settings_write on public.monitor_settings;
create policy settings_write on public.monitor_settings
  for all using (public.can_write(event_id)) with check (public.can_write(event_id));

-- ---- albums / album_items ----------------------------------
drop policy if exists albums_read on public.albums;
create policy albums_read on public.albums
  for select using (visibility <> 'private' or public.is_admin(event_id));

drop policy if exists albums_write on public.albums;
create policy albums_write on public.albums
  for all using (public.can_write(event_id)) with check (public.can_write(event_id));

drop policy if exists album_items_read on public.album_items;
create policy album_items_read on public.album_items
  for select using (
    exists (
      select 1 from public.albums a
      where a.id = album_id and (a.visibility <> 'private' or public.is_admin(a.event_id))
    )
  );

drop policy if exists album_items_write on public.album_items;
create policy album_items_write on public.album_items
  for all using (
    exists (select 1 from public.albums a where a.id = album_id and public.can_write(a.event_id))
  ) with check (
    exists (select 1 from public.albums a where a.id = album_id and public.can_write(a.event_id))
  );

-- ---- admin_users -------------------------------------------
drop policy if exists admin_users_read on public.admin_users;
create policy admin_users_read on public.admin_users
  for select using (public.is_admin(event_id) or auth_user_id = auth.uid());

drop policy if exists admin_users_write on public.admin_users;
create policy admin_users_write on public.admin_users
  for all using (public.admin_role(event_id) = 'owner')
  with check (public.admin_role(event_id) = 'owner');

-- ---- audit_logs --------------------------------------------
-- 追記のみ。ゲストも自分の操作を記録できるが、読み出しは管理者に限る。
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert with check (true);

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs
  for select using (event_id is null or public.is_admin(event_id));

-- ---- notifications -----------------------------------------
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (public.is_admin(event_id));

drop policy if exists notifications_write on public.notifications;
create policy notifications_write on public.notifications
  for all using (public.can_write(event_id)) with check (public.can_write(event_id));

-- ============================================================
--  Realtime 配信（投稿・モニターキュー・モニター状態）
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.monitor_queue;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.monitor_devices;
  exception when duplicate_object then null;
  end;
end $$;

-- ============================================================
--  Storage バケット
--  originals : 原本（非公開・管理者のみ）
--  display   : 表示用（公開。アルバム/モニターが参照）
--  thumbs    : サムネイル（公開）
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('originals', 'originals', false),
  ('display',   'display',   true),
  ('thumbs',    'thumbs',    true)
on conflict (id) do nothing;

drop policy if exists storage_display_read on storage.objects;
create policy storage_display_read on storage.objects
  for select using (bucket_id in ('display','thumbs'));

drop policy if exists storage_upload on storage.objects;
create policy storage_upload on storage.objects
  for insert with check (
    bucket_id in ('originals','display','thumbs')
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.accept_uploads
    )
  );

drop policy if exists storage_admin_manage on storage.objects;
create policy storage_admin_manage on storage.objects
  for delete using (
    bucket_id in ('originals','display','thumbs')
    and public.is_admin(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================
--  保持期間の自動削除（pg_cron を利用する場合）
--  select cron.schedule('wps-purge','0 3 * * *', $$
--    delete from public.posts p
--    using public.events e
--    where p.event_id = e.id
--      and p.posted_at < now() - (e.retention_days || ' days')::interval;
--  $$);
-- ============================================================

-- 初期イベント（必要に応じて書き換えてください）
insert into public.events (slug, join_code, title, couple_names, venue_name, ceremony_date, status)
values (
  'sugimura-watari-2026',
  'WTR26A',
  '椙村・亘 結婚披露宴',
  '椙村 渉 ・ 亘 美咲',
  'ロサンジェルス バルコニー テラスレストラン＆ムーンバー',
  date '2026-11-15',
  'open'
)
on conflict (slug) do nothing;

insert into public.monitor_devices (event_id, name, code, resolution_w, resolution_h, mode)
select id, 'バンケット メインスクリーン', 'MON-A1', 1920, 1080, 'background'
from public.events where slug = 'sugimura-watari-2026'
on conflict (code) do nothing;

insert into public.monitor_settings (event_id)
select id from public.events where slug = 'sugimura-watari-2026'
on conflict do nothing;


-- ---------- supabase/migrations/20261017000002_guest_rpc.sql ----------

-- ============================================================
--  wedding-photo-share  ゲスト／モニター用 RPC
--
--  背景：RLS を有効にしたテーブルでは
--    insert ... returning / upsert ... returning
--  に SELECT 権限も必要になる。ゲストはログインしないため、
--  「自分の投稿を返す」操作が RLS で弾かれてしまう。
--
--  そこで、ゲストとモニターの操作は security definer の関数に
--  集約する。関数内で本人確認（device_token / 端末コード）と
--  受付期間・ブロック状態の検証まで行うので、RLS より厳密になる。
-- ============================================================

-- ------------------------------------------------------------
--  1. ゲスト登録（新規 or 同じ端末の再訪）
-- ------------------------------------------------------------
create or replace function public.register_guest(
  p_event_id uuid,
  p_nickname text,
  p_device_token text,
  p_consent_version text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_guest public.guests;
  v_nick text := left(btrim(coalesce(p_nickname, '')), 20);
begin
  if char_length(v_nick) < 1 then
    raise exception 'nickname_required' using errcode = '22023';
  end if;
  if char_length(coalesce(p_device_token, '')) < 8 then
    raise exception 'invalid_device_token' using errcode = '22023';
  end if;
  if not exists (select 1 from public.events e where e.id = p_event_id) then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  select * into v_guest
  from public.guests
  where event_id = p_event_id and device_token = p_device_token;

  if v_guest.id is null then
    insert into public.guests (event_id, nickname, device_token, consent_version)
    values (p_event_id, v_nick, p_device_token, coalesce(p_consent_version, 'v1'))
    returning * into v_guest;
  else
    update public.guests
       set nickname = v_nick, last_seen_at = now()
     where id = v_guest.id
    returning * into v_guest;
  end if;

  return to_jsonb(v_guest);
end $$;

-- ------------------------------------------------------------
--  2. 端末トークンからゲストを取得（セッション復元）
-- ------------------------------------------------------------
create or replace function public.get_guest(
  p_event_id uuid,
  p_device_token text
) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(g)
  from public.guests g
  where g.event_id = p_event_id
    and g.device_token = p_device_token
  limit 1;
$$;

-- ------------------------------------------------------------
--  3. 投稿の作成（原本・表示用・サムネイルの3パスをまとめて登録）
--     画像本体はクライアントから Storage へ直接送信済み。
-- ------------------------------------------------------------
create or replace function public.create_guest_post(
  p_event_id uuid,
  p_device_token text,
  p_comment text,
  p_assets jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
  v_guest public.guests;
  v_post public.posts;
  v_status text;
begin
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if not v_event.accept_uploads then
    raise exception 'uploads_closed' using errcode = 'P0001';
  end if;

  select * into v_guest
  from public.guests
  where event_id = p_event_id and device_token = p_device_token;
  if v_guest.id is null then
    raise exception 'guest_not_registered' using errcode = 'P0002';
  end if;
  if v_guest.is_blocked then
    raise exception 'guest_blocked' using errcode = 'P0001';
  end if;

  v_status := case when v_event.post_approval_required then 'pending' else 'approved' end;

  insert into public.posts (
    event_id, guest_id, nickname_snapshot, comment, status, is_visible_in_album
  ) values (
    p_event_id,
    v_guest.id,
    v_guest.nickname,
    left(coalesce(p_comment, ''), 200),
    v_status,
    v_status = 'approved'
  )
  returning * into v_post;

  insert into public.post_assets (
    post_id, storage_path, display_path, thumb_path,
    width, height, bytes, mime, sort_order
  )
  select
    v_post.id,
    coalesce(a ->> 'storage_path', ''),
    coalesce(a ->> 'display_path', ''),
    coalesce(a ->> 'thumb_path', ''),
    coalesce((a ->> 'width')::int, 0),
    coalesce((a ->> 'height')::int, 0),
    coalesce((a ->> 'bytes')::bigint, 0),
    coalesce(a ->> 'mime', 'image/jpeg'),
    coalesce((a ->> 'sort_order')::int, 0)
  from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) as a;

  update public.guests set last_seen_at = now() where id = v_guest.id;

  return jsonb_build_object(
    'post', to_jsonb(v_post),
    'assets', coalesce((
      select jsonb_agg(to_jsonb(pa) order by pa.sort_order)
      from public.post_assets pa where pa.post_id = v_post.id
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------------
--  4. 自分の投稿一覧（G-06）
-- ------------------------------------------------------------
create or replace function public.list_guest_posts(
  p_event_id uuid,
  p_device_token text
) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x ->> 'posted_at' desc), '[]'::jsonb)
  from (
    select
      to_jsonb(p) || jsonb_build_object(
        'assets', coalesce((
          select jsonb_agg(to_jsonb(pa) order by pa.sort_order)
          from public.post_assets pa where pa.post_id = p.id
        ), '[]'::jsonb)
      ) as x
    from public.posts p
    join public.guests g on g.id = p.guest_id
    where p.event_id = p_event_id
      and g.device_token = p_device_token
  ) t;
$$;

-- ------------------------------------------------------------
--  5. 削除依頼（ゲスト本人のみ）
-- ------------------------------------------------------------
create or replace function public.request_post_delete(
  p_post_id uuid,
  p_device_token text,
  p_reason text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.posts p
     set status = 'hidden',
         is_visible_in_album = false,
         moderation_note = '削除依頼: ' || left(coalesce(p_reason, '本人の申告'), 120),
         updated_at = now()
   from public.guests g
   where p.id = p_post_id
     and g.id = p.guest_id
     and g.device_token = p_device_token;
  return found;
end $$;

-- ------------------------------------------------------------
--  6. モニターの生存通知
--     端末コードを知っていることだけを根拠にする（会場内の機器）
-- ------------------------------------------------------------
create or replace function public.monitor_heartbeat(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.monitor_devices
     set is_online = true, last_heartbeat_at = now()
   where code = p_code;
  return found;
end $$;

-- ------------------------------------------------------------
--  7. 再生キューの状態更新（モニター端末から）
--     端末コードの一致を検証してから更新する
-- ------------------------------------------------------------
create or replace function public.monitor_update_queue(
  p_code text,
  p_queue_id uuid,
  p_state text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_monitor public.monitor_devices;
begin
  if p_state not in ('queued', 'playing', 'done', 'skipped') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;

  select * into v_monitor from public.monitor_devices where code = p_code;
  if v_monitor.id is null then
    raise exception 'monitor_not_found' using errcode = 'P0002';
  end if;

  update public.monitor_queue q
     set state = p_state,
         started_at = case when p_state = 'playing' then now() else q.started_at end,
         finished_at = case when p_state in ('done', 'skipped') then now() else q.finished_at end
   where q.id = p_queue_id
     and q.event_id = v_monitor.event_id
     and (q.monitor_id is null or q.monitor_id = v_monitor.id);

  return found;
end $$;

-- ============================================================
--  実行権限（ログイン不要のロールに開放する）
-- ============================================================
grant execute on function public.register_guest(uuid, text, text, text) to anon, authenticated;
grant execute on function public.get_guest(uuid, text) to anon, authenticated;
grant execute on function public.create_guest_post(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.list_guest_posts(uuid, text) to anon, authenticated;
grant execute on function public.request_post_delete(uuid, text, text) to anon, authenticated;
grant execute on function public.monitor_heartbeat(text) to anon, authenticated;
grant execute on function public.monitor_update_queue(text, uuid, text) to anon, authenticated;

-- ============================================================
--  Storage：upsert で上書きするため UPDATE も許可する
-- ============================================================
drop policy if exists storage_update on storage.objects;
create policy storage_update on storage.objects
  for update using (
    bucket_id in ('originals', 'display', 'thumbs')
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.accept_uploads
    )
  );

-- ============================================================
--  投稿が「保留」のまま残らないよう、既定の状態を明示する
-- ============================================================
comment on function public.create_guest_post(uuid, text, text, jsonb) is
  'ゲスト投稿の作成。受付停止・ブロック済みゲストを関数内で拒否する。';

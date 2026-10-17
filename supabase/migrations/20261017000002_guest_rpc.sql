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

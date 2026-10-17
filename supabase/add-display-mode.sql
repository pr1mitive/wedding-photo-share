-- ============================================================
--  モニターのライブ表示レイアウト（display_mode）を追加
--  Supabase SQL Editor に貼り付けて実行してください。
-- ============================================================

alter table public.monitor_settings
  add column if not exists display_mode text not null default 'mosaic';

alter table public.monitor_settings
  drop constraint if exists monitor_settings_display_mode_check;

alter table public.monitor_settings
  add constraint monitor_settings_display_mode_check
  check (display_mode in ('slide', 'mosaic'));

-- 確認
select id, event_id, display_mode, large_seconds, background_seconds,
       safe_area_percent, auto_play
  from public.monitor_settings;

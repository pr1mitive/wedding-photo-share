-- ============================================================
--  モニターのライブ表示設定を追加
--  Supabase SQL Editor に貼り付けて実行してください。
-- ============================================================

-- 表示レイアウト：slide（1枚ずつ） / mosaic（写真の壁＋新着を大きく）
alter table public.monitor_settings
  add column if not exists display_mode text not null default 'mosaic';

-- 新着を前景に大きく出す秒数
alter table public.monitor_settings
  add column if not exists featured_seconds integer not null default 12;

-- 写真の壁：タイル1枚の高さ（画面高さに対する %）
alter table public.monitor_settings
  add column if not exists wall_tile_vh integer not null default 30;

-- 写真の壁：流れ1周にかける秒数（大きいほどゆっくり）
alter table public.monitor_settings
  add column if not exists wall_speed_seconds integer not null default 180;

-- 値の範囲を縛る
alter table public.monitor_settings drop constraint if exists monitor_settings_display_mode_check;
alter table public.monitor_settings add constraint monitor_settings_display_mode_check
  check (display_mode in ('slide', 'mosaic'));

alter table public.monitor_settings drop constraint if exists monitor_settings_featured_seconds_check;
alter table public.monitor_settings add constraint monitor_settings_featured_seconds_check
  check (featured_seconds between 3 and 120);

alter table public.monitor_settings drop constraint if exists monitor_settings_wall_tile_vh_check;
alter table public.monitor_settings add constraint monitor_settings_wall_tile_vh_check
  check (wall_tile_vh between 10 and 80);

alter table public.monitor_settings drop constraint if exists monitor_settings_wall_speed_check;
alter table public.monitor_settings add constraint monitor_settings_wall_speed_check
  check (wall_speed_seconds between 30 and 1800);

-- 確認
select id, event_id, display_mode, featured_seconds, wall_tile_vh,
       wall_speed_seconds, large_seconds, background_seconds, safe_area_percent
  from public.monitor_settings;

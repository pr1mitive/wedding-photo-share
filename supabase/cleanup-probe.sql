-- ============================================================
--  動作確認で作成したテストデータの削除（改訂版）
--
--  前版は storage.objects を直接 DELETE していたため
--  「Direct deletion from storage tables is not allowed」で
--  エラーになり、トランザクション全体がロールバックしていました。
--  Storage のオブジェクトは SQL ではなく Storage API でしか
--  削除できない仕様です（事故防止のため）。
--
--  この版は DB の行だけを削除します。
--  Storage のファイル1件は、下の手順でダッシュボードから
--  削除してください。
--
--  【手順】
--   1. この SQL を SQL Editor で Run（DB のテスト行を削除）
--   2. Supabase ダッシュボード → Storage → display バケット
--      → 次のフォルダを開いて 1.jpg を削除
--        f17fe013-5f61-46d4-8bed-8fdb70bba4c5 / __probe__ / 1.jpg
--   3. 下の確認クエリの結果が すべて 0 なら完了
-- ============================================================

-- 1) テスト投稿（post_assets は cascade で同時に削除される）
delete from public.posts
 where nickname_snapshot = '__probe__'
    or comment like '%__probe__%';

-- 2) テストゲスト
delete from public.guests
 where nickname = '__probe__'
    or device_token = 'probe-token-00000001';

-- 3) 監査ログ（テスト操作の記録が残っていれば削除）
delete from public.audit_logs
 where actor_label = '__probe__';

-- 4) 確認：すべて 0 なら完了
select
  (select count(*) from public.posts)        as posts,
  (select count(*) from public.post_assets)  as assets,
  (select count(*) from public.guests)       as guests,
  (select count(*) from public.audit_logs)   as audit,
  (select count(*) from public.monitor_queue) as queue;

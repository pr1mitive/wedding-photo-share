-- ============================================================
--  画像を持たない「空の投稿」を削除
--
--  二重登録の不具合により、投稿1件につき画像なしの投稿が
--  1件余分に作られていました（修正済み）。その残骸を消します。
--
--  post_assets を持たない投稿だけを対象にするので、
--  正常な投稿（画像あり）は一切影響を受けません。
-- ============================================================

delete from public.posts p
 where not exists (
   select 1 from public.post_assets a where a.post_id = p.id
 );

-- 確認：empty_posts が 0、posts が実際に投稿した件数になれば完了
select
  (select count(*) from public.posts) as posts,
  (select count(*) from public.posts p
     where not exists (select 1 from public.post_assets a where a.post_id = p.id)
  ) as empty_posts,
  (select count(*) from public.post_assets) as assets;

-- ============================================================
--  管理者アカウントの紐付け（メールアドレスだけでOK）
--
--  これが未実行だと、Supabase Auth でログインできても
--  管理画面の操作がすべて拒否されます（admin_users が空のため）。
--
--  【手順】
--   1. Supabase → Authentication → Users でアカウントを作成済みか確認
--   2. 下の <メールアドレス> を実際のものに置き換えて Run
--   3. 末尾の確認クエリで role が表示されれば完了
--
--  ※ User UID をコピーする必要はありません。メールで自動照合します。
--  ※ SQL Editor は RLS を迂回する postgres 権限で動くため、
--     ここから最初の owner を作成できます。
-- ============================================================

-- ---- 新郎：owner（すべての操作が可能）--------------------
insert into public.admin_users (event_id, auth_user_id, email, display_name, role)
select e.id, u.id, u.email, '椙村 渉', 'owner'
from public.events e
cross join auth.users u
where e.slug = 'sugimura-watari-2026'
  and lower(u.email) = lower('<メールアドレス>')
on conflict do nothing;

-- ---- プランナー：operator（写真の承認とモニター操作）------
-- 必要な場合だけコメントを外して使う
-- insert into public.admin_users (event_id, auth_user_id, email, display_name, role)
-- select e.id, u.id, u.email, 'プランナー', 'operator'
-- from public.events e
-- cross join auth.users u
-- where e.slug = 'sugimura-watari-2026'
--   and lower(u.email) = lower('<プランナーのメールアドレス>')
-- on conflict do nothing;

-- ---- 確認 --------------------------------------------------
-- role が owner / operator で表示されれば成功。
-- 0件のままなら、メールアドレスの綴りか、
-- Authentication にユーザーが存在するかを確認してください。
select au.display_name, au.email, au.role, au.is_active, e.slug
from public.admin_users au
join public.events e on e.id = au.event_id
order by au.created_at;

-- ---- 参考：Auth に登録済みのユーザー一覧 ------------------
select id, email, email_confirmed_at, created_at
from auth.users
order by created_at desc;

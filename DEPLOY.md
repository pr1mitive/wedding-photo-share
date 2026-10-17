# デプロイ手順（Vercel + Supabase）

対象：`pr1mitive.com` / 椙村・亘 結婚式（2026-11-15）

---

## 0. 前提：すでに完了していること

| 項目 | 状態 |
|---|---|
| Supabase プロジェクト | 作成済み（`ocfoddxgrnkttnbngnfi`） |
| DBスキーマ（12テーブル・RLS・Storage・Realtime・RPC） | **適用済み・検証済み** |
| ドメイン `pr1mitive.com` | 取得済み（Name.com） |
| ドメインのDNS委譲 | **Vercel のネームサーバーに設定済み** |

DNSはすでに `ns1.vercel-dns.com` / `ns2.vercel-dns.com` を向いており、
Aレコードも Vercel の `216.198.79.1` / `216.198.79.65` を指しています。
**したがって、DNSレコードを手作業で追加する必要はありません。**
Vercel の画面でドメインを追加すれば、そのまま検証が通ります。

---

## 1. コードを GitHub に上げる

作業フォルダで実行します。

```bash
cd wps

git init
git add -A
git commit -m "結婚式フォトシェア 初版"

# GitHub で空のリポジトリを作成してから（Private 推奨）
git branch -M main
git remote add origin https://github.com/<あなたのアカウント>/wedding-photo-share.git
git push -u origin main
```

`.gitignore` に `.env.local` が含まれているため、
**Supabase のキーは GitHub に上がりません**（キーは次の手順で Vercel に直接設定します）。

---

## 2. Vercel にインポート

1. https://vercel.com/new を開く
2. **Import Git Repository** から上記リポジトリを選択
3. 設定は自動検出されます（Framework: **Next.js**）。そのままでOK

> リポジトリ直下に `wps/` フォルダがある構成にした場合は、
> **Root Directory を `wps` に設定**してください。
> `cd wps` してから `git init` した場合は、この操作は不要です。

---

## 3. 環境変数を設定（ビルド前に必須）

**Deploy を押す前に** Environment Variables へ3つ追加します。

| Key | Value | 備考 |
|---|---|---|
| `DATA_BACKEND` | `supabase` | これが無いとデモモードで動きます |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ocfoddxgrnkttnbngnfi.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | 公開キー。RLSで保護 |
| `NEXT_PUBLIC_APP_ORIGIN` | `https://pr1mitive.com` | **QRコードのURLになる** |

いずれも **Production / Preview / Development の3つすべて**にチェックを入れてください。

### ⚠️ `NEXT_PUBLIC_` は「ビルド時に埋め込まれる」

`NEXT_PUBLIC_` が付いた変数はビルド成果物に文字列として焼き込まれます。
**後から値を変えても、再デプロイしない限り反映されません。**
特に `NEXT_PUBLIC_APP_ORIGIN` は QRコードのURLに直結するので、
最初から正しい値を入れてください。

---

## 4. デプロイ

**Deploy** を押すと2〜3分で完了します。
完了後、`https://<プロジェクト名>.vercel.app` で動作を確認できます。

確認するURL：

| 画面 | パス |
|---|---|
| ゲスト | `/e/sugimura-watari-2026` |
| モニター | `/monitor/MON-A1` |
| 管理 | `/admin/login` |

---

## 5. ドメインを接続

1. Vercel のプロジェクト → **Settings → Domains**
2. `pr1mitive.com` を入力して **Add**
3. 続けて `www.pr1mitive.com` も追加し、`pr1mitive.com` へリダイレクトさせる

ネームサーバーがすでに Vercel を向いているため、
**数十秒〜数分で「Valid Configuration」になり、HTTPS証明書も自動発行**されます。

DNSレコードを手で足す必要はありません。

---

## 6. Supabase 側のURL設定

**これを忘れると管理画面のログインが失敗します。**

Supabase ダッシュボード → **Authentication → URL Configuration**

| 項目 | 値 |
|---|---|
| Site URL | `https://pr1mitive.com` |
| Redirect URLs | `https://pr1mitive.com/**` と `https://<プロジェクト名>.vercel.app/**` |

---

## 7. 管理者アカウントの作成

1. Supabase → **Authentication → Users → Add user**
   新郎新婦・プランナーのアカウントを作成（メール＋パスワード）
2. 作成時に発行される **User UID** を控える
3. **SQL Editor** で紐付けを実行

```sql
-- 新郎（owner：全操作可）
insert into public.admin_users (event_id, auth_user_id, email, display_name, role)
select e.id, '<新郎のUser UID>', '<新郎のメール>', '椙村 渉', 'owner'
from public.events e where e.slug = 'sugimura-watari-2026';

-- プランナー（operator：写真の承認とモニター操作）
insert into public.admin_users (event_id, auth_user_id, email, display_name, role)
select e.id, '<プランナーのUser UID>', '<プランナーのメール>', 'プランナー', 'operator'
from public.events e where e.slug = 'sugimura-watari-2026';
```

権限は3段階です。

| role | できること |
|---|---|
| `owner` | すべて（設定変更・ゲスト管理・削除・アルバム公開） |
| `operator` | 写真の承認・非表示、モニター操作 |
| `viewer` | 閲覧のみ |

---

## 8. QRコードの発行

1. `https://pr1mitive.com/admin/login` にログイン
2. **イベント設定 / QR** を開く
3. QRコードが自動生成されます（`https://pr1mitive.com/e/sugimura-watari-2026`）
4. **QRを保存** でPNGをダウンロード → 受付用カードに印刷

> QRコードは印刷物に載るため、**ドメイン確定後**に発行してください。
> ドメインを変えると、配ったカードがすべて無効になります。

---

## 9. 当日の起動

| 役割 | URL | 端末 |
|---|---|---|
| モニター | `https://pr1mitive.com/monitor/MON-A1` | 会場PC / プロジェクター |
| 管理 | `https://pr1mitive.com/admin` | 手元のPC・スマホ |
| ゲスト | QRコードから | 各自のスマホ |

モニターは**フルスクリーン表示**（F11 / ⌃⌘F）にしてください。
管理画面の「モニターを別窓で開く」から起動できます。

---

## 10. 費用の目安

| サービス | プラン | 月額 |
|---|---|---|
| Vercel | Hobby（無料） | $0 |
| Supabase | Pro | $25 |
| ドメイン | Name.com | 年1,500円程度 |

**Vercel は Hobby で始めて問題ありません。** この結婚式サイトは非商用の
個人利用にあたり、想定転送量（約50GB／月）は Hobby の上限100GBに
収まります。上限に近づいたら Pro へ切り替えれば即座に枠が広がります。

**Supabase は Pro を推奨します。** 無料枠は**1週間アクセスが無いと
プロジェクトが自動停止**するため、挙式後に閲覧が途切れると
アルバムが見られなくなります。180日間のアルバム公開を考えると
Pro のほうが安全です。

---

## 11. トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| デモデータが出る | `DATA_BACKEND=supabase` が未設定。設定後に**再デプロイ** |
| 写真が表示されない | `NEXT_PUBLIC_SUPABASE_URL` / `PUBLISHABLE_KEY` を確認し再デプロイ |
| 管理画面にログインできない | Supabase の URL Configuration と `admin_users` の紐付けを確認 |
| QRのURLが間違っている | `NEXT_PUBLIC_APP_ORIGIN` を修正し**再デプロイ**（ビルド時に埋め込まれるため） |
| ドメインが繋がらない | Vercel の Settings → Domains で「Valid Configuration」か確認 |
| 投稿できない | Supabase の `events.accept_uploads` が `true` か確認 |

---

## 12. 再デプロイの方法

コードを直した場合：

```bash
git add -A
git commit -m "修正内容"
git push
```

Vercel が自動で再ビルドします（2〜3分）。
環境変数を変えた場合も、**Deployments → 最新の「…」→ Redeploy** で
焼き込み直してください。

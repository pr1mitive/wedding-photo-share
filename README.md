# Wedding Photo Share

結婚式の写真を QR コードから集め、会場モニターに流し、後日アルバムとして共有する Web サービス。

- **要件定義書**：全 17 章 / 機能要件 44 件
- **基本設計書**：画面 25 / API 40 エンドポイント / DB 12 テーブル
- **画面デザイン案**：全 25 画面（`docs/design/` 相当の PNG 一式）

## 対象イベント

| 項目 | 内容 |
|---|---|
| 新郎 | 椙村 渉（すぎむら わたる） |
| 新婦 | 亘 美咲（わたり みさき） |
| 挙式日 | 2026年11月15日 |
| 会場 | ロサンジェルス バルコニー テラスレストラン＆ムーンバー |
| イベント slug | `sugimura-watari-2026` |
| 参加コード | `WTR26A` |
| モニター端末コード | `MON-A1` |
| 写真の保持期間 | 180日（原本保管あり） |
| 投稿の承認制 | なし（投稿後すぐ公開） |

これらの値は次の3か所に反映済みです。

1. `src/lib/repo/demo.ts` の `seed()` … デモモードの初期データ
2. `supabase/migrations/20261017000001_init.sql` の末尾 … 本番の初期投入
3. 管理画面の A-09「イベント設定 / QRコード」… ここからいつでも変更できます

> デモモードの写真・コメント・ゲスト名はプレビュー用のサンプルです。
> 本番構成（`DATA_BACKEND=supabase`）ではサンプルは一切入りません。

## 構成

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 15（App Router） + TypeScript + Tailwind CSS 4 |
| データ | Supabase（Postgres 15 / Auth / Storage / Realtime） |
| ホスティング | Vercel 想定 |

デザイントークンは `src/app/globals.css` の `@theme` に定義しており、
画面デザイン案（S-00）と 1 対 1 で対応しています。

## クイックスタート（デモモード）

Supabase を用意しなくても、ブラウザ内ストレージだけで全 25 画面が動作します。

```bash
npm install
npm run dev
# http://localhost:3000
```

デモモードの入口は `/` です。

| ロール | 入口 | 備考 |
|---|---|---|
| ゲスト | `/e/sugimura-watari-2026` | スマホ想定（390×844） |
| モニター | `/monitor/MON-A1` | 1920×1080。管理画面から送信すると追従します |
| 管理者 | `/admin/login` | パスワード `demo1234` |

デモデータを初期状態に戻すには、ブラウザの開発者ツールで
`localStorage.removeItem('wps.demo.db.v2')` を実行してください。

## 本番構成（Supabase）

```bash
cp .env.example .env.local
# DATA_BACKEND=supabase / NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を設定
```

マイグレーションを適用します。

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # supabase/migrations/20261017000001_init.sql
```

続いて、Supabase ダッシュボードで管理者を登録します。

1. Authentication → Users で新郎新婦・プランナーのアカウントを作成
2. SQL Editor で `admin_users` に紐付けを挿入

```sql
insert into public.admin_users (event_id, auth_user_id, email, display_name, role)
select e.id, '<auth-user-uuid>', 'owner@example.com', '椙村 渉', 'owner'
from public.events e where e.slug = 'sugimura-watari-2026';
```

Storage バケット（`originals` / `display` / `thumbs`）はマイグレーションで自動作成されます。

## 実装済みの画面

### ゲスト（8 + 1 画面）

| ID | パス | 内容 |
|---|---|---|
| G-01 | `/e/[slug]` | 利用同意とニックネーム登録 |
| G-02 | `/e/[slug]/home` | 投稿ホーム |
| G-03 | `/e/[slug]/camera` | カメラ撮影 / 写真選択 |
| G-04 | `/e/[slug]/confirm` | 投稿確認とコメント |
| G-05 | `/e/[slug]/done` | 投稿完了 |
| G-06 | `/e/[slug]/mine` | 自分の投稿（削除依頼） |
| G-07/G-08 | `/e/[slug]/album` | アルバム一覧 / 拡大表示 |
| E-01 | `/e/[slug]/closed` | 受付終了 |

### モニター（4 画面）

`/monitor/[code]` の 1 ルートで `mode` により切り替えます。

| ID | mode | 内容 |
|---|---|---|
| M-01 | `background` | 背景スライドショー |
| M-02 | `large` | 大型表示 |
| M-03 | `large` + `kind=zoom` | 拡大表示 |
| M-04 | `idle` | 待機画面 |

`px` を使わず `vh` / `%` のみで組んであり、上下左右 5% のセーフエリアを確保しています。

### 管理（11 画面）

| ID | パス | 内容 |
|---|---|---|
| A-01 | `/admin/login` | ログイン |
| A-02 | `/admin` | ダッシュボード |
| A-03 | `/admin/photos` | 写真一覧（一括承認・送信・削除） |
| A-04 | `/admin/photos/[id]` | 写真詳細 |
| A-05 | `/admin/monitor` | モニター操作 |
| A-06 | `/admin/monitor/settings` | モニター設定 |
| A-07 | `/admin/albums` | アルバム管理 |
| A-08 | `/admin/albums/[id]` | アルバム編集（並べ替え） |
| A-09 | `/admin/settings` | イベント設定と QR 発行 |
| A-10 | `/admin/guests` | ゲスト管理 |
| A-11 | `/admin/audit` | 監査ログと統計 |

## データアクセス層

`src/lib/repo/` に 2 つの実装があり、`DATA_BACKEND` で切り替わります。
画面側は `Repo` インターフェース（`src/lib/repo/contract.ts`）にのみ依存します。

```
src/lib/repo/
  contract.ts   … 契約（全メソッド定義）
  demo.ts       … ブラウザ内ストレージ実装（レビュー用）
  supabase.ts   … Supabase 実装（RLS に権限制御を委譲）
  index.ts      … getRepo() で自動選択
```

## ディレクトリ

```
src/
  app/
    page.tsx                    デモ入口
    e/[slug]/…                  ゲスト画面
    monitor/[code]/page.tsx     モニター
    admin/…                     管理画面
  components/
    ui.tsx                      共通部品（S-00 の実装）
    guest-shell.tsx             ゲスト用レイアウト
    admin-shell.tsx             管理用レイアウト
    monitor-stage.tsx           モニター描画（M-01〜M-04）
  lib/
    types.ts                    ドメイン型（DB 12 テーブル対応）
    config.ts                   環境変数
    hooks.ts                    共通フック
    session.ts                  ゲスト/管理者セッション
    repo/                       データアクセス層
supabase/migrations/            スキーマ・RLS・Storage・Realtime
```

## 未決事項（実装を進めるうえで確定が必要）

1. **会場ネットワーク**：ゲスト用 Wi-Fi の有無と帯域。50 名同時投稿の可否を左右します
2. **モニター台数・解像度・接続方法**：`monitor_devices` に複数登録できますが、
   実機の解像度が確定しないとセーフエリアの最終調整ができません
3. **投稿の承認制要否**：`events.post_approval_required` で切り替え可能（既定オフ）
4. **写真の保持期間と引き渡し方法**：既定 180 日 / 原本保管オン。
   原本保管はストレージ容量が約 3〜5 倍になります

## スクリプト

```bash
npm run dev        # 開発サーバー（0.0.0.0:3000）
npm run build      # 本番ビルド
npm run typecheck  # 型チェック
npm run db:push    # Supabase マイグレーション適用
```

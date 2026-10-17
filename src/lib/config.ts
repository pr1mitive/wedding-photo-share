/**
 * 実行時設定。
 *
 * 重要：ブラウザ（クライアントコンポーネント）から参照できるのは
 * NEXT_PUBLIC_ が付いた環境変数だけです。Next.js はクライアントの
 * バンドルに NEXT_PUBLIC_ 付きの変数しか埋め込まないため、
 * NEXT_PUBLIC_ の無い DATA_BACKEND はブラウザでは常に undefined に
 * なります。これを既定値にすると、本番環境でもデモモードで動いて
 * しまいます（実際にこの問題が発生しました）。
 *
 * そこで「Supabase の接続情報が入っていれば本番」と自動判定し、
 * 明示的にデモで動かしたい場合だけ NEXT_PUBLIC_DATA_BACKEND=demo を
 * 指定する設計にしています。
 */

export type DataBackend = "demo" | "supabase";

function pick(...values: (string | undefined)[]): string | undefined {
  return values.find((v) => typeof v === "string" && v.length > 0);
}

export const SUPABASE_URL = pick(process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * クライアント用キー。
 * Supabase は anon キーを廃止し、publishable キー（sb_publishable_…）へ
 * 移行した。両方を受け付け、新キーを優先する。
 * どちらも「公開されてよい」キーで、権限制御は RLS が担う。
 */
export const SUPABASE_CLIENT_KEY = pick(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** @deprecated SUPABASE_CLIENT_KEY を使う */
export const SUPABASE_ANON_KEY = SUPABASE_CLIENT_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_CLIENT_KEY);

const explicitBackend = pick(
  process.env.NEXT_PUBLIC_DATA_BACKEND,
  process.env.DATA_BACKEND,
);

/**
 * データ層の選択。
 *   1. NEXT_PUBLIC_DATA_BACKEND=demo が明示されていればデモ
 *   2. Supabase の接続情報が揃っていれば本番
 *   3. どちらでもなければデモ
 */
export const DATA_BACKEND: DataBackend =
  explicitBackend === "demo" ? "demo" : isSupabaseConfigured ? "supabase" : "demo";

/**
 * 設定漏れを画面上で気づけるようにするための診断情報。
 * 値そのものは絶対に含めない（変数名と有無だけ）。
 */
export const CONFIG_DIAGNOSTICS = {
  backend: DATA_BACKEND,
  supabaseUrlPresent: Boolean(SUPABASE_URL),
  supabaseKeyPresent: Boolean(SUPABASE_CLIENT_KEY),
  explicitBackend: explicitBackend ?? null,
  /** 設定すると本番接続になる変数名（値は入れない） */
  requiredVars: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ],
} as const;

export const APP_ORIGIN =
  pick(process.env.NEXT_PUBLIC_APP_ORIGIN) ?? "http://localhost:3000";

export const MAX_UPLOAD_BYTES = Number(
  pick(process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES) ?? 20 * 1024 * 1024,
);

export const MAX_FILES_PER_POST = Number(
  pick(process.env.NEXT_PUBLIC_MAX_FILES_PER_POST) ?? 10,
);

export const CONSENT_VERSION = "2026-10-01";

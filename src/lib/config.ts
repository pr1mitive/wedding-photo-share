/** 実行時設定。クライアントからも参照するため NEXT_PUBLIC_ を優先する。 */

export type DataBackend = "demo" | "supabase";

function pick(...values: (string | undefined)[]): string | undefined {
  return values.find((v) => typeof v === "string" && v.length > 0);
}

export const DATA_BACKEND: DataBackend =
  (pick(process.env.NEXT_PUBLIC_DATA_BACKEND, process.env.DATA_BACKEND) as DataBackend) ??
  "demo";

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

export const APP_ORIGIN =
  pick(process.env.NEXT_PUBLIC_APP_ORIGIN) ?? "http://localhost:3000";

export const MAX_UPLOAD_BYTES = Number(
  pick(process.env.NEXT_PUBLIC_MAX_UPLOAD_BYTES) ?? 20 * 1024 * 1024,
);

export const MAX_FILES_PER_POST = Number(
  pick(process.env.NEXT_PUBLIC_MAX_FILES_PER_POST) ?? 10,
);

export const CONSENT_VERSION = "2026-10-01";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_CLIENT_KEY);

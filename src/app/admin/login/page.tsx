"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Field, Toast, useToast } from "@/components/ui";
import { DATA_BACKEND, isSupabaseConfigured } from "@/lib/config";
import { saveAdminSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/repo/supabase";

/** A-01 管理画面ログイン */
export default function AdminLoginPage() {
  const router = useRouter();
  const { toast, show } = useToast();
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const useSupabase = DATA_BACKEND === "supabase" && isSupabaseConfigured;

  async function submit() {
    setBusy(true);
    try {
      if (useSupabase) {
        const { data, error } = await supabaseBrowser().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(error.message);
        const role =
          (data.user?.user_metadata?.role as string | undefined) ?? "operator";
        saveAdminSession({ email, role });
        router.replace("/admin");
        return;
      }
      // デモモード：パスワードは demo1234 で固定
      if (password !== "demo1234") {
        show("デモモードのパスワードは demo1234 です", "danger");
        setBusy(false);
        return;
      }
      saveAdminSession({ email, role: "owner" });
      router.replace("/admin");
    } catch (e) {
      show(e instanceof Error ? e.message : "ログインに失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-5 py-10">
      <div className="text-center">
        <p className="text-[0.6875rem] font-semibold tracking-[0.22em] text-primary">
          ADMIN CONSOLE
        </p>
        <h1 className="mt-3 font-mincho text-[1.75rem] leading-snug text-wine">
          管理画面にログイン
        </h1>
        <p className="hint mt-2">
          新郎新婦または進行担当者（プランナー）のみが利用できます。
        </p>
      </div>

      <Card className="mt-8 p-6">
        <div className="space-y-4">
          <Field label="メールアドレス" required>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label="パスワード"
            required
            hint={useSupabase ? undefined : "デモモード：demo1234"}
          >
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
          </Field>
        </div>

        <button
          type="button"
          className="btn btn-primary mt-6 w-full"
          onClick={submit}
          disabled={busy}
        >
          {busy ? "確認しています…" : "ログイン"}
        </button>

        <p className="hint mt-4 text-center">
          パスワードを忘れた場合は、イベント作成者に再設定を依頼してください。
        </p>
      </Card>

      <Card className="mt-6 p-4">
        <p className="text-[0.8125rem] font-semibold text-ink">権限について</p>
        <ul className="mt-2 space-y-1 text-[0.8125rem] text-muted">
          <li>・owner：すべての操作（設定変更・ゲスト管理・削除）</li>
          <li>・operator：写真の承認・モニター操作</li>
          <li>・viewer：閲覧のみ</li>
        </ul>
        <p className="hint mt-3">
          現在のデータ層：{useSupabase ? "Supabase（本番）" : "デモ（ブラウザ内）"}
        </p>
      </Card>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </div>
  );
}

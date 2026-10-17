"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, Field, Loading, SectionTitle, Toast, Toggle, useToast } from "@/components/ui";
import { useRepo } from "@/lib/hooks";
import type { EventRow, MonitorSettingsRow } from "@/lib/types";

/** A-06 管理 モニター設定 */
export default function AdminMonitorSettingsPage() {
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [settings, setSettings] = useState<MonitorSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    if (ev) setSettings(await repo.getMonitorSettings(ev.id));
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!settings || !event) return;
    setBusy(true);
    try {
      await repo.updateMonitorSettings(event.id, {
        large_seconds: settings.large_seconds,
        background_seconds: settings.background_seconds,
        safe_area_percent: settings.safe_area_percent,
        show_nickname: settings.show_nickname,
        show_comment: settings.show_comment,
        auto_play: settings.auto_play,
        // display_mode 列がまだ無い環境では送らない（マイグレーション前でも壊れない）
        ...(settings.display_mode ? { display_mode: settings.display_mode } : {}),
      });
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: "monitor_settings.update",
        targetType: "monitor_settings",
        targetId: settings.id,
        detail: {
          large_seconds: settings.large_seconds,
          background_seconds: settings.background_seconds,
          safe_area_percent: settings.safe_area_percent,
        },
      });
      show("設定を保存しました。モニターに反映されます。", "success");
    } catch (e) {
      show(e instanceof Error ? e.message : "保存に失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !settings) return <Loading />;

  return (
    <AdminShell
      event={event}
      title="モニター設定"
      description="表示時間・セーフエリア・表示項目を調整します"
      actions={
        <button
          type="button"
          className="btn btn-primary min-h-[40px] px-4 text-[0.8125rem]"
          onClick={save}
          disabled={busy}
        >
          {busy ? "保存中…" : "変更を保存"}
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="表示時間" description="1枚あたりの表示秒数" />
          <Card className="space-y-5 p-5">
            <Field
              label={`大型表示の表示時間：${settings.large_seconds}秒`}
              hint="要件：5秒を既定とし、3〜15秒の範囲で調整できます"
            >
              <input
                type="range"
                min={3}
                max={15}
                value={settings.large_seconds}
                className="w-full accent-[#9C2B4E]"
                onChange={(e) =>
                  setSettings({ ...settings, large_seconds: Number(e.target.value) })
                }
              />
            </Field>
            <Field
              label={`背景スライドショーの切替：${settings.background_seconds}秒`}
              hint="要件：8秒を既定とし、5〜20秒の範囲で調整できます"
            >
              <input
                type="range"
                min={5}
                max={20}
                value={settings.background_seconds}
                className="w-full accent-[#9C2B4E]"
                onChange={(e) =>
                  setSettings({ ...settings, background_seconds: Number(e.target.value) })
                }
              />
            </Field>
            <Field
              label={`セーフエリア：上下左右 ${settings.safe_area_percent}%`}
              hint="プロジェクターの端が切れる場合に広げてください"
            >
              <input
                type="range"
                min={0}
                max={12}
                value={settings.safe_area_percent}
                className="w-full accent-[#9C2B4E]"
                onChange={(e) =>
                  setSettings({ ...settings, safe_area_percent: Number(e.target.value) })
                }
              />
            </Field>
          </Card>
        </section>

        <section>
          <SectionTitle title="表示項目" description="会場の雰囲気に合わせて調整" />
          <Card className="divide-y divide-line p-5">
            <Field
              label="ライブ表示のレイアウト"
              hint="写真の壁：新着1枚を大きく見せながら、過去の写真が背景で流れ続けます"
            >
              <select
                className="input"
                value={settings.display_mode ?? "mosaic"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    display_mode: e.target.value as MonitorSettingsRow["display_mode"],
                  })
                }
              >
                <option value="mosaic">写真の壁＋新着を大きく（推奨）</option>
                <option value="slide">1枚ずつ切り替え（従来）</option>
              </select>
            </Field>
            <Toggle
              checked={settings.show_nickname}
              label="投稿者名を表示する"
              description="モニターに投稿者のニックネームを出します"
              onChange={(next) => setSettings({ ...settings, show_nickname: next })}
            />
            <Toggle
              checked={settings.show_comment}
              label="コメントを表示する"
              description="投稿に添えられたコメントを表示します"
              onChange={(next) => setSettings({ ...settings, show_comment: next })}
            />
            <Toggle
              checked={settings.auto_play}
              label="自動再生を有効にする"
              description="管理画面から送信しなくても新着を自動で流します"
              onChange={(next) => setSettings({ ...settings, auto_play: next })}
            />
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-ink">投影前の確認</p>
            <ul className="mt-2 space-y-1 text-[0.8125rem] text-muted">
              <li>・会場の解像度とアスペクト比を実際に投影して確認してください。</li>
              <li>・文字サイズは投稿者名4.5vh / コメント3.2vhを基準にしています。</li>
              <li>・端が切れる場合はセーフエリアを5%→8%程度に広げます。</li>
            </ul>
          </Card>
        </section>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

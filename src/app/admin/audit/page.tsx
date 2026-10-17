"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Loading, SectionTitle, Stat, Toast, useToast } from "@/components/ui";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useRepo } from "@/lib/hooks";
import type { AuditLogRow, EventRow, NotificationRow } from "@/lib/types";
import type { StatsSummary } from "@/lib/repo";

const ACTION_LABEL: Record<string, string> = {
  "guest.consent": "ゲスト参加登録",
  "guest.block": "ゲストをブロック",
  "guest.unblock": "ブロック解除",
  "post.create": "投稿",
  "post.approve": "投稿を公開",
  "post.hide": "投稿を非表示",
  "post.delete": "投稿を削除",
  "post.delete_request": "削除依頼（ゲスト）",
  "monitor.enqueue": "モニターへ送信",
  "monitor.mode.large": "大型表示に切替",
  "monitor.mode.background": "背景スライドショーに切替",
  "monitor.mode.idle": "待機画面に切替",
  "monitor_settings.update": "モニター設定を変更",
  "event.update": "イベント設定を変更",
  "album.create": "アルバム作成",
};

/** A-11 管理 監査ログと統計 */
export default function AdminAuditPage() {
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    if (ev) {
      const [l, s, n] = await Promise.all([
        repo.listAuditLogs(ev.id, 200),
        repo.stats(ev.id),
        repo.listNotifications(ev.id),
      ]);
      setLogs(l);
      setStats(s);
      setNotifications(n);
    }
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? logs
        : logs.filter((l) => l.actor_type === filter || l.action.startsWith(filter)),
    [logs, filter],
  );

  function exportCsv() {
    const header = "日時,実行者,種別,操作,対象,詳細\n";
    const body = filtered
      .map((l) =>
        [
          formatDateTime(l.created_at),
          l.actor_label,
          l.actor_type,
          ACTION_LABEL[l.action] ?? l.action,
          l.target_type ? `${l.target_type}:${l.target_id ?? ""}` : "",
          l.detail ? JSON.stringify(l.detail).replace(/,/g, ";") : "",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${header}${body}`], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${event?.slug ?? "event"}.csv`;
    a.click();
    show("CSVを書き出しました", "success");
  }

  if (loading) return <Loading />;

  return (
    <AdminShell
      event={event}
      title="監査ログ / 統計"
      description="誰がいつ何をしたかをすべて記録しています"
      actions={
        <button
          type="button"
          className="btn btn-outline min-h-[40px] px-4 text-[0.8125rem]"
          onClick={exportCsv}
        >
          CSV出力
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="投稿" value={stats?.posts ?? 0} unit="件" tone="primary" />
        <Stat label="写真" value={stats?.assets ?? 0} unit="枚" />
        <Stat label="保存容量" value={formatBytes(stats?.bytes ?? 0)} />
        <Stat label="参加者" value={stats?.guests ?? 0} unit="名" tone="success" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle
            title="操作履歴"
            description={`${filtered.length}件を表示（最新200件まで保持）`}
          />
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: "すべて" },
              { key: "admin", label: "管理者" },
              { key: "guest", label: "ゲスト" },
              { key: "post", label: "投稿関連" },
              { key: "monitor", label: "モニター関連" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={filter === f.key ? "chip chip-primary" : "chip"}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="記録がありません" />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[0.8125rem]">
                <thead className="bg-surface text-[0.75rem] text-muted">
                  <tr>
                    <th className="px-3 py-3">日時</th>
                    <th className="px-3 py-3">実行者</th>
                    <th className="px-3 py-3">操作</th>
                    <th className="px-3 py-3">対象</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-surface/60">
                      <td className="whitespace-nowrap px-3 py-3 text-muted">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold">{log.actor_label}</span>
                        <span className="ml-2 chip">
                          {log.actor_type === "admin"
                            ? "管理者"
                            : log.actor_type === "guest"
                              ? "ゲスト"
                              : "システム"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {ACTION_LABEL[log.action] ?? log.action}
                        {log.detail ? (
                          <span className="hint ml-1">
                            {Object.entries(log.detail)
                              .map(([k, v]) => `${k}=${String(v)}`)
                              .join(" / ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {log.target_type
                          ? `${log.target_type}:${(log.target_id ?? "").slice(0, 8)}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>

        <section>
          <SectionTitle title="通知予定" description="後日アルバムの案内など" />
          <Card className="divide-y divide-line">
            {notifications.length === 0 ? (
              <div className="p-4">
                <p className="hint">予定されている通知はありません。</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.875rem] font-semibold">{n.kind}</p>
                    <span
                      className={
                        n.state === "sent"
                          ? "chip chip-success"
                          : n.state === "failed"
                            ? "chip chip-danger"
                            : "chip chip-warning"
                      }
                    >
                      {n.state === "sent" ? "送信済み" : n.state === "failed" ? "失敗" : "予約済み"}
                    </span>
                  </div>
                  <p className="hint mt-1">
                    {n.channel} ・{" "}
                    {n.sent_at
                      ? `送信 ${formatDateTime(n.sent_at)}`
                      : `予定 ${formatDateTime(n.scheduled_at)}`}
                  </p>
                </div>
              ))
            )}
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-ink">データの保持と削除</p>
            <p className="hint mt-2">
              投稿から{event?.retention_days ?? 180}日が経過した写真は自動削除されます。
              監査ログは操作の追跡のため、削除後も12か月間保持します。
            </p>
          </Card>
        </section>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

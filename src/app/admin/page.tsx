"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Loading, SectionTitle, Stat, StatusChip } from "@/components/ui";
import { formatBytes, formatTime, relativeTime } from "@/lib/format";
import { usePolling, useRepo } from "@/lib/hooks";
import type { EventRow, MonitorDeviceRow, PostWithDemoAssets } from "@/lib/types";
import type { StatsSummary } from "@/lib/repo";

/** A-02 管理ダッシュボード */
export default function AdminDashboardPage() {
  const repo = useRepo();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [recent, setRecent] = useState<PostWithDemoAssets[]>([]);
  const [pending, setPending] = useState<PostWithDemoAssets[]>([]);
  const [monitors, setMonitors] = useState<MonitorDeviceRow[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    if (!ev) {
      setReady(true);
      return;
    }
    const [s, r, p, m] = await Promise.all([
      repo.stats(ev.id),
      repo.listPosts(ev.id, { limit: 6 }),
      repo.listPosts(ev.id, { statuses: ["pending"] }),
      repo.listMonitors(ev.id),
    ]);
    setStats(s);
    setRecent(r);
    setPending(p);
    setMonitors(m);
    setReady(true);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);
  usePolling(() => void load(), 8000, ready);

  if (!ready) return <Loading />;

  return (
    <AdminShell
      event={event}
      title="ダッシュボード"
      description="当日の進行状況をひと目で確認できます"
      actions={
        <Link href="/admin/photos" className="btn btn-primary min-h-[40px] px-4 text-[0.8125rem]">
          写真一覧へ
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="総投稿数"
          value={stats?.posts ?? 0}
          unit="件"
          tone="primary"
          hint={`本日 ${stats?.today ?? 0} 件`}
        />
        <Stat
          label="公開中"
          value={stats?.approved ?? 0}
          unit="件"
          tone="success"
          hint={`非表示 ${stats?.hidden ?? 0} 件`}
        />
        <Stat
          label="承認待ち"
          value={stats?.pending ?? 0}
          unit="件"
          tone={stats?.pending ? "warning" : "default"}
          hint="承認制の場合のみ発生します"
        />
        <Stat
          label="保存容量"
          value={formatBytes(stats?.bytes ?? 0)}
          hint={`写真 ${stats?.assets ?? 0} 枚 / 参加 ${stats?.guests ?? 0} 名`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle
            title="承認待ちの投稿"
            description="モニターに出す前に内容を確認してください"
            action={
              <Link href="/admin/photos" className="btn btn-outline min-h-[40px] px-4 text-[0.8125rem]">
                すべて見る
              </Link>
            }
          />
          {pending.length === 0 ? (
            <EmptyState
              title="承認待ちはありません"
              description="新しい投稿は自動で公開されています。"
              icon="✓"
            />
          ) : (
            <ul className="space-y-3">
              {pending.map((post) => (
                <li key={post.id}>
                  <Card className="flex items-center gap-4 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.assets[0]?.thumbUrl}
                      alt=""
                      className="size-16 rounded-[10px] border border-line object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-semibold">
                        {post.nickname_snapshot}
                      </p>
                      <p className="truncate text-[0.875rem] text-muted">
                        {post.comment || "コメントなし"}
                      </p>
                      <p className="hint">{relativeTime(post.posted_at)}</p>
                    </div>
                    <Link
                      href={`/admin/photos/${post.id}`}
                      className="btn btn-primary min-h-[40px] px-4 text-[0.8125rem]"
                    >
                      確認する
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <SectionTitle title="最新の投稿" description="会場の様子" />
          {recent.length === 0 ? (
            <EmptyState title="まだ投稿がありません" />
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {recent.map((post) => (
                <li key={post.id}>
                  <Link href={`/admin/photos/${post.id}`} className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.assets[0]?.thumbUrl}
                      alt=""
                      className="aspect-square w-full rounded-[10px] border border-line object-cover"
                    />
                    <span className="mt-1 block truncate text-[0.6875rem] text-muted">
                      {post.nickname_snapshot}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle title="モニターの状態" description="会場スクリーンの稼働状況" />
          <Card className="divide-y divide-line">
            {monitors.length === 0 ? (
              <div className="p-4">
                <p className="hint">モニターが登録されていません。</p>
              </div>
            ) : (
              monitors.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-semibold">{m.name}</p>
                    <p className="hint">
                      {m.resolution_w}×{m.resolution_h} ・ 最終通信{" "}
                      {formatTime(m.last_heartbeat_at)}
                    </p>
                  </div>
                  <StatusChip status={m.is_online ? "online" : "offline"} />
                </div>
              ))
            )}
          </Card>

          <SectionTitle title="当日の進行メモ" />
          <Card className="p-4">
            <ul className="space-y-2 text-[0.875rem] text-muted">
              <li>・乾杯前にQRコードの案内をアナウンス</li>
              <li>・ケーキ入刀のタイミングで大型表示を手動送信</li>
              <li>・お色直し中は背景スライドショーへ切り替え</li>
            </ul>
            <Link href="/admin/monitor" className="btn btn-outline mt-4 w-full text-[0.8125rem]">
              モニター操作を開く
            </Link>
          </Card>
        </section>
      </div>
    </AdminShell>
  );
}

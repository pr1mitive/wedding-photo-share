"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Loading, SectionTitle, StatusChip, Toast, useToast } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/format";
import { usePolling, useRepo } from "@/lib/hooks";
import type {
  EventRow,
  MonitorDeviceRow,
  MonitorQueueRow,
  PostWithDemoAssets,
} from "@/lib/types";

/** A-05 管理 モニター操作 */
export default function AdminMonitorPage() {
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [monitor, setMonitor] = useState<MonitorDeviceRow | null>(null);
  const [queue, setQueue] = useState<MonitorQueueRow[]>([]);
  const [posts, setPosts] = useState<PostWithDemoAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    if (!ev) {
      setLoading(false);
      return;
    }
    const [monitors, q, p] = await Promise.all([
      repo.listMonitors(ev.id),
      repo.listQueue(ev.id, { states: ["queued", "playing"] }),
      repo.listPosts(ev.id, { statuses: ["approved"], limit: 30 }),
    ]);
    setMonitor(monitors[0] ?? null);
    setQueue(q);
    setPosts(p);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);
  usePolling(() => void load(), 4000, !loading);

  async function send(post: PostWithDemoAssets, kind: "large" | "zoom" | "background") {
    if (!event) return;
    setBusy(true);
    try {
      await repo.enqueue({
        eventId: event.id,
        monitorId: monitor?.id ?? null,
        postId: post.id,
        kind,
        requestedBy: "admin",
      });
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: `monitor.enqueue.${kind}`,
        targetType: "post",
        targetId: post.id,
      });
      show(kind === "zoom" ? "拡大表示で送信しました" : "モニターに送信しました", "success");
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "送信に失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function setMode(mode: MonitorDeviceRow["mode"]) {
    if (!monitor || !event) return;
    setBusy(true);
    try {
      await repo.setMonitorMode(monitor.id, mode);
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: `monitor.mode.${mode}`,
        targetType: "monitor",
        targetId: monitor.id,
      });
      show(
        mode === "background" ? "背景スライドショーに切り替えました" : mode === "idle" ? "待機画面に切り替えました" : "大型表示に切り替えました",
        "success",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  const playing = queue.find((q) => q.state === "playing");
  const waiting = queue.filter((q) => q.state === "queued");

  return (
    <AdminShell
      event={event}
      title="モニター操作"
      description="会場スクリーンに流す写真をコントロールします"
      actions={
        <button
          type="button"
          className="btn btn-outline min-h-[40px] px-4 text-[0.8125rem]"
          disabled={busy || waiting.length === 0}
          onClick={() => void repo.clearQueue(event!.id).then(load)}
        >
          待機列をクリア
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section>
          <SectionTitle title="モニターの状態" />
          {!monitor ? (
            <EmptyState title="モニターが登録されていません" />
          ) : (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mincho text-[1.0625rem] text-wine">{monitor.name}</p>
                  <p className="hint">
                    端末コード {monitor.code} ・ {monitor.resolution_w}×{monitor.resolution_h}
                  </p>
                </div>
                <StatusChip status={monitor.is_online ? "online" : "offline"} />
              </div>
              <p className="hint mt-3">
                最終通信 {formatDateTime(monitor.last_heartbeat_at)}（
                {relativeTime(monitor.last_heartbeat_at)}）
              </p>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  className={monitor.mode === "large" ? "btn btn-primary w-full" : "btn btn-outline w-full"}
                  disabled={busy}
                  onClick={() => void setMode("large")}
                >
                  大型表示モード
                </button>
                <button
                  type="button"
                  className={monitor.mode === "background" ? "btn btn-primary w-full" : "btn btn-outline w-full"}
                  disabled={busy}
                  onClick={() => void setMode("background")}
                >
                  背景スライドショー
                </button>
                <button
                  type="button"
                  className={monitor.mode === "idle" ? "btn btn-primary w-full" : "btn btn-outline w-full"}
                  disabled={busy}
                  onClick={() => void setMode("idle")}
                >
                  待機画面
                </button>
              </div>
            </Card>
          )}

          <SectionTitle title="再生キュー" description={`再生中1件 ・ 待機${waiting.length}件`} />
          <Card className="divide-y divide-line">
            {playing ? (
              <div className="flex items-center justify-between gap-3 bg-primary-soft p-4">
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-semibold text-primary">いま再生中</p>
                  <p className="truncate text-[0.9375rem] font-semibold">
                    {posts.find((p) => p.id === playing.post_id)?.nickname_snapshot ?? "-"}
                  </p>
                </div>
                <StatusChip status="playing" />
              </div>
            ) : null}
            {waiting.length === 0 && !playing ? (
              <div className="p-4">
                <p className="hint">キューは空です。写真を送信すると順番に表示されます。</p>
              </div>
            ) : (
              waiting.map((item, index) => {
                const post = posts.find((p) => p.id === item.post_id);
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <span className="w-6 text-center text-[0.75rem] text-muted">
                      {index + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post?.assets[0]?.thumbUrl}
                      alt=""
                      className="size-12 rounded-[8px] border border-line object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] font-semibold">
                        {post?.nickname_snapshot ?? "-"}
                      </p>
                      <p className="hint">
                        {item.kind === "zoom" ? "拡大表示" : "大型表示"} ・{" "}
                        {relativeTime(item.requested_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost min-h-[36px] px-2 text-[0.75rem]"
                      onClick={() => void repo.updateQueueState(item.id, "skipped").then(load)}
                    >
                      スキップ
                    </button>
                  </div>
                );
              })
            )}
          </Card>
        </section>

        <section>
          <SectionTitle
            title="写真をモニターに送る"
            description="タップすると再生キューに追加されます"
          />
          {posts.length === 0 ? (
            <EmptyState title="送信できる写真がありません" />
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {posts.map((post) => (
                <li key={post.id}>
                  <Card className="overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.assets[0]?.thumbUrl}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                    <div className="p-2">
                      <p className="truncate text-[0.75rem] font-semibold">
                        {post.nickname_snapshot}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          className="btn btn-primary min-h-[32px] px-1 text-[0.6875rem]"
                          disabled={busy}
                          onClick={() => void send(post, "large")}
                        >
                          大型
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline min-h-[32px] px-1 text-[0.6875rem]"
                          disabled={busy}
                          onClick={() => void send(post, "zoom")}
                        >
                          拡大
                        </button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

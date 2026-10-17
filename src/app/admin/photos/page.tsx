"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Loading, StatusChip, Toast, useToast } from "@/components/ui";
import { formatBytes, formatDateTime } from "@/lib/format";
import { useRepo } from "@/lib/hooks";
import type { EventRow, PostStatus, PostWithDemoAssets } from "@/lib/types";

type Filter = "all" | PostStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "approved", label: "公開中" },
  { key: "pending", label: "承認待ち" },
  { key: "hidden", label: "非表示" },
];

/** A-03 管理 写真一覧 */
export default function AdminPhotosPage() {
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [posts, setPosts] = useState<PostWithDemoAssets[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    if (ev) setPosts(await repo.listPosts(ev.id));
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          p.nickname_snapshot.toLowerCase().includes(q) ||
          p.comment.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [posts, filter, query]);

  const allChecked = filtered.length > 0 && selected.length === filtered.length;

  async function applyStatus(status: PostStatus, ids: string[]) {
    if (!event || ids.length === 0) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await repo.updatePostStatus(id, status);
        await repo.log({
          eventId: event.id,
          actorType: "admin",
          actorId: null,
          actorLabel: "管理者",
          action: `post.${status}`,
          targetType: "post",
          targetId: id,
        });
      }
      show(`${ids.length}件を「${status === "approved" ? "公開" : status === "hidden" ? "非表示" : status}」に変更しました`, "success");
      setSelected([]);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "更新に失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function sendToMonitor(ids: string[]) {
    if (!event || ids.length === 0) return;
    setBusy(true);
    try {
      const monitors = await repo.listMonitors(event.id);
      for (const id of ids) {
        await repo.enqueue({
          eventId: event.id,
          monitorId: monitors[0]?.id ?? null,
          postId: id,
          kind: "large",
        });
      }
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: "monitor.enqueue",
        targetType: "post",
        targetId: ids.join(","),
        detail: { count: ids.length },
      });
      show(`${ids.length}件をモニターに送信しました`, "success");
      setSelected([]);
    } catch (e) {
      show(e instanceof Error ? e.message : "送信に失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function remove(ids: string[]) {
    if (!event || ids.length === 0) return;
    if (!window.confirm(`${ids.length}件の投稿を完全に削除します。よろしいですか？`)) return;
    setBusy(true);
    try {
      for (const id of ids) {
        await repo.removePost(id);
        await repo.log({
          eventId: event.id,
          actorType: "admin",
          actorId: null,
          actorLabel: "管理者",
          action: "post.delete",
          targetType: "post",
          targetId: id,
        });
      }
      show(`${ids.length}件を削除しました`, "success");
      setSelected([]);
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "削除に失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  const totalBytes = filtered.reduce(
    (sum, p) => sum + p.assets.reduce((s, a) => s + a.bytes, 0),
    0,
  );

  return (
    <AdminShell
      event={event}
      title="写真一覧"
      description={`${filtered.length}件 ・ ${formatBytes(totalBytes)}`}
      actions={
        <button
          type="button"
          className="btn btn-primary min-h-[40px] px-4 text-[0.8125rem]"
          disabled={busy || selected.length === 0}
          onClick={() => void sendToMonitor(selected)}
        >
          選択をモニターへ送信
        </button>
      }
    >
      <Card className="mb-5 flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? "chip chip-primary" : "chip"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="ml-1 text-[0.6875rem] opacity-70">
                {f.key === "all"
                  ? posts.length
                  : posts.filter((p) => p.status === f.key).length}
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-2">
          <input
            className="input min-h-[40px]"
            placeholder="ニックネーム・コメントで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Card>

      {selected.length > 0 ? (
        <Card className="mb-4 flex flex-wrap items-center gap-2 border-primary/30 bg-primary-soft p-3">
          <span className="text-[0.875rem] font-semibold text-primary-dark">
            {selected.length}件を選択中
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-[40px] px-4 text-[0.8125rem]"
              disabled={busy}
              onClick={() => void applyStatus("approved", selected)}
            >
              公開する
            </button>
            <button
              type="button"
              className="btn btn-outline min-h-[40px] px-4 text-[0.8125rem]"
              disabled={busy}
              onClick={() => void applyStatus("hidden", selected)}
            >
              非表示にする
            </button>
            <button
              type="button"
              className="btn btn-danger min-h-[40px] px-4 text-[0.8125rem]"
              disabled={busy}
              onClick={() => void remove(selected)}
            >
              削除
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-[40px] px-3 text-[0.8125rem]"
              onClick={() => setSelected([])}
            >
              選択解除
            </button>
          </div>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title="該当する投稿がありません" description="条件を変えて検索してください。" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[0.875rem]">
            <thead className="bg-surface text-[0.75rem] uppercase tracking-wide text-muted">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="すべて選択"
                    className="size-4 accent-[#9C2B4E]"
                    checked={allChecked}
                    onChange={(e) =>
                      setSelected(e.target.checked ? filtered.map((p) => p.id) : [])
                    }
                  />
                </th>
                <th className="px-3 py-3">写真</th>
                <th className="px-3 py-3">投稿者 / コメント</th>
                <th className="px-3 py-3">状態</th>
                <th className="px-3 py-3">投稿日時</th>
                <th className="px-3 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((post) => (
                <tr key={post.id} className="hover:bg-surface/60">
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      aria-label={`${post.nickname_snapshot} の投稿を選択`}
                      className="size-4 accent-[#9C2B4E]"
                      checked={selected.includes(post.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, post.id]
                            : prev.filter((id) => id !== post.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/admin/photos/${post.id}`} className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.assets[0]?.thumbUrl}
                        alt=""
                        className="size-14 rounded-[8px] border border-line object-cover"
                      />
                    </Link>
                  </td>
                  <td className="max-w-[280px] px-3 py-3">
                    <p className="truncate font-semibold">{post.nickname_snapshot}</p>
                    <p className="truncate text-muted">{post.comment || "コメントなし"}</p>
                    <p className="hint">
                      {post.assets.length}枚 ・{" "}
                      {formatBytes(post.assets.reduce((s, a) => s + a.bytes, 0))}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusChip status={post.status} />
                    {post.is_visible_in_album ? (
                      <p className="hint mt-1">アルバム掲載</p>
                    ) : (
                      <p className="hint mt-1">アルバム非掲載</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {formatDateTime(post.posted_at)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-outline min-h-[36px] px-3 text-[0.75rem]"
                        disabled={busy}
                        onClick={() => void sendToMonitor([post.id])}
                      >
                        送信
                      </button>
                      <Link
                        href={`/admin/photos/${post.id}`}
                        className="btn btn-outline min-h-[36px] px-3 text-[0.75rem]"
                      >
                        詳細
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

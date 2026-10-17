"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Loading, StatusChip, Toggle, Toast, useToast } from "@/components/ui";
import { formatBytes, formatDateTime, retentionExpiry } from "@/lib/format";
import { useRepo } from "@/lib/hooks";
import type { EventRow, PostWithDemoAssets } from "@/lib/types";

/** A-04 管理 写真詳細 */
export default function AdminPhotoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [post, setPost] = useState<PostWithDemoAssets | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const events = await repo.listEvents();
    setEvent(events[0] ?? null);
    const found = await repo.getPost(id);
    setPost(found);
    setNote(found?.moderation_note ?? "");
    setLoading(false);
  }, [repo, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: "approved" | "hidden") {
    if (!post || !event) return;
    setBusy(true);
    try {
      await repo.updatePostStatus(post.id, status, note || null);
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: status === "approved" ? "post.approve" : "post.hide",
        targetType: "post",
        targetId: post.id,
        detail: { note: note || null },
      });
      show(status === "approved" ? "公開しました" : "非表示にしました", "success");
      await load();
    } catch (e) {
      show(e instanceof Error ? e.message : "更新に失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!post || !event) return;
    if (!window.confirm("この投稿を完全に削除します。取り消せません。よろしいですか？")) return;
    setBusy(true);
    try {
      await repo.removePost(post.id);
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: "post.delete",
        targetType: "post",
        targetId: post.id,
      });
      router.replace("/admin/photos");
    } catch (e) {
      show(e instanceof Error ? e.message : "削除に失敗しました", "danger");
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  if (!post) {
    return (
      <AdminShell event={event} title="写真詳細">
        <EmptyState title="投稿が見つかりません" description="削除された可能性があります。" />
        <Link href="/admin/photos" className="btn btn-outline mt-4">
          一覧へ戻る
        </Link>
      </AdminShell>
    );
  }

  const totalBytes = post.assets.reduce((s, a) => s + a.bytes, 0);

  return (
    <AdminShell
      event={event}
      title="写真詳細"
      description={`投稿ID ${post.id.slice(0, 8)} ・ ${formatDateTime(post.posted_at)}`}
      actions={
        <Link href="/admin/photos" className="btn btn-outline min-h-[40px] px-4 text-[0.8125rem]">
          一覧へ戻る
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {post.assets.map((asset) => (
              <li key={asset.id}>
                <button type="button" className="block w-full" onClick={() => setZoom(asset.url)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.thumbUrl || asset.url}
                    alt=""
                    className="aspect-square w-full rounded-[10px] border border-line object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-muted">投稿内容</p>
            <p className="mt-2 font-mincho text-[1.125rem] text-wine">
              {post.nickname_snapshot}
            </p>
            <p className="mt-2 text-[0.9375rem]">{post.comment || "コメントなし"}</p>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-[0.8125rem] sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-muted">枚数</dt>
                <dd>{post.assets.length}枚</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">容量</dt>
                <dd>{formatBytes(totalBytes)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">投稿日時</dt>
                <dd>{formatDateTime(post.posted_at)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">保持期限</dt>
                <dd>{formatDateTime(retentionExpiry(post.posted_at, event?.retention_days ?? 180))}</dd>
              </div>
            </dl>
          </Card>
        </section>

        <section>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[0.9375rem] font-semibold">公開状態</span>
              <StatusChip status={post.status} />
            </div>

            <div className="mt-4">
              <Toggle
                checked={post.is_visible_in_album}
                label="アルバムに掲載する"
                description="後日共有するアルバムに含めるかどうか"
                onChange={(next) => {
                  void repo.setAlbumVisibility(post.id, next).then(load);
                }}
              />
            </div>

            <label className="label mt-4" htmlFor="note">
              対応メモ（任意・監査ログに残ります）
            </label>
            <textarea
              id="note"
              className="input min-h-[88px] resize-none"
              placeholder="例：本人の申告により非表示"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy}
                onClick={() => void setStatus("approved")}
              >
                公開する（モニターに送信可能）
              </button>
              <button
                type="button"
                className="btn btn-outline w-full"
                disabled={busy}
                onClick={() => void setStatus("hidden")}
              >
                非表示にする
              </button>
              <button
                type="button"
                className="btn btn-outline w-full"
                disabled={busy}
                onClick={() => {
                  void repo
                    .enqueue({
                      eventId: post.event_id,
                      monitorId: null,
                      postId: post.id,
                      kind: "zoom",
                    })
                    .then(() => show("拡大表示でモニターに送信しました", "success"));
                }}
              >
                拡大表示でモニターへ送信
              </button>
              <button
                type="button"
                className="btn btn-danger w-full"
                disabled={busy}
                onClick={() => void remove()}
              >
                完全に削除する
              </button>
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-muted">対応のヒント</p>
            <ul className="mt-2 space-y-1 text-[0.8125rem] text-muted">
              <li>・本人から削除依頼があった場合は「非表示」ではなく「削除」を選びます。</li>
              <li>・モニターに出す前に、写り込みや個人情報を確認してください。</li>
              <li>・すべての操作は監査ログに記録されます。</li>
            </ul>
          </Card>
        </section>
      </div>

      {zoom ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

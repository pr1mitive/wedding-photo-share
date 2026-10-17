"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GuestHeading, GuestShell } from "@/components/guest-shell";
import { Card, EmptyState, ErrorCard, Loading, StatusChip, Toast, useToast } from "@/components/ui";
import { formatDateTime, formatBytes } from "@/lib/format";
import { useEvent, useGuestSession, useRepo } from "@/lib/hooks";
import type { PostWithDemoAssets } from "@/lib/types";

/** G-06 自分の投稿 */
export default function GuestMinePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const repo = useRepo();
  const { event, loading: eventLoading } = useEvent(slug);
  const { session, ready } = useGuestSession(slug);
  const { toast, show } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostWithDemoAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // 自分の投稿の読み込み。
  // イベントと端末セッションが揃うまで待ってから取得し、
  // 取得完了まで loading を下げない。
  useEffect(() => {
    if (!event) return;
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const rows = await repo.listPosts(
          event.id,
          session ? { deviceToken: session.deviceToken } : {},
        );
        if (!alive) return;
        setPosts(rows.filter((p) => p.assets.length > 0));
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [repo, event, session, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  async function requestDelete(post: PostWithDemoAssets) {
    if (!event || !session) return;
    const reason = window.prompt(
      "削除を依頼する理由を入力してください（管理者に伝わります）",
      "本人の申告",
    );
    if (reason === null) return;
    setBusyId(post.id);
    try {
      await repo.log({
        eventId: event.id,
        actorType: "guest",
        actorId: session.guestId,
        actorLabel: session.nickname,
        action: "post.delete_request",
        targetType: "post",
        targetId: post.id,
        detail: { reason },
      });
      await repo.requestPostDelete(post.id, session.deviceToken, reason);
      show("削除を依頼しました。管理者が確認します。", "success");
      await reload();
    } catch (e) {
      show(e instanceof Error ? e.message : "依頼に失敗しました", "danger");
    } finally {
      setBusyId(null);
    }
  }

  if (!ready || loading || eventLoading) return <Loading />;
  if (error) {
    return (
      <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="自分の投稿">
        <ErrorCard title="投稿を読み込めませんでした" message={error} onRetry={reload} />
      </GuestShell>
    );
  }

  const totalBytes = posts.reduce(
    (sum, p) => sum + p.assets.reduce((s, a) => s + a.bytes, 0),
    0,
  );

  return (
    <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="自分の投稿">
      <GuestHeading
        title="自分の投稿"
        description={`${posts.length}件 ・ 合計 ${formatBytes(totalBytes)}`}
      />

      {!session ? (
        <EmptyState
          title="参加登録がまだです"
          description="最初の画面からニックネームを登録してください。"
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="まだ投稿がありません"
          description="「投稿」タブから最初の1枚を共有しましょう。同じ端末であれば、投稿した写真がここに並びます。"
        />
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.id}>
              <Card className="overflow-hidden">
                <div className="flex gap-3 p-3">
                  <div className="size-24 shrink-0 overflow-hidden rounded-[10px] border border-line bg-line">
                    {post.assets[0]?.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.assets[0].thumbUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusChip status={post.status} />
                      <span className="hint">{formatDateTime(post.posted_at)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[0.9375rem]">
                      {post.comment || <span className="text-muted">コメントなし</span>}
                    </p>
                    <p className="hint mt-1">
                      {post.assets.length}枚 ・{" "}
                      {formatBytes(post.assets.reduce((s, a) => s + a.bytes, 0))}
                    </p>
                  </div>
                </div>
                {post.status === "hidden" ? (
                  <p className="border-t border-line bg-[#fdf4f3] px-3 py-2 text-[0.8125rem] text-danger">
                    非表示になっています（{post.moderation_note ?? "管理者により非表示"}）
                  </p>
                ) : (
                  <div className="flex justify-end border-t border-line px-3 py-2">
                    <button
                      type="button"
                      className="btn btn-danger min-h-[40px] px-3 text-[0.8125rem]"
                      disabled={busyId === post.id}
                      onClick={() => void requestDelete(post)}
                    >
                      {busyId === post.id ? "依頼中…" : "削除を依頼"}
                    </button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6 p-4">
        <p className="text-[0.875rem] font-semibold text-ink">写真の保持について</p>
        <p className="hint mt-1">
          投稿された写真は{event?.retention_days ?? 180}日後に自動削除されます。
          必要な写真は端末にも保存しておいてください。
        </p>
      </Card>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </GuestShell>
  );
}

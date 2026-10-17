"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GuestHeading, GuestShell } from "@/components/guest-shell";
import { Card, EmptyState, ErrorCard, Loading } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { useAsync, useEvent, useGuestSession, useRealtime, useRepo } from "@/lib/hooks";
import type { AlbumItemRow, PostWithDemoAssets } from "@/lib/types";

/** G-07 アルバム一覧 / G-08 アルバム閲覧と拡大 */
export default function GuestAlbumPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const repo = useRepo();
  const { event, loading: eventLoading } = useEvent(slug);
  const { session } = useGuestSession(slug);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const loader = useCallback(async () => {
    if (!event) return [] as PostWithDemoAssets[];
    const rows = await repo.listPosts(event.id, { statuses: ["approved"] });
    // 画像を持たない投稿はアルバムに載せない
    return rows.filter((p) => p.assets.length > 0);
  }, [repo, event]);

  const { data: posts, loading, error, reload } = useAsync<PostWithDemoAssets[]>(
    loader,
    [event?.id],
    [],
  );
  useRealtime(event?.id, () => void reload());

  const visible = onlyMine && session
    ? posts.filter((p) => p.guest_id === session.guestId)
    : posts;

  const flat = visible.flatMap((post) =>
    post.assets.map((asset) => ({ post, asset })),
  );

  // 拡大表示中のキーボード操作（G-08）
  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight")
        setOpenIndex((i) => (i === null ? i : Math.min(i + 1, flat.length - 1)));
      if (e.key === "ArrowLeft")
        setOpenIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openIndex, flat.length]);

  // イベントの読み込みが終わるまで空状態を出さない
  if (loading || eventLoading) return <Loading />;
  if (error) {
    return (
      <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="アルバム">
        <ErrorCard title="アルバムを読み込めませんでした" message={error} onRetry={reload} />
      </GuestShell>
    );
  }

  const current = openIndex === null ? null : flat[openIndex];

  return (
    <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="アルバム">
      <GuestHeading
        title="みんなのアルバム"
        description={`${flat.length}枚 ・ 新しい順に並んでいます`}
      />

      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          className={onlyMine ? "btn btn-primary min-h-[40px] px-4 text-[0.8125rem]" : "btn btn-outline min-h-[40px] px-4 text-[0.8125rem]"}
          onClick={() => setOnlyMine((v) => !v)}
        >
          {onlyMine ? "自分の投稿のみ" : "すべて表示"}
        </button>
        <span className="hint">{visible.length}件の投稿</span>
      </div>

      {flat.length === 0 ? (
        <EmptyState
          title="まだ写真がありません"
          description="投稿された写真がここに並びます。"
        />
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          {flat.map((item, index) => (
            <li key={item.asset.id}>
              <button
                type="button"
                className="block w-full"
                onClick={() => setOpenIndex(index)}
                aria-label={`${item.post.nickname_snapshot} の写真を拡大`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.asset.thumbUrl || item.asset.url}
                  alt={item.post.comment || "投稿写真"}
                  className="aspect-square w-full rounded-[8px] border border-line object-cover"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6 p-4">
        <p className="text-[0.875rem] font-semibold text-ink">
          {event?.couple_names} のアルバム
        </p>
        <p className="hint mt-1">
          このアルバムはイベント参加者だけが閲覧できます。写真の無断転載はご遠慮ください。
        </p>
      </Card>

      {/* G-08 拡大表示 */}
      {current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="写真の拡大表示"
          className="fixed inset-0 z-50 flex flex-col bg-black/92"
          onClick={() => setOpenIndex(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-[0.875rem]">
              {openIndex! + 1} / {flat.length}
            </span>
            <button
              type="button"
              aria-label="閉じる"
              className="flex size-11 items-center justify-center rounded-full bg-white/15 text-[1.125rem]"
              onClick={() => setOpenIndex(null)}
            >
              ✕
            </button>
          </div>

          <div
            className="flex flex-1 items-center justify-center overflow-hidden px-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.asset.url || current.asset.thumbUrl}
              alt={current.post.comment || "投稿写真"}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div
            className="bg-gradient-to-t from-black/85 to-transparent px-5 pb-6 pt-8 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mincho text-[1.125rem]">{current.post.nickname_snapshot}</p>
            {current.post.comment ? (
              <p className="mt-1 text-[0.9375rem] text-white/90">{current.post.comment}</p>
            ) : null}
            <p className="mt-2 text-[0.75rem] text-white/60">
              {formatDateTime(current.post.posted_at)}
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-3 border-t border-white/10 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn min-h-[44px] bg-white/12 text-white"
              onClick={() => setOpenIndex((i) => Math.max((i ?? 0) - 1, 0))}
              disabled={openIndex === 0}
            >
              ← 前の写真
            </button>
            <button
              type="button"
              className="btn min-h-[44px] bg-white/12 text-white"
              onClick={() =>
                setOpenIndex((i) => Math.min((i ?? 0) + 1, flat.length - 1))
              }
              disabled={openIndex === flat.length - 1}
            >
              次の写真 →
            </button>
          </div>
        </div>
      ) : null}
    </GuestShell>
  );
}

export type { AlbumItemRow };

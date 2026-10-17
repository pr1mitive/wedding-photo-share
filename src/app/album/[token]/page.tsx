"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, EmptyState, ErrorCard, Loading } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { useRepo } from "@/lib/hooks";
import type { AlbumRow, EventRow, PostWithDemoAssets } from "@/lib/types";

/* ============================================================
   共有アルバム（ログイン不要）

   管理画面の「共有リンク」が指す公開ページ。
   /album/<share_token> で開き、アルバムに掲載した写真だけを
   閲覧順（sort_order）どおりに並べる。

   権限は RLS が担う。albums.visibility が private のアルバムは
   anon からは読めないため、この画面では「公開されていません」
   として扱われる。ゲスト側のログインは不要。
   ============================================================ */

type Entry = {
  asset: PostWithDemoAssets["assets"][number];
  post: PostWithDemoAssets;
};

export default function SharedAlbumPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const repo = useRepo();

  const [album, setAlbum] = useState<AlbumRow | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // 読み込みは「完了するまで loading を下げない」方式にする。
  // 途中で空のまま確定すると「写真がありません」と誤表示するため。
  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const found = await repo.getAlbumByToken(token);
        if (!alive) return;
        setAlbum(found);
        if (!found) return;

        const [ev, items, posts] = await Promise.all([
          repo.getEventById(found.event_id),
          repo.listAlbumItems(found.id),
          repo.listPosts(found.event_id, { statuses: ["approved"] }),
        ]);
        if (!alive) return;
        setEvent(ev);

        // 掲載順（album_items.sort_order）を保ったまま写真を引き当てる
        const byAsset = new Map<string, Entry>();
        for (const post of posts) {
          for (const asset of post.assets) byAsset.set(asset.id, { asset, post });
        }
        setEntries(
          items
            .map((i) => byAsset.get(i.asset_id))
            .filter((e): e is Entry => Boolean(e)),
        );
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
  }, [repo, token, nonce]);

  // 拡大表示のキーボード操作
  useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight")
        setOpenIndex((i) => (i === null ? i : Math.min(i + 1, entries.length - 1)));
      if (e.key === "ArrowLeft")
        setOpenIndex((i) => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openIndex, entries.length]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <Frame>
        <ErrorCard
          title="アルバムを読み込めませんでした"
          message={error}
          onRetry={() => setNonce((n) => n + 1)}
        />
      </Frame>
    );
  }

  // トークンが無効、または非公開（RLS により anon からは見えない）
  if (!album) {
    return (
      <Frame>
        <EmptyState
          title="アルバムが見つかりません"
          description="リンクが正しいかご確認ください。このアルバムは現在公開されていない可能性があります。"
        />
      </Frame>
    );
  }

  const current = openIndex === null ? null : entries[openIndex];

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-[900px] px-5 py-6">
          <p className="text-[0.75rem] font-semibold tracking-widest text-primary">
            PHOTO ALBUM
          </p>
          <h1 className="mt-1 font-mincho text-[1.5rem] leading-snug text-wine">
            {album.title}
          </h1>
          {event ? (
            <p className="mt-1 text-[0.875rem] text-muted">
              {event.couple_names} ・ {event.title}
            </p>
          ) : null}
          {album.description ? (
            <p className="mt-3 text-[0.9375rem] text-ink">{album.description}</p>
          ) : null}
          <p className="hint mt-3">{entries.length}枚</p>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-3 pb-16 pt-5">
        {entries.length === 0 ? (
          <EmptyState
            title="まだ写真が入っていません"
            description="新郎新婦が写真を選ぶと、ここに並びます。"
          />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {entries.map((item, index) => (
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
                    alt={item.post.comment || "アルバム写真"}
                    className="aspect-square w-full rounded-[8px] border border-line object-cover"
                    loading="lazy"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Card className="mt-8 p-4">
          <p className="text-[0.875rem] font-semibold text-ink">
            {event?.couple_names} のアルバム
          </p>
          <p className="hint mt-1">
            このアルバムは共有リンクを知っている方だけが閲覧できます。写真の無断転載はご遠慮ください。
          </p>
        </Card>
      </main>

      {/* 拡大表示 */}
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
              {openIndex! + 1} / {entries.length}
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
              alt={current.post.comment || "アルバム写真"}
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
                setOpenIndex((i) => Math.min((i ?? 0) + 1, entries.length - 1))
              }
              disabled={openIndex === entries.length - 1}
            >
              次の写真 →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 読み込み中以外の共通枠（見つからない／エラー時） */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-5">
      <div className="w-full max-w-[520px]">{children}</div>
    </div>
  );
}

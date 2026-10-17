"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Field, Loading, Toast, useToast } from "@/components/ui";
import { useRepo } from "@/lib/hooks";
import type { AlbumItemRow, AlbumRow, EventRow, PostWithDemoAssets } from "@/lib/types";

/** A-08 管理 アルバム編集 */
export default function AdminAlbumEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const repo = useRepo();
  const { toast, show } = useToast();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [album, setAlbum] = useState<AlbumRow | null>(null);
  const [items, setItems] = useState<AlbumItemRow[]>([]);
  const [posts, setPosts] = useState<PostWithDemoAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    const found = await repo.getAlbum(id);
    setAlbum(found);
    if (found) {
      setItems(await repo.listAlbumItems(found.id));
      setPosts(await repo.listPosts(found.event_id, { statuses: ["approved"] }));
    }
    setLoading(false);
  }, [repo, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const assetById = new Map(
    posts.flatMap((post) =>
      post.assets.map((asset) => [asset.id, { asset, post }] as const),
    ),
  );

  async function move(index: number, delta: number) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    await repo.reorderAlbumItems(id!, next.map((i) => i.id));
  }

  async function toggleAsset(assetId: string) {
    if (!album) return;
    const existing = items.find((i) => i.asset_id === assetId);
    setBusy(true);
    try {
      if (existing) {
        await repo.removeAlbumItem(existing.id);
        show("アルバムから外しました");
      } else {
        await repo.addAlbumItems(album.id, [assetId]);
        show("アルバムに追加しました", "success");
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  if (!album) {
    return (
      <AdminShell event={event} title="アルバム編集">
        <EmptyState title="アルバムが見つかりません" />
        <Link href="/admin/albums" className="btn btn-outline mt-4">
          一覧へ戻る
        </Link>
      </AdminShell>
    );
  }

  const includedIds = new Set(items.map((i) => i.asset_id));

  return (
    <AdminShell
      event={event}
      title="アルバム編集"
      description={`${album.title} ・ ${items.length}枚を掲載中`}
      actions={
        <Link href="/admin/albums" className="btn btn-outline min-h-[40px] px-4 text-[0.8125rem]">
          一覧へ戻る
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <Card className="p-5">
            <Field label="アルバム名">
              <input
                className="input"
                value={album.title}
                onChange={(e) => setAlbum({ ...album, title: e.target.value })}
                onBlur={() => void repo.updateAlbum(album.id, { title: album.title })}
              />
            </Field>
            <div className="mt-4">
              <Field label="説明文">
                <textarea
                  className="input min-h-[80px] resize-none"
                  value={album.description}
                  placeholder="アルバムの説明を入力"
                  onChange={(e) => setAlbum({ ...album, description: e.target.value })}
                  onBlur={() =>
                    void repo.updateAlbum(album.id, { description: album.description })
                  }
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="公開範囲" hint="ゲストの閲覧可否を決めます">
                <select
                  className="input"
                  value={album.visibility}
                  onChange={(e) => {
                    const next = e.target.value as AlbumRow["visibility"];
                    setAlbum({ ...album, visibility: next });
                    void repo.updateAlbum(album.id, { visibility: next });
                  }}
                >
                  <option value="private">非公開（下書き）</option>
                  <option value="guest">参加者のみ</option>
                  <option value="public">公開リンク</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-ink">共有リンク</p>
            <p className="mt-2 break-all rounded-[8px] bg-surface px-3 py-2 font-mono text-[0.75rem] text-muted">
              /album/{album.share_token}
            </p>
            <p className="hint mt-2">
              公開範囲が「参加者のみ」「公開リンク」のときだけ有効です。
            </p>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 font-mincho text-[1.125rem] text-wine">
            掲載中 {items.length}枚（並べ替え）
          </h2>
          {items.length === 0 ? (
            <EmptyState title="まだ写真が入っていません" description="下の一覧から追加してください。" />
          ) : (
            <ul className="space-y-2">
              {items.map((item, index) => {
                const entry = assetById.get(item.asset_id);
                return (
                  <li key={item.id}>
                    <Card className="flex items-center gap-3 p-2">
                      <span className="w-6 text-center text-[0.75rem] text-muted">
                        {index + 1}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry?.asset.thumbUrl}
                        alt=""
                        className="size-14 rounded-[8px] border border-line object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.875rem] font-semibold">
                          {entry?.post.nickname_snapshot ?? "（投稿が削除されました）"}
                        </p>
                        <p className="truncate text-[0.75rem] text-muted">
                          {entry?.post.comment || "コメントなし"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label="上へ"
                          className="btn btn-outline min-h-[36px] px-2 text-[0.75rem]"
                          disabled={index === 0}
                          onClick={() => void move(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="下へ"
                          className="btn btn-outline min-h-[36px] px-2 text-[0.75rem]"
                          disabled={index === items.length - 1}
                          onClick={() => void move(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label="外す"
                          className="btn btn-danger min-h-[36px] px-2 text-[0.75rem]"
                          onClick={() => void toggleAsset(item.asset_id)}
                        >
                          ✕
                        </button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="mb-3 mt-8 font-mincho text-[1.125rem] text-wine">
            追加できる写真
          </h2>
          <ul className="grid grid-cols-4 gap-2">
            {posts.flatMap((post) =>
              post.assets.map((asset) => {
                const included = includedIds.has(asset.id);
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      className="relative block w-full"
                      disabled={busy}
                      onClick={() => void toggleAsset(asset.id)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.thumbUrl}
                        alt=""
                        className={
                          included
                            ? "aspect-square w-full rounded-[8px] border-2 border-primary object-cover opacity-60"
                            : "aspect-square w-full rounded-[8px] border border-line object-cover"
                        }
                      />
                      {included ? (
                        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[0.625rem] text-white">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              }),
            )}
          </ul>
        </section>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

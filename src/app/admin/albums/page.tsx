"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Field, Loading, StatusChip, Toast, useToast } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useRepo } from "@/lib/hooks";
import type { AlbumRow, EventRow } from "@/lib/types";

const VISIBILITY_LABEL: Record<string, string> = {
  private: "非公開",
  guest: "参加者のみ",
  public: "公開リンク",
};

/** A-07 管理 アルバム管理 */
export default function AdminAlbumsPage() {
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    if (ev) {
      const rows = await repo.listAlbums(ev.id);
      setAlbums(rows);
      const map: Record<string, number> = {};
      for (const album of rows) {
        map[album.id] = (await repo.listAlbumItems(album.id)).length;
      }
      setCounts(map);
    }
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!event || !title.trim()) {
      show("アルバム名を入力してください", "danger");
      return;
    }
    setBusy(true);
    try {
      await repo.createAlbum(event.id, title.trim());
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: "album.create",
        targetType: "album",
        detail: { title: title.trim() },
      });
      setTitle("");
      show("アルバムを作成しました", "success");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <AdminShell
      event={event}
      title="アルバム管理"
      description="後日ゲストへ共有するアルバムを作成・公開します"
    >
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          {albums.length === 0 ? (
            <EmptyState title="アルバムがありません" description="右のフォームから作成してください。" />
          ) : (
            <ul className="space-y-4">
              {albums.map((album) => (
                <li key={album.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mincho text-[1.125rem] text-wine">{album.title}</p>
                        <p className="hint mt-1">
                          {album.description || "説明は未設定です"}
                        </p>
                      </div>
                      <span className="chip chip-primary">
                        {VISIBILITY_LABEL[album.visibility] ?? album.visibility}
                      </span>
                    </div>

                    <dl className="mt-4 grid gap-x-6 gap-y-2 text-[0.8125rem] sm:grid-cols-3">
                      <div className="flex gap-2">
                        <dt className="text-muted">掲載枚数</dt>
                        <dd>{counts[album.id] ?? 0}枚</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted">作成日</dt>
                        <dd>{formatDate(album.created_at)}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted">公開状態</dt>
                        <dd>
                          <StatusChip status={album.published_at ? "approved" : "pending"} />
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/albums/${album.id}`}
                        className="btn btn-primary min-h-[40px] px-4 text-[0.8125rem]"
                      >
                        写真を選ぶ / 並べ替え
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline min-h-[40px] px-4 text-[0.8125rem]"
                        onClick={() => {
                          void repo
                            .updateAlbum(album.id, {
                              published_at: album.published_at ? null : new Date().toISOString(),
                            })
                            .then(() => {
                              show(
                                album.published_at ? "非公開にしました" : "ゲストに公開しました",
                                "success",
                              );
                              return load();
                            });
                        }}
                      >
                        {album.published_at ? "非公開にする" : "ゲストに公開する"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost min-h-[40px] px-3 text-[0.8125rem]"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(`${window.location.origin}/album/${album.share_token}`)
                            .then(() => show("共有リンクをコピーしました", "success"));
                        }}
                      >
                        共有リンクをコピー
                      </button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <Card className="p-5">
            <p className="font-mincho text-[1.0625rem] text-wine">新しいアルバムを作成</p>
            <div className="mt-4">
              <Field label="アルバム名" required hint="例：2026.11.15 椙村・亘 結婚式">
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="アルバム名を入力"
                />
              </Field>
            </div>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              onClick={create}
              disabled={busy}
            >
              作成する
            </button>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-ink">公開範囲の考え方</p>
            <ul className="mt-2 space-y-1 text-[0.8125rem] text-muted">
              <li>・非公開：新郎新婦だけが確認する下書き状態</li>
              <li>・参加者のみ：当日のゲストがQRから閲覧できる</li>
              <li>・公開リンク：URLを知っている人だけが閲覧できる</li>
            </ul>
            <p className="hint mt-3">
              写真の保持期間は投稿から{event?.retention_days ?? 180}日です。期間内に
              ダウンロードして保管してください。
            </p>
          </Card>
        </section>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

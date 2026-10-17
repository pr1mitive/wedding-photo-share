"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BigAction, GuestHeading, GuestShell } from "@/components/guest-shell";
import { Card, Loading, Stat, Toast, useToast } from "@/components/ui";
import { useAsync, useEvent, useGuestSession, useRealtime, useRepo } from "@/lib/hooks";
import { formatTime, remainingLabel, relativeTime } from "@/lib/format";
import type { PostWithDemoAssets } from "@/lib/types";

/** G-02 投稿ホーム */
export default function GuestHomePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { event, loading, repo } = useEvent(slug);
  const { session } = useGuestSession(slug);
  const { toast, show } = useToast();

  const [recent, setRecent] = useState<PostWithDemoAssets[]>([]);

  const load = async () => {
    if (!event) return;
    const posts = await repo.listPosts(event.id, { statuses: ["approved"], limit: 8 });
    setRecent(posts);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  useRealtime(event?.id, () => void load());

  if (loading || !event) return <Loading />;

  const closing = new Date(event.ceremony_date);
  closing.setHours(23, 59, 59);

  return (
    <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="投稿ホーム">
      <GuestHeading
        title="写真を共有する"
        description={`${event.couple_names} の写真をみんなで集めています`}
      />

      <BigAction
        icon="◉"
        label="写真をとる / えらぶ"
        sublabel="1回で最大10枚まで"
        href={`/e/${slug}/camera`}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat
          label="今日の投稿"
          value={recent.filter((p) => Date.now() - new Date(p.posted_at).getTime() < 86400000).length}
          unit="枚組"
          tone="primary"
        />
        <Stat
          label="受付終了まで"
          value={remainingLabel(closing.toISOString())}
          hint="終了後も閲覧できます"
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-mincho text-[1.125rem] text-wine">みんなの新着</h2>
          <span className="hint">モニターに流れています</span>
        </div>

        {recent.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="hint">まだ投稿がありません。最初の1枚を共有しましょう。</p>
          </Card>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {recent.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  className="group block w-full text-left"
                  onClick={() => show(`${post.nickname_snapshot}：${post.comment || "コメントなし"}`)}
                >
                  <span className="relative block aspect-square overflow-hidden rounded-[10px] border border-line bg-line">
                    {post.assets[0]?.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.assets[0].thumbUrl}
                        alt={post.comment || "投稿写真"}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : null}
                    {post.assets.length > 1 ? (
                      <span className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                        +{post.assets.length - 1}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-[0.6875rem] text-muted">
                    {post.nickname_snapshot}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-mincho text-[1.125rem] text-wine">受付状況</h2>
        <Card className="divide-y divide-line">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[0.9375rem]">投稿の受付</span>
            <span className={event.accept_uploads ? "chip chip-success" : "chip chip-warning"}>
              {event.accept_uploads ? "受付中" : "終了"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[0.9375rem]">承認制</span>
            <span className="chip">
              {event.post_approval_required ? "管理者の承認後公開" : "投稿後すぐ公開"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[0.9375rem]">写真の保持</span>
            <span className="chip">{event.retention_days}日間</span>
          </div>
        </Card>
        <p className="hint mt-3">
          最終更新 {formatTime(new Date().toISOString())} ・{" "}
          {recent[0] ? `最新投稿 ${relativeTime(recent[0].posted_at)}` : "投稿待ち"}
        </p>
      </section>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </GuestShell>
  );
}

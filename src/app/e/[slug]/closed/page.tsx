"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { GuestShell } from "@/components/guest-shell";
import { Card, Loading } from "@/components/ui";
import { useEvent } from "@/lib/hooks";
import { formatDate } from "@/lib/format";

/** E-01 受付終了・期限切れ */
export default function GuestClosedPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { event, loading } = useEvent(slug);

  if (loading) return <Loading />;

  return (
    <GuestShell event={event} slug={slug!} title="受付終了" hideNav>
      <div className="flex flex-col items-center px-2 pt-10 text-center">
        <span
          aria-hidden
          className="flex size-20 items-center justify-center rounded-full bg-[#fbf4e4] text-[2rem] text-warning"
        >
          ⌛
        </span>
        <h1 className="mt-5 font-mincho text-[1.5rem] leading-snug text-wine">
          写真の受付は終了しました
        </h1>
        <p className="mt-2 text-[0.9375rem] text-muted">
          {event?.title ?? "このイベント"} への投稿受付が終了しました。
          <br />
          たくさんのご参加ありがとうございました。
        </p>

        <Card className="mt-7 w-full p-5 text-left">
          <p className="text-[0.875rem] font-semibold text-muted">まだできること</p>
          <ul className="mt-3 space-y-3 text-[0.9375rem]">
            <li className="flex gap-3">
              <span aria-hidden className="text-primary">
                ▤
              </span>
              これまでに投稿された写真は、引き続きアルバムで閲覧できます。
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-primary">
                ◍
              </span>
              ご自身の投稿は「自分の投稿」から確認・削除依頼ができます。
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-primary">
                ✉
              </span>
              新郎新婦による後日アルバムの共有をお待ちください。
            </li>
          </ul>
        </Card>

        <div className="mt-7 w-full space-y-3">
          <Link href={`/e/${slug}/album`} className="btn btn-primary w-full">
            アルバムを見る
          </Link>
          <Link href={`/e/${slug}/mine`} className="btn btn-outline w-full text-[0.9375rem]">
            自分の投稿を確認する
          </Link>
        </div>

        {event ? (
          <p className="hint mt-8">
            {event.couple_names} ・ {formatDate(event.ceremony_date)}
            <br />
            写真は投稿から{event.retention_days}日後に自動削除されます。
          </p>
        ) : null}
      </div>
    </GuestShell>
  );
}

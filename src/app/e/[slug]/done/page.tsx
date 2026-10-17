"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { GuestShell } from "@/components/guest-shell";
import { Card } from "@/components/ui";
import { useEvent, useGuestSession } from "@/lib/hooks";

/** G-05 投稿完了 */
export default function GuestDonePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const search = useSearchParams();
  const { event } = useEvent(slug);
  const { session } = useGuestSession(slug);

  const count = Number(search.get("count") ?? "1");
  const status = search.get("status") ?? "approved";
  const pending = status === "pending";

  return (
    <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="投稿完了" hideNav>
      <div className="flex flex-col items-center px-2 pt-8 text-center">
        <span
          aria-hidden
          className="flex size-20 items-center justify-center rounded-full bg-primary-soft text-[2.25rem] text-primary"
        >
          ✓
        </span>
        <h1 className="mt-5 font-mincho text-[1.5rem] leading-snug text-wine">
          投稿が完了しました
        </h1>
        <p className="mt-2 text-[0.9375rem] text-muted">
          {count}枚の写真を受け付けました。
        </p>

        <Card className="mt-6 w-full p-5 text-left">
          <p className="text-[0.875rem] font-semibold text-muted">つぎに起きること</p>
          <ul className="mt-3 space-y-3 text-[0.9375rem]">
            <li className="flex gap-3">
              <span aria-hidden className="text-primary">
                1
              </span>
              {pending
                ? "管理者が確認したあと、会場モニターに表示されます。"
                : "数秒以内に会場モニターに表示されます。順番に流れていきます。"}
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-primary">
                2
              </span>
              アルバムにも自動で追加され、ほかのゲストも見られるようになります。
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-primary">
                3
              </span>
              自分が投稿した写真は「自分の投稿」から確認できます。
            </li>
          </ul>
        </Card>

        <div className="mt-7 w-full space-y-3">
          <Link href={`/e/${slug}/home`} className="btn btn-primary w-full">
            続けて写真を投稿する
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/e/${slug}/album`} className="btn btn-outline w-full text-[0.9375rem]">
              アルバムを見る
            </Link>
            <Link href={`/e/${slug}/mine`} className="btn btn-outline w-full text-[0.9375rem]">
              自分の投稿
            </Link>
          </div>
        </div>

        <p className="hint mt-6">
          この画面を閉じても、同じ端末であれば「自分の投稿」から履歴を確認できます。
        </p>
      </div>
    </GuestShell>
  );
}

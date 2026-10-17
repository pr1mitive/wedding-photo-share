"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRepo } from "@/lib/hooks";
import type { EventRow } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui";

/**
 * デモ入口。実際の運用ではこのページは使わず、
 * ゲストは配布したQRコードから /e/[slug] を直接開く。
 */
export default function LandingPage() {
  const repo = useRepo();
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    void repo.listEvents().then(setEvents);
  }, [repo]);

  const event = events[0];

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-12">
      <p className="text-[0.8125rem] font-semibold tracking-[0.18em] text-primary">
        WEDDING PHOTO SHARE
      </p>
      <h1 className="mt-2 font-mincho text-[2rem] leading-tight text-wine">
        結婚式の写真を、その場でみんなのものに。
      </h1>
      <p className="mt-3 max-w-[46ch] text-[0.9375rem] text-muted">
        QRコードからアクセス、アプリ不要・ログイン不要。投稿した写真は会場モニターに流れ、
        後日アルバムとしてまとまります。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="chip chip-primary">ゲスト</p>
          <p className="mt-3 font-mincho text-[1.0625rem] text-wine">スマホ画面</p>
          <p className="hint mt-1">利用同意 → 投稿 → アルバム（全8画面）</p>
          {event ? (
            <Link
              href={`/e/${event.slug}`}
              className="btn btn-primary mt-4 w-full text-[0.9375rem]"
            >
              QRを読み取った状態で開く
            </Link>
          ) : null}
        </Card>

        <Card className="p-5">
          <p className="chip chip-primary">会場モニター</p>
          <p className="mt-3 font-mincho text-[1.0625rem] text-wine">
            プロジェクター / 大型TV
          </p>
          <p className="hint mt-1">背景スライドショー・大型表示（全4画面）</p>
          <Link
            href="/monitor/MON-A1"
            className="btn btn-outline mt-4 w-full text-[0.9375rem]"
          >
            モニター画面を開く
          </Link>
        </Card>

        <Card className="p-5">
          <p className="chip chip-primary">管理者</p>
          <p className="mt-3 font-mincho text-[1.0625rem] text-wine">PC / スマホ</p>
          <p className="hint mt-1">投稿管理・モニター操作・アルバム編集（全11画面）</p>
          <Link
            href="/admin/login"
            className="btn btn-outline mt-4 w-full text-[0.9375rem]"
          >
            管理画面へ
          </Link>
        </Card>
      </div>

      {event ? (
        <Card className="mt-8 p-5">
          <p className="text-[0.8125rem] font-semibold text-muted">デモイベント</p>
          <p className="mt-1 font-mincho text-[1.125rem] text-wine">{event.title}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-[0.875rem] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted">新郎新婦</dt>
              <dd>{event.couple_names}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">挙式日</dt>
              <dd>{formatDate(event.ceremony_date)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">会場</dt>
              <dd className="truncate">{event.venue_name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">参加コード</dt>
              <dd className="font-mono font-semibold">{event.join_code}</dd>
            </div>
          </dl>
        </Card>
      ) : null}
    </div>
  );
}

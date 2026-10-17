"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { EventRow, PostWithDemoAssets } from "@/lib/types";

/* ============================================================
   モニター描画（M-01〜M-04）
   px を一切使わず vh / % のみで構成する。
   上下左右5%セーフエリア、投稿者名4.5vh、コメント3.2vh。
   ============================================================ */

export type StageMode = "idle" | "large" | "background" | "mosaic";

export function MonitorStage({
  mode,
  event,
  current,
  zoomed,
  backgroundPool,
  wallPool,
  announce,
  settings,
  clock,
}: {
  mode: StageMode;
  event: EventRow | null;
  current: PostWithDemoAssets | null;
  zoomed: boolean;
  backgroundPool: PostWithDemoAssets[];
  /** 写真の壁に流す写真（新着は前景に出るため除かれる） */
  wallPool: PostWithDemoAssets[];
  /** 新着投稿のお知らせ（数秒だけ表示） */
  announce: string | null;
  settings: {
    show_nickname: boolean;
    show_comment: boolean;
    safe_area_percent: number;
    background_seconds: number;
    featured_seconds?: number;
    wall_tile_vh?: number;
    wall_speed_seconds?: number;
  };
  clock: Date;
}) {
  const safeInset = `${settings.safe_area_percent}%`;
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    if (mode !== "background" || backgroundPool.length === 0) return;
    // 切替間隔は管理画面の設定（background_seconds）に従う。
    // 以前は 8000ms 固定で、設定を変えても反映されなかった。
    const timer = setInterval(
      () => setBgIndex((i) => (i + 1) % backgroundPool.length),
      Math.max(settings.background_seconds, 2) * 1000,
    );
    return () => clearInterval(timer);
  }, [mode, backgroundPool.length, settings.background_seconds]);

  const bgPost = useMemo(
    () => backgroundPool[bgIndex] ?? backgroundPool[0] ?? null,
    [backgroundPool, bgIndex],
  );

  /* 写真の壁：3列に振り分け、継ぎ目のないループのため各列を2回繰り返す。
     並びは写真の集合が変わったときだけ作り直す。3秒ごとの再取得のたびに
     並びが変わると、壁がちらついて落ち着かないため。 */
  const wallColumns = useMemo(() => {
    const pool = wallPool.filter(
      (p) => p.id !== current?.id && p.assets[0]?.thumbUrl,
    );
    if (pool.length < 3) return [] as PostWithDemoAssets[][];
    const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1));
    const cols: PostWithDemoAssets[][] = [[], [], []];
    sorted.forEach((p, i) => cols[i % 3].push(p));
    // 1列分の高さが画面より低いと、流れる途中で隙間ができる。
    // 写真が少ないうちは同じ写真を繰り返して埋め、継ぎ目を出さない。
    const MIN_PER_SET = 6;
    return cols.map((c) => {
      if (c.length === 0) return [];
      const filled: PostWithDemoAssets[] = [];
      while (filled.length < MIN_PER_SET) filled.push(...c);
      return [...filled, ...filled];
    });
  }, [wallPool, current?.id]);

  // 流れる速さは管理画面の設定から決める。列ごとに少し変えて、
  // 全体が一枚板に見えないようにする。
  const wallBase = Math.max(settings.wall_speed_seconds ?? 180, 30);
  const wallDurations = [
    `${wallBase}s`,
    `${Math.round(wallBase * 1.25)}s`,
    `${Math.round(wallBase * 0.83)}s`,
  ];
  const wallTileVh = settings.wall_tile_vh ?? 30;

  const clockText = `${String(clock.getHours()).padStart(2, "0")}:${String(
    clock.getMinutes(),
  ).padStart(2, "0")}`;

  /* ---- M-04 待機画面 ---- */
  if (mode === "idle") {
    return (
      <div className="monitor-root">
        <div
          className="monitor-safe flex flex-col items-center justify-center text-center"
          style={{ inset: safeInset }}
        >
          <p
            className="font-mincho tracking-[0.32em] text-white/55"
            style={{ fontSize: "2.2vh" }}
          >
            WEDDING PHOTO SHARE
          </p>
          <h1
            className="mt-4 font-mincho leading-tight"
            style={{ fontSize: "7.4vh" }}
          >
            {event?.couple_names ?? "Wedding"}
          </h1>
          <p className="mt-3 text-white/65" style={{ fontSize: "2.6vh" }}>
            {event?.venue_name ?? ""}
          </p>

          <div
            className="mt-8 flex items-center gap-4 rounded-full border border-white/12 bg-white/5"
            style={{ padding: "2.2vh 4vh" }}
          >
            <span
              className="font-mincho text-white/85"
              style={{ fontSize: "4.6vh", lineHeight: 1 }}
            >
              {clockText}
            </span>
            <span className="text-white/35" style={{ fontSize: "2.4vh" }}>
              受付中
            </span>
          </div>

          <div
            className="mt-10 flex items-center gap-3 rounded-[1.6vh] bg-primary"
            style={{ padding: "2vh 3.4vh" }}
          >
            <span style={{ fontSize: "3.4vh" }} aria-hidden>
              ◉
            </span>
            <span className="font-mincho" style={{ fontSize: "3.2vh" }}>
              写真を撮ったら、その場で共有しよう
            </span>
          </div>

          <p className="mt-6 text-white/45" style={{ fontSize: "2.1vh" }}>
            QRコードを読み取って、ニックネームだけで参加できます
          </p>
        </div>
      </div>
    );
  }

  /* ---- M-01 背景スライドショー ---- */
  if (mode === "background") {
    return (
      <div className="monitor-root">
        {bgPost?.assets[0]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={bgPost.id}
            src={bgPost.assets[0].url}
            alt=""
            className="absolute inset-0 size-full object-cover animate-kenburns"
            style={{ animationDuration: `${settings.background_seconds}s` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/45 to-black/25" />

        <div
          className="monitor-safe flex flex-col justify-end"
          style={{ inset: safeInset }}
        >
          <div className="flex items-end justify-between gap-[3%]">
            <div className="min-w-0 flex-1 animate-fade-up">
              <span
                className="inline-block rounded-full bg-primary font-semibold"
                style={{ fontSize: "1.9vh", padding: "0.8vh 2vh" }}
              >
                最新の投稿
              </span>
              {settings.show_nickname ? (
                <p
                  className="mt-3 font-mincho leading-tight"
                  style={{ fontSize: "4.5vh" }}
                >
                  {bgPost?.nickname_snapshot ?? ""}
                </p>
              ) : null}
              {settings.show_comment && bgPost?.comment ? (
                <p
                  className="mt-2 text-white/88"
                  style={{ fontSize: "3.2vh", lineHeight: 1.45 }}
                >
                  {bgPost.comment}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <p
                className="font-mincho leading-none text-white/90"
                style={{ fontSize: "5.6vh" }}
              >
                {clockText}
              </p>
              <p className="mt-2 text-white/50" style={{ fontSize: "1.9vh" }}>
                {event?.title ?? ""}
              </p>
            </div>
          </div>

          <div
            className="mt-[3vh] h-[0.35vh] w-full overflow-hidden rounded-full bg-white/18"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${((bgIndex + 1) / Math.max(backgroundPool.length, 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ---- ライブ表示：写真の壁。新着がある間だけ前景に大きく出す ---- */
  if (mode === "mosaic") {
    const featuredAsset = current?.assets[0];

    const wall = (
      <div className="absolute inset-0 flex gap-[0.5%]" aria-hidden>
        {wallColumns.map((col, ci) => (
          <div key={ci} className="relative h-full flex-1 overflow-hidden">
            <div
              className={clsx(
                "wall-track flex flex-col gap-[0.7vh]",
                ci === 1 && "wall-track-reverse",
              )}
              style={{ animationDuration: wallDurations[ci] }}
            >
              {col.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${p.id}-${i}`}
                  src={p.assets[0]?.thumbUrl}
                  alt=""
                  className="w-full shrink-0 rounded-[0.6vh] object-cover"
                  style={{ height: `${wallTileVh}vh` }}
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );

    const announceBadge = announce ? (
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "6.5vh" }}>
        <span
          className="animate-fade-up inline-block rounded-full bg-primary font-semibold shadow-2xl"
          style={{ fontSize: "2.6vh", padding: "1.4vh 3.4vh" }}
        >
          {announce}
        </span>
      </div>
    ) : null;

    /* 新着なし：壁だけを全面に流す（大きな表示は一定時間で閉じる） */
    if (!featuredAsset) {
      return (
        <div className="monitor-root">
          {wall}
          {/* 全面の壁は明るく騒がしくなるため、薄く落として
             時計とイベント名を読めるようにする */}
          <div className="absolute inset-0 bg-black/28" />
          <div className="absolute inset-x-0 bottom-0 h-[36vh] bg-gradient-to-t from-black/90 to-transparent" />

          <div
            className="monitor-safe flex items-end justify-between"
            style={{ inset: safeInset }}
          >
            <p className="font-mincho text-white/75" style={{ fontSize: "2.6vh" }}>
              {event?.title ?? ""}
            </p>
            <p
              className="font-mincho leading-none text-white/90"
              style={{ fontSize: "5.6vh" }}
            >
              {clockText}
            </p>
          </div>

          {announceBadge}
        </div>
      );
    }

    /* 新着あり：壁を暗く落として、前景に大きく見せる */
    return (
      <div className="monitor-root">
        <div className="opacity-[0.40]">{wall}</div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(14,11,13,0.62)_0%,rgba(14,11,13,0.94)_76%)]" />

        <div
          className="monitor-safe flex items-center gap-[3%]"
          style={{ inset: safeInset }}
        >
          <div className="relative h-full w-[58%] overflow-hidden rounded-[1.4vh] bg-black/40 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={featuredAsset.id}
              src={featuredAsset.url}
              alt=""
              className="size-full animate-pop-in object-cover"
            />
            <span
              className="absolute rounded-full bg-primary font-semibold"
              style={{ fontSize: "1.9vh", padding: "0.8vh 2vh", left: "2vh", top: "2vh" }}
            >
              新着
            </span>
          </div>

          <div className="min-w-0 flex-1 animate-fade-up">
            {settings.show_nickname ? (
              <p className="font-mincho leading-tight" style={{ fontSize: "4.5vh" }}>
                {current?.nickname_snapshot ?? ""}
              </p>
            ) : null}
            {settings.show_comment && current?.comment ? (
              <p
                className="mt-3 text-white/88"
                style={{ fontSize: "3.2vh", lineHeight: 1.45 }}
              >
                {current.comment}
              </p>
            ) : null}
            <p
              className="mt-6 font-mincho leading-none text-white/85"
              style={{ fontSize: "5.6vh" }}
            >
              {clockText}
            </p>
            <p className="mt-2 text-white/45" style={{ fontSize: "1.9vh" }}>
              {event?.title ?? ""}
            </p>
          </div>
        </div>

        {announceBadge}
      </div>
    );
  }

  /* ---- M-02 大型表示 / M-03 拡大表示 ---- */
  const asset = current?.assets[0];
  const multiple = (current?.assets.length ?? 0) > 1;

  return (
    <div className="monitor-root">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,#1b1418_0%,#0e0b0d_72%)]" />

      <div
        className={clsx(
          "monitor-safe flex",
          zoomed ? "flex-col" : "flex-row items-center gap-[3%]",
        )}
        style={{ inset: safeInset }}
      >
        <div
          className={clsx(
            "relative overflow-hidden rounded-[1.4vh] bg-black/40 shadow-2xl",
            zoomed ? "flex-1" : "h-full w-[62%]",
          )}
        >
          {asset?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={asset.id}
              src={asset.url}
              alt=""
              className={clsx(
                "size-full animate-pop-in",
                zoomed ? "object-contain" : "object-cover",
              )}
            />
          ) : null}
          {multiple ? (
            <span
              className="absolute rounded-full bg-black/65 font-semibold text-white"
              style={{ fontSize: "1.9vh", padding: "0.7vh 1.8vh", right: "2vh", top: "2vh" }}
            >
              {current?.assets.length}枚のうち1枚
            </span>
          ) : null}
        </div>

        <div className={clsx(zoomed ? "mt-[3vh]" : "flex-1", "animate-fade-up")}>
          {settings.show_nickname ? (
            <>
              <p
                className="text-primary"
                style={{ fontSize: "2.1vh", letterSpacing: "0.24em" }}
              >
                PHOTO BY
              </p>
              <p
                className="mt-2 font-mincho leading-tight"
                style={{ fontSize: zoomed ? "4.6vh" : "5.2vh" }}
              >
                {current?.nickname_snapshot ?? ""}
              </p>
            </>
          ) : null}

          {settings.show_comment && current?.comment ? (
            <p
              className="mt-[2.4vh] text-white/90"
              style={{
                fontSize: zoomed ? "3.4vh" : "3.6vh",
                lineHeight: 1.5,
                maxWidth: zoomed ? "100%" : "26ch",
              }}
            >
              {current.comment}
            </p>
          ) : null}

          <div
            className="mt-[4vh] flex items-center gap-[2%] text-white/45"
            style={{ fontSize: "1.9vh" }}
          >
            <span>{event?.title ?? ""}</span>
            <span aria-hidden>・</span>
            <span>{clockText}</span>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[0.4vh] bg-white/10"
        aria-hidden
      >
        <div className="h-full w-1/3 animate-[pulse_2s_ease-in-out_infinite] bg-primary" />
      </div>
    </div>
  );
}

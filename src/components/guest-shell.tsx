"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { EventRow } from "@/lib/types";

/* ============================================================
   ゲスト用シェル（G-02 以降の共通レイアウト）
   スマホ 390×844 を基準に、最大幅 430px で中央寄せする。
   下部ナビはタップ領域 56px を確保する。
   ============================================================ */

const NAV = [
  { href: "home", label: "投稿", icon: "＋" },
  { href: "album", label: "アルバム", icon: "▤" },
  { href: "mine", label: "自分の投稿", icon: "◍" },
];

export function GuestShell({
  event,
  slug,
  nickname,
  children,
  title,
  hideNav,
}: {
  event: EventRow | null;
  slug: string;
  nickname?: string;
  children: ReactNode;
  title?: string;
  hideNav?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-mincho text-[1.0625rem] leading-tight text-wine">
              {event?.title ?? "結婚式フォトシェア"}
            </p>
            <p className="truncate text-[0.75rem] text-muted">
              {title ?? event?.couple_names ?? ""}
            </p>
          </div>
          {nickname ? (
            <span className="chip chip-primary shrink-0" title="この端末のニックネーム">
              {nickname}
            </span>
          ) : null}
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      {hideNav ? null : (
        <nav
          aria-label="ゲストメニュー"
          className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-white/97 backdrop-blur"
        >
          <ul className="grid grid-cols-3">
            {NAV.map((item) => {
              const href = `/e/${slug}/${item.href}`;
              const active = pathname === href;
              return (
                <li key={item.href}>
                  <Link
                    href={href}
                    className={clsx(
                      "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold",
                      active ? "text-primary" : "text-muted",
                    )}
                  >
                    <span aria-hidden className="text-[1.125rem] leading-none">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      )}
    </div>
  );
}

/** ゲスト画面のセクション見出し */
export function GuestHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <h1 className="font-mincho text-[1.375rem] leading-snug text-wine">{title}</h1>
      {description ? <p className="hint mt-1">{description}</p> : null}
    </div>
  );
}

/** 大きな丸ボタン（G-02 の撮影ボタン等） */
export function BigAction({
  label,
  sublabel,
  icon,
  onClick,
  disabled,
  href,
}: {
  label: string;
  sublabel?: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <span aria-hidden className="text-[1.75rem] leading-none">
        {icon}
      </span>
      <span className="font-mincho text-[1.125rem]">{label}</span>
      {sublabel ? (
        <span className="text-[0.75rem] font-normal opacity-80">{sublabel}</span>
      ) : null}
    </>
  );
  const cls =
    "flex w-full min-h-[132px] flex-col items-center justify-center gap-2 rounded-[14px] bg-primary text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-45";

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

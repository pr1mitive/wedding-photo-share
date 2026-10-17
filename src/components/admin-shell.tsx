"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { clearAdminSession, loadAdminSession } from "@/lib/session";
import type { EventRow } from "@/lib/types";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/admin", label: "ダッシュボード", icon: "◫" },
  { href: "/admin/photos", label: "写真一覧", icon: "▦" },
  { href: "/admin/monitor", label: "モニター操作", icon: "▶" },
  { href: "/admin/monitor/settings", label: "モニター設定", icon: "⚙" },
  { href: "/admin/albums", label: "アルバム管理", icon: "▤" },
  { href: "/admin/settings", label: "イベント設定 / QR", icon: "▣" },
  { href: "/admin/guests", label: "ゲスト管理", icon: "◍" },
  { href: "/admin/audit", label: "監査ログ / 統計", icon: "≡" },
];

export function AdminShell({
  event,
  title,
  description,
  actions,
  children,
}: {
  event: EventRow | null;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const session = loadAdminSession();
    if (!session) router.replace("/admin/login");
  }, [router]);

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="border-b border-line px-5 py-4">
          <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-primary">
            ADMIN CONSOLE
          </p>
          <p className="mt-1 truncate font-mincho text-[1rem] text-wine">
            {event?.title ?? "イベント"}
          </p>
        </div>
        <nav aria-label="管理メニュー" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 text-[0.9375rem] font-semibold transition-colors",
                      active
                        ? "bg-primary-soft text-primary-dark"
                        : "text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    <span aria-hidden className="w-4 text-center">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line p-3">
          <Link
            href="/monitor/MON-A1"
            className="btn btn-outline w-full text-[0.8125rem]"
            target="_blank"
          >
            モニターを別窓で開く
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <h1 className="truncate font-mincho text-[1.25rem] leading-tight text-wine">
                {title}
              </h1>
              {description ? <p className="hint truncate">{description}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <span className="chip chip-primary hidden sm:inline-flex">
                {loadAdminSession()?.email ?? ""}
              </span>
              <button
                type="button"
                className="btn btn-ghost min-h-[40px] px-3 text-[0.8125rem]"
                onClick={() => {
                  clearAdminSession();
                  router.replace("/admin/login");
                }}
              >
                ログアウト
              </button>
            </div>
          </div>
          <nav aria-label="管理メニュー(モバイル)" className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "chip shrink-0",
                  pathname === item.href ? "chip-primary" : "",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-5 py-6">{children}</main>
      </div>
    </div>
  );
}

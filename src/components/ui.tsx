"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/* ============================================================
   共通UI部品（画面デザイン案 S-00 の実装）
   ・タップ領域48px以上
   ・本文16px下限
   ・見出しは明朝 / 本文はゴシック
   ============================================================ */

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={clsx("card", className)}>{children}</Tag>;
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[1.25rem] leading-tight text-wine">{title}</h2>
        {description ? <p className="hint mt-1">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="hint mt-1 block">{hint}</span> : null}
      {error ? (
        <span className="mt-1 block text-[0.8125rem] font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "default" | "primary" | "warning" | "success";
  hint?: string;
}) {
  const toneClass = {
    default: "text-ink",
    primary: "text-primary",
    warning: "text-warning",
    success: "text-success",
  }[tone];
  return (
    <Card className="p-4">
      <p className="text-[0.8125rem] font-semibold text-muted">{label}</p>
      <p className={clsx("mt-1 font-mincho text-[1.75rem] leading-none", toneClass)}>
        {value}
        {unit ? (
          <span className="ml-1 font-sans text-[0.8125rem] font-semibold text-muted">
            {unit}
          </span>
        ) : null}
      </p>
      {hint ? <p className="hint mt-2">{hint}</p> : null}
    </Card>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "公開", cls: "chip-success" },
    pending: { label: "承認待ち", cls: "chip-warning" },
    hidden: { label: "非表示", cls: "chip-danger" },
    deleted: { label: "削除済み", cls: "chip" },
    open: { label: "受付中", cls: "chip-success" },
    closed: { label: "受付終了", cls: "chip-warning" },
    draft: { label: "下書き", cls: "chip" },
    archived: { label: "保管", cls: "chip" },
    queued: { label: "待機中", cls: "chip-primary" },
    playing: { label: "再生中", cls: "chip-success" },
    done: { label: "再生済み", cls: "chip" },
    skipped: { label: "スキップ", cls: "chip" },
    online: { label: "接続中", cls: "chip-success" },
    offline: { label: "未接続", cls: "chip-danger" },
  };
  const entry = map[status] ?? { label: status, cls: "chip" };
  return <span className={clsx("chip", entry.cls)}>{entry.label}</span>;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "✳",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <span aria-hidden className="text-[1.75rem] text-primary/40">
        {icon}
      </span>
      <p className="font-mincho text-[1.0625rem] text-wine">{title}</p>
      {description ? <p className="hint max-w-sm">{description}</p> : null}
      {action}
    </div>
  );
}

export function Toast({
  message,
  tone = "default",
}: {
  message: string | null;
  tone?: "default" | "success" | "danger";
}) {
  if (!message) return null;
  const cls = {
    default: "bg-wine text-white",
    success: "bg-success text-white",
    danger: "bg-danger text-white",
  }[tone];
  return (
    <div
      role="status"
      className={clsx(
        "fixed bottom-[6.5rem] left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-[0.9375rem] font-semibold shadow-lg",
        cls,
      )}
    >
      {message}
    </div>
  );
}

/** 一定時間で消えるトーストを扱うフック */
export function useToast(duration = 2600) {
  const [toast, setToast] = useState<{ message: string; tone: "default" | "success" | "danger" } | null>(
    null,
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast, duration]);
  return {
    toast,
    show: (message: string, tone: "default" | "success" | "danger" = "default") =>
      setToast({ message, tone }),
  };
}

export function Loading({ label = "読み込み中…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="inline-block size-5 animate-spin rounded-full border-2 border-line border-t-primary" />
      <span className="text-[0.9375rem]">{label}</span>
    </div>
  );
}

export function BackLink({ href, label = "戻る" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[48px] items-center gap-1 text-[0.9375rem] font-semibold text-muted hover:text-primary"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}

/** 進行状況バー（アップロード等） */
export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-[0.9375rem] font-semibold text-ink">{label}</p>
        {description ? <p className="hint mt-0.5">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition-colors",
          checked ? "border-primary bg-primary" : "border-line bg-line",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

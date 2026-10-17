"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AdminShell } from "@/components/admin-shell";
import { Card, Field, Loading, SectionTitle, Toast, Toggle, useToast } from "@/components/ui";
import { APP_ORIGIN } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { useRepo } from "@/lib/hooks";
import type { EventRow } from "@/lib/types";

/** A-09 管理 イベント設定とQR発行 */
export default function AdminEventSettingsPage() {
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    setEvent(events[0] ?? null);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  const joinUrl = event ? `${APP_ORIGIN}/e/${event.slug}` : "";

  useEffect(() => {
    if (!joinUrl) return;
    void QRCode.toDataURL(joinUrl, {
      width: 512,
      margin: 1,
      color: { dark: "#38182A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then(setQr);
  }, [joinUrl]);

  async function save() {
    if (!event) return;
    setBusy(true);
    try {
      await repo.updateEvent(event.id, {
        title: event.title,
        couple_names: event.couple_names,
        venue_name: event.venue_name,
        ceremony_date: event.ceremony_date,
        welcome_message: event.welcome_message,
        status: event.status,
        accept_uploads: event.accept_uploads,
        post_approval_required: event.post_approval_required,
        retention_days: event.retention_days,
        keep_originals: event.keep_originals,
      });
      await repo.log({
        eventId: event.id,
        actorType: "admin",
        actorId: null,
        actorLabel: "管理者",
        action: "event.update",
        targetType: "event",
        targetId: event.id,
      });
      show("設定を保存しました", "success");
    } catch (e) {
      show(e instanceof Error ? e.message : "保存に失敗しました", "danger");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !event) return <Loading />;

  return (
    <AdminShell
      event={event}
      title="イベント設定 / QRコード"
      description="当日ゲストに案内するQRコードと投稿ルールを設定します"
      actions={
        <button
          type="button"
          className="btn btn-primary min-h-[40px] px-4 text-[0.8125rem]"
          onClick={save}
          disabled={busy}
        >
          {busy ? "保存中…" : "変更を保存"}
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle title="イベント情報" />
          <Card className="space-y-4 p-5">
            <Field label="イベント名" required>
              <input
                className="input"
                value={event.title}
                onChange={(e) => setEvent({ ...event, title: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="新郎新婦">
                <input
                  className="input"
                  value={event.couple_names}
                  onChange={(e) => setEvent({ ...event, couple_names: e.target.value })}
                />
              </Field>
              <Field label="挙式日">
                <input
                  className="input"
                  type="date"
                  value={event.ceremony_date}
                  onChange={(e) => setEvent({ ...event, ceremony_date: e.target.value })}
                />
              </Field>
            </div>
            <Field label="会場">
              <input
                className="input"
                value={event.venue_name}
                onChange={(e) => setEvent({ ...event, venue_name: e.target.value })}
              />
            </Field>
            <Field label="ゲスト向けメッセージ" hint="G-01 の同意画面に表示されます">
              <textarea
                className="input min-h-[96px] resize-none"
                value={event.welcome_message}
                onChange={(e) => setEvent({ ...event, welcome_message: e.target.value })}
              />
            </Field>
          </Card>

          <SectionTitle title="投稿ルール" />
          <Card className="divide-y divide-line p-5">
            <Toggle
              checked={event.accept_uploads}
              label="写真の投稿を受け付ける"
              description="オフにするとゲストは E-01 受付終了画面を表示します"
              onChange={(next) => setEvent({ ...event, accept_uploads: next })}
            />
            <Toggle
              checked={event.post_approval_required}
              label="投稿を承認制にする"
              description="オンにすると管理者が承認するまで公開されません"
              onChange={(next) => setEvent({ ...event, post_approval_required: next })}
            />
            <Toggle
              checked={event.keep_originals}
              label="原本データを保管する"
              description="後日アルバム用に高解像度の原本を保持します（容量は約3〜5倍）"
              onChange={(next) => setEvent({ ...event, keep_originals: next })}
            />
            <div className="pt-4">
              <Field
                label={`写真の保持期間：${event.retention_days}日`}
                hint="要件：180日を既定としています"
              >
                <input
                  type="range"
                  min={30}
                  max={365}
                  step={30}
                  value={event.retention_days}
                  className="w-full accent-[#9C2B4E]"
                  onChange={(e) =>
                    setEvent({ ...event, retention_days: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle title="ゲスト用QRコード" description="受付で配布・テーブルに設置" />
          <Card className="p-5 text-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="ゲスト用QRコード"
                className="mx-auto size-[240px] rounded-[12px] border border-line"
              />
            ) : (
              <div className="mx-auto size-[240px] animate-pulse rounded-[12px] bg-line" />
            )}
            <p className="mt-4 font-mincho text-[1.125rem] text-wine">{event.title}</p>
            <p className="hint mt-1">{event.couple_names}</p>
            <p className="hint mt-3 break-all font-mono text-[0.75rem]">{joinUrl}</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn btn-outline text-[0.8125rem]"
                onClick={() => {
                  void navigator.clipboard?.writeText(joinUrl);
                  show("URLをコピーしました", "success");
                }}
              >
                URLをコピー
              </button>
              <button
                type="button"
                className="btn btn-outline text-[0.8125rem]"
                onClick={() => {
                  if (!qr) return;
                  const a = document.createElement("a");
                  a.href = qr;
                  a.download = `qr-${event.slug}.png`;
                  a.click();
                }}
              >
                QRを保存
              </button>
            </div>

            <p className="hint mt-4">
              参加コード <span className="font-mono font-semibold">{event.join_code}</span>
              <br />
              QRが読み取れない場合はこのコードを案内してください。
            </p>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-ink">当日の案内文（例）</p>
            <p className="mt-2 rounded-[8px] bg-surface p-3 text-[0.8125rem] leading-relaxed text-muted">
              お手元のQRコードから、本日の写真をぜひ共有してください。アプリの
              インストールは不要です。撮影した写真は会場のスクリーンに映ります。
            </p>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-[0.8125rem] font-semibold text-ink">スケジュール</p>
            <p className="hint mt-2">
              挙式日 {formatDate(event.ceremony_date)}
              <br />
              投稿受付：当日 〜 翌日 23:59（終了後に自動で受付停止）
              <br />
              アルバム共有：挙式日から7日後を目安に通知
            </p>
          </Card>
        </section>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

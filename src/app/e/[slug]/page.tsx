"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CONSENT_VERSION } from "@/lib/config";
import { useEvent, useGuestSession, useRepo } from "@/lib/hooks";
import { nicknameOrDefault, newId } from "@/lib/ids";
import { markConsented } from "@/lib/session";
import { Card, Field, Loading, useToast, Toast } from "@/components/ui";

/** G-01 利用同意とニックネーム登録 */
export default function GuestConsentPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const router = useRouter();
  const { event, loading, error, repo } = useEvent(slug);
  const { session, ready, persist } = useGuestSession(slug);
  const { toast, show } = useToast();

  const [nickname, setNickname] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && session) setNickname(session.nickname);
  }, [ready, session]);

  useEffect(() => {
    if (!loading && event && !event.accept_uploads) {
      router.replace(`/e/${slug}/closed`);
    }
  }, [loading, event, router, slug]);

  async function submit() {
    if (!event) return;
    if (!agreed) {
      show("利用規約と写真の取り扱いへの同意が必要です", "danger");
      return;
    }
    setSubmitting(true);
    try {
      const deviceToken = session?.deviceToken ?? newId();
      const guest = await repo.registerGuest({
        eventId: event.id,
        nickname: nicknameOrDefault(nickname),
        deviceToken,
        consentVersion: CONSENT_VERSION,
      });
      await repo.log({
        eventId: event.id,
        actorType: "guest",
        actorId: guest.id,
        actorLabel: guest.nickname,
        action: "guest.consent",
        targetType: "guest",
        targetId: guest.id,
        detail: { consent_version: CONSENT_VERSION },
      });
      markConsented();
      persist({
        guestId: guest.id,
        eventId: event.id,
        slug: event.slug,
        nickname: guest.nickname,
        deviceToken,
        consentedAt: guest.consented_at,
      });
      router.push(`/e/${slug}/home`);
    } catch (e) {
      show(e instanceof Error ? e.message : "登録に失敗しました", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !ready) return <Loading />;

  if (error || !event) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-5 py-16">
        <Card className="p-6">
          <h1 className="font-mincho text-[1.25rem] text-wine">
            イベントが見つかりません
          </h1>
          <p className="hint mt-2">
            QRコードの読み取りに失敗したか、イベントが終了している可能性があります。
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[430px] bg-surface">
      {/* ヒーロー */}
      <div className="relative overflow-hidden bg-primary-soft px-5 pb-8 pt-12">
        <div
          aria-hidden
          className="absolute -top-24 left-0 size-[420px] rounded-full bg-primary/10 blur-3xl"
        />
        <p className="relative text-[0.75rem] font-semibold tracking-[0.2em] text-primary">
          PHOTO SHARE
        </p>
        <h1 className="relative mt-3 font-mincho text-[1.75rem] leading-snug text-wine">
          {event.couple_names}
        </h1>
        <p className="relative mt-2 text-[0.9375rem] text-muted">{event.venue_name}</p>
      </div>

      <div className="px-4 pb-12">
        <Card className="-mt-5 relative p-5">
          <p className="text-[0.9375rem] whitespace-pre-line text-ink">
            {event.welcome_message}
          </p>
        </Card>

        <div className="mt-6">
          <Field
            label="ニックネーム"
            required
            hint="写真に表示される名前です。本名でなくてかまいません（20文字以内）"
          >
            <input
              className="input"
              value={nickname}
              maxLength={20}
              placeholder="例：みさきの友人A"
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
            />
          </Field>
        </div>

        <Card className="mt-6 p-5">
          <h2 className="font-mincho text-[1.0625rem] text-wine">写真の取り扱いについて</h2>
          <ul className="mt-3 space-y-2 text-[0.875rem] leading-relaxed text-ink">
            <li className="flex gap-2">
              <span aria-hidden className="text-primary">
                ・
              </span>
              投稿された写真は、当日会場のモニターに表示されます。
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-primary">
                ・
              </span>
              後日、新郎新婦とゲストだけが閲覧できるアルバムに掲載されます。
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-primary">
                ・
              </span>
              投稿は{event.retention_days}日後に自動的に削除されます（{event.keep_originals ? "原本は新郎新婦が保管" : "原本も削除"}）。
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-primary">
                ・
              </span>
              自分が投稿した写真は、いつでも削除を依頼できます。
            </li>
          </ul>

          <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-line pt-4">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-[#9C2B4E]"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="text-[0.9375rem] font-semibold text-ink">
              上記に同意して参加します
            </span>
          </label>
        </Card>

        <button
          type="button"
          className="btn btn-primary mt-6 w-full"
          onClick={submit}
          disabled={submitting || !agreed}
        >
          {submitting ? "登録しています…" : "同意して参加する"}
        </button>
        <p className="hint mt-3 text-center">
          ログインは不要です。この端末だけに識別情報を保存します。
        </p>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </div>
  );
}

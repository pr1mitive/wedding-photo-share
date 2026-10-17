"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GuestHeading, GuestShell } from "@/components/guest-shell";
import { BackLink } from "@/components/ui";
import { Card, Progress, Toast, useToast } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import type { DraftFile } from "@/lib/hooks";
import { clearDraft, loadDraft, useEvent, useGuestSession, useRepo } from "@/lib/hooks";

/** G-04 投稿確認とコメント */
export default function GuestConfirmPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const router = useRouter();
  const repo = useRepo();
  const { event } = useEvent(slug);
  const { session } = useGuestSession(slug);
  const { toast, show } = useToast();

  const [files, setFiles] = useState<DraftFile[]>([]);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const draft = loadDraft();
    if (!draft || draft.files.length === 0) {
      router.replace(`/e/${slug}/camera`);
      return;
    }
    setFiles(draft.files);
    setComment(draft.comment);
  }, [router, slug]);

  useEffect(() => {
    if (!posting) return;
    const timer = setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : p + 7));
    }, 220);
    return () => clearInterval(timer);
  }, [posting]);

  async function submit() {
    if (!event || !session) {
      show("先に参加登録を済ませてください", "danger");
      return;
    }
    setPosting(true);
    setProgress(6);
    try {
      const post = await repo.createPost({
        eventId: event.id,
        guestId: session.guestId,
        deviceToken: session.deviceToken,
        nickname: session.nickname,
        comment: comment.trim().slice(0, 200),
        files,
      });
      await repo.log({
        eventId: event.id,
        actorType: "guest",
        actorId: session.guestId,
        actorLabel: session.nickname,
        action: "post.create",
        targetType: "post",
        targetId: post.id,
        detail: { assets: post.assets.length, status: post.status },
      });
      setProgress(100);
      clearDraft();
      const params = new URLSearchParams({
        id: post.id,
        status: post.status,
        count: String(post.assets.length),
      });
      router.push(`/e/${slug}/done?${params.toString()}`);
    } catch (e) {
      setPosting(false);
      show(e instanceof Error ? e.message : "投稿に失敗しました", "danger");
    }
  }

  const originalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  const uploadBytes = files.reduce(
    (sum, f) => sum + f.display.bytes + f.thumb.bytes,
    0,
  );

  return (
    <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="投稿の確認" hideNav>
      <BackLink href={`/e/${slug}/camera`} label="選び直す" />
      <GuestHeading
        title="この内容で投稿します"
        description="コメントは任意です。あとから削除を依頼できます。"
      />

      <section>
        <h2 className="mb-2 font-mincho text-[1.0625rem] text-wine">
          写真 {files.length}枚
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.thumb.dataUrl}
                alt={file.name}
                className="aspect-square w-full rounded-[10px] border border-line object-cover"
              />
            </li>
          ))}
        </ul>
        <p className="hint mt-2">
          原本 {formatBytes(originalBytes)} ・ 送信するデータ {formatBytes(uploadBytes)}
        </p>
      </section>

      <section className="mt-6">
        <label className="label" htmlFor="comment">
          コメント（任意・200文字まで）
        </label>
        <textarea
          id="comment"
          className="input min-h-[104px] resize-none"
          maxLength={200}
          placeholder="例：ケーキ入刀の瞬間です！"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <p className="hint mt-1 text-right">{comment.length}/200</p>
      </section>

      <Card className="mt-5 p-4">
        <p className="text-[0.875rem] font-semibold text-ink">投稿者として表示される名前</p>
        <p className="mt-1 font-mincho text-[1.125rem] text-primary">
          {session?.nickname ?? "-"}
        </p>
        <p className="hint mt-1">変更する場合は最初の画面から登録し直してください。</p>
      </Card>

      {files.some((f) => !f.originalRetained) ? (
        <p className="hint mt-4">
          端末の都合で原本を読み直せなかったため、表示用の画質で投稿します。
        </p>
      ) : null}

      {event?.post_approval_required ? (
        <p className="hint mt-4">
          このイベントは承認制です。管理者が確認したあとに公開されます。
        </p>
      ) : (
        <p className="hint mt-4">
          投稿するとすぐに会場モニターとアルバムに反映されます。
        </p>
      )}

      {posting ? (
        <div className="mt-5">
          <Progress value={progress} />
          <p className="hint mt-2 text-center">アップロードしています… {progress}%</p>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <BackLink href={`/e/${slug}/camera`} label="やめる" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={posting || files.length === 0}
        >
          {posting ? "投稿中…" : "この内容で投稿する"}
        </button>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </GuestShell>
  );
}

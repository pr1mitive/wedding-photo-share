"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { GuestHeading, GuestShell } from "@/components/guest-shell";
import { Card, Toast, useToast } from "@/components/ui";
import { MAX_FILES_PER_POST, MAX_UPLOAD_BYTES } from "@/lib/config";
import { formatBytes } from "@/lib/format";
import type { DraftFile } from "@/lib/hooks";
import { saveDraft, useEvent, useGuestSession } from "@/lib/hooks";
import { resizeMany } from "@/lib/image-resize";

type Picked = DraftFile;

/** G-03 カメラ撮影 / 写真選択 */
export default function GuestCameraPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const router = useRouter();
  const { event } = useEvent(slug);
  const { session } = useGuestSession(slug);
  const { toast, show } = useToast();

  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const room = MAX_FILES_PER_POST - picked.length;
    if (room <= 0) {
      show(`1回に選べるのは${MAX_FILES_PER_POST}枚までです`, "danger");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: Math.min(incoming.length, room) });

    // サムネイル・表示用を生成しつつ、種別と容量もここで検査する
    const { ok, failed } = await resizeMany(
      incoming.slice(0, room),
      (done, total) => setProgress({ done, total }),
    );

    setPicked((prev) => [
      ...prev,
      ...ok.map((photo) => ({ ...photo, originalRetained: true })),
    ]);
    setBusy(false);
    setProgress(null);

    for (const item of failed) show(`${item.name}：${item.reason}`, "danger");
    if (incoming.length > room) {
      show(`上限${MAX_FILES_PER_POST}枚のため、一部は追加していません`, "danger");
    }
  }

  function next() {
    if (picked.length === 0) {
      show("写真を1枚以上選んでください", "danger");
      return;
    }
    saveDraft({ files: picked, comment: "" });
    router.push(`/e/${slug}/confirm`);
  }

  return (
    <GuestShell event={event} slug={slug!} nickname={session?.nickname} title="写真をえらぶ">
      <GuestHeading
        title="写真をとる / えらぶ"
        description={`最大${MAX_FILES_PER_POST}枚・1枚${formatBytes(MAX_UPLOAD_BYTES)}まで`}
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn btn-primary min-h-[112px] flex-col gap-1"
          onClick={() => cameraRef.current?.click()}
        >
          <span aria-hidden className="text-[1.5rem]">
            ◉
          </span>
          カメラで撮る
        </button>
        <button
          type="button"
          className="btn btn-outline min-h-[112px] flex-col gap-1"
          onClick={() => libraryRef.current?.click()}
        >
          <span aria-hidden className="text-[1.5rem]">
            ▤
          </span>
          アルバムから選ぶ
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-mincho text-[1.0625rem] text-wine">
            選択中 {picked.length}/{MAX_FILES_PER_POST}
          </h2>
          {picked.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost min-h-[40px] px-2 text-[0.8125rem]"
              onClick={() => setPicked([])}
            >
              すべて外す
            </button>
          ) : null}
        </div>

        {picked.length === 0 ? (
          <Card className="px-5 py-8 text-center">
            <p className="hint">
              まだ写真が選ばれていません。カメラで撮るか、端末のアルバムから選んでください。
            </p>
          </Card>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {picked.map((file, index) => (
              <li key={`${file.name}-${index}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.thumb.dataUrl}
                  alt={file.name}
                  className="aspect-square w-full rounded-[10px] border border-line object-cover"
                />
                <button
                  type="button"
                  aria-label={`${file.name} を外す`}
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/65 text-[0.75rem] font-bold text-white"
                  onClick={() => setPicked((prev) => prev.filter((_, i) => i !== index))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {busy ? (
        <p className="hint mt-3">
          写真を最適化しています…
          {progress ? ` ${progress.done}/${progress.total}` : ""}
        </p>
      ) : null}

      <div className="fixed bottom-[4.75rem] left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={next}
          disabled={picked.length === 0 || busy}
        >
          次へ（コメントを書く）
        </button>
      </div>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </GuestShell>
  );
}

"use client";

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { resizeForUpload, type ResizedPhoto } from "@/lib/image-resize";

/* ============================================================
   開発用：画像最適化の実測ページ
   実機と同じコード（resizeForUpload）を走らせ、生成結果の
   画素数とバイト数を画面に出す。挙式前の画質確認に使う。
   ============================================================ */

export default function ResizeTestPage() {
  // 開発用の計測ページ。本番ビルドでは存在しないものとして扱う。
  if (process.env.NODE_ENV === "production") notFound();

  const [out, setOut] = useState<ResizedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 最近のスマホ写真に近い 4032x3024 のテスト画像を生成する
        const canvas = document.createElement("canvas");
        canvas.width = 4032;
        canvas.height = 3024;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas unavailable");

        const grad = ctx.createLinearGradient(0, 0, 4032, 3024);
        grad.addColorStop(0, "#9C2B4E");
        grad.addColorStop(1, "#38182A");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 4032, 3024);

        for (let i = 0; i < 1200; i += 1) {
          ctx.fillStyle = `rgba(255,255,255,${((i % 40) / 100).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc((i * 977) % 4032, (i * 1583) % 3024, (i % 60) + 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 200px sans-serif";
        ctx.fillText("SAMPLE 4032 x 3024", 240, 1560);

        const blob: Blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.92),
        );
        const file = new File([blob], "sample.jpg", { type: "image/jpeg" });
        setOut(await resizeForUpload(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const kb = (n: number) => `${Math.round(n / 1024)} KB`;

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-10">
      <h1 className="font-mincho text-[1.5rem] text-wine">画像最適化の実測</h1>
      <p className="hint mt-2">
        4032×3024 のテスト画像を resizeForUpload に通した結果です。
      </p>

      {error ? <p className="mt-6 text-danger">ERROR: {error}</p> : null}

      {out ? (
        <>
          <table className="mt-6 w-full border-collapse text-left text-[0.9375rem]">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2">種類</th>
                <th className="py-2">画素数</th>
                <th className="py-2">サイズ</th>
                <th className="py-2">削減率</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2 font-semibold">original</td>
                <td className="py-2">
                  {out.width} x {out.height}
                </td>
                <td className="py-2">{kb(out.bytes)}</td>
                <td className="py-2">-</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 font-semibold">display</td>
                <td className="py-2">
                  {out.display.width} x {out.display.height}
                </td>
                <td className="py-2">{kb(out.display.bytes)}</td>
                <td className="py-2">
                  {Math.round((1 - out.display.bytes / out.bytes) * 100)}%
                </td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 font-semibold">thumb</td>
                <td className="py-2">
                  {out.thumb.width} x {out.thumb.height}
                </td>
                <td className="py-2">{kb(out.thumb.bytes)}</td>
                <td className="py-2">
                  {Math.round((1 - out.thumb.bytes / out.bytes) * 100)}%
                </td>
              </tr>
            </tbody>
          </table>

          <p className="mt-6 font-semibold">RESULT display=1 thumb=1</p>

          <div className="mt-6 flex gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={out.display.dataUrl}
              alt="display"
              className="w-1/2 rounded-[10px] border border-line"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={out.thumb.dataUrl}
              alt="thumb"
              className="w-1/2 rounded-[10px] border border-line"
            />
          </div>
        </>
      ) : (
        <p className="mt-6">計測中…</p>
      )}
    </div>
  );
}

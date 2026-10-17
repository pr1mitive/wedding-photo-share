"use client";

import { MAX_UPLOAD_BYTES } from "./config";

/* ============================================================
   アップロード前の画像最適化

   原本をそのまま保存すると、アルバム一覧で500枚を読み込んだときに
   1GB超を転送してしまい「投稿から3秒以内」の要件を満たせない。
   そこで1枚から3種類を生成する。

     original … 端末の撮影データそのまま（非公開・管理者のみ）
     display  … 長辺1600px / JPEG品質0.82（アルバム・モニター用）
     thumb    … 長辺640px / JPEG品質0.72（一覧グリッド用）

   縮小のみ行い、元が小さい画像は拡大しない。
   ============================================================ */

export const DISPLAY_LONG_EDGE = 1600;
export const THUMB_LONG_EDGE = 640;
export const DISPLAY_QUALITY = 0.82;
export const THUMB_QUALITY = 0.72;

export interface Variant {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
}

export interface ResizedPhoto {
  name: string;
  mime: string;
  /** 原本のバイト数 */
  bytes: number;
  /** 原本の data URL（そのまま） */
  dataUrl: string;
  display: Variant;
  thumb: Variant;
  /** 原本の画素数 */
  width: number;
  height: number;
}

/** data URL に含まれる実バイト数を求める（base64 のパディングを考慮） */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

interface Drawable {
  source: CanvasImageSource;
  width: number;
  height: number;
  release?: () => void;
}

/** EXIF の回転情報を反映して読み込む（iPhone の縦写真が横倒しになるのを防ぐ） */
async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      /* 未対応ブラウザはフォールバックへ */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("画像として読み込めませんでした"));
      img.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function renderVariant(drawable: Drawable, longEdge: number, quality: number): Variant {
  const longest = Math.max(drawable.width, drawable.height);
  // 縮小のみ。元が小さい画像を引き伸ばすと画質が落ちるだけで意味がない。
  const scale = longest > 0 ? Math.min(1, longEdge / longest) : 1;
  const width = Math.max(1, Math.round(drawable.width * scale));
  const height = Math.max(1, Math.round(drawable.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像処理を開始できませんでした");

  // PNG 等の透過部分が JPEG で黒くならないよう白で下塗りする
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(drawable.source, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, bytes: dataUrlBytes(dataUrl), width, height };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}

/** 1枚の画像を最適化する */
export async function resizeForUpload(file: File): Promise<ResizedPhoto> {
  const original = await readAsDataUrl(file);
  const drawable = await loadDrawable(file);
  try {
    const display = renderVariant(drawable, DISPLAY_LONG_EDGE, DISPLAY_QUALITY);
    const thumb = renderVariant(drawable, THUMB_LONG_EDGE, THUMB_QUALITY);
    return {
      name: file.name,
      mime: file.type || "image/jpeg",
      bytes: file.size,
      dataUrl: original,
      display,
      thumb,
      width: drawable.width,
      height: drawable.height,
    };
  } finally {
    drawable.release?.();
  }
}

export interface ResizeOutcome {
  ok: ResizedPhoto[];
  failed: { name: string; reason: string }[];
}

/**
 * 複数枚をまとめて最適化する。
 * 種別・容量の検査もここで行い、呼び出し側を薄く保つ。
 */
export async function resizeMany(
  files: File[],
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<ResizeOutcome> {
  const ok: ResizedPhoto[] = [];
  const failed: { name: string; reason: string }[] = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);

    if (!file.type.startsWith("image/")) {
      failed.push({ name: file.name, reason: "画像ファイルではありません" });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      failed.push({
        name: file.name,
        reason: `1枚あたり${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MBを超えています`,
      });
      continue;
    }
    try {
      ok.push(await resizeForUpload(file));
    } catch (e) {
      failed.push({
        name: file.name,
        reason: e instanceof Error ? e.message : "読み込みに失敗しました",
      });
    }
  }

  onProgress?.(files.length, files.length, "");
  return { ok, failed };
}

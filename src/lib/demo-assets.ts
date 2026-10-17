/* ============================================================
   デモモード用のダミー写真生成
   Supabase を使わずに全画面をレビューできるよう、
   決定的なグラデーションSVGを data URL として生成する。
   ============================================================ */

const PALETTES: [string, string, string][] = [
  ["#9C2B4E", "#6E1E38", "#F8EEF2"],
  ["#38182A", "#6E1E38", "#E8D5DC"],
  ["#B8860B", "#6E1E38", "#FBF4E4"],
  ["#2F7A55", "#1F5A3D", "#EAF3EE"],
  ["#7D7773", "#38182A", "#F2EFEC"],
  ["#B3261E", "#6E1E38", "#FBEDEC"],
  ["#9C2B4E", "#B8860B", "#FFF6E8"],
  ["#6E1E38", "#2F7A55", "#EDF5F0"],
];

const LABELS = [
  "挙式前の控室",
  "チャペル前",
  "乾杯の瞬間",
  "ケーキ入刀",
  "友人スピーチ",
  "花束贈呈",
  "親族集合写真",
  "二次会の様子",
  "受付の様子",
  "テーブルラウンド",
  "新婦のドレス姿",
  "新郎のスピーチ",
];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 写真風のプレースホルダ画像を生成する。
 * 実際の写真と差し替えても表示ロジックは変わらない。
 */
export function demoPhoto(
  seed: string,
  index = 0,
  width = 1600,
  height = 1200,
): string {
  const h = hash(seed);
  const [c1, c2, c3] = PALETTES[h % PALETTES.length];
  const label = LABELS[(h + index) % LABELS.length];
  const bx = 12 + (h % 40);
  const by = 18 + ((h >> 3) % 30);
  const r = 14 + ((h >> 5) % 18);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${c1}"/><stop offset="55%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/>
</linearGradient>
<radialGradient id="v" cx="${bx + 30}%" cy="${by + 20}%" r="75%">
<stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
</radialGradient>
</defs>
<rect width="${width}" height="${height}" fill="url(#g)"/>
<rect width="${width}" height="${height}" fill="url(#v)"/>
<circle cx="${(width * bx) / 100}" cy="${(height * by) / 100}" r="${(height * r) / 100}" fill="#ffffff" fill-opacity="0.18"/>
<circle cx="${(width * (100 - bx)) / 100}" cy="${(height * (100 - by)) / 100}" r="${(height * r) / 160}" fill="#ffffff" fill-opacity="0.12"/>
<text x="50%" y="50%" text-anchor="middle" fill="#ffffff" fill-opacity="0.92" font-family="Hiragino Sans, Yu Gothic, sans-serif" font-size="${Math.round(height / 14)}" font-weight="600">${label}</text>
<text x="50%" y="${(height * 58) / 100}" text-anchor="middle" fill="#ffffff" fill-opacity="0.6" font-family="Hiragino Sans, sans-serif" font-size="${Math.round(height / 30)}">DEMO PHOTO</text>
</svg>`;

  return svgDataUrl(svg);
}

export function demoThumb(seed: string, index = 0): string {
  return demoPhoto(seed, index, 640, 480);
}

export function demoAvatar(seed: string, size = 96): string {
  const h = hash(seed);
  const [c1, c2] = PALETTES[h % PALETTES.length];
  const initial = ["あ", "か", "さ", "た", "な", "は", "ま", "や"][h % 8];
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
<rect width="${size}" height="${size}" rx="${size / 2}" fill="url(#a)"/>
<text x="50%" y="56%" text-anchor="middle" fill="#fff" font-family="Hiragino Mincho ProN, serif" font-size="${size * 0.44}">${initial}</text>
</svg>`,
  );
}

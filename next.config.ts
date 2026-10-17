import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 開発時のインジケータ（左下の黒丸バッジ）を非表示にして
  // 画面確認・スクリーンショットを実画面と同じ見た目にする
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    ],
  },
  experimental: {
    // ゲスト投稿は1リクエストあたり最大10枚。Server Action のボディ上限を確保する。
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;

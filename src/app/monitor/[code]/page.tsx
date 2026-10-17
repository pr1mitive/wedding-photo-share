"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonitorStage, type StageMode } from "@/components/monitor-stage";
import { usePolling, useRepo } from "@/lib/hooks";
import { setMonitorCodeHint } from "@/lib/repo/supabase";
import type {
  EventRow,
  MonitorDeviceRow,
  MonitorQueueRow,
  MonitorSettingsRow,
  PostWithDemoAssets,
} from "@/lib/types";

/** M-01〜M-04 会場モニター（1画面でモードを切り替える） */
export default function MonitorPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "MON-A1").toUpperCase();
  const repo = useRepo();
  // RPC は端末コードで本人確認するため、URL の値を引き渡す
  setMonitorCodeHint(code);

  const [device, setDevice] = useState<MonitorDeviceRow | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [settings, setSettings] = useState<MonitorSettingsRow | null>(null);
  const [queue, setQueue] = useState<MonitorQueueRow[]>([]);
  const [posts, setPosts] = useState<PostWithDemoAssets[]>([]);
  const [playing, setPlaying] = useState<MonitorQueueRow | null>(null);
  const [clock, setClock] = useState(new Date());
  /** 前景に大きく出す投稿（既定は最新。auto_play で新着に切り替わる） */
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  /** 新着投稿のお知らせ文言 */
  const [announce, setAnnounce] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);

  /* 端末の登録とハートビート */
  const loadDevice = useCallback(async () => {
    const found = await repo.getMonitorByCode(code);
    setDevice(found);
    if (!found) return;
    const ev = await repo.getEventById(found.event_id);
    setEvent(ev);
    setSettings(await repo.getMonitorSettings(found.event_id));
  }, [repo, code]);

  useEffect(() => {
    void loadDevice();
  }, [loadDevice]);

  /* データの定期取得（デモでも実機に近い追従性を確保） */
  const refresh = useCallback(async () => {
    if (!device) return;
    const [q, p] = await Promise.all([
      repo.listQueue(device.event_id, { states: ["queued", "playing"] }),
      repo.listPosts(device.event_id, { statuses: ["approved"], limit: 60 }),
    ]);
    setQueue(q);
    setPosts(p);
  }, [repo, device]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(() => {
    void refresh();
    if (device) void repo.heartbeat(device.id);
  }, 3000, Boolean(device));

  /* 時計 */
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  /* 新着の検出。
     auto_play が有効なときだけ、新しく届いた投稿を前景へ自動で出す。
     無効のときは管理画面から送信したものだけが大きく出る。
     初回読み込み時は「全部が新着」になってしまうため、通知せずに既読にする。 */
  useEffect(() => {
    if (posts.length === 0) return;
    const ids = posts.map((p) => p.id);
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(ids);
      setFeaturedId(ids[0] ?? null);
      return;
    }
    const seen = seenIdsRef.current;
    const fresh = ids.filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (fresh.length === 0 || !settings?.auto_play) return;
    setFeaturedId(fresh[0]);
    const posted = posts.find((p) => p.id === fresh[0]);
    setAnnounce(`${posted?.nickname_snapshot ?? "ゲスト"}さんが投稿しました`);
  }, [posts, settings?.auto_play]);

  /* お知らせは数秒で消す */
  useEffect(() => {
    if (!announce) return;
    const timer = setTimeout(() => setAnnounce(null), 8000);
    return () => clearTimeout(timer);
  }, [announce]);

  /* 再生キュー処理：1件ずつ large_seconds 表示して done にする */
  useEffect(() => {
    if (!device || !settings) return;
    if (playing) return;
    const next = queue.find((q) => q.state === "queued");
    if (!next) return;
    setPlaying(next);
    void repo.updateQueueState(next.id, "playing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, playing, device, settings]);

  useEffect(() => {
    if (!playing || !settings) return;
    const seconds = playing.kind === "zoom" ? 12 : settings.large_seconds;
    const timer = setTimeout(() => {
      void repo.updateQueueState(playing.id, "done");
      setPlaying(null);
    }, seconds * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, settings]);

  const currentPost = useMemo(() => {
    if (playing) return posts.find((p) => p.id === playing.post_id) ?? null;
    if (featuredId) return posts.find((p) => p.id === featuredId) ?? posts[0] ?? null;
    return posts[0] ?? null;
  }, [playing, posts, featuredId]);

  /* 表示モードの決定。
     ・管理画面から送信されたもの（playing）は従来どおり全画面で出す
     ・idle は待機画面
     ・それ以外はライブ表示。display_mode が mosaic なら
       「新着を大きく＋過去写真の壁」、slide なら1枚ずつの切替。
       壁は3列に分けるため、3枚未満のときは切替表示に落とす。 */
  const mode: StageMode = useMemo(() => {
    if (playing) return "large";
    if (!device) return "idle";
    if (device.mode === "idle") return "idle";
    const displayMode = settings?.display_mode ?? "mosaic";
    if (displayMode === "mosaic" && posts.length >= 4) return "mosaic";
    if (device.mode === "large" && posts[0]) return "large";
    return "background";
  }, [playing, device, posts, settings?.display_mode]);

  if (!device || !settings) {
    return (
      <div className="monitor-root flex items-center justify-center">
        <div className="text-center">
          <p className="font-mincho" style={{ fontSize: "4vh" }}>
            モニターを待機しています
          </p>
          <p className="mt-3 text-white/50" style={{ fontSize: "2.2vh" }}>
            端末コード：{code} を管理画面で登録してください
          </p>
        </div>
      </div>
    );
  }

  const dbg =
    typeof window !== "undefined" && window.location.search.includes("debug=1");

  return (
    <>
      {dbg ? (
        <pre
          style={{
            position: "fixed",
            zIndex: 999,
            left: 0,
            top: 0,
            margin: 0,
            padding: "4px",
            background: "#ff0",
            color: "#000",
            fontSize: "13px",
            lineHeight: 1.3,
          }}
        >
          {JSON.stringify({
            mode,
            postsN: posts.length,
            displayMode: settings?.display_mode ?? "(undefined→mosaic)",
            deviceMode: device?.mode ?? null,
            playingId: playing?.id ?? null,
            queueN: queue.length,
            settingsKeys: settings ? Object.keys(settings) : null,
          })}
        </pre>
      ) : null}
    <MonitorStage
      mode={mode}
      event={event}
      current={currentPost}
      zoomed={playing?.kind === "zoom"}
      backgroundPool={posts.slice(0, 12)}
      wallPool={posts}
      announce={announce}
      settings={settings}
      clock={clock}
    />
    </>
  );
}

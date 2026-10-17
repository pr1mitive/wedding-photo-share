"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
      repo.listPosts(device.event_id, { statuses: ["approved"], limit: 40 }),
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
    if (playing) {
      return posts.find((p) => p.id === playing.post_id) ?? null;
    }
    return posts[0] ?? null;
  }, [playing, posts]);

  const mode: StageMode = useMemo(() => {
    if (playing) return playing.kind === "zoom" ? "large" : "large";
    if (!device) return "idle";
    if (device.mode === "idle") return "idle";
    if (device.mode === "large" && posts[0]) return "large";
    return "background";
  }, [playing, device, posts]);

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

  return (
    <MonitorStage
      mode={mode}
      event={event}
      current={currentPost}
      zoomed={playing?.kind === "zoom"}
      backgroundPool={posts.slice(0, 12)}
      settings={settings}
      clock={clock}
    />
  );
}

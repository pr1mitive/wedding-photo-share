"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepo, type Repo } from "./repo";
import { loadGuestSession, saveGuestSession } from "./session";
import type { EventRow, GuestSession } from "./types";

export function useRepo(): Repo {
  return useMemo(() => getRepo(), []);
}

/** slug からイベントを読み込む */
export function useEvent(slug: string | undefined) {
  const repo = useRepo();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const found = await repo.getEventBySlug(slug);
      setEvent(found);
      setError(found ? null : "イベントが見つかりません");
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [repo, slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { event, loading, error, reload, repo };
}

/** id からイベントを読み込む（管理画面用） */
export function useEventById(eventId: string | undefined) {
  const repo = useRepo();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!eventId) return;
      const found = await repo.getEventById(eventId);
      if (alive) {
        setEvent(found);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [repo, eventId]);
  return { event, loading };
}

/** 端末に保存されたゲストセッション */
export function useGuestSession(slug: string | undefined) {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadGuestSession();
    setSession(loaded && (!slug || loaded.slug === slug) ? loaded : null);
    setReady(true);
  }, [slug]);

  const persist = useCallback((next: GuestSession) => {
    saveGuestSession(next);
    setSession(next);
  }, []);

  return { session, ready, persist };
}

/**
 * リアルタイム購読。topic が変わると callback が呼ばれる。
 * モニター画面・管理ダッシュボードで使用する。
 */
export function useRealtime(
  eventId: string | undefined,
  callback: (topic: string) => void,
) {
  const repo = useRepo();
  const cbRef = useMemo(() => ({ current: callback }), [callback]);
  cbRef.current = callback;

  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = repo.subscribe(eventId, (topic) => cbRef.current(topic));
    return unsubscribe;
  }, [repo, eventId]);
}

/** 一定間隔で再取得する（デモモードでもモニターが追従するように） */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const ref = useMemo(() => ({ current: callback }), [callback]);
  ref.current = callback;
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => ref.current(), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);
}

/** データ取得の定型（loading / error 付き） */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  initial: T,
) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useMemo(() => ({ current: loader }), [loader]);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    try {
      setError(null);
      const result = await loaderRef.current();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run };
}

/** File → data URL（投稿時にアダプタへ渡す共通形式） */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------
   G-03 → G-04 の受け渡し

   原本の data URL は1枚あたり数MBあり、10枚だと sessionStorage の
   上限（約5MB）を超えて保存に失敗する。そこで

     ・メモリ上の変数を一次置き場にする（通常の画面遷移はこれで足りる）
     ・sessionStorage には原本を除いた軽量版だけを退避し、
       リロードやカメラアプリからの復帰に備える

   という二段構えにする。
   ------------------------------------------------------------ */

export interface DraftFile {
  name: string;
  mime: string;
  bytes: number;
  /** 原本の data URL。退避から復元した場合は空になる */
  dataUrl: string;
  display: { dataUrl: string; bytes: number; width: number; height: number };
  thumb: { dataUrl: string; bytes: number; width: number; height: number };
  width: number;
  height: number;
  /** 原本を保持できているか。false のときは表示用画像で代替する */
  originalRetained: boolean;
}

export interface PostDraft {
  files: DraftFile[];
  comment: string;
}

const DRAFT_KEY = "wps.guest.draft.v2";
const MIRROR_BUDGET = 2_400_000;

let memoryDraft: PostDraft | null = null;

export function saveDraft(draft: PostDraft): void {
  memoryDraft = draft;
  try {
    const lean: PostDraft = {
      comment: draft.comment,
      files: draft.files.map((f) => ({ ...f, dataUrl: "" })),
    };
    const json = JSON.stringify(lean);
    if (json.length <= MIRROR_BUDGET) {
      window.sessionStorage.setItem(DRAFT_KEY, json);
    } else {
      window.sessionStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    /* 保存できなくてもメモリ上の下書きで動作を継続する */
  }
}

export function loadDraft(): PostDraft | null {
  if (memoryDraft) return memoryDraft;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const lean = JSON.parse(raw) as PostDraft;
    return {
      ...lean,
      files: lean.files.map((f) => ({ ...f, dataUrl: "", originalRetained: false })),
    };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  memoryDraft = null;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
}

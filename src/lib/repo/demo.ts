"use client";

import { CONSENT_VERSION } from "../config";
import { demoPhoto, demoThumb } from "../demo-assets";
import { joinCode, newId, shareToken } from "../ids";
import type {
  AdminUserRow,
  AlbumItemRow,
  AlbumRow,
  AuditLogRow,
  EventRow,
  GuestRow,
  MonitorDeviceRow,
  MonitorMode,
  MonitorQueueRow,
  MonitorSettingsRow,
  NotificationRow,
  PostAssetRow,
  PostStatus,
  PostWithDemoAssets,
  QueueKind,
  QueueState,
} from "../types";
import type { AuditInput, CreatePostInput, Repo, StatsSummary } from "./contract";

/* ============================================================
   デモモード実装
   ブラウザ内ストレージだけで全25画面が動作する。
   ・写真は data URL として保持（大きいものはプレースホルダに退避）
   ・複数タブ間は BroadcastChannel で同期（管理画面とモニターの同時確認用）
   ============================================================ */

const DB_KEY = "wps.demo.db.v2";
const MAX_INLINE_BYTES = 400 * 1024; // localStorage を圧迫しないための上限

interface DemoAsset extends PostAssetRow {
  url: string;
  thumbUrl: string;
}

interface DemoDb {
  events: EventRow[];
  guests: GuestRow[];
  posts: PostWithDemoAssets[];
  monitors: MonitorDeviceRow[];
  queue: MonitorQueueRow[];
  settings: MonitorSettingsRow[];
  albums: AlbumRow[];
  albumItems: AlbumItemRow[];
  admins: AdminUserRow[];
  audit: AuditLogRow[];
  notifications: NotificationRow[];
}

const DAY = 86400000;
const now = () => new Date().toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function seed(): DemoDb {
  const eventId = "evt-demo-0001";
  const event: EventRow = {
    id: eventId,
    slug: "sugimura-watari-2026",
    join_code: "WTR26A",
    title: "椙村・亘 結婚披露宴",
    couple_names: "椙村 渉 ・ 亘 美咲",
    venue_name: "ロサンジェルス バルコニー テラスレストラン＆ムーンバー",
    // 挙式日：2026年11月15日（固定）
    ceremony_date: "2026-11-15",
    status: "open",
    accept_uploads: true,
    post_approval_required: false,
    retention_days: 180,
    keep_originals: true,
    welcome_message:
      "本日はお越しいただきありがとうございます。\nふたりの門出を一緒に祝っていただけること、心より嬉しく思います。\nぜひ、あなたの目線で撮った写真を共有してください。",
    created_at: ago(30 * DAY),
    updated_at: ago(2 * DAY),
  };

  const guestNames = [
    "みさきの友人A",
    "わたるの同期",
    "大学の友達",
    "いとこ",
    "会社の先輩",
    "新郎の友人",
    "新婦の友人",
    "二次会幹事",
    "高校の同級生",
    "ご近所さん",
    "親族",
    "友人代表",
  ];

  const guests: GuestRow[] = guestNames.map((nickname, i) => ({
    id: `gst-demo-${String(i + 1).padStart(4, "0")}`,
    event_id: eventId,
    nickname,
    device_token: `token-demo-${i + 1}`,
    consent_version: CONSENT_VERSION,
    consented_at: ago((28 - i) * DAY),
    is_blocked: false,
    last_seen_at: ago(i * 3600000),
    created_at: ago((28 - i) * DAY),
  }));

  const comments = [
    "おめでとうございます！",
    "すてきな式でした🌸",
    "ケーキ入刀の瞬間です",
    "みんなで記念に",
    "スピーチ最高でした！",
    "ドレス姿がきれいでした",
    "二次会も盛り上がってます",
    "受付の様子です",
    "テーブルラウンドの1枚",
    "本当におめでとう！",
    "笑顔がすてき",
    "最後の集合写真です",
    "この瞬間が一番好きです",
    "末永くお幸せに",
  ];

  const posts: PostWithDemoAssets[] = comments.map((comment, i) => {
    const postId = `pst-demo-${String(i + 1).padStart(4, "0")}`;
    const guest = guests[i % guests.length];
    const assetCount = i % 5 === 0 ? 2 : 1;
    const assets: DemoAsset[] = Array.from({ length: assetCount }, (_, k) => {
      const assetId = `${postId}-a${k + 1}`;
      return {
        id: assetId,
        post_id: postId,
        storage_path: `originals/${eventId}/${postId}/${k + 1}.svg`,
        display_path: `display/${eventId}/${postId}/${k + 1}.svg`,
        thumb_path: `thumbs/${eventId}/${postId}/${k + 1}.svg`,
        width: 1600,
        height: 1200,
        bytes: 2_400_000,
        mime: "image/svg+xml",
        sort_order: k,
        created_at: ago((14 - i) * 3600000),
        url: demoPhoto(assetId, i + k),
        thumbUrl: demoThumb(assetId, i + k),
      };
    });
    const status: PostStatus =
      i === 11 ? "pending" : i === 9 ? "hidden" : "approved";
    return {
      id: postId,
      event_id: eventId,
      guest_id: guest.id,
      nickname_snapshot: guest.nickname,
      comment,
      status,
      moderation_note: status === "hidden" ? "本人の申告により非表示" : null,
      is_visible_in_album: status === "approved",
      posted_at: ago((14 - i) * 3600000),
      created_at: ago((14 - i) * 3600000),
      updated_at: ago((14 - i) * 3600000),
      assets,
    };
  });

  const monitor: MonitorDeviceRow = {
    id: "mon-demo-0001",
    event_id: eventId,
    name: "バンケット メインスクリーン",
    code: "MON-A1",
    resolution_w: 1920,
    resolution_h: 1080,
    mode: "background",
    is_online: true,
    last_heartbeat_at: now(),
    created_at: ago(30 * DAY),
  };

  const album: AlbumRow = {
    id: "alb-demo-0001",
    event_id: eventId,
    title: "2026.11.15 椙村・亘 結婚式",
    description: "当日みんなで撮った写真をまとめました。",
    cover_asset_id: posts[3].assets[0].id,
    visibility: "guest",
    share_token: shareToken(),
    published_at: null,
    created_at: ago(10 * DAY),
    updated_at: ago(1 * DAY),
  };

  const albumItems: AlbumItemRow[] = posts
    .filter((p) => p.status === "approved")
    .slice(0, 6)
    .map((p, i) => ({
      id: `alb-item-${i + 1}`,
      album_id: album.id,
      asset_id: p.assets[0].id,
      sort_order: i,
      caption: "",
      added_at: ago(DAY),
    }));

  const admins: AdminUserRow[] = [
    {
      id: "adm-demo-0001",
      event_id: eventId,
      email: "owner@example.com",
      display_name: "椙村 渉",
      role: "owner",
      is_active: true,
      last_login_at: ago(3600000),
      created_at: ago(30 * DAY),
    },
    {
      id: "adm-demo-0002",
      event_id: eventId,
      email: "planner@example.com",
      display_name: "プランナー 山本",
      role: "operator",
      is_active: true,
      last_login_at: ago(7200000),
      created_at: ago(25 * DAY),
    },
    {
      id: "adm-demo-0003",
      event_id: eventId,
      email: "photo@example.com",
      display_name: "撮影スタッフ",
      role: "viewer",
      is_active: false,
      last_login_at: null,
      created_at: ago(20 * DAY),
    },
  ];

  const audit: AuditLogRow[] = [
    {
      id: newId(),
      event_id: eventId,
      actor_type: "admin",
      actor_id: admins[0].id,
      actor_label: "椙村 渉",
      action: "event.update",
      target_type: "event",
      target_id: eventId,
      detail: { field: "welcome_message" },
      ip: "203.0.113.10",
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)",
      created_at: ago(2 * DAY),
    },
    {
      id: newId(),
      event_id: eventId,
      actor_type: "guest",
      actor_id: guests[9].id,
      actor_label: guests[9].nickname,
      action: "guest.block",
      target_type: "guest",
      target_id: guests[9].id,
      detail: { reason: "迷惑投稿のため" },
      ip: "203.0.113.42",
      user_agent: "Mozilla/5.0 (Android 15)",
      created_at: ago(1 * DAY),
    },
    {
      id: newId(),
      event_id: eventId,
      actor_type: "admin",
      actor_id: admins[1].id,
      actor_label: "プランナー 山本",
      action: "post.hide",
      target_type: "post",
      target_id: posts[9].id,
      detail: { from: "approved", to: "hidden" },
      ip: "203.0.113.20",
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      created_at: ago(3600000 * 5),
    },
  ];

  return {
    events: [event],
    guests,
    posts,
    monitors: [monitor],
    queue: [],
    settings: [
      {
        id: "set-demo-0001",
        event_id: eventId,
        monitor_id: null,
        large_seconds: 5,
        background_seconds: 8,
        safe_area_percent: 5,
        show_nickname: true,
        show_comment: true,
        auto_play: true,
        updated_at: ago(DAY),
      },
    ],
    albums: [album],
    albumItems,
    admins,
    audit,
    notifications: [
      {
        id: newId(),
        event_id: eventId,
        channel: "email",
        kind: "album.ready",
        payload: { to: "owner@example.com" },
        state: "scheduled",
        scheduled_at: new Date(Date.now() + 7 * DAY).toISOString(),
        sent_at: null,
        error: null,
        created_at: ago(DAY),
      },
    ],
  };
}

/* ---------- ストレージ読み書き ---------- */

let cache: DemoDb | null = null;

function read(): DemoDb {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      cache = JSON.parse(raw) as DemoDb;
      return cache;
    }
  } catch {
    /* 壊れていたら再シードする */
  }
  cache = seed();
  write(cache);
  return cache;
}

function write(db: DemoDb): void {
  cache = db;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // 容量超過時は写真の data URL を落として再試行する
    const lean: DemoDb = {
      ...db,
      posts: db.posts.map((p) => ({
        ...p,
        assets: p.assets.map((a) => ({ ...a, url: "", thumbUrl: "" })),
      })),
    };
    cache = lean;
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify(lean));
    } catch {
      /* 保存できなくてもメモリ上の状態で動作を継続する */
    }
  }
}

export function resetDemoDb(): void {
  cache = null;
  try {
    window.localStorage.removeItem(DB_KEY);
  } catch {
    /* noop */
  }
}

/* ---------- リアルタイム（同一タブ＋タブ間） ---------- */

const CHANNEL = "wps.demo.channel";
let bc: BroadcastChannel | null = null;

function bus(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!bc) bc = new BroadcastChannel(CHANNEL);
  return bc;
}

function emit(eventId: string, topic: string): void {
  bus()?.postMessage({ eventId, topic });
}

/* ---------- 実装 ---------- */

export class DemoRepo implements Repo {
  readonly kind = "demo" as const;

  private db(): DemoDb {
    return read();
  }

  private save(): void {
    write(cache as DemoDb);
  }

  private touch(eventId: string, topic: string): void {
    this.save();
    emit(eventId, topic);
  }

  async getEventBySlug(slug: string): Promise<EventRow | null> {
    return this.db().events.find((e) => e.slug === slug) ?? null;
  }
  async getEventById(id: string): Promise<EventRow | null> {
    return this.db().events.find((e) => e.id === id) ?? null;
  }
  async listEvents(): Promise<EventRow[]> {
    return [...this.db().events];
  }
  async updateEvent(id: string, patch: Partial<EventRow>): Promise<EventRow> {
    const db = this.db();
    const idx = db.events.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error("イベントが見つかりません");
    db.events[idx] = { ...db.events[idx], ...patch, updated_at: now() };
    this.touch(id, "event");
    return db.events[idx];
  }

  async registerGuest(input: {
    eventId: string;
    nickname: string;
    deviceToken: string;
    consentVersion: string;
  }): Promise<GuestRow> {
    const db = this.db();
    const existing = db.guests.find(
      (g) => g.event_id === input.eventId && g.device_token === input.deviceToken,
    );
    if (existing) {
      existing.nickname = input.nickname;
      existing.last_seen_at = now();
      this.touch(input.eventId, "guests");
      return existing;
    }
    const row: GuestRow = {
      id: newId(),
      event_id: input.eventId,
      nickname: input.nickname,
      device_token: input.deviceToken,
      consent_version: input.consentVersion,
      consented_at: now(),
      is_blocked: false,
      last_seen_at: now(),
      created_at: now(),
    };
    db.guests.push(row);
    this.touch(input.eventId, "guests");
    return row;
  }

  async getGuestByToken(eventId: string, deviceToken: string): Promise<GuestRow | null> {
    return (
      this.db().guests.find(
        (g) => g.event_id === eventId && g.device_token === deviceToken,
      ) ?? null
    );
  }

  async listGuests(eventId: string): Promise<GuestRow[]> {
    return this.db()
      .guests.filter((g) => g.event_id === eventId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async setGuestBlocked(guestId: string, blocked: boolean): Promise<void> {
    const db = this.db();
    const g = db.guests.find((x) => x.id === guestId);
    if (!g) return;
    g.is_blocked = blocked;
    this.touch(g.event_id, "guests");
  }

  async createPost(input: CreatePostInput): Promise<PostWithDemoAssets> {
    const db = this.db();
    const event = db.events.find((e) => e.id === input.eventId);
    const postId = newId();
    const createdAt = now();
    const assets: DemoAsset[] = input.files.map((file, i) => {
      const assetId = newId();
      // デモはブラウザ内ストレージに保存するため、サムネイルだけを保持する。
      // （表示用まで持つと10枚で数MBになり保存に失敗する）
      const inline = file.thumb.bytes <= MAX_INLINE_BYTES;
      const thumbUrl = inline ? file.thumb.dataUrl : demoThumb(assetId, i);
      return {
        id: assetId,
        post_id: postId,
        storage_path: `originals/${input.eventId}/${postId}/${i + 1}-${file.name}`,
        display_path: `display/${input.eventId}/${postId}/${i + 1}.jpg`,
        thumb_path: `thumbs/${input.eventId}/${postId}/${i + 1}.jpg`,
        width: file.display.width || file.width,
        height: file.display.height || file.height,
        bytes: file.bytes,
        mime: file.mime,
        sort_order: i,
        created_at: createdAt,
        url: inline ? file.display.dataUrl : thumbUrl,
        thumbUrl,
      };
    });

    const status: PostStatus = event?.post_approval_required ? "pending" : "approved";
    const post: PostWithDemoAssets = {
      id: postId,
      event_id: input.eventId,
      guest_id: input.guestId,
      nickname_snapshot: input.nickname,
      comment: input.comment,
      status,
      moderation_note: null,
      is_visible_in_album: status === "approved",
      posted_at: createdAt,
      created_at: createdAt,
      updated_at: createdAt,
      assets,
    };
    db.posts.unshift(post);
    this.touch(input.eventId, "posts");
    return post;
  }

  async listPosts(
    eventId: string,
    options?: {
      statuses?: PostStatus[];
      guestId?: string;
      deviceToken?: string;
      limit?: number;
    },
  ): Promise<PostWithDemoAssets[]> {
    let rows = this.db().posts.filter((p) => p.event_id === eventId);
    if (options?.statuses?.length) {
      rows = rows.filter((p) => options.statuses!.includes(p.status));
    }
    if (options?.guestId) rows = rows.filter((p) => p.guest_id === options.guestId);
    if (options?.deviceToken) {
      const own = new Set(
        this.db()
          .guests.filter((g) => g.device_token === options.deviceToken)
          .map((g) => g.id),
      );
      rows = rows.filter((p) => own.has(p.guest_id));
    }
    rows = rows.sort((a, b) => (a.posted_at < b.posted_at ? 1 : -1));
    return options?.limit ? rows.slice(0, options.limit) : rows;
  }

  async getPost(postId: string): Promise<PostWithDemoAssets | null> {
    return this.db().posts.find((p) => p.id === postId) ?? null;
  }

  async updatePostStatus(
    postId: string,
    status: PostStatus,
    note?: string | null,
  ): Promise<void> {
    const db = this.db();
    const p = db.posts.find((x) => x.id === postId);
    if (!p) return;
    p.status = status;
    p.moderation_note = note ?? p.moderation_note;
    p.is_visible_in_album = status === "approved";
    p.updated_at = now();
    this.touch(p.event_id, "posts");
  }

  async setAlbumVisibility(postId: string, visible: boolean): Promise<void> {
    const db = this.db();
    const p = db.posts.find((x) => x.id === postId);
    if (!p) return;
    p.is_visible_in_album = visible;
    p.updated_at = now();
    this.touch(p.event_id, "posts");
  }

  async requestPostDelete(
    postId: string,
    _deviceToken: string,
    reason: string,
  ): Promise<boolean> {
    const db = this.db();
    const p = db.posts.find((x) => x.id === postId);
    if (!p) return false;
    p.status = "hidden";
    p.is_visible_in_album = false;
    p.moderation_note = `削除依頼: ${reason}`;
    p.updated_at = now();
    this.touch(p.event_id, "posts");
    return true;
  }

  async removePost(postId: string): Promise<void> {
    const db = this.db();
    const idx = db.posts.findIndex((p) => p.id === postId);
    if (idx < 0) return;
    const eventId = db.posts[idx].event_id;
    const assetIds = db.posts[idx].assets.map((a) => a.id);
    db.posts.splice(idx, 1);
    db.albumItems = db.albumItems.filter((i) => !assetIds.includes(i.asset_id));
    this.touch(eventId, "posts");
  }

  async listMonitors(eventId: string): Promise<MonitorDeviceRow[]> {
    return this.db().monitors.filter((m) => m.event_id === eventId);
  }

  async getMonitorByCode(code: string): Promise<MonitorDeviceRow | null> {
    return this.db().monitors.find((m) => m.code === code) ?? null;
  }

  async setMonitorMode(monitorId: string, mode: MonitorMode): Promise<void> {
    const db = this.db();
    const m = db.monitors.find((x) => x.id === monitorId);
    if (!m) return;
    m.mode = mode;
    m.last_heartbeat_at = now();
    this.touch(m.event_id, "monitor");
  }

  async heartbeat(monitorId: string): Promise<void> {
    const db = this.db();
    const m = db.monitors.find((x) => x.id === monitorId);
    if (!m) return;
    m.last_heartbeat_at = now();
    m.is_online = true;
    this.save();
  }

  async enqueue(input: {
    eventId: string;
    monitorId: string | null;
    postId: string;
    kind: QueueKind;
    requestedBy?: string | null;
  }): Promise<MonitorQueueRow> {
    const db = this.db();
    const row: MonitorQueueRow = {
      id: newId(),
      event_id: input.eventId,
      monitor_id: input.monitorId,
      post_id: input.postId,
      kind: input.kind,
      state: "queued",
      priority: input.kind === "zoom" ? 10 : input.kind === "large" ? 5 : 1,
      requested_by: input.requestedBy ?? null,
      requested_at: now(),
      started_at: null,
      finished_at: null,
    };
    db.queue.push(row);
    this.touch(input.eventId, "queue");
    return row;
  }

  async listQueue(
    eventId: string,
    options?: { states?: QueueState[]; limit?: number },
  ): Promise<MonitorQueueRow[]> {
    let rows = this.db().queue.filter((q) => q.event_id === eventId);
    if (options?.states?.length) {
      rows = rows.filter((q) => options.states!.includes(q.state));
    }
    rows = rows.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.requested_at < b.requested_at ? -1 : 1;
    });
    return options?.limit ? rows.slice(0, options.limit) : rows;
  }

  async updateQueueState(id: string, state: QueueState): Promise<void> {
    const db = this.db();
    const q = db.queue.find((x) => x.id === id);
    if (!q) return;
    q.state = state;
    if (state === "playing") q.started_at = now();
    if (state === "done" || state === "skipped") q.finished_at = now();
    this.touch(q.event_id, "queue");
  }

  async clearQueue(eventId: string): Promise<void> {
    const db = this.db();
    db.queue = db.queue.filter(
      (q) => q.event_id !== eventId || q.state === "playing",
    );
    this.touch(eventId, "queue");
  }

  async getMonitorSettings(eventId: string): Promise<MonitorSettingsRow> {
    const db = this.db();
    const found = db.settings.find((s) => s.event_id === eventId);
    if (found) return found;
    const created: MonitorSettingsRow = {
      id: newId(),
      event_id: eventId,
      monitor_id: null,
      large_seconds: 5,
      background_seconds: 8,
      safe_area_percent: 5,
      show_nickname: true,
      show_comment: true,
      auto_play: true,
      updated_at: now(),
    };
    db.settings.push(created);
    this.save();
    return created;
  }

  async updateMonitorSettings(
    eventId: string,
    patch: Partial<MonitorSettingsRow>,
  ): Promise<MonitorSettingsRow> {
    const current = await this.getMonitorSettings(eventId);
    const db = this.db();
    const idx = db.settings.findIndex((s) => s.id === current.id);
    db.settings[idx] = { ...current, ...patch, updated_at: now() };
    this.touch(eventId, "settings");
    return db.settings[idx];
  }

  async listAlbums(eventId: string): Promise<AlbumRow[]> {
    return this.db().albums.filter((a) => a.event_id === eventId);
  }
  async getAlbum(albumId: string): Promise<AlbumRow | null> {
    return this.db().albums.find((a) => a.id === albumId) ?? null;
  }
  async getAlbumByToken(token: string): Promise<AlbumRow | null> {
    return this.db().albums.find((a) => a.share_token === token) ?? null;
  }
  async createAlbum(eventId: string, title: string): Promise<AlbumRow> {
    const db = this.db();
    const row: AlbumRow = {
      id: newId(),
      event_id: eventId,
      title,
      description: "",
      cover_asset_id: null,
      visibility: "private",
      share_token: shareToken(),
      published_at: null,
      created_at: now(),
      updated_at: now(),
    };
    db.albums.push(row);
    this.touch(eventId, "albums");
    return row;
  }
  async updateAlbum(albumId: string, patch: Partial<AlbumRow>): Promise<AlbumRow> {
    const db = this.db();
    const idx = db.albums.findIndex((a) => a.id === albumId);
    if (idx < 0) throw new Error("アルバムが見つかりません");
    db.albums[idx] = { ...db.albums[idx], ...patch, updated_at: now() };
    this.touch(db.albums[idx].event_id, "albums");
    return db.albums[idx];
  }
  async listAlbumItems(albumId: string): Promise<AlbumItemRow[]> {
    return this.db()
      .albumItems.filter((i) => i.album_id === albumId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
  async addAlbumItems(albumId: string, assetIds: string[]): Promise<void> {
    const db = this.db();
    const base = db.albumItems.filter((i) => i.album_id === albumId).length;
    assetIds.forEach((assetId, i) => {
      if (db.albumItems.some((x) => x.album_id === albumId && x.asset_id === assetId))
        return;
      db.albumItems.push({
        id: newId(),
        album_id: albumId,
        asset_id: assetId,
        sort_order: base + i,
        caption: "",
        added_at: now(),
      });
    });
    const album = db.albums.find((a) => a.id === albumId);
    this.touch(album?.event_id ?? "", "albums");
  }
  async removeAlbumItem(itemId: string): Promise<void> {
    const db = this.db();
    const item = db.albumItems.find((i) => i.id === itemId);
    db.albumItems = db.albumItems.filter((i) => i.id !== itemId);
    const album = db.albums.find((a) => a.id === item?.album_id);
    this.touch(album?.event_id ?? "", "albums");
  }
  async reorderAlbumItems(albumId: string, orderedIds: string[]): Promise<void> {
    const db = this.db();
    orderedIds.forEach((id, index) => {
      const item = db.albumItems.find((i) => i.id === id && i.album_id === albumId);
      if (item) item.sort_order = index;
    });
    const album = db.albums.find((a) => a.id === albumId);
    this.touch(album?.event_id ?? "", "albums");
  }

  async listAdmins(eventId: string): Promise<AdminUserRow[]> {
    return this.db().admins.filter((a) => a.event_id === eventId);
  }

  async listAuditLogs(eventId: string, limit = 200): Promise<AuditLogRow[]> {
    return this.db()
      .audit.filter((a) => a.event_id === eventId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }

  async log(input: AuditInput): Promise<void> {
    const db = this.db();
    db.audit.unshift({
      id: newId(),
      event_id: input.eventId,
      actor_type: input.actorType,
      actor_id: input.actorId,
      actor_label: input.actorLabel,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      detail: input.detail ?? null,
      ip: null,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : null,
      created_at: now(),
    });
    db.audit = db.audit.slice(0, 500);
    this.touch(input.eventId ?? "", "audit");
  }

  async listNotifications(eventId: string): Promise<NotificationRow[]> {
    return this.db().notifications.filter((n) => n.event_id === eventId);
  }

  async stats(eventId: string): Promise<StatsSummary> {
    const db = this.db();
    const posts = db.posts.filter((p) => p.event_id === eventId);
    const assets = posts.flatMap((p) => p.assets);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return {
      posts: posts.length,
      approved: posts.filter((p) => p.status === "approved").length,
      pending: posts.filter((p) => p.status === "pending").length,
      hidden: posts.filter((p) => p.status === "hidden").length,
      guests: db.guests.filter((g) => g.event_id === eventId).length,
      assets: assets.length,
      bytes: assets.reduce((sum, a) => sum + a.bytes, 0),
      today: posts.filter((p) => new Date(p.posted_at) >= startOfToday).length,
    };
  }

  subscribe(eventId: string, onChange: (topic: string) => void): () => void {
    const channel = bus();
    const handler = (e: MessageEvent) => {
      const data = e.data as { eventId: string; topic: string };
      if (data?.eventId === eventId) onChange(data.topic);
    };
    channel?.addEventListener("message", handler);
    return () => channel?.removeEventListener("message", handler);
  }
}

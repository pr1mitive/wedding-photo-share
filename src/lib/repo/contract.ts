import type {
  AlbumItemRow,
  AlbumRow,
  AuditLogRow,
  EventRow,
  GuestRow,
  MonitorDeviceRow,
  MonitorQueueRow,
  MonitorSettingsRow,
  MonitorMode,
  NotificationRow,
  PostAssetRow,
  PostStatus,
  PostWithDemoAssets,
  QueueKind,
  QueueState,
} from "../types";

/* ============================================================
   データアクセス層の契約
   demo（ブラウザ内ストレージ）と supabase（本番）が同じ実装を持つ。
   画面側はこのインターフェースにのみ依存する。
   ============================================================ */

export interface UploadVariant {
  /** クライアントで生成した data URL */
  dataUrl: string;
  /** data URL から算出した実バイト数 */
  bytes: number;
  width: number;
  height: number;
}

export interface UploadFile {
  name: string;
  /** 原本の MIME タイプ */
  mime: string;
  /** 原本のバイト数 */
  bytes: number;
  /** 原本の data URL（リロード後は空になることがある） */
  dataUrl: string;
  /** 表示用（長辺1600px / JPEG） */
  display: UploadVariant;
  /** サムネイル（長辺640px / JPEG） */
  thumb: UploadVariant;
  /** 原本の画素数 */
  width: number;
  height: number;
}

export interface CreatePostInput {
  eventId: string;
  guestId: string;
  /** 本人確認に使う端末トークン（RLS を経由せず RPC で検証する） */
  deviceToken: string;
  nickname: string;
  comment: string;
  files: UploadFile[];
}

export interface StatsSummary {
  posts: number;
  approved: number;
  pending: number;
  hidden: number;
  guests: number;
  assets: number;
  bytes: number;
  today: number;
}

export interface AuditInput {
  eventId: string | null;
  actorType: AuditLogRow["actor_type"];
  actorId: string | null;
  actorLabel: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
}

export interface Repo {
  readonly kind: "demo" | "supabase";

  /* ---- イベント ---- */
  getEventBySlug(slug: string): Promise<EventRow | null>;
  getEventById(id: string): Promise<EventRow | null>;
  listEvents(): Promise<EventRow[]>;
  updateEvent(id: string, patch: Partial<EventRow>): Promise<EventRow>;

  /* ---- ゲスト ---- */
  registerGuest(input: {
    eventId: string;
    nickname: string;
    deviceToken: string;
    consentVersion: string;
  }): Promise<GuestRow>;
  getGuestByToken(eventId: string, deviceToken: string): Promise<GuestRow | null>;
  listGuests(eventId: string): Promise<GuestRow[]>;
  setGuestBlocked(guestId: string, blocked: boolean): Promise<void>;

  /* ---- 投稿 ---- */
  createPost(input: CreatePostInput): Promise<PostWithDemoAssets>;
  listPosts(
    eventId: string,
    options?: {
      statuses?: PostStatus[];
      guestId?: string;
      /** 指定するとその端末の投稿だけを返す（ゲスト用・RPC 経由） */
      deviceToken?: string;
      limit?: number;
    },
  ): Promise<PostWithDemoAssets[]>;
  getPost(postId: string): Promise<PostWithDemoAssets | null>;
  updatePostStatus(
    postId: string,
    status: PostStatus,
    note?: string | null,
  ): Promise<void>;
  setAlbumVisibility(postId: string, visible: boolean): Promise<void>;
  /** ゲスト本人による削除依頼 */
  requestPostDelete(
    postId: string,
    deviceToken: string,
    reason: string,
  ): Promise<boolean>;
  removePost(postId: string): Promise<void>;

  /* ---- モニター ---- */
  listMonitors(eventId: string): Promise<MonitorDeviceRow[]>;
  getMonitorByCode(code: string): Promise<MonitorDeviceRow | null>;
  setMonitorMode(monitorId: string, mode: MonitorMode): Promise<void>;
  heartbeat(monitorId: string): Promise<void>;
  enqueue(input: {
    eventId: string;
    monitorId: string | null;
    postId: string;
    kind: QueueKind;
    requestedBy?: string | null;
  }): Promise<MonitorQueueRow>;
  listQueue(
    eventId: string,
    options?: { states?: QueueState[]; limit?: number },
  ): Promise<MonitorQueueRow[]>;
  updateQueueState(id: string, state: QueueState): Promise<void>;
  clearQueue(eventId: string): Promise<void>;
  getMonitorSettings(eventId: string): Promise<MonitorSettingsRow>;
  updateMonitorSettings(
    eventId: string,
    patch: Partial<MonitorSettingsRow>,
  ): Promise<MonitorSettingsRow>;

  /* ---- アルバム ---- */
  listAlbums(eventId: string): Promise<AlbumRow[]>;
  getAlbum(albumId: string): Promise<AlbumRow | null>;
  getAlbumByToken(token: string): Promise<AlbumRow | null>;
  createAlbum(eventId: string, title: string): Promise<AlbumRow>;
  updateAlbum(albumId: string, patch: Partial<AlbumRow>): Promise<AlbumRow>;
  listAlbumItems(albumId: string): Promise<AlbumItemRow[]>;
  addAlbumItems(albumId: string, assetIds: string[]): Promise<void>;
  removeAlbumItem(itemId: string): Promise<void>;
  reorderAlbumItems(albumId: string, orderedIds: string[]): Promise<void>;

  /* ---- 管理者・監査・統計 ---- */
  listAdmins(eventId: string): Promise<import("../types").AdminUserRow[]>;
  listAuditLogs(eventId: string, limit?: number): Promise<AuditLogRow[]>;
  log(input: AuditInput): Promise<void>;
  listNotifications(eventId: string): Promise<NotificationRow[]>;
  stats(eventId: string): Promise<StatsSummary>;

  /* ---- リアルタイム ---- */
  /** 投稿・キュー・モニター状態の変更を購読する。戻り値は解除関数 */
  subscribe(eventId: string, onChange: (topic: string) => void): () => void;
}

export type { PostAssetRow };

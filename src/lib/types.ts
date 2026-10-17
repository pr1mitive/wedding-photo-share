/* ============================================================
   ドメイン型定義
   基本設計書のDB 12テーブルに対応する。
   ============================================================ */

export type EventStatus = "draft" | "open" | "closed" | "archived";
export type PostStatus = "pending" | "approved" | "hidden" | "deleted";
export type MonitorMode = "idle" | "large" | "background";
export type QueueKind = "large" | "background" | "zoom";
export type QueueState = "queued" | "playing" | "done" | "skipped";
export type AdminRole = "owner" | "operator" | "viewer";
export type AlbumVisibility = "private" | "guest" | "public";
export type ActorType = "guest" | "admin" | "system";

export interface EventRow {
  id: string;
  slug: string;
  join_code: string;
  title: string;
  couple_names: string;
  venue_name: string;
  ceremony_date: string; // YYYY-MM-DD
  status: EventStatus;
  accept_uploads: boolean;
  post_approval_required: boolean;
  retention_days: number;
  keep_originals: boolean;
  welcome_message: string;
  created_at: string;
  updated_at: string;
}

export interface GuestRow {
  id: string;
  event_id: string;
  nickname: string;
  device_token: string;
  consent_version: string;
  consented_at: string;
  is_blocked: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface PostRow {
  id: string;
  event_id: string;
  guest_id: string;
  nickname_snapshot: string;
  comment: string;
  status: PostStatus;
  moderation_note: string | null;
  is_visible_in_album: boolean;
  posted_at: string;
  created_at: string;
  updated_at: string;
}

export interface PostAssetRow {
  id: string;
  post_id: string;
  /** 原本の保存先（非公開バケット）。原本を保管しない場合は空 */
  storage_path: string;
  /** 表示用画像の保存先（公開バケット） */
  display_path: string;
  /** サムネイルの保存先（公開バケット） */
  thumb_path: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
  sort_order: number;
  created_at: string;
}

export interface MonitorDeviceRow {
  id: string;
  event_id: string;
  name: string;
  code: string;
  resolution_w: number;
  resolution_h: number;
  mode: MonitorMode;
  is_online: boolean;
  last_heartbeat_at: string;
  created_at: string;
}

export interface MonitorQueueRow {
  id: string;
  event_id: string;
  monitor_id: string | null;
  post_id: string;
  kind: QueueKind;
  state: QueueState;
  priority: number;
  requested_by: string | null;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface MonitorSettingsRow {
  id: string;
  event_id: string;
  monitor_id: string | null;
  large_seconds: number;
  background_seconds: number;
  safe_area_percent: number;
  show_nickname: boolean;
  show_comment: boolean;
  auto_play: boolean;
  updated_at: string;
}

export interface AlbumRow {
  id: string;
  event_id: string;
  title: string;
  description: string;
  cover_asset_id: string | null;
  visibility: AlbumVisibility;
  share_token: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlbumItemRow {
  id: string;
  album_id: string;
  asset_id: string;
  sort_order: number;
  caption: string;
  added_at: string;
}

export interface AdminUserRow {
  id: string;
  event_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  event_id: string | null;
  actor_type: ActorType;
  actor_id: string | null;
  actor_label: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  event_id: string;
  channel: "email" | "line" | "webhook";
  kind: string;
  payload: Record<string, unknown> | null;
  state: "scheduled" | "sent" | "failed";
  scheduled_at: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

/* ---------- 画面で使う合成ビュー ---------- */

/** 投稿＋アセット（ゲスト/管理/モニターで共通に使う表示単位） */
export interface PostWithAssets extends PostRow {
  assets: PostAssetRow[];
}

/** ゲストのセッション（端末ローカルに保持） */
export interface GuestSession {
  guestId: string;
  eventId: string;
  slug: string;
  nickname: string;
  deviceToken: string;
  consentedAt: string;
}

/** デモモードの写真は data URL / 生成SVG で表現する */
export interface DemoAsset extends PostAssetRow {
  /** 表示用の解決済みURL（Supabaseでは署名付きURL、デモでは data URL） */
  url: string;
  thumbUrl: string;
}

export interface PostWithDemoAssets extends PostRow {
  assets: DemoAsset[];
}

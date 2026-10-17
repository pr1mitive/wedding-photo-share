"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONSENT_VERSION, SUPABASE_CLIENT_KEY, SUPABASE_URL } from "../config";
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
  PostStatus,
  PostWithDemoAssets,
  QueueKind,
  QueueState,
} from "../types";
import type { AuditInput, CreatePostInput, Repo, StatsSummary } from "./contract";

/* ============================================================
   Supabase 本番実装
   ブラウザの anon キー（管理者は Auth ログイン後）で動作し、
   権限制御はすべて RLS に委ねる。
   写真は Storage の thumbs / display バケットから公開URLで読む。
   ============================================================ */

const THUMB_BUCKET = "thumbs";
const DISPLAY_BUCKET = "display";
const ORIGINAL_BUCKET = "originals";

// モニター端末は URL の端末コードで識別する。
// 画面から渡される値で都度上書きされるため、既定値は控えめに持つ。
let MONITOR_CODE_HINT = "MON-A1";

export function setMonitorCodeHint(code: string): void {
  MONITOR_CODE_HINT = code.toUpperCase();
}

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_CLIENT_KEY) {
      throw new Error(
        "Supabase が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を設定してください。",
      );
    }
    client = createClient(SUPABASE_URL, SUPABASE_CLIENT_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

function publicUrl(bucket: string, path: string): string {
  if (!path) return "";
  const { data } = supabaseBrowser().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

type Row = Record<string, unknown>;

function mapPost(row: Row): PostWithDemoAssets {
  const assets = ((row.post_assets as Row[]) ?? []).map((a) => ({
    id: String(a.id),
    post_id: String(a.post_id),
    storage_path: String(a.storage_path ?? ""),
    display_path: String(a.display_path ?? ""),
    thumb_path: String(a.thumb_path ?? ""),
    width: Number(a.width ?? 0),
    height: Number(a.height ?? 0),
    bytes: Number(a.bytes ?? 0),
    mime: String(a.mime ?? "image/jpeg"),
    sort_order: Number(a.sort_order ?? 0),
    created_at: String(a.created_at ?? ""),
    url: publicUrl(DISPLAY_BUCKET, String(a.display_path ?? a.storage_path ?? "")),
    thumbUrl: publicUrl(THUMB_BUCKET, String(a.thumb_path ?? "")),
  }));
  assets.sort((a, b) => a.sort_order - b.sort_order);
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    guest_id: String(row.guest_id ?? ""),
    nickname_snapshot: String(row.nickname_snapshot ?? "ゲスト"),
    comment: String(row.comment ?? ""),
    status: row.status as PostStatus,
    moderation_note: (row.moderation_note as string | null) ?? null,
    is_visible_in_album: Boolean(row.is_visible_in_album),
    posted_at: String(row.posted_at ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    assets,
  };
}

export class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  private sb = supabaseBrowser();

  /**
   * security definer 関数の呼び出し。
   * ゲスト・モニターはログインしないため、RLS ではなく
   * 関数内の本人確認（device_token / 端末コード）で保護する。
   */
  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  }

  /** RPC が返す { post, assets } を画面用の形へ変換する */
  private mapRpcPost(payload: { post: Row; assets: Row[] } | null) {
    if (!payload?.post) throw new Error("投稿の作成に失敗しました");
    return mapPost({ ...payload.post, post_assets: payload.assets ?? [] });
  }

  private async one<T>(table: string, column: string, value: string): Promise<T | null> {
    const { data, error } = await this.sb
      .from(table)
      .select("*")
      .eq(column, value)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as T) ?? null;
  }

  async getEventBySlug(slug: string): Promise<EventRow | null> {
    return this.one<EventRow>("events", "slug", slug);
  }
  async getEventById(id: string): Promise<EventRow | null> {
    return this.one<EventRow>("events", "id", id);
  }
  async listEvents(): Promise<EventRow[]> {
    const { data, error } = await this.sb
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as EventRow[]) ?? [];
  }
  async updateEvent(id: string, patch: Partial<EventRow>): Promise<EventRow> {
    const { data, error } = await this.sb
      .from("events")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as EventRow;
  }

  async registerGuest(input: {
    eventId: string;
    nickname: string;
    deviceToken: string;
    consentVersion: string;
  }): Promise<GuestRow> {
    const data = await this.call<GuestRow | null>("register_guest", {
      p_event_id: input.eventId,
      p_nickname: input.nickname,
      p_device_token: input.deviceToken,
      p_consent_version: input.consentVersion,
    });
    if (!data) throw new Error("参加登録に失敗しました");
    return data;
  }

  async getGuestByToken(eventId: string, deviceToken: string): Promise<GuestRow | null> {
    return this.call<GuestRow | null>("get_guest", {
      p_event_id: eventId,
      p_device_token: deviceToken,
    });
  }
  async listGuests(eventId: string): Promise<GuestRow[]> {
    const { data, error } = await this.sb
      .from("guests")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as GuestRow[]) ?? [];
  }
  async setGuestBlocked(guestId: string, blocked: boolean): Promise<void> {
    const { error } = await this.sb
      .from("guests")
      .update({ is_blocked: blocked })
      .eq("id", guestId);
    if (error) throw new Error(error.message);
  }

  async createPost(input: CreatePostInput): Promise<PostWithDemoAssets> {
    // ここで posts に行を作ってはいけない。
    // 投稿の作成は create_guest_post（RPC）が行うため、両方で作ると
    // 「画像なしの投稿」が1件余分に生まれる（実際にこの不具合が出た）。
    //
    // この UUID は Storage のフォルダ名にだけ使う。
    const uploadFolder = newId();

    const event = await this.getEventById(input.eventId);
    const keyFor = (i: number) => `${input.eventId}/${uploadFolder}/${i + 1}.jpg`;
    const assets: Row[] = [];

    for (let i = 0; i < input.files.length; i += 1) {
      const file = input.files[i];
      const key = keyFor(i);

      // アップロード先は投稿ごとに新規UUIDで作るため、既存オブジェクトと
      // 衝突しない。したがって upsert は使わない。
      //
      // upsert は「既存行との衝突判定」のために対象行を読む必要があり、
      // 非公開の originals バケット（anon に SELECT 権限を与えていない）では
      // RLS 違反になる。実測でも originals のみ 403 になった。
      const put = async (bucket: string, body: Blob, contentType: string) => {
        const { error } = await this.sb.storage
          .from(bucket)
          .upload(key, body, { contentType });
        // 万一の再送で既に存在する場合は成功として扱う
        if (error && !/already exists|duplicate/i.test(error.message)) {
          throw new Error(error.message);
        }
      };

      // 原本：保管する設定のときだけ保存する（非公開バケット）
      if (event?.keep_originals) {
        await put(ORIGINAL_BUCKET, dataUrlToBlob(file.dataUrl || file.display.dataUrl), file.mime);
      }
      // 表示用：アルバムとモニターが参照する（公開バケット）
      await put(DISPLAY_BUCKET, dataUrlToBlob(file.display.dataUrl), "image/jpeg");
      // サムネイル：一覧グリッド用（公開バケット）
      await put(THUMB_BUCKET, dataUrlToBlob(file.thumb.dataUrl), "image/jpeg");

      assets.push({
        storage_path: event?.keep_originals ? key : "",
        display_path: key,
        thumb_path: key,
        width: file.display.width || file.width,
        height: file.display.height || file.height,
        bytes: file.bytes,
        mime: file.mime,
        sort_order: i,
      });
    }

    // DB 登録は RPC に集約する。受付停止・ブロック済みゲストの検証と
    // 承認要否の判定をサーバー側で行い、確定した投稿をそのまま受け取る。
    const payload = await this.call<{ post: Row; assets: Row[] }>("create_guest_post", {
      p_event_id: input.eventId,
      p_device_token: input.deviceToken,
      p_comment: input.comment,
      p_assets: assets,
    });
    return this.mapRpcPost(payload);
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
    // 自分の投稿は RPC 経由（保留中の投稿は RLS では読めないため）
    if (options?.deviceToken) {
      const rows = await this.call<Row[]>("list_guest_posts", {
        p_event_id: eventId,
        p_device_token: options.deviceToken,
      });
      let list = (rows ?? []).map((row) =>
        mapPost({ ...row, post_assets: (row.assets as Row[]) ?? [] }),
      );
      if (options.statuses?.length) {
        list = list.filter((p) => options.statuses!.includes(p.status));
      }
      return options.limit ? list.slice(0, options.limit) : list;
    }

    let query = this.sb
      .from("posts")
      .select("*, post_assets(*)")
      .eq("event_id", eventId)
      .order("posted_at", { ascending: false });
    if (options?.statuses?.length) query = query.in("status", options.statuses);
    if (options?.guestId) query = query.eq("guest_id", options.guestId);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data as Row[]) ?? []).map(mapPost);
  }

  async getPost(postId: string): Promise<PostWithDemoAssets | null> {
    const { data, error } = await this.sb
      .from("posts")
      .select("*, post_assets(*)")
      .eq("id", postId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapPost(data as Row) : null;
  }

  async updatePostStatus(
    postId: string,
    status: PostStatus,
    note?: string | null,
  ): Promise<void> {
    const { error } = await this.sb
      .from("posts")
      .update({
        status,
        moderation_note: note ?? null,
        is_visible_in_album: status === "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    if (error) throw new Error(error.message);
  }

  async setAlbumVisibility(postId: string, visible: boolean): Promise<void> {
    const { error } = await this.sb
      .from("posts")
      .update({ is_visible_in_album: visible })
      .eq("id", postId);
    if (error) throw new Error(error.message);
  }

  async requestPostDelete(
    postId: string,
    deviceToken: string,
    reason: string,
  ): Promise<boolean> {
    return this.call<boolean>("request_post_delete", {
      p_post_id: postId,
      p_device_token: deviceToken,
      p_reason: reason,
    });
  }

  async removePost(postId: string): Promise<void> {
    // 先に Storage のオブジェクトを片付けてから行を消す（孤児ファイルを残さない）
    const { data: assets } = await this.sb
      .from("post_assets")
      .select("storage_path, display_path, thumb_path")
      .eq("post_id", postId);
    const drop = async (bucket: string, key: string) => {
      if (!key) return;
      await this.sb.storage.from(bucket).remove([key]);
    };
    for (const row of ((assets as Row[] | null) ?? [])) {
      await drop(ORIGINAL_BUCKET, String(row.storage_path ?? ""));
      await drop(DISPLAY_BUCKET, String(row.display_path ?? ""));
      await drop(THUMB_BUCKET, String(row.thumb_path ?? ""));
    }
    const { error } = await this.sb.from("posts").delete().eq("id", postId);
    if (error) throw new Error(error.message);
  }

  async listMonitors(eventId: string): Promise<MonitorDeviceRow[]> {
    const { data, error } = await this.sb
      .from("monitor_devices")
      .select("*")
      .eq("event_id", eventId);
    if (error) throw new Error(error.message);
    return (data as MonitorDeviceRow[]) ?? [];
  }
  async getMonitorByCode(code: string): Promise<MonitorDeviceRow | null> {
    return this.one<MonitorDeviceRow>("monitor_devices", "code", code);
  }
  async setMonitorMode(monitorId: string, mode: MonitorMode): Promise<void> {
    const { error } = await this.sb
      .from("monitor_devices")
      .update({ mode, last_heartbeat_at: new Date().toISOString() })
      .eq("id", monitorId);
    if (error) throw new Error(error.message);
  }
  async heartbeat(monitorId: string): Promise<void> {
    // 端末コードで RPC を呼ぶ。id しか持たない場合は何もしない。
    const code = await this.monitorCode(monitorId);
    if (!code) return;
    await this.sb.rpc("monitor_heartbeat", { p_code: code });
  }

  /** 端末 id からコードを引く（ハートビート用の小さなキャッシュ付き） */
  private codeCache = new Map<string, string>();
  private async monitorCode(monitorId: string): Promise<string | null> {
    const cached = this.codeCache.get(monitorId);
    if (cached) return cached;
    const { data } = await this.sb
      .from("monitor_devices")
      .select("code")
      .eq("id", monitorId)
      .maybeSingle();
    const code = (data as { code?: string } | null)?.code;
    if (code) this.codeCache.set(monitorId, code);
    return code ?? null;
  }
  async enqueue(input: {
    eventId: string;
    monitorId: string | null;
    postId: string;
    kind: QueueKind;
    requestedBy?: string | null;
  }): Promise<MonitorQueueRow> {
    const { data, error } = await this.sb
      .from("monitor_queue")
      .insert({
        event_id: input.eventId,
        monitor_id: input.monitorId,
        post_id: input.postId,
        kind: input.kind,
        priority: input.kind === "zoom" ? 10 : input.kind === "large" ? 5 : 1,
        requested_by: input.requestedBy ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as MonitorQueueRow;
  }
  async listQueue(
    eventId: string,
    options?: { states?: QueueState[]; limit?: number },
  ): Promise<MonitorQueueRow[]> {
    let query = this.sb
      .from("monitor_queue")
      .select("*")
      .eq("event_id", eventId)
      .order("priority", { ascending: false })
      .order("requested_at", { ascending: true });
    if (options?.states?.length) query = query.in("state", options.states);
    if (options?.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as MonitorQueueRow[]) ?? [];
  }
  async updateQueueState(id: string, state: QueueState): Promise<void> {
    // モニター端末（未ログイン）からも呼べるよう RPC を使う。
    // 管理画面（ログイン済み）は RLS 経由でも更新できる。
    const { error } = await this.sb.rpc("monitor_update_queue", {
      p_code: MONITOR_CODE_HINT,
      p_queue_id: id,
      p_state: state,
    });
    if (!error) return;
    const patch: Row = { state };
    if (state === "playing") patch.started_at = new Date().toISOString();
    if (state === "done" || state === "skipped")
      patch.finished_at = new Date().toISOString();
    const fallback = await this.sb.from("monitor_queue").update(patch).eq("id", id);
    if (fallback.error) throw new Error(fallback.error.message);
  }
  async clearQueue(eventId: string): Promise<void> {
    const { error } = await this.sb
      .from("monitor_queue")
      .update({ state: "skipped", finished_at: new Date().toISOString() })
      .eq("event_id", eventId)
      .eq("state", "queued");
    if (error) throw new Error(error.message);
  }
  async getMonitorSettings(eventId: string): Promise<MonitorSettingsRow> {
    const { data, error } = await this.sb
      .from("monitor_settings")
      .select("*")
      .eq("event_id", eventId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as MonitorSettingsRow;
    const { data: created, error: createError } = await this.sb
      .from("monitor_settings")
      .insert({ event_id: eventId })
      .select("*")
      .single();
    if (createError) throw new Error(createError.message);
    return created as MonitorSettingsRow;
  }
  async updateMonitorSettings(
    eventId: string,
    patch: Partial<MonitorSettingsRow>,
  ): Promise<MonitorSettingsRow> {
    const current = await this.getMonitorSettings(eventId);
    const { data, error } = await this.sb
      .from("monitor_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as MonitorSettingsRow;
  }

  async listAlbums(eventId: string): Promise<AlbumRow[]> {
    const { data, error } = await this.sb
      .from("albums")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as AlbumRow[]) ?? [];
  }
  async getAlbum(albumId: string): Promise<AlbumRow | null> {
    return this.one<AlbumRow>("albums", "id", albumId);
  }
  async getAlbumByToken(token: string): Promise<AlbumRow | null> {
    return this.one<AlbumRow>("albums", "share_token", token);
  }
  async createAlbum(eventId: string, title: string): Promise<AlbumRow> {
    const { data, error } = await this.sb
      .from("albums")
      .insert({ event_id: eventId, title, share_token: shareToken() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as AlbumRow;
  }
  async updateAlbum(albumId: string, patch: Partial<AlbumRow>): Promise<AlbumRow> {
    const { data, error } = await this.sb
      .from("albums")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", albumId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as AlbumRow;
  }
  async listAlbumItems(albumId: string): Promise<AlbumItemRow[]> {
    const { data, error } = await this.sb
      .from("album_items")
      .select("*")
      .eq("album_id", albumId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as AlbumItemRow[]) ?? [];
  }
  async addAlbumItems(albumId: string, assetIds: string[]): Promise<void> {
    const existing = await this.listAlbumItems(albumId);
    const rows = assetIds
      .filter((id) => !existing.some((e) => e.asset_id === id))
      .map((assetId, i) => ({
        album_id: albumId,
        asset_id: assetId,
        sort_order: existing.length + i,
      }));
    if (rows.length === 0) return;
    const { error } = await this.sb.from("album_items").insert(rows);
    if (error) throw new Error(error.message);
  }
  async removeAlbumItem(itemId: string): Promise<void> {
    const { error } = await this.sb.from("album_items").delete().eq("id", itemId);
    if (error) throw new Error(error.message);
  }
  async reorderAlbumItems(albumId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await this.sb
        .from("album_items")
        .update({ sort_order: i })
        .eq("id", orderedIds[i])
        .eq("album_id", albumId);
    }
  }

  async listAdmins(eventId: string): Promise<AdminUserRow[]> {
    const { data, error } = await this.sb
      .from("admin_users")
      .select("*")
      .eq("event_id", eventId);
    if (error) throw new Error(error.message);
    return (data as AdminUserRow[]) ?? [];
  }

  async listAuditLogs(eventId: string, limit = 200): Promise<AuditLogRow[]> {
    const { data, error } = await this.sb
      .from("audit_logs")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data as AuditLogRow[]) ?? [];
  }

  async log(input: AuditInput): Promise<void> {
    await this.sb.from("audit_logs").insert({
      event_id: input.eventId,
      actor_type: input.actorType,
      actor_id: input.actorId,
      actor_label: input.actorLabel,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      detail: input.detail ?? null,
    });
  }

  async listNotifications(eventId: string): Promise<NotificationRow[]> {
    const { data, error } = await this.sb
      .from("notifications")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as NotificationRow[]) ?? [];
  }

  async stats(eventId: string): Promise<StatsSummary> {
    const posts = await this.listPosts(eventId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const assets = posts.flatMap((p) => p.assets);
    const guests = await this.listGuests(eventId);
    return {
      posts: posts.length,
      approved: posts.filter((p) => p.status === "approved").length,
      pending: posts.filter((p) => p.status === "pending").length,
      hidden: posts.filter((p) => p.status === "hidden").length,
      guests: guests.length,
      assets: assets.length,
      bytes: assets.reduce((sum, a) => sum + a.bytes, 0),
      today: posts.filter((p) => new Date(p.posted_at) >= startOfToday).length,
    };
  }

  subscribe(eventId: string, onChange: (topic: string) => void): () => void {
    const channel = this.sb
      .channel(`event-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `event_id=eq.${eventId}` },
        () => onChange("posts"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monitor_queue",
          filter: `event_id=eq.${eventId}`,
        },
        () => onChange("queue"),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monitor_devices",
          filter: `event_id=eq.${eventId}`,
        },
        () => onChange("monitor"),
      )
      .subscribe();
    return () => {
      void this.sb.removeChannel(channel);
    };
  }
}

/** 本番モードでも使えるよう、ダミー画像のフォールバックを再輸出する */
export { demoPhoto, demoThumb, joinCode, shareToken, CONSENT_VERSION };

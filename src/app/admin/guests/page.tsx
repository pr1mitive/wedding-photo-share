"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, EmptyState, Loading, SectionTitle, StatusChip, Toast, useToast } from "@/components/ui";
import { formatBytes, formatDateTime, relativeTime } from "@/lib/format";
import { useRepo } from "@/lib/hooks";
import type { AdminUserRow, EventRow, GuestRow, PostWithDemoAssets } from "@/lib/types";

/** A-10 管理 ゲスト管理 */
export default function AdminGuestsPage() {
  const repo = useRepo();
  const { toast, show } = useToast();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [posts, setPosts] = useState<PostWithDemoAssets[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const events = await repo.listEvents();
    const ev = events[0] ?? null;
    setEvent(ev);
    if (ev) {
      const [g, a, p] = await Promise.all([
        repo.listGuests(ev.id),
        repo.listAdmins(ev.id),
        repo.listPosts(ev.id),
      ]);
      setGuests(g);
      setAdmins(a);
      setPosts(p);
    }
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleBlock(guest: GuestRow) {
    if (!event) return;
    await repo.setGuestBlocked(guest.id, !guest.is_blocked);
    await repo.log({
      eventId: event.id,
      actorType: "admin",
      actorId: null,
      actorLabel: "管理者",
      action: guest.is_blocked ? "guest.unblock" : "guest.block",
      targetType: "guest",
      targetId: guest.id,
      detail: { nickname: guest.nickname },
    });
    show(guest.is_blocked ? "ブロックを解除しました" : "ブロックしました", "success");
    await load();
  }

  if (loading) return <Loading />;

  return (
    <AdminShell
      event={event}
      title="ゲスト管理"
      description={`参加 ${guests.length}名 ・ 管理者 ${admins.length}名`}
    >
      <SectionTitle title="参加ゲスト" description="投稿状況と最終アクセスを確認できます" />
      {guests.length === 0 ? (
        <EmptyState title="まだ参加者がいません" description="QRコードを案内してください。" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[0.875rem]">
            <thead className="bg-surface text-[0.75rem] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">ニックネーム</th>
                <th className="px-4 py-3">投稿数</th>
                <th className="px-4 py-3">容量</th>
                <th className="px-4 py-3">最終アクセス</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {guests.map((guest) => {
                const own = posts.filter((p) => p.guest_id === guest.id);
                const bytes = own.reduce(
                  (sum, p) => sum + p.assets.reduce((s, a) => s + a.bytes, 0),
                  0,
                );
                return (
                  <tr key={guest.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{guest.nickname}</p>
                      <p className="hint">同意 {formatDateTime(guest.consented_at)}</p>
                    </td>
                    <td className="px-4 py-3">{own.length}件</td>
                    <td className="px-4 py-3">{formatBytes(bytes)}</td>
                    <td className="px-4 py-3 text-muted">
                      {relativeTime(guest.last_seen_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={guest.is_blocked ? "hidden" : "approved"} />
                      {guest.is_blocked ? (
                        <p className="hint mt-1">ブロック中</p>
                      ) : (
                        <p className="hint mt-1">正常</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className={
                          guest.is_blocked
                            ? "btn btn-outline min-h-[36px] px-3 text-[0.75rem]"
                            : "btn btn-danger min-h-[36px] px-3 text-[0.75rem]"
                        }
                        onClick={() => void toggleBlock(guest)}
                      >
                        {guest.is_blocked ? "解除" : "ブロック"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <SectionTitle
        title="管理者アカウント"
        description="owner / operator / viewer の3段階の権限"
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[0.875rem]">
          <thead className="bg-surface text-[0.75rem] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">氏名</th>
              <th className="px-4 py-3">メールアドレス</th>
              <th className="px-4 py-3">権限</th>
              <th className="px-4 py-3">最終ログイン</th>
              <th className="px-4 py-3">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {admins.map((admin) => (
              <tr key={admin.id}>
                <td className="px-4 py-3 font-semibold">{admin.display_name}</td>
                <td className="px-4 py-3 text-muted">{admin.email}</td>
                <td className="px-4 py-3">
                  <span className="chip chip-primary">{admin.role}</span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {admin.last_login_at ? formatDateTime(admin.last_login_at) : "未ログイン"}
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={admin.is_active ? "approved" : "hidden"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Toast message={toast?.message ?? null} tone={toast?.tone} />
    </AdminShell>
  );
}

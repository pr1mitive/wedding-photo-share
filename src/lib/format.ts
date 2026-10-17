/** 表示用フォーマッタ */

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "-";
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${Math.max(sec, 0)}秒前`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分前`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}時間前`;
  return `${Math.round(hour / 24)}日前`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** 「残り 1日 4時間」のような残り時間表記 */
export function remainingLabel(untilIso: string | null | undefined): string {
  if (!untilIso) return "-";
  const diff = new Date(untilIso).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return "終了";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}日 ${hours}時間`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}時間 ${mins}分`;
}

/** 保持期限の満了日を投稿日時から算出する（既定180日） */
export function retentionExpiry(postedAtIso: string, retentionDays: number): string {
  const d = new Date(postedAtIso);
  d.setDate(d.getDate() + retentionDays);
  return d.toISOString();
}
